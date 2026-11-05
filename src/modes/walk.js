// On foot: Tyler stays centered on the 3D town map. Tap to walk, drag to rotate, pinch to zoom.
import * as THREE from 'three';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { makeBeacon } from '../engine/models.js';
import { keys, angleLerp } from '../engine/util.js';

const SPEED = 9; // m/s (Tyler hustles)
const ARRIVE = 4.5;

export class WalkMode {
  constructor(game, { location }) {
    this.game = game;
    this.location = location;
  }

  enter() {
    const g = this.game;
    const P = g.places;
    const tyler = g.tyler;
    let start;
    let target;
    let label;
    let pickable;
    this.trigger = null;

    if (this.location === 'home') {
      g.parkCar('home');
      start = P.home.door;
      target = g.carDoor();
      label = 'Patrol car';
      pickable = g.car;
      this.trigger = 'homeWalk';
      tyler.rotation.y = P.home.rot;
    } else if (this.location === 'wawaLot') {
      g.parkCar('wawa');
      start = g.carDoor();
      target = P.wawa.door;
      label = 'Wawa';
      pickable = g.wawaBuilding;
      tyler.rotation.y = P.wawa.rot + Math.PI;
    } else {
      g.parkCar('school');
      start = g.carDoor();
      target = P.school.door;
      label = 'Front entrance';
      pickable = g.schoolBuilding;
      this.trigger = 'schoolWalk';
      tyler.rotation.y = P.school.rot + Math.PI;
    }

    tyler.position.set(start[0], 0, start[1]);
    tyler.visible = true;
    g.avatarRing.visible = true;
    this.target = new THREE.Vector3(target[0], 0, target[1]);
    this.pickable = pickable;
    this.dest = null;
    this.arrived = false;

    this.beacon = makeBeacon();
    this.beacon.position.copy(this.target);
    g.world.scene.add(this.beacon);
    this.label = g.world.addLabel(label, () => this.target.clone().setY(9));
    this.label.onClick(() => { this.dest = this.target.clone(); });

    g.world.setCamera({ follow: () => tyler.position, pitch: 0.92, dist: 46, minDist: 18, maxDist: 90, yaw: g.world.rig.yaw, lookHeight: 2.5 });
    // Look from the street side toward the building, so it isn't hidden behind the camera.
    g.world.rig.yaw = P[this.location === 'wawaLot' ? 'wawa' : this.location].rot + (this.location === 'home' ? 0.5 : 0.35);

    audio.playMusic('walk');
    if (this.location === 'home') toast('Tap the map to walk. Drag to look around.');
    if (this.trigger) maybeCall(this.trigger, { delay: 1200 });
  }

  onTap(e) {
    if (state.inputLocked || this.arrived) return;
    const w = this.game.world;
    if (w.pick(e, [this.pickable, this.beacon])) {
      this.dest = this.target.clone();
      return;
    }
    const p = w.groundPoint(e);
    if (p) this.dest = p;
  }

  update(dt) {
    const g = this.game;
    const tyler = g.tyler;
    this.beacon.userData.animate(dt);
    g.avatarRing.position.set(tyler.position.x, 0, tyler.position.z);
    g.avatarRing.userData.animate(dt);
    if (this.arrived || state.inputLocked) { tyler.userData.animate(dt, false); return; }

    // Keyboard: move relative to the camera.
    let kx = 0;
    let kz = 0;
    if (keys.has('arrowup') || keys.has('w')) kz -= 1;
    if (keys.has('arrowdown') || keys.has('s')) kz += 1;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;
    let vx = 0;
    let vz = 0;
    if (kx || kz) {
      const yaw = g.world.rig.yaw;
      vx = kx * Math.cos(yaw) + kz * Math.sin(yaw);
      vz = -kx * Math.sin(yaw) + kz * Math.cos(yaw);
      this.dest = null;
    } else if (this.dest) {
      vx = this.dest.x - tyler.position.x;
      vz = this.dest.z - tyler.position.z;
      if (Math.hypot(vx, vz) < 0.3) { this.dest = null; vx = 0; vz = 0; }
    }
    const len = Math.hypot(vx, vz);
    const moving = len > 0;
    if (moving) {
      const step = Math.min(len, SPEED * dt);
      tyler.position.x += (vx / len) * step;
      tyler.position.z += (vz / len) * step;
      tyler.rotation.y = angleLerp(tyler.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-dt * 12));
    }
    tyler.userData.animate(dt, moving, 1.2);

    if (tyler.position.distanceTo(this.target) < ARRIVE) this.arrive();
  }

  arrive() {
    this.arrived = true;
    const g = this.game;
    if (this.location === 'school') {
      state.arrivalMinutes = state.clock.minutes;
      state.clockRunning = false;
      state.objective = '';
      setTimeout(() => nextStep(), 300);
      return;
    }
    audio.sfx(this.location === 'wawaLot' ? 'chime' : 'carDoor');
    if (this.location === 'home') g.tyler.visible = false;
    setTimeout(() => nextStep(), 350);
  }

  exit() {
    this.beacon.removeFromParent();
    this.label.remove();
    this.game.avatarRing.visible = false;
  }
}
