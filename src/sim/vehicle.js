// Arcade car physics: grip + handbrake drift, building and tree collisions with bounce,
// and springy body lean / squash for the cartoon feel.

export const CAR_STATS = {
  sedan: { maxSpeed: 32, accel: 20, reverse: 10, brake: 34, grip: 9, turn: 2.4, mass: 1 },
  pickup: { maxSpeed: 30, accel: 18, reverse: 9, brake: 30, grip: 8, turn: 2.1, mass: 1.4 },
  sports: { maxSpeed: 42, accel: 30, reverse: 11, brake: 38, grip: 10, turn: 2.6, mass: 0.9 },
  bus: { maxSpeed: 22, accel: 9, reverse: 6, brake: 22, grip: 7, turn: 1.4, mass: 3 },
  patrol: { maxSpeed: 38, accel: 25, reverse: 11, brake: 38, grip: 10, turn: 2.6, mass: 1.2 },
};

export class Vehicle {
  constructor(model, { x = 0, z = 0, heading = 0, vx = 0, vz = 0, spin = 0 } = {}) {
    this.model = model;
    this.kind = model.userData.kind;
    this.stats = CAR_STATS[this.kind] || CAR_STATS.sedan;
    this.length = model.userData.length;
    this.width = model.userData.width;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = vx;
    this.vz = vz;
    this.spin = spin;
    this.steer = 0;
    this.squash = 0;
    this.squashV = 0;
    this.roll = 0;
    this.pitch = 0;
    this.siren = false;
    this.offroad = false;
    this.drifting = false;
    this.idleTime = 0;
    this.sync(0);
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  // Signed speed along the car's nose.
  get forwardSpeed() {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }

  // Collision circles along the body: [x, z, r].
  circles() {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const r = this.width * 0.5;
    const o = this.length * 0.5 - r;
    return [[this.x + fx * o, this.z + fz * o, r, o], [this.x, this.z, r, 0], [this.x - fx * o, this.z - fz * o, r, -o]];
  }

  // ctrl: { throttle -1..1, steer -1..1, drift bool }. Returns the hardest wall impact (m/s).
  update(dt, ctrl, colliders, roads, bounds) {
    const st = this.stats;
    const h = this.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = -Math.cos(h);
    const rz = Math.sin(h);
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;
    const before = vF;

    this.offroad = roads.edgeDistance(this.x, this.z, 12) > 1;
    const max = st.maxSpeed * (this.offroad ? 0.65 : 1) * (this.boost ? 1.2 : 1);
    const t = ctrl.throttle;
    if (t > 0.05) {
      if (vF < -0.5) vF += st.brake * t * dt;
      else if (vF < max * t) vF += st.accel * t * dt * (1 - Math.max(0, vF) / (max * 1.15));
      else vF -= 6 * dt;
    } else if (t < -0.05) {
      if (vF > 0.5) vF -= st.brake * -t * dt;
      else if (vF > -st.reverse) vF -= st.accel * 0.6 * -t * dt;
    } else {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), (ctrl.idle ? 9 : 3.5) * dt);
    }
    if (this.offroad) vF *= Math.exp(-0.5 * dt);
    if (vF > max * 1.05) vF -= 18 * dt;

