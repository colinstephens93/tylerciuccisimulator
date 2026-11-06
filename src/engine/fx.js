// Pooled cartoon particles: dust puffs, sparks, and confetti.
import * as THREE from 'three';
import { glow, toon } from './models.js';

const GEO = new THREE.IcosahedronGeometry(0.35, 0);
const CONFETTI = [0xff4f4f, 0xffd23f, 0x3ddc84, 0x2f8cff, 0xff6fb5, 0xb36bff];

export class Fx {
  constructor(scene, size = 90) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(GEO, toon(0xffffff));
      m.visible = false;
      scene.add(m);
      this.pool.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, grow: 0 });
    }
    this.next = 0;
  }

  emit(x, y, z, { color = 0xffffff, vx = 0, vy = 0, vz = 0, life = 0.6, size = 1, grav = 0, grow = 1.5, bright = false }) {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    p.m.material = bright ? glow(color) : toon(color);
    p.m.position.set(x, y, z);
    p.m.scale.setScalar(size);
    p.m.visible = true;
    Object.assign(p, { life, max: life, vx, vy, vz, grav, grow, size });
  }

  // Dust puff ring, e.g. landing, skids, impacts.
  puff(x, z, n = 6, color = 0xf2efe6, y = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.emit(x, y, z, { color, vx: Math.cos(a) * 3, vy: 1 + Math.random(), vz: Math.sin(a) * 3, life: 0.5, size: 0.8 + Math.random() * 0.6, grow: 2 });
    }
  }

  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      this.emit(x, y, z, { color: i % 2 ? 0xffd23f : 0xffffff, bright: true, vx: (Math.random() - 0.5) * 14, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 14, life: 0.4, size: 0.35, grav: 25, grow: -1 });
    }
  }

  confetti(x, y, z, n = 30) {
    for (let i = 0; i < n; i++) {
      this.emit(x, y, z, { color: CONFETTI[i % CONFETTI.length], bright: true, vx: (Math.random() - 0.5) * 12, vy: 8 + Math.random() * 8, vz: (Math.random() - 0.5) * 12, life: 1.4, size: 0.4, grav: 14, grow: 0 });
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vy -= p.grav * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y = Math.max(0.1, p.m.position.y + p.vy * dt);
      p.m.position.z += p.vz * dt;
      p.vx *= Math.exp(-dt * 2);
      p.vz *= Math.exp(-dt * 2);
      const k = p.life / p.max;
      p.m.scale.setScalar(Math.max(0.01, p.size * (1 + p.grow * (1 - k)) * Math.min(1, k * 3)));
      p.m.rotation.x += dt * 5;
      p.m.rotation.y += dt * 4;
    }
  }
}
