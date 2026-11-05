// Driving: the patrol car follows the GPS route along real Lawrenceville streets.
// The player controls speed (brake) and lane (left/right), dodges traffic, and can run the lights.
import * as THREE from 'three';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { polylineLength, sampleAt } from '../map/graph.js';
import { makeTrafficCar, makeBeacon, makePerson, makeSchoolZoneSign } from '../engine/models.js';
import { keys, angleLerp } from '../engine/util.js';
import { h, $ } from '../ui/dom.js';

const LANES = [1.7, 4.3]; // meters right of the road centerline
const MAX_SPEED = 38; // m/s in game space; shown as 45 mph
const LIGHTS_SPEED = 46;
const MPH = 45 / MAX_SPEED;
const ZONE_LIMIT_MPH = 25;
const KINDS = ['car', 'car', 'car', 'car', 'pickup', 'bus', 'pothole'];
const SPEEDS = { car: [13, 22], pickup: [9, 14], bus: [9, 12], pothole: [0, 0] };

export class DriveMode {
  constructor(game, { route }) {
    this.game = game;
    this.routeKey = route;
  }

  enter() {
    const g = this.game;
    const r = g.routes[this.routeKey];
    this.points = r.points;
    this.length = polylineLength(this.points);
    this.roadNames = r.roads;
    this.s = 0;
    this.lane = 0;
    this.lat = 0;
    this.speed = 0;
    this.heading = g.car.rotation.y;
    this.traffic = [];
    this.oncoming = [];
    this.nextSpawn = 70;
    this.nextOncoming = 40;
    this.lightsUntil = 0;
    this.lightsReadyAt = 0;
    this.time = 0;
    this.overLimit = 0;
    this.finished = false;
    this.called = false;
    this.brakeHeld = false;
    this.extras = [];
    g.tyler.visible = false;
    g.avatarRing.visible = false;
    g.car.visible = true;

    const toSchool = this.routeKey === 'toSchool';
    this.zone = toSchool ? { from: this.length - 480, to: this.length - 60 } : null;
    this.trigger = toSchool ? 'driveSchool' : 'driveWawa';
    this.destLabel = toSchool ? state.config.schoolName : 'Wawa';

    this.addRouteLine();
    const end = this.points[this.points.length - 1];
    const beacon = makeBeacon(0x3fa9f5);
    beacon.position.set(end[0], 0, end[1]);
    this.beacon = beacon;
    this.add(beacon);
    g.world.addLabel(this.destLabel, () => beacon.position.clone().setY(13));

    if (this.zone) {
      const at = (s, off, rotOff = 0) => {
        const p = this.poseAt(s, off);
        return [p.x, p.z, p.heading + rotOff];
      };
      const sign = makeSchoolZoneSign();
      const [sx, sz, sh] = at(this.zone.from, 10, Math.PI);
      sign.position.set(sx, 0, sz);
      sign.rotation.y = sh;
      this.add(sign);
      const guard = makePerson({ shirt: 0x2b4c7e, vest: 0xff7a00, beard: null, hair: 0x888888, sign: true });
      guard.scale.setScalar(1.7);
      const [gx, gz, gh] = at((this.zone.from + this.zone.to) / 2, 9, -Math.PI / 2);
      guard.position.set(gx, 0, gz);
      guard.rotation.y = gh;
      this.add(guard);
    }

    g.world.setCamera({
      follow: () => g.car.position,
      autoYaw: () => this.heading + Math.PI,
      pitch: 0.6,
      dist: 30,
      minDist: 18,
      maxDist: 60,
      lookHeight: 3,
    });

    this.buildControls();
    audio.playMusic('drive');
    audio.sfx('carDoor');
    if (toSchool && state.inventory.some((i) => i.type === 'drink')) {
      setTimeout(() => { audio.sfx('gulp'); toast('Ghost Energy: activated.'); }, 900);
    }
    toast(`Route: ${this.roadNames.filter((n) => n !== 'unnamed road').slice(0, 4).join(' > ')}`, 3500);
    this.update(0);
  }

  add(obj) {
    this.game.world.scene.add(obj);
    this.extras.push(obj);
  }