    this.drifting = !!ctrl.drift && Math.abs(vF) > 8;
    if (ctrl.drift) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 5 * dt);
    const grip = this.drifting ? 1.4 : st.grip;
    vL *= Math.exp(-grip * dt);

    // Steering: strongest at moderate speed, gentler at top speed.
    this.steer += (ctrl.steer - this.steer) * Math.min(1, dt * 10);
    const sp = Math.abs(vF);
    const factor = Math.min(1, sp / 5) * (1 - 0.4 * Math.min(1, sp / st.maxSpeed)) * Math.sign(vF || 1);
    const yawRate = -this.steer * st.turn * factor * (this.drifting ? 1.45 : 1);

    this.vx = fx * vF + rx * vL;
    this.vz = fz * vF + rz * vL;
    this.spin *= Math.exp(-dt * 4);
    this.heading += (yawRate + this.spin) * dt;

    // Move in substeps so fast cars don't tunnel through thin walls.
    let impact = 0;
    let impactN = null;
    const steps = Math.max(1, Math.ceil((this.speed * dt) / 0.6));
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps;
      this.z += (this.vz * dt) / steps;
      const hit = this.collideStatic(colliders);
      if (hit && hit.impact > impact) { impact = hit.impact; impactN = hit; }
    }
    if (bounds) {
      this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
      this.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, this.z));
    }

    // Body lean from acceleration (cartoon exaggerated).
    const accelF = (this.forwardSpeed - before) / Math.max(dt, 1e-3);
    this.pitch += (Math.max(-0.12, Math.min(0.12, -accelF * 0.006)) - this.pitch) * Math.min(1, dt * 8);
    const latG = yawRate * vF;
    this.roll += (Math.max(-0.16, Math.min(0.16, latG * 0.005)) - this.roll) * Math.min(1, dt * 8);
    if (impact > 4) this.bump(Math.min(1, impact / 20));
    this.sync(dt);
    return impact > 0 ? { impact, nx: impactN.nx, nz: impactN.nz, x: impactN.x, z: impactN.z } : null;
  }

  collideStatic(colliders) {
    let best = null;
    for (const [cx, cz, r, off] of this.circles()) {
      const res = colliders.resolveCircle(cx, cz, r);
      if (!res.hit) continue;
      this.x += res.x - cx;
      this.z += res.z - cz;
      const vn = this.vx * res.nx + this.vz * res.nz;
      if (vn < 0) {
        // Bounce off the wall and lose some speed along it.
        this.vx -= 1.35 * vn * res.nx;
        this.vz -= 1.35 * vn * res.nz;
        this.vx *= 0.88;
        this.vz *= 0.88;
        const rx = -Math.cos(this.heading);
        const rz = Math.sin(this.heading);
        this.spin += off * (res.nx * rx + res.nz * rz) * -vn * 0.04;
        if (!best || -vn > best.impact) best = { impact: -vn, nx: res.nx, nz: res.nz, x: cx - res.nx * r, z: cz - res.nz * r };
      }
    }
    return best;
  }

  bump(power) {
    this.squashV -= 8 * power;
  }

  sync(dt) {
    const m = this.model;
    const u = m.userData;
    this.squashV += (-this.squash * 220 - this.squashV * 12) * dt;
    this.squash += this.squashV * dt;
    const sq = Math.max(-0.3, Math.min(0.3, this.squash));
    m.position.set(this.x, 0, this.z);
    m.rotation.y = this.heading;
    u.body.rotation.set(this.pitch, 0, this.roll);
    u.body.scale.set(1 - sq * 0.4, 1 + sq, 1 - sq * 0.2);
    u.body.position.y = this.offroad && this.speed > 3 ? Math.random() * 0.06 : 0;
    const roll = (this.forwardSpeed * dt) / (u.wheelR || 0.5);
    for (const w of u.wheels) w.rotation.x += roll;
    for (const s of u.steer) s.rotation.y = -this.steer * 0.5;
  }
}

// Push two dynamic vehicles apart and exchange momentum. Returns the impact speed or 0.
export function collideVehicles(a, b) {
  let best = null;
  for (const [ax, az, ar] of a.circles()) {
    for (const [bx, bz, br] of b.circles()) {
      const dx = bx - ax;
      const dz = bz - az;
      const d = Math.hypot(dx, dz);
      const pen = ar + br - d;
      if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: d ? dx / d : 1, nz: d ? dz / d : 0, x: (ax + bx) / 2, z: (az + bz) / 2 };
    }
  }
  if (!best) return null;
  const ma = a.stats.mass;
  const mb = b.stats.mass;
  const wa = mb / (ma + mb);
  const wb = ma / (ma + mb);
  a.x -= best.nx * best.pen * wa;
  a.z -= best.nz * best.pen * wa;
  b.x += best.nx * best.pen * wb;
  b.z += best.nz * best.pen * wb;
  const rel = (b.vx - a.vx) * best.nx + (b.vz - a.vz) * best.nz;
  if (rel >= 0) return { impact: 0, ...best };
  const j = (-(1 + 0.4) * rel) / (1 / ma + 1 / mb);
  a.vx -= (j * best.nx) / ma;
  a.vz -= (j * best.nz) / ma;
  b.vx += (j * best.nx) / mb;
  b.vz += (j * best.nz) / mb;
  b.spin += (Math.random() - 0.5) * -rel * 0.15;
  return { impact: -rel, ...best };
}
