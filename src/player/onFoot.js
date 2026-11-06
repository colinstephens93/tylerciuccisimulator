// Tyler on foot: camera-relative joystick movement, snappy acceleration, jump with squash
// and stretch, and a front kick.
import { angleLerp } from '../engine/util.js';

const GRAVITY = 30;
const RADIUS = 0.7;

export class OnFoot {
  constructor(model, cfg) {
    this.model = model;
    this.rig = model.userData.rig;
    this.cfg = cfg;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.heading = 0;
    this.grounded = true;
    this.rush = 0; // Ghost Energy speed boost, seconds left
    this.kickCooldown = 0;
    this.down = 0; // knocked down, seconds left
  }

  place(x, z, heading) {
    Object.assign(this, { x, z, heading, y: 0, vx: 0, vz: 0, vy: 0, grounded: true, down: 0 });
    this.sync(0, 0);
  }

  // axis from Controls; camYaw from the camera rig. Returns { jumped, landed, kicked }.
  update(dt, axis, camYaw, actions, colliders, bounds) {
    const ev = { jumped: false, landed: 0, kicked: false };
    this.kickCooldown -= dt;
    this.rush = Math.max(0, this.rush - dt);

    if (this.down > 0) {
      this.down -= dt;
      this.vx *= Math.exp(-dt * 4);
      this.vz *= Math.exp(-dt * 4);
    } else {
      // Camera-relative direction: stick up = away from the camera.
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      const dx = fx * axis.y + rx * axis.x;
      const dz = fz * axis.y + rz * axis.x;
      const boost = this.rush > 0 ? 1.45 : 1;
      const speed = (axis.m > 0.75 || axis.keyboard ? this.cfg.runSpeed : this.cfg.walkSpeed * (0.4 + axis.m)) * boost;
      const tx = axis.m ? (dx / Math.hypot(dx, dz)) * speed : 0;
      const tz = axis.m ? (dz / Math.hypot(dx, dz)) * speed : 0;
      const accel = this.grounded ? 45 : 14;
      this.vx += Math.sign(tx - this.vx) * Math.min(Math.abs(tx - this.vx), accel * dt);
      this.vz += Math.sign(tz - this.vz) * Math.min(Math.abs(tz - this.vz), accel * dt);
      if (axis.m) this.heading = angleLerp(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 14));

      if (actions.jump && this.grounded) {
        this.vy = this.cfg.jumpSpeed;
        this.grounded = false;
        this.rig.hop();
        ev.jumped = true;
      }
      if (actions.kick && this.kickCooldown <= 0) {
        this.kickCooldown = 0.45;
        this.rig.kick();
        ev.kicked = true;
      }
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        ev.landed = Math.min(1, -this.vy / 14);
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.rig.land(ev.landed);
      }
    }
    const res = colliders.resolveCircle(this.x, this.z, RADIUS);
    if (res.hit) {
      this.x = res.x;
      this.z = res.z;
      const vn = this.vx * res.nx + this.vz * res.nz;
      if (vn < 0) { this.vx -= vn * res.nx; this.vz -= vn * res.nz; }
    }
    if (bounds) {
      this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
      this.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, this.z));
    }
    this.sync(dt, Math.hypot(this.vx, this.vz));
    return ev;
  }

  // Get bowled over by something (a wreck, Sarge's tackle).
  knock(vx, vz) {
    this.vx = vx;
    this.vz = vz;
    this.vy = 7;
    this.grounded = false;
    this.down = 1.4;
  }

  sync(dt, speed) {
    this.model.position.set(this.x, this.y, this.z);
    this.model.rotation.y = this.heading;
    const pose = this.down > 0 ? (this.grounded ? 'down' : 'fly') : 'normal';
    this.rig.update(dt, { speed, air: !this.grounded, pose, height: this.y });
  }

  // Point just in front of Tyler (kick target).
  front(dist = 1.6) {
    return [this.x + Math.sin(this.heading) * dist, this.z + Math.cos(this.heading) * dist];
  }
}