  addRouteLine() {
    const pos = [];
    const pts = this.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const nx = (-(bz - az) / len) * 0.9;
      const nz = ((bx - ax) / len) * 0.9;
      const y = 0.26;
      pos.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3fa9f5, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    this.add(line);
  }

  // Taper lane offset to 0 at the parking spots so the car pulls in/out cleanly.
  taper(s) {
    return Math.min(1, Math.max(0, s / 18)) * Math.min(1, Math.max(0, (this.length - s) / 24));
  }

  poseAt(s, lat) {
    const p = sampleAt(this.points, Math.max(0, Math.min(this.length, s)));
    const a = sampleAt(this.points, Math.min(this.length, s + 6));
    const b = sampleAt(this.points, Math.max(0, s - 1));
    const heading = s + 6 <= this.length ? Math.atan2(a.x - p.x, a.z - p.z) : Math.atan2(p.x - b.x, p.z - b.z);
    const rx = -Math.cos(heading);
    const rz = Math.sin(heading);
    return { x: p.x + rx * lat, z: p.z + rz * lat, heading };
  }

  buildControls() {
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('held'); on(); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { el.classList.remove('held'); off?.(); });
    };
    const left = h('button', {}, '◀');
    const brake = h('button', { class: 'brake' }, 'BRAKE');
    const right = h('button', {}, '▶');
    hold(left, () => { this.lane = 0; audio.sfx('tap'); });
    hold(right, () => { this.lane = 1; audio.sfx('tap'); });
    hold(brake, () => { this.brakeHeld = true; }, () => { this.brakeHeld = false; });
    this.speedo = h('div', { class: 'card speedo' });
    this.lightsBtn = h('button', { class: 'lights', onclick: () => this.useLights() }, 'LIGHTS');
    this.zoneEl = h('div', { class: 'zone' }, `SCHOOL ZONE · ${ZONE_LIMIT_MPH} MPH`);
    this.zoneEl.hidden = true;
    $('#controls').append(h('div', { class: 'drive' }, left, brake, right), this.speedo, this.lightsBtn, this.zoneEl);
    this.onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.lane = 0;
      if (k === 'arrowright' || k === 'd') this.lane = 1;
      if (k === 'l') this.useLights();
    };
    window.addEventListener('keydown', this.onKey);
  }

  useLights() {
    if (this.time < this.lightsReadyAt || this.finished) return;
    this.lightsUntil = this.time + 4;
    this.lightsReadyAt = this.time + 9;
    state.infractions++;
    audio.sfx('siren');
    toast('Lights for a breakfast run? +1 infraction');
    for (const t of this.traffic) {
      if (t.s > this.s - 5 && t.s < this.s + 260) t.cleared = true;
    }
  }

  spawn() {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const [lo, hi] = SPEEDS[kind];
    const mesh = makeTrafficCar(kind);
    const lane = Math.random() < 0.5 ? 0 : 1;
    const t = { kind, mesh, s: this.s + 200 + Math.random() * 90, lane, lat: LANES[lane], speed: lo + Math.random() * (hi - lo), cleared: false, len: mesh.userData.length * 1.25 };
    this.add(mesh);
    this.traffic.push(t);
  }

  spawnOncoming() {
    const mesh = makeTrafficCar(Math.random() < 0.85 ? 'car' : 'pickup');
    this.add(mesh);
    this.oncoming.push({ mesh, s: this.s + 260 + Math.random() * 60, speed: 14 + Math.random() * 8 });
  }

  place(mesh, s, lat, flip = false) {
    const p = this.poseAt(s, lat);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading + (flip ? Math.PI : 0);
  }

  update(dt) {
    const g = this.game;
    this.time += dt;
    this.beacon.userData.animate(dt);
    const lights = this.time < this.lightsUntil;
    g.car.userData.setLights(lights, dt);
    this.lightsBtn.disabled = this.time < this.lightsReadyAt;

    if (!this.finished) {
      const braking = this.brakeHeld || keys.has('arrowdown') || keys.has('s') || keys.has(' ');
      const top = lights ? LIGHTS_SPEED : MAX_SPEED;
      if (braking) this.speed = Math.max(0, this.speed - 30 * dt);
      else if (this.speed < top) this.speed = Math.min(top, this.speed + 9 * dt);
      else this.speed = Math.max(top, this.speed - 6 * dt);
      // Ease off at the very end to pull into the spot.
      const remaining = this.length - this.s;
      if (remaining < 40) this.speed = Math.min(this.speed, Math.max(4, remaining * 0.6));
      this.s = Math.min(this.length, this.s + this.speed * dt);
    }

    const targetLat = LANES[this.lane] * this.taper(this.s);
    this.lat += (targetLat - this.lat) * (1 - Math.exp(-dt * 6));
    const pose = this.poseAt(this.s, this.lat);
    this.heading = angleLerp(this.heading, pose.heading, 1 - Math.exp(-dt * 10));
    g.car.position.set(pose.x, 0, pose.z);
    g.car.rotation.y = this.heading;

    // Traffic in our direction
    if (!lights && this.s >= this.nextSpawn && this.s < this.length - 260 && this.traffic.length < 7) {
      this.spawn();
      this.nextSpawn = this.s + 45 + Math.random() * 70;
    }
    for (const t of this.traffic) {
      if (t.cleared) {
        t.lat += (8.5 - t.lat) * (1 - Math.exp(-dt * 3)); // pull over to the shoulder
        t.speed = Math.max(0, t.speed - 12 * dt);
      }
      t.s += t.speed * dt;
      this.place(t.mesh, t.s, t.lat);
      if (!t.cleared && !this.finished && Math.abs(t.s - this.s) < (t.len + 6.1) / 2 - 0.6 && Math.abs(t.lat - this.lat) < 2.3) this.crash(t);
    }
    this.traffic = this.traffic.filter((t) => {
      if (t.s < this.s - 70) { t.mesh.removeFromParent(); return false; }
      return true;
    });

    // Oncoming traffic (scenery)
    if (this.s >= this.nextOncoming && this.s < this.length - 300 && this.oncoming.length < 4) {
      this.spawnOncoming();
      this.nextOncoming = this.s + 60 + Math.random() * 90;
    }
    for (const o of this.oncoming) {
      o.s -= o.speed * dt;
      this.place(o.mesh, o.s, -2.4, true);
    }
    this.oncoming = this.oncoming.filter((o) => {
      if (o.s < this.s - 60) { o.mesh.removeFromParent(); return false; }
      return true;
    });

    // School zone
    const mph = Math.round(this.speed * MPH);
    const inZone = this.zone && this.s >= this.zone.from && this.s <= this.zone.to;
    this.zoneEl.hidden = !inZone;
    const over = inZone && mph > ZONE_LIMIT_MPH;
    if (over) {
      this.overLimit += dt;
      if (this.overLimit > 1.5) {
        this.overLimit = 0;
        state.infractions++;
        toast('Speeding in a school zone! +1 infraction');
      }
    }
    this.speedo.innerHTML = `${mph} <small>MPH</small>`;
    this.speedo.classList.toggle('over', !!over);

    if (!this.called && this.s > this.length * 0.35) {
      this.called = true;
      maybeCall(this.trigger, { handsFree: true, delay: 0 });
    }

    const left = state.clock.minutesUntilBell();
    audio.setTempo(left < 10 ? 1.25 : left < 20 ? 1.1 : 1);

    if (!this.finished && this.s >= this.length - 0.05) {
      this.finished = true;
      this.speed = 0;
      audio.setTempo(1);
      toast(`Arrived at ${this.destLabel}`);
      setTimeout(() => nextStep(), 700);
    }
  }

  crash(t) {
    t.cleared = true;
    t.lat += t.lat < this.lat ? -3 : 3;
    this.speed = Math.min(this.speed, 6);
    state.infractions++;
    state.clock.addMinutes(state.config.collisionPenaltyMinutes);
    audio.sfx('crash');
    navigator.vibrate?.(150);
    toast(`Fender bender! +${state.config.collisionPenaltyMinutes} min`);
  }

  exit() {
    for (const o of this.extras) o.removeFromParent();
    window.removeEventListener('keydown', this.onKey);
    this.game.car.userData.setLights(false);
    audio.setTempo(1);
  }
}
