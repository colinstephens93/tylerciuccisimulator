// Breakable street furniture (hydrants, mailboxes, trash cans, cones, news boxes), drawn with
// one InstancedMesh per type. Hit one and it goes flying, spills coins, and later reappears.
import * as THREE from 'three';
import { propGeometries, vertexToon } from '../engine/models.js';
import { seeded } from '../engine/util.js';
import { vert } from '../map/graph.js';

const BUSY = new Set(['primary', 'primary_link', 'secondary', 'tertiary', 'trunk', 'trunk_link']);
const RESPAWN = 25;
const GRAVITY = 26;
const CELL = 16;

export class Props {
  constructor(scene, map, colliders, roadGrid, spacing = 26) {
    this.defs = propGeometries();
    this.kinds = Object.keys(this.defs);
    this.items = [];
    this.grid = new Map();
    this.active = new Set(); // flying or knocked over
    const rand = seeded(7);

    for (const r of map.roads) {
      if (r.t === 'service') continue;
      const pool = BUSY.has(r.t) ? ['hydrant', 'newsbox', 'trash', 'cone', 'hydrant'] : ['mailbox', 'mailbox', 'trash', 'hydrant'];
      for (let i = 0; i < r.v.length - 1; i++) {
        const [ax, az] = vert(map, r.v[i]);
        const [bx, bz] = vert(map, r.v[i + 1]);
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 8) continue;
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        for (let d = 4 + rand() * spacing; d < len - 4; d += spacing * (0.7 + rand() * 0.6)) {
          const side = rand() < 0.5 ? -1 : 1;
          const off = r.w / 2 + 1.5;
          const x = ax + ((bx - ax) * d) / len + nx * off * side;
          const z = az + ((bz - az) * d) / len + nz * off * side;
          if (colliders.blocked(x, z, 0.8) || roadGrid.edgeDistance(x, z, 10) < 0.6) continue;
          const kind = pool[Math.floor(rand() * pool.length)];
          this.add(kind, x, z, Math.atan2(nx * side, nz * side));
        }
      }
    }

    this.meshes = {};
    const counts = {};
    for (const it of this.items) counts[it.kind] = (counts[it.kind] || 0) + 1;
    for (const k of this.kinds) {
      const im = new THREE.InstancedMesh(this.defs[k].geo, vertexToon, Math.max(1, counts[k] || 0));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; // instances spread over the whole map and fly around
      im.count = counts[k] || 0;
      this.meshes[k] = im;
      scene.add(im);
    }
    const idx = {};
    for (const it of this.items) {
      it.slot = idx[it.kind] = (idx[it.kind] ?? -1) + 1;
      this.write(it);
    }
  }

  add(kind, x, z, rot) {
    const it = { kind, x, z, rot, hx: x, hz: z, hrot: rot, y: 0, vx: 0, vy: 0, vz: 0, tilt: 0, tiltAxis: 0, spin: 0, state: 'idle', t: 0, r: 0 };
    it.r = 0.5;
    this.items.push(it);
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(it);
  }

  // Props currently near (x, z), standing or knocked over.
  near(x, z, r) {
    const out = [];
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const list = this.grid.get(`${cx},${cz}`);
        if (list) for (const it of list) if (it.state === 'idle' && Math.hypot(it.x - x, it.z - z) < r + it.r) out.push(it);
      }
    }
    return out;
  }

  // Send a prop flying with velocity (vx, vz).
  smash(it, vx, vz) {
    it.state = 'fly';
    it.vx = vx * (0.9 + Math.random() * 0.4) + (Math.random() - 0.5) * 3;
    it.vz = vz * (0.9 + Math.random() * 0.4) + (Math.random() - 0.5) * 3;
    it.vy = 5 + Math.min(10, Math.hypot(vx, vz) * 0.35);
    it.spin = (Math.random() - 0.5) * 18;
    it.tiltAxis = Math.random() * Math.PI * 2;
    this.active.add(it);
  }

  update(dt, px, pz) {
    for (const it of this.active) {
      if (it.state === 'fly') {
        it.vy -= GRAVITY * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.z += it.vz * dt;
        it.tilt += it.spin * dt;
        if (it.y <= 0 && it.vy < 0) {
          it.y = 0;
          if (it.vy < -6) {
            it.vy *= -0.35;
            it.vx *= 0.5;
            it.vz *= 0.5;
            it.spin *= 0.5;
          } else {
            it.state = 'down';
            it.tilt = Math.PI / 2;
            it.t = RESPAWN;
          }
        }
        this.write(it);
      } else if (it.state === 'down') {
        it.t -= dt;
        if (it.t <= 0 && Math.hypot(it.hx - px, it.hz - pz) > 70) {
          Object.assign(it, { x: it.hx, z: it.hz, rot: it.hrot, y: 0, tilt: 0, state: 'idle' });
          this.write(it);
          this.active.delete(it);
        }
      }
    }
  }

  write(it) {
    const m = this.meshes?.[it.kind];
    if (!m) return;
    _q.setFromAxisAngle(_up, it.rot);
    if (it.tilt) {
      _axis.set(Math.cos(it.tiltAxis), 0, Math.sin(it.tiltAxis));
      _q2.setFromAxisAngle(_axis, it.tilt);
      _q.premultiply(_q2);
    }
    _m.compose(_p.set(it.x, it.y, it.z), _q, _s);
    m.setMatrixAt(it.slot, _m);
    m.instanceMatrix.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1.25, 1.25, 1.25);
const _up = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
