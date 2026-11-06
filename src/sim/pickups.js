// Coins that burst out of smashed props, and the hidden Ghost Energy cans spread around town.
import { makeCoin, makeGhostCan } from '../engine/models.js';
import { seeded } from '../engine/util.js';
import { vert } from '../map/graph.js';

const GRAVITY = 24;

export class Coins {
  constructor(scene, size = 50) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = makeCoin();
      m.visible = false;
      scene.add(m);
      this.pool.push({ m, alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 });
    }
  }

  burst(x, z, n) {
    for (let i = 0; i < n; i++) {
      const c = this.pool.find((p) => !p.alive);
      if (!c) return;
      const a = Math.random() * Math.PI * 2;
      Object.assign(c, { alive: true, x, y: 1, z, vx: Math.cos(a) * 4, vy: 8 + Math.random() * 3, vz: Math.sin(a) * 4, t: 12 });
      c.m.visible = true;
    }
  }

  // Returns how many coins were collected this frame. reach: pickup radius around (px, pz).
  update(dt, px, pz, reach) {
    let got = 0;
    for (const c of this.pool) {
      if (!c.alive) continue;
      c.t -= dt;
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < reach + 5 && c.vy <= 0 && c.y < 1.2) {
        // Magnet: coins zip toward the player.
        c.x += (dx / d) * Math.min(d, 22 * dt);
        c.z += (dz / d) * Math.min(d, 22 * dt);
      } else {
        c.vy -= GRAVITY * dt;
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        c.y += c.vy * dt;
        if (c.y < 0.8 && c.vy < 0) { c.y = 0.8; c.vy = c.vy < -4 ? -c.vy * 0.4 : 0; c.vx *= 0.5; c.vz *= 0.5; }
      }
      if (d < reach) { got++; c.alive = false; c.m.visible = false; continue; }
      if (c.t <= 0) { c.alive = false; c.m.visible = false; continue; }
      c.m.position.set(c.x, c.y, c.z);
      c.m.rotation.y += dt * 8;
      c.m.visible = c.t > 2 || Math.floor(c.t * 8) % 2 === 0; // blink before vanishing
    }
    return got;
  }
}

// Fixed, seeded spots so every player hunts the same hidden cans.
export function hiddenCanSpots(map, count, roadGrid, colliders) {
  const rand = seeded(2026);
  const spots = [];
  const roads = map.roads.filter((r) => r.t !== 'service');
  let guard = 0;
  while (spots.length < count && guard++ < 5000) {
    const r = roads[Math.floor(rand() * roads.length)];
    const i = Math.floor(rand() * (r.v.length - 1));
    const [ax, az] = vert(map, r.v[i]);
    const [bx, bz] = vert(map, r.v[i + 1]);
    const t = rand();
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const side = rand() < 0.5 ? -1 : 1;
    const off = r.w / 2 + 3 + rand() * 6;
    const x = ax + (bx - ax) * t + (-(bz - az) / len) * off * side;
    const z = az + (bz - az) * t + ((bx - ax) / len) * off * side;
    if (Math.abs(x) > 1100 || Math.abs(z) > 1100) continue;
    if (colliders.blocked(x, z, 1.2) || roadGrid.edgeDistance(x, z, 12) < 0.5) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 140)) continue;
    spots.push({ id: `can${spots.length}`, x, z });
  }
  return spots;
}

export class Cans {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  add(id, x, z, color, beam) {
    const m = makeGhostCan(color, beam);
    m.position.set(x, 0, z);
    this.scene.add(m);
    const c = { id, x, z, m };
    this.list.push(c);
    return c;
  }

  remove(c) {
    c.m.removeFromParent();
    this.list.splice(this.list.indexOf(c), 1);
  }

  clear(filter = () => true) {
    for (const c of [...this.list]) if (filter(c)) this.remove(c);
  }

  // Returns cans touched this frame.
  update(dt, px, pz, py, reach) {
    const got = [];
    for (const c of this.list) {
      c.m.userData.animate(dt);
      if (Math.hypot(c.x - px, c.z - pz) < reach && py < 4) got.push(c);
    }
    return got;
  }
}
