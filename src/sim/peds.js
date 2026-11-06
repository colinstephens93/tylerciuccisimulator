// Pedestrians strolling the sidewalks. They dive out of the way of speeding cars and go
// flying (cartoon style, no gore) when they don't make it, then dust themselves off.
import { makePedestrian } from '../engine/models.js';
import { angleLerp } from '../engine/util.js';
import { edgePose, nextEdge, nodeInRing } from './roadnet.js';

const SPAWN_MIN = 35;
const SPAWN_MAX = 130;
const DESPAWN = 170;
const GRAVITY = 26;

export class Peds {
  constructor(scene, net, count, colliders) {
    this.scene = scene;
    this.net = net;
    this.count = count;
    this.colliders = colliders;
    this.list = [];
    this.timer = 0;
  }

  spawn(px, pz) {
    const node = nodeInRing(this.net, px, pz, SPAWN_MIN, SPAWN_MAX);
    if (node < 0) return;
    const edges = this.net.out[node];
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const side = Math.random() < 0.5 ? 1 : -1;
    const lat = side * (edge.road.w / 2 + 1.3);
    const pose = edgePose(this.net, edge, 0, lat);
    if (this.colliders.blocked(pose.x, pose.z, 0.6)) return;
    const model = makePedestrian();
    this.scene.add(model);
    this.list.push({
      model, rig: model.userData.rig, edge, d: 0, side, state: 'walk', t: 0,
      x: pose.x, z: pose.z, y: 0, vx: 0, vy: 0, vz: 0, heading: pose.heading,
      speed: 1.3 + Math.random() * 0.7,
    });
  }

  // A driver thrown out of their car: lands near (x, z), then walks off on the nearest sidewalk.
  eject(x, z, vx, vz) {
    const node = nodeInRing(this.net, x, z, 0, 60);
    if (node < 0) return null;
    const edge = this.net.out[node][0];
    const model = makePedestrian();
    this.scene.add(model);
    const p = {
      model, rig: model.userData.rig, edge, d: 0, side: 1, state: 'walk', t: 0,
      x, z, y: 0, vx: 0, vy: 0, vz: 0, heading: 0, speed: 3,
    };
    this.list.push(p);
    this.launch(p, vx, vz, 7);
    return p;
  }

  remove(p) {
    p.model.removeFromParent();
    this.list.splice(this.list.indexOf(p), 1);
  }

  clear() {
    for (const p of [...this.list]) this.remove(p);
  }

  // Knock a pedestrian flying with velocity (vx, vz).
  launch(p, vx, vz, up = 8) {
    p.state = 'fly';
    p.vx = vx;
    p.vz = vz;
    p.vy = up;
    p.y = Math.max(p.y, 0.2);
  }

  // threats: [{ x, z, vx, vz }] fast-moving cars to dodge.
  update(dt, px, pz, threats) {
    this.timer -= dt;
    if (this.list.length < this.count && this.timer <= 0) {
      this.timer = 0.2;
      this.spawn(px, pz);
    }
    for (const p of [...this.list]) {
      if (Math.hypot(p.x - px, p.z - pz) > DESPAWN && p.state === 'walk') { this.remove(p); continue; }
      this.step(p, dt, threats);
    }
  }

  step(p, dt, threats) {
    p.t -= dt;
    if (p.state === 'fly') {
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const res = this.colliders.resolveCircle(p.x, p.z, 0.5);
      if (res.hit) {
        p.x = res.x; p.z = res.z;
        const vn = p.vx * res.nx + p.vz * res.nz;
        if (vn < 0) { p.vx -= 1.6 * vn * res.nx; p.vz -= 1.6 * vn * res.nz; } // cartoon wall bounce
      }
      if (p.y <= 0 && p.vy < 0) {
        p.y = 0;
        if (p.vy < -7) {
          p.vy *= -0.38;
          p.vx *= 0.6;
          p.vz *= 0.6;
          p.rig.land(1);
        } else {
          p.state = 'down';
          p.t = 2.2;
          p.rig.land(0.6);
        }
      }
      this.sync(p, dt, 'fly');
      return;
    }
    if (p.state === 'down') {
      if (p.t <= 0) {
        // Back up, a bit dazed, and off they go (faster).
        p.state = 'walk';
        p.speed = 3;
        p.rig.hop();
      }
      this.sync(p, dt, 'down');
      return;
    }

    // Dodge: a fast car heading our way makes us dive aside.
    if (p.state === 'walk') {
      for (const c of threats) {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const sp = Math.hypot(c.vx, c.vz);
        if (d < 14 && sp > 9 && (dx * c.vx + dz * c.vz) / (d * sp) > 0.7) {
          const sx = -c.vz / sp;
          const sz = c.vx / sp;
          const s = sx * dx + sz * dz > 0 ? 1 : -1;
          p.state = 'panic';
          p.t = 0.9;
          p.vx = sx * s * 8;
          p.vz = sz * s * 8;
          p.vy = 4;
          p.rig.hop();
          break;
        }
      }
    }

    if (p.state === 'panic') {
      p.vy -= GRAVITY * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const res = this.colliders.resolveCircle(p.x, p.z, 0.5);
      if (res.hit) { p.x = res.x; p.z = res.z; }
      p.heading = angleLerp(p.heading, Math.atan2(p.vx, p.vz), Math.min(1, dt * 10));
      if (p.t <= 0) p.state = 'walk';
      this.sync(p, dt, 'panic', 8);
      return;
    }

    // Walking along the sidewalk.
    p.speed += (1.6 - p.speed) * dt * 0.3;
    p.d += p.speed * dt;
    while (p.d >= p.edge.len) {
      p.d -= p.edge.len;
      const n = Math.random() < 0.08 ? null : nextEdge(this.net, p.edge);
      if (n) p.edge = n;
      else {
        // Turn around at dead ends (or just because).
        const back = this.net.out[p.edge.to].find((e) => e.to === p.edge.from) || p.edge;
        p.edge = back;
        p.side = -p.side;
      }
    }
    const pose = edgePose(this.net, p.edge, p.d, p.side * (p.edge.road.w / 2 + 1.3));
    const k = Math.min(1, dt * 4);
    const ox = p.x;
    const oz = p.z;
    p.x += (pose.x - p.x) * k;
    p.z += (pose.z - p.z) * k;
    p.y = Math.max(0, p.y - 10 * dt);
    const mv = Math.hypot(p.x - ox, p.z - oz);
    if (mv > 1e-4) p.heading = angleLerp(p.heading, Math.atan2(p.x - ox, p.z - oz), Math.min(1, dt * 8));
    this.sync(p, dt, 'normal', mv / Math.max(dt, 1e-3));
  }

  sync(p, dt, pose, speed = 0) {
    p.model.position.set(p.x, p.y, p.z);
    p.model.rotation.y = p.heading;
    p.rig.update(dt, { speed, pose, air: pose === 'panic' && p.y > 0.2, height: p.y });
  }
}
