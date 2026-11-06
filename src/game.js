// Free-roam sandbox: owns the world, the player (on foot or driving), the living city
// (traffic, pedestrians, props, pickups), missions, heat/Sarge, the HUD and the camera.
import * as THREE from 'three';
import { state } from './state.js';
import { audio } from './audio.js';
import map from './data/lawrenceville.json';
import missions from './data/missions.json';
import { World } from './engine/world.js';
import { Controls } from './engine/input.js';
import { Fx } from './engine/fx.js';
import { makeTyler } from './engine/tyler.js';
import { makeFoodTruck, makeDan } from './engine/elcregs.js';
import {
  makePatrolCar, makeHouse, makeWawa, makeSchool, makeArrow, makeMissionMarker, LANDMARK_BOXES,
} from './engine/models.js';
import { toWorld, angleLerp, angleDiff } from './engine/util.js';
import { buildCity } from './map/cityMesh.js';
import { computePlaces } from './map/places.js';
import { ColliderGrid, RoadGrid } from './sim/colliders.js';
import { buildLaneNet, TRAFFIC_TYPES, WALK_TYPES, nodeInRing } from './sim/roadnet.js';
import { Traffic } from './sim/traffic.js';
import { Peds } from './sim/peds.js';
import { Props } from './sim/props.js';
import { Coins, Cans, hiddenCanSpots } from './sim/pickups.js';
import { Vehicle, collideVehicles } from './sim/vehicle.js';
import { OnFoot } from './player/onFoot.js';
import { MissionRunner } from './missions/runner.js';
import { formatTimer } from './missions/logic.js';
import { Heat, bustedFine } from './logic/heat.js';
import { Hud } from './ui/hud.js';
import { titleScreen, loadingScreen, clearScreen, briefCard, resultCard, closeCards, pauseMenu, dialogueCard } from './ui/screens.js';
import { $ } from './ui/dom.js';
import { vert } from './map/graph.js';

const MPH = 2.0; // display speed per m/s (cartoon scale)
const MAX_PARKED = 6;
const SMASH_WORDS = ['SMASH!', 'POW!', 'BONK!', 'KRAK!', 'WHAM!'];
const OUCH_WORDS = ['OOF!', 'HEY!', 'MY BACK!', 'WHOA!', 'RUDE!'];

export class Game {
  constructor() {
    this.world = new World($('#view'), $('#labels'));
    this.controls = new Controls();
    this.controls.show(false);
    this.mode = 'loading';
  }

  async load() {
    loadingScreen();
    await new Promise((r) => setTimeout(r, 50));
    const cfg = state.config;
    const scene = this.world.scene;
    const { graph, places } = computePlaces(map);
    this.graph = graph;
    this.places = places;

    this.colliders = new ColliderGrid();
    this.roads = new RoadGrid();
    for (const [key, boxes] of Object.entries(LANDMARK_BOXES)) {
      const p = places[key];
      for (const [cx, cz, hw, hd] of boxes) {
        const [wx, wz] = toWorld(p.x, p.z, p.rot, cx, cz);
        this.colliders.addBox(wx, wz, hw, hd, p.rot);
      }
    }
    const clear = Object.values(places).filter((p) => p.building).map((p) => ({ x: p.x, z: p.z, r: p.clearRadius }));
    scene.add(buildCity(map, clear, this.colliders, this.roads));
    const put = (obj, p) => { obj.position.set(p.x, 0, p.z); obj.rotation.y = p.rot; scene.add(obj); };
    put(makeHouse(), places.home);
    put(makeWawa(), places.wawa);
    put(makeSchool(), places.school);
    for (const p of Object.values(places)) p.marker = this.openSpot(p.marker[0], p.marker[1], 2.5);
    this.npcs = { dan: this.buildElCregs(places.elcregs) };

    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < map.verts.length; i += 2) {
      minX = Math.min(minX, map.verts[i]); maxX = Math.max(maxX, map.verts[i]);
      minZ = Math.min(minZ, map.verts[i + 1]); maxZ = Math.max(maxZ, map.verts[i + 1]);
    }
    this.bounds = { minX: minX + 20, maxX: maxX - 20, minZ: minZ + 20, maxZ: maxZ - 20 };

    this.driveNet = buildLaneNet(map, { types: TRAFFIC_TYPES, oneWay: true });
    this.walkNet = buildLaneNet(map, { types: WALK_TYPES, oneWay: false });
    this.traffic = new Traffic(scene, this.driveNet, cfg.world.trafficCars);
    this.peds = new Peds(scene, this.walkNet, cfg.world.pedestrians, this.colliders);
    this.props = new Props(scene, map, this.colliders, this.roads, cfg.world.propSpacing);
    this.coins = new Coins(scene);
    this.cans = new Cans(scene);
    this.hiddenSpots = hiddenCanSpots(map, cfg.world.hiddenCans, this.roads, this.colliders);
    for (const s of this.hiddenSpots) if (!state.save.cans.includes(s.id)) this.cans.add(s.id, s.x, s.z, 0x3ddc84, 30).hidden = true;
    this.fx = new Fx(scene);

    this.tylerModel = makeTyler();
    scene.add(this.tylerModel);
    this.foot = new OnFoot(this.tylerModel, cfg.player);
    this.patrol = new Vehicle(makePatrolCar(), { x: places.home.park[0], z: places.home.park[1], heading: places.home.parkRot });
    scene.add(this.patrol.model);
    this.vehicles = [this.patrol]; // drivable cars not in traffic (parked, abandoned, wrecked)
    this.driving = null;
    this.arrow = makeArrow();
    this.arrow.visible = false;
    scene.add(this.arrow);
    this.heat = new Heat();
    this.sarge = null;
    this.mission = null;
    this.modal = false;
    this.footYaw = 0;
    this.sirenTimer = 0;
    this.time = 0;
    this.coinSfx = 0;

    this.markers = this.buildMarkers();
    this.hud = new Hud(map, () => this.pause());
    this.hud.show(false);
    this.world.onUpdate = (dt) => this.update(dt);
    this.world.cameraBlock = (x, z, dx, dz, max) => {
      for (let d = 2; d < max; d += 1.5) if (this.colliders.blocked(x + dx * d, z + dz * d, 0.4, 'building')) return Math.max(2, d - 1.2);
      return max;
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play' && !this.world.paused) this.pause(); });
    this.placeTylerAtHome();
    this.showTitle();
  }

  // ---------- Setup helpers ----------

  // Nearest point to (x, z) with r meters of clearance from buildings and trees.
  openSpot(x, z, r) {
    if (!this.colliders.blocked(x, z, r)) return [x, z];
    for (let d = 2; d < 30; d += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (!this.colliders.blocked(px, pz, r)) return [px, pz];
      }
    }
    return [x, z];
  }

  // A random open roadside spot between minD and maxD from (x, z), away from `avoid`.
  findSpotNear(x, z, minD, maxD, avoid = []) {
    for (let k = 0; k < 80; k++) {
      const node = nodeInRing(this.driveNet, x, z, minD, maxD);
      if (node < 0) continue;
      const [vx, vz] = vert(map, node);
      const a = Math.random() * Math.PI * 2;
      const px = vx + Math.cos(a) * 3;
      const pz = vz + Math.sin(a) * 3;
      if (this.colliders.blocked(px, pz, 1.5)) continue;
      if (avoid.some((o) => Math.hypot(o.x - px, o.z - pz) < 25)) continue;
      return [px, pz];
    }
    return null;
  }

  // El Cregs flauta truck parked by the roadside, with ATF Agent Dan out front.
  buildElCregs(p) {
    const truck = makeFoodTruck();
    const rot = p.rot; // local +z points at the road
    let [tx, tz] = toWorld(p.marker[0], p.marker[1], rot, 0, -4.5);
    [tx, tz] = this.openSpot(tx, tz, 3.5);
    truck.position.set(tx, 0, tz);
    truck.rotation.y = rot - Math.PI / 2; // serving window faces the road
    this.world.scene.add(truck);
    this.colliders.addBox(tx, tz, truck.userData.width / 2, truck.userData.length / 2, rot - Math.PI / 2);
    const [dx, dz] = toWorld(tx, tz, rot, 1.2, 3.4);
    const model = makeDan();
    model.position.set(dx, 0, dz);
    model.rotation.y = rot;
    this.world.scene.add(model);
    this.colliders.addCircle(dx, dz, 0.5, 'npc');
    p.marker = [dx, dz];
    this.world.addLabel('El Cregs', () => truck.position.clone().setY(6.5), 'label', 140);
    return { key: 'dan', label: 'Agent Dan', model, rig: model.userData.rig, x: dx, z: dz, heading: rot, baseHeading: rot, wave: 0, chatter: 0 };
  }

  // Dan idles by the truck, turns to face Tyler, and waves him over.
  updateNpcs(dt, px, pz) {
    for (const n of Object.values(this.npcs)) {
      const d = Math.hypot(px - n.x, pz - n.z);
      const want = d < 18 ? Math.atan2(px - n.x, pz - n.z) : n.baseHeading;
      n.heading = angleLerp(n.heading, want, Math.min(1, dt * 4));
      n.model.rotation.y = n.heading;
      n.rig.update(dt, { speed: 0 });
      if (d < 30 && d > 3.5 && this.mission?.run.stage.npc === n.key) {
        n.wave += dt;
        n.rig.arms[1].rotation.set(0, 0, 2.6 + Math.sin(n.wave * 10) * 0.35);
      }
      // In free roam, Dan has a word for Tyler when he walks up.
      n.chatter -= dt;
      if (!this.mission && !this.driving && d < 3 && n.chatter <= 0) {
        n.chatter = 12;
        const lines = ['Flautas are on me today, Deputy.', 'Quiet morning. Want a flauta?', 'Salsa verde. Trust me.', "Don't tell Amanda I keep feeding you."];
        this.world.popText(lines[Math.floor(Math.random() * lines.length)], n.model.position.clone().setY(3.2), 'pop say', 2600);
        audio.sfx('ding');
      }
    }
  }

  // A conversation card (the mission clock is paused by the runner meanwhile).
  talkTo(key, lines, onDone) {
    const n = this.npcs[key];
    this.foot.heading = Math.atan2(n.x - this.foot.x, n.z - this.foot.z);
    this.foot.vx = 0;
    this.foot.vz = 0;
    this.modal = true;
    audio.sfx('ding');
    dialogueCard(lines, () => { closeCards(); this.modal = false; onDone(); });
  }

  buildMarkers() {
    const perPlace = {};
    return missions.map((def) => {
      const p = this.places[def.start];
      const i = (perPlace[def.start] = (perPlace[def.start] ?? -1) + 1);
      const side = [p.marker[0] - p.road[0], p.marker[1] - p.road[1]];
      const len = Math.hypot(...side) || 1;
      // Several missions at one place sit side by side along the road.
      const [x, z] = this.openSpot(p.marker[0] + (-side[1] / len) * i * 9, p.marker[1] + (side[0] / len) * i * 9, 3);
      const m = makeMissionMarker();
      m.position.set(x, 0, z);
      this.world.scene.add(m);
      const label = this.world.addLabel(def.title, () => m.position.clone().setY(10), 'label mission', 160);
      return { def, x, z, model: m, label, armed: true };
    });
  }

  placeTylerAtHome() {
    const p = this.places.home;
    const [x, z] = toWorld(this.patrol.x, this.patrol.z, this.patrol.heading, this.patrol.width / 2 + 1.2, 0);
    this.foot.place(x, z, p.rot);
    this.footYaw = p.rot + Math.PI;
  }

  playerPos() {
    return this.driving ? [this.driving.x, this.driving.z] : [this.foot.x, this.foot.z];
  }

  // ---------- Screens and modes ----------

  showTitle() {
    this.mode = 'title';
    this.hud.show(false);
    this.controls.show(false);
    this.world.setCamera({ follow: () => this.tylerModel.position, autoYaw: null, yaw: this.places.home.rot + 0.7, pitch: 0.32, dist: 16, lookHeight: 2.5, fovKick: 0 });
    this.world.snapCamera();
    titleScreen(() => this.start());
  }

  start() {
    audio.unlock();
    clearScreen();
    this.mode = 'play';
    this.hud.show(true);
    this.controls.show(true);
    this.enterFoot();
    if (!state.save.seenIntro) {
      state.save.seenIntro = true;
      state.persist();
      const tips = [
        'Left thumb: joystick to run. Drag the open screen to look around.',
        'Walk up to your patrol car and tap GET IN.',
        'Yellow ! markers are missions. Smash stuff for coins!',
      ];
      tips.forEach((t, i) => setTimeout(() => this.hud.toast(t, 3800), 400 + i * 4200));
    } else {
      this.hud.toast(`Welcome back to ${state.config.townName}, Deputy.`);
    }
  }

  enterFoot() {
    this.driving = null;
    this.tylerModel.visible = true;
    this.controls.setScheme('foot');
    this.world.setCamera({
      follow: () => this.tylerModel.position, autoYaw: () => this.footYaw,
      basePitch: 0.38, pitch: 0.38, dist: 11, minDist: 6, maxDist: 30, lookHeight: 2.6, fovKick: 0,
    });
    audio.engine(null);
    this.syncMusic();
  }

  enterCar(veh) {
    this.driving = veh;
    veh.siren = false;
    this.tylerModel.visible = false;
    this.controls.setScheme('car');
    this.controls.showButton('siren', veh.kind === 'patrol');
    this.world.setCamera({
      follow: () => veh.model.position, autoYaw: () => this.carYaw(veh),
      basePitch: 0.3, pitch: 0.3, dist: 15, minDist: 9, maxDist: 40, lookHeight: 2.2,
    });
    audio.sfx('carDoor');
    this.syncMusic();
  }

  // Camera sits behind the direction of travel (looks back when reversing).
  carYaw(veh) {
    const f = veh.forwardSpeed;
    const back = f < -3 ? veh.heading : veh.heading + Math.PI;
    return back;
  }

  syncMusic() {
    if (this.mission) audio.playMusic('mission');
    else audio.playMusic(this.driving ? 'drive' : 'walk');
    audio.setTempo(this.sarge ? 1.2 : 1);
  }

  pause() {
    if (this.mode !== 'play' || this.world.paused) return;
    if (this.modal) { closeCards(); this.modal = false; } // the pause menu replaces any open card
    if (this.mission?.talking) this.mission.talking = false; // walk up to Dan again to finish the chat
    this.world.paused = true;
    this.controls.show(false);
    audio.engine(null);
    pauseMenu({
      inMission: !!this.mission,
      onResume: () => this.resume(),
      onToggle: (key) => {
        state.settings[key] = !state.settings[key];
        state.saveSettings();
        audio.applySettings();
      },
      onQuitMission: () => { this.resume(); this.endMission(); this.hud.toast('Mission abandoned.'); },
      onReset: () => {
        state.resetSave();
        this.cans.clear((c) => c.hidden);
        for (const s of this.hiddenSpots) this.cans.add(s.id, s.x, s.z, 0x3ddc84, 30).hidden = true;
        this.resume();
        this.hud.toast('Progress reset.');
      },
    });
  }

  resume() {
    closeCards();
    this.world.paused = false;
    this.controls.show(true);
  }

  // ---------- Frame update ----------

  update(dt) {
    this.time += dt;
    if (this.mode === 'title') {
      this.world.rig.yaw += dt * 0.15;
      this.foot.sync(dt, 0);
      this.patrol.sync(dt);
      return;
    }
    if (this.mode !== 'play') return;

    const c = this.controls;
    const axis = this.modal ? { x: 0, y: 0, m: 0 } : c.axis();
    const act = {
      jump: c.consume('jump'), kick: c.consume('kick'), enter: c.consume('enter'),
      horn: c.consume('horn'), siren: c.consume('siren'),
    };
    if (this.modal) for (const k in act) act[k] = false;

    if (this.driving) this.updateDriving(dt, axis, act);
    else this.updateFoot(dt, axis, act);
    const [px, pz] = this.playerPos();

    // Idle (parked / wrecked / abandoned) cars coast to a stop and collide.
    for (const v of this.vehicles) {
      if (v === this.driving) continue;
      if (v.speed > 0.05 || Math.abs(v.spin) > 0.01) v.update(dt, { throttle: 0, steer: 0, idle: true }, this.colliders, this.roads, this.bounds);
    }

    // The living city.
    const obstacles = [{ x: px, z: pz }];
    for (const v of this.vehicles) if (v !== this.driving) obstacles.push({ x: v.x, z: v.z });
    if (this.sarge) obstacles.push({ x: this.sarge.veh.x, z: this.sarge.veh.z });
    this.traffic.update(dt, px, pz, obstacles, !!this.driving?.siren);
    const threats = [];
    if (this.driving) threats.push({ x: this.driving.x, z: this.driving.z, vx: this.driving.vx, vz: this.driving.vz });
    if (this.sarge) threats.push({ x: this.sarge.veh.x, z: this.sarge.veh.z, vx: this.sarge.veh.vx, vz: this.sarge.veh.vz });
    this.peds.update(dt, px, pz, threats);
    this.props.update(dt, px, pz);

    if (this.driving) this.carHits(this.driving, true);
    for (const v of this.vehicles) if (v !== this.driving && v.speed > 8) this.carHits(v, false);
    this.updateSarge(dt, px, pz);

    this.updatePickups(dt, px, pz);
    this.fx.update(dt);
    this.updateMarkers(dt, px, pz);
    this.updateNpcs(dt, px, pz);
    if (this.mission) this.updateMission(dt);
    this.updateHeat(dt, px, pz);
    this.updateArrow(dt, px, pz);
    this.pruneVehicles(px, pz);

    this.hud.update({
      heat: this.heat.level,
      pursuit: this.heat.pursuit,
      mission: this.mission,
      speedMph: this.driving ? Math.round(this.driving.speed * MPH) : null,
      cans: state.save.cans.length,
      cansTotal: this.hiddenSpots.length,
      view: {
        x: px, z: pz,
        heading: this.driving ? this.driving.heading : this.foot.heading,
        yaw: this.world.rig.yaw,
        route: this.mission?.route,
        markers: this.mission ? [] : this.markers.map((m) => ({ x: m.x, z: m.z })),
        target: this.mission?.target(),
        sarge: this.sarge ? { x: this.sarge.veh.x, z: this.sarge.veh.z } : null,
        cans: this.mission?.cans,
      },
    });
    c.endFrame();
  }

  updateFoot(dt, axis, act) {
    const f = this.foot;
    const ev = f.update(dt, axis, this.world.rig.yaw, act, this.colliders, this.bounds);
    if (ev.jumped) audio.sfx('jump');
    if (ev.landed > 0.3) { audio.sfx('land'); this.fx.puff(f.x, f.z, 5); }
    if (ev.kicked) this.kick();

    // Camera swings in behind Tyler while he runs forward.
    const speed = Math.hypot(f.vx, f.vz);
    // On foot, a drag turns the camera for good (no swing back).
    this.footYaw += this.world.rig.userYaw;
    this.world.rig.userYaw = 0;
    if (axis.m > 0 && axis.y > 0.5 && this.world.rig.dragIdle > 1) this.footYaw = angleLerp(this.footYaw, f.heading + Math.PI, Math.min(1, dt * 0.25 * speed));

    // Anything we could drive?
    const near = this.nearestCar(f.x, f.z);
    this.controls.showButton('enter', !!near, near?.traffic ? 'TAKE CAR' : 'GET IN');
    if (act.enter && near) this.getIn(near);

    // A sliding wreck can bowl Tyler over.
    for (const v of this.vehicles) {
      if (v.speed > 7 && f.down <= 0 && Math.hypot(v.x - f.x, v.z - f.z) < v.width * 0.8 + 0.6) {
        f.knock(v.vx * 0.7, v.vz * 0.7);
        audio.sfx('bonk');
        this.world.addShake(0.6);
      }
    }
  }

  nearestCar(x, z) {
    let best = null;
    let bestD = Infinity;
    const consider = (veh, traffic, car) => {
      const d = Math.hypot(veh.x - x, veh.z - z) - veh.length / 2;
      if (d < 2.6 && d < bestD) { bestD = d; best = { veh, traffic, car }; }
    };
    for (const v of this.vehicles) if (v.speed < 6) consider(v, false);
    for (const car of this.traffic.cars) if (!car.special) consider(car.veh, true, car);
    return best;
  }

  getIn({ veh, traffic, car }) {
    if (traffic) {
      // "Official business!" The driver gets the boot.
      this.traffic.remove(car);
      veh.vx = 0;
      veh.vz = 0;
      this.vehicles.push(veh);
      const [dx, dz] = toWorld(veh.x, veh.z, veh.heading, veh.width / 2 + 1, 0);
      this.peds.eject(dx, dz, (dx - veh.x) * 3, (dz - veh.z) * 3);
      this.heat.add('carjack');
      audio.sfx('hey');
      this.world.popText('OFFICIAL BUSINESS!', veh.model.position.clone().setY(5), 'pop big');
    }
    // Snappy hop into the seat.
    this.fx.puff(this.foot.x, this.foot.z, 4);
    this.enterCar(veh);
  }

  getOut() {
    const v = this.driving;
    const fast = v.speed > 10;
    let spot = null;
    for (const side of [1, -1]) {
      const [x, z] = toWorld(v.x, v.z, v.heading, side * (v.width / 2 + 1.1), 0);
      if (!this.colliders.blocked(x, z, 0.7)) { spot = [x, z]; break; }
    }
    if (!spot) spot = toWorld(v.x, v.z, v.heading, 0, -(v.length / 2 + 1.2));
    v.siren = false;
    v.model.userData.setLights?.(false);
    this.enterFoot();
    this.foot.place(spot[0], spot[1], v.heading);
    this.footYaw = this.world.rig.yaw;
    if (fast) {
      // Bail out at speed: tumble like a stunt double.
      this.foot.knock(v.vx * 0.5, v.vz * 0.5);
      audio.sfx('bonk');
      this.world.popText('BAIL!', this.tylerModel.position.clone().setY(4), 'pop big');
    } else {
      audio.sfx('carDoor');
      this.foot.rig.hop();
    }
  }

  updateDriving(dt, axis, act) {
    const v = this.driving;
    const drift = this.controls.isHeld('drift');
    const hit = v.update(dt, { throttle: axis.y, steer: axis.x, drift }, this.colliders, this.roads, this.bounds);
    if (hit && hit.impact > 5) {
      audio.sfx(hit.impact > 12 ? 'crash' : 'thud');
      this.world.addShake(Math.min(1.2, hit.impact / 18));
      this.fx.sparks(hit.x, 1, hit.z, Math.min(14, Math.round(hit.impact)));
      if (hit.impact > 14) {
        this.fx.puff(hit.x, hit.z, 6);
        this.world.popText(SMASH_WORDS[Math.floor(Math.random() * SMASH_WORDS.length)], v.model.position.clone().setY(4), 'pop');
        navigator.vibrate?.(60);
      }
    }
    if (v.drifting && Math.random() < 0.5) {
      const [bx, bz] = toWorld(v.x, v.z, v.heading, (Math.random() - 0.5) * v.width, -v.length * 0.4);
      this.fx.emit(bx, 0.4, bz, { color: 0xd8d8d8, life: 0.6, size: 0.9, grow: 2, vy: 1 });
    }
    if (act.horn) {
      audio.sfx('horn');
      for (const p of this.peds.list) if (p.state === 'walk' && Math.hypot(p.x - v.x, p.z - v.z) < 18) p.rig.hop();
    }
    if (act.siren && v.kind === 'patrol') {
      v.siren = !v.siren;
      this.sirenTimer = 0;
      this.controls.setButtonActive('siren', v.siren);
      this.hud.toast(v.siren ? 'Siren on: traffic pulls over.' : 'Siren off.');
    }
    v.model.userData.setLights?.(v.siren, dt);
    if (v.siren) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) { audio.sfx('siren'); this.sirenTimer = 1.2; }
    }
    if (act.enter) { this.getOut(); return; }

    audio.engine(Math.min(1, v.speed / v.stats.maxSpeed));
    this.world.rig.fovKick = Math.min(14, v.speed * 0.35);
    if (v.boost > 0) {
      v.boost -= dt;
      if (v.boost <= 0) v.boost = 0;
    }
  }

  // A moving car (player, or a sliding wreck) against traffic, parked cars, peds and props.
  carHits(v, isPlayer) {
    const reach = v.length / 2 + 4;
    for (const car of [...this.traffic.cars]) {
      if (Math.abs(car.x - v.x) > reach + 4 || Math.abs(car.z - v.z) > reach + 4) continue;
      const res = collideVehicles(v, car.veh);
      if (!res) continue;
      car.x = car.veh.x;
      car.z = car.veh.z;
      if (isPlayer && this.mission?.rammed(car, res.impact)) {
        audio.sfx('crash');
        this.world.addShake(0.8);
        this.fx.sparks(res.x, 1.2, res.z, 12);
        this.world.popText(`HIT ${this.mission.run.progress}/${this.mission.run.goal}`, car.model.position.clone().setY(5), 'pop big');
        continue;
      }
      if (res.impact > 9 && !car.special) this.wreck(car, res, isPlayer);
      else if (res.impact > 2 && isPlayer) {
        audio.sfx('thud');
        if (car.honk <= 0) { car.honk = 2; setTimeout(() => audio.sfx('horn'), 150); }
      }
    }
    for (const o of this.vehicles) {
      if (o === v || (!isPlayer && o === this.driving)) continue; // the player's car handles its own hits
      if (Math.abs(o.x - v.x) > reach + 4 || Math.abs(o.z - v.z) > reach + 4) continue;
      const res = collideVehicles(v, o);
      if (res && res.impact > 4 && isPlayer) {
        audio.sfx(res.impact > 10 ? 'crash' : 'thud');
        this.world.addShake(Math.min(1, res.impact / 15));
        this.fx.sparks(res.x, 1, res.z, 8);
        o.bump(Math.min(1, res.impact / 15));
      }
    }
    const circles = v.circles();
    const speed = v.speed;
    if (speed > 3) {
      for (const p of this.peds.list) {
        if (p.state === 'fly' || p.state === 'down') continue;
        if (Math.abs(p.x - v.x) > reach || Math.abs(p.z - v.z) > reach) continue;
        if (!circles.some(([cx, cz, r]) => Math.hypot(p.x - cx, p.z - cz) < r + 0.6)) continue;
        const nx = p.x - v.x;
        const nz = p.z - v.z;
        const n = Math.hypot(nx, nz) || 1;
        this.peds.launch(p, v.vx * 0.9 + (nx / n) * 4, v.vz * 0.9 + (nz / n) * 4, 7 + speed * 0.25);
        v.vx *= 0.92;
        v.vz *= 0.92;
        audio.sfx('bonk');
        if (isPlayer) {
          this.heat.add('ped');
          this.world.addShake(0.4);
          this.world.popText(OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)], p.model.position.clone().setY(4), 'pop');
        }
      }
    }
    if (speed > 2) {
      for (const it of this.props.near(v.x, v.z, v.length / 2 + 0.5)) {
        if (!circles.some(([cx, cz, r]) => Math.hypot(it.x - cx, it.z - cz) < r + it.r)) continue;
        this.props.smash(it, v.vx, v.vz);
        v.vx *= 0.97;
        v.vz *= 0.97;
        if (isPlayer) this.smashed(it);
      }
    }
  }

  wreck(car, res, byPlayer) {
    this.traffic.remove(car);
    car.veh.spin += (Math.random() - 0.5) * 6;
    car.veh.bump(1);
    this.vehicles.push(car.veh);
    audio.sfx('crash');
    this.fx.sparks(res.x, 1.2, res.z, 14);
    this.fx.puff(res.x, res.z, 8);
    if (byPlayer) {
      this.world.addShake(1);
      this.heat.add('crash');
      this.coins.burst(car.x, car.z, 3);
      this.world.popText(SMASH_WORDS[Math.floor(Math.random() * SMASH_WORDS.length)], car.model.position.clone().setY(5), 'pop big');
      navigator.vibrate?.(80);
    }
  }

  smashed(it) {
    audio.sfx('smash');
    this.fx.puff(it.x, it.z, 4);
    this.coins.burst(it.x, it.z, 1 + Math.floor(Math.random() * 3));
    this.heat.add('prop');
    this.mission?.smashed();
    if (Math.random() < 0.35) this.world.popText(SMASH_WORDS[Math.floor(Math.random() * SMASH_WORDS.length)], new THREE.Vector3(it.x, 3, it.z), 'pop');
  }

  kick() {
    const f = this.foot;
    audio.sfx('kick');
    const [kx, kz] = f.front(1.6);
    const dx = Math.sin(f.heading);
    const dz = Math.cos(f.heading);
    let hit = false;
    for (const it of this.props.near(kx, kz, 1.3)) {
      this.props.smash(it, dx * 13, dz * 13);
      this.smashed(it);
      hit = true;
    }
    for (const p of this.peds.list) {
      if (p.state === 'fly' || p.state === 'down') continue;
      if (Math.hypot(p.x - kx, p.z - kz) < 1.6) {
        this.peds.launch(p, dx * 10, dz * 10, 8);
        this.heat.add('kick');
        audio.sfx('bonk');
        this.world.popText(OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)], p.model.position.clone().setY(4), 'pop');
        hit = true;
      }
    }
    for (const v of this.vehicles) {
      if (Math.hypot(v.x - kx, v.z - kz) < v.length / 2 + 0.5) {
        v.vx += dx * 3;
        v.vz += dz * 3;
        v.bump(0.6);
        hit = true;
      }
    }
    if (hit) this.world.addShake(0.3);
  }

  updatePickups(dt, px, pz) {
    const reach = this.driving ? 3.6 : 1.9;
    const got = this.coins.update(dt, px, pz, reach);
    this.coinSfx -= dt;
    if (got) {
      state.addCoins(got);
      this.hud.bumpCoins();
      if (this.coinSfx <= 0) { audio.sfx('coin'); this.coinSfx = 0.06; }
    }
    const py = this.driving ? 0 : this.foot.y;
    for (const can of this.cans.update(dt, px, pz, py, this.driving ? 3.8 : 2.4)) {
      if (this.mission?.collect(can)) {
        audio.sfx('can');
        this.world.popText(`${this.mission.run.progress}/${this.mission.run.goal}`, new THREE.Vector3(can.x, 4, can.z), 'pop big');
        continue;
      }
      if (!can.hidden) continue;
      this.cans.remove(can);
      if (state.collectCan(can.id)) {
        audio.sfx('can');
        state.addCoins(10);
        this.fx.confetti(can.x, 2, can.z, 20);
        this.hud.bannerText(`GHOST CAN ${state.save.cans.length}/${this.hiddenSpots.length}`, 'green', 1800);
        this.hud.toast('Ghost rush! Speed boost.', 2000);
        this.foot.rush = state.config.player.ghostRushSeconds;
        if (this.driving) this.driving.boost = state.config.player.ghostRushSeconds;
        audio.sfx('gulp');
      }
    }
  }

  // ---------- Missions ----------

  updateMarkers(dt, px, pz) {
    for (const m of this.markers) {
      m.model.visible = !this.mission;
      if (this.mission) continue;
      m.model.userData.animate(dt);
      const d = Math.hypot(m.x - px, m.z - pz);
      if (d > 9) m.armed = true;
      const slowEnough = !this.driving || this.driving.speed < 14;
      if (m.armed && d < 4.2 && slowEnough && !this.modal) {
        m.armed = false;
        this.offerMission(m.def);
      }
    }
    for (const m of this.markers) m.label.el.hidden = !!this.mission;
  }

  offerMission(def) {
    this.modal = true;
    audio.sfx('ding');
    briefCard(def, {
      onAccept: () => { closeCards(); this.modal = false; this.startMission(def); },
      onDecline: () => { closeCards(); this.modal = false; },
    });
  }

  startMission(def) {
    this.mission?.end();
    this.mission = new MissionRunner(this, def);
    this.mission.setupStage();
    audio.sfx('start');
    this.hud.bannerText(def.title.toUpperCase(), '', 1600);
    this.syncMusic();
  }

  updateMission(dt) {
    const m = this.mission;
    m.update(dt);
    while (m.messages.length) this.hud.toast(m.messages.shift(), 3000);
    if (m.status === 'complete') {
      const secs = m.run.elapsed;
      const isBest = state.recordMission(m.def.id, secs);
      state.addCoins(m.def.reward);
      state.persist();
      const [px, pz] = this.playerPos();
      this.fx.confetti(px, 3, pz, 40);
      audio.sfx('win');
      this.hud.bannerText('MISSION COMPLETE', 'gold', 2200);
      const def = m.def;
      this.endMission();
      setTimeout(() => {
        this.modal = true;
        resultCard({
          title: def.title,
          lines: [`Time ${formatTimer(secs)}${isBest ? '  (new best!)' : ''}`, `+${def.reward} coins`],
          primary: { label: 'Nice', onClick: () => { closeCards(); this.modal = false; } },
        });
      }, 1200);
    } else if (m.status === 'failed') {
      const reasons = { time: 'Out of time!', lost: 'He got away.', busted: 'Sarge busted you.' };
      const def = m.def;
      const reason = reasons[m.run.failReason] || 'Mission failed.';
      audio.sfx('fail');
      this.hud.bannerText('MISSION FAILED', 'red', 2000);
      this.endMission();
      setTimeout(() => {
        this.modal = true;
        resultCard({
          title: def.title,
          lines: [reason],
          primary: { label: 'Retry', onClick: () => { closeCards(); this.modal = false; this.retryMission(def); } },
          secondary: { label: 'Free roam', onClick: () => { closeCards(); this.modal = false; } },
        });
      }, 1200);
    }
  }

  endMission() {
    this.mission?.end();
    this.mission = null;
    this.arrow.visible = false;
    for (const m of this.markers) m.armed = false; // don't re-offer while standing on it
    this.syncMusic();
  }

  // Back to the mission's start, then go again.
  retryMission(def) {
    const p = this.places[def.start];
    if (this.driving) {
      const v = this.driving;
      const [x, z] = p.park || p.marker;
      Object.assign(v, { x, z, heading: p.parkRot ?? p.rot, vx: 0, vz: 0, spin: 0 });
      v.sync(0);
    } else {
      this.foot.place(p.marker[0], p.marker[1], p.rot);
    }
    this.world.snapCamera();
    this.startMission(def);
  }

  updateArrow(dt, px, pz) {
    const t = this.mission?.target();
    const show = !!t && Math.hypot(t.x - px, t.z - pz) > 12;
    this.arrow.visible = show;
    if (!show) return;
    const y = (this.driving ? 5.2 : 5) + Math.sin(this.time * 4) * 0.25;
    this.arrow.position.set(px, y, pz);
    const want = Math.atan2(t.x - px, t.z - pz);
    this.arrow.rotation.y = angleLerp(this.arrow.rotation.y, want, Math.min(1, dt * 10));
  }

  // ---------- Heat and Sarge ----------

  updateHeat(dt, px, pz) {
    const far = !this.sarge || Math.hypot(this.sarge.veh.x - px, this.sarge.veh.z - pz) > 140;
    const ended = this.heat.tick(dt, far);
    if (this.heat.pursuit && !this.sarge) this.spawnSarge(px, pz);
    if (ended && this.sarge) {
      this.hud.toast('You lost Sarge. Heat is off.');
      this.removeSarge();
    }
  }

  spawnSarge(px, pz) {
    const node = this.traffic.nodeNear(px, pz, 90, 160);
    if (node === null) return;
    const [x, z] = vert(map, node);
    const veh = new Vehicle(makePatrolCar('SARGE'), { x, z, heading: Math.atan2(px - x, pz - z) });
    veh.stats = { ...veh.stats, maxSpeed: veh.stats.maxSpeed * 0.97 };
    veh.siren = true;
    this.world.scene.add(veh.model);
    this.sarge = { veh, stuck: 0, reverse: 0, leaving: 0, label: this.world.addLabel('SARGE', () => veh.model.position.clone().setY(5.5), 'label target') };
    audio.sfx('alarm');
    this.hud.bannerText('SARGE IS ON YOUR TAIL!', 'red', 2200);
    this.syncMusic();
  }

  removeSarge() {
    if (!this.sarge) return;
    this.sarge.veh.model.removeFromParent();
    this.sarge.label.remove();
    this.sarge = null;
    this.syncMusic();
  }

  updateSarge(dt, px, pz) {
    const s = this.sarge;
    if (!s) return;
    const v = s.veh;
    const dx = px - v.x;
    const dz = pz - v.z;
    const dist = Math.hypot(dx, dz);
    let throttle = 1;
    let steer;
    if (s.leaving > 0) {
      // Drives off, then disappears.
      s.leaving -= dt;
      steer = Math.max(-1, Math.min(1, angleDiff(v.heading, Math.atan2(-dx, -dz)) * -2));
      if (s.leaving <= 0 || dist > 120) { this.removeSarge(); return; }
    } else {
      steer = Math.max(-1, Math.min(1, angleDiff(v.heading, Math.atan2(dx, dz)) * -2.2));
      if (v.speed < 2) s.stuck += dt;
      else s.stuck = 0;
      if (s.stuck > 1.2) { s.reverse = 1; s.stuck = 0; }
      if (s.reverse > 0) { s.reverse -= dt; throttle = -1; steer = -steer; }
      v.boost = dist > 110 ? 1 : 0; // rubber band so he never falls too far behind
    }
    v.update(dt, { throttle, steer, drift: false }, this.colliders, this.roads, this.bounds);
    v.model.userData.setLights?.(true, dt);
    this.carHits(v, false);
    if (s.leaving > 0) return;

    // Busted: Sarge rams the player's car or tackles Tyler.
    let busted = false;
    if (this.driving) {
      const res = collideVehicles(v, this.driving);
      if (res && res.impact > 4) busted = true;
    } else if (dist < 3.2) {
      this.foot.knock(v.vx * 0.5, v.vz * 0.5);
      busted = true;
    }
    if (busted) this.busted();
  }

  busted() {
    const fine = bustedFine(state.save.coins);
    state.addCoins(-fine);
    audio.sfx('busted');
    this.world.addShake(1);
    this.hud.bannerText('BUSTED!', 'red', 2000);
    this.hud.toast(`Sarge wrote you up. -${fine} coins.`, 3000);
    this.heat.reset();
    this.sarge.leaving = 4;
    this.sarge.label.setText('SARGE');
    if (this.mission) this.mission.run.fail('busted');
  }

  // Keep only a handful of parked/abandoned cars around.
  pruneVehicles(px, pz) {
    const extra = this.vehicles.filter((v) => v !== this.patrol && v !== this.driving);
    if (extra.length <= MAX_PARKED) return;
    extra.sort((a, b) => Math.hypot(b.x - px, b.z - pz) - Math.hypot(a.x - px, a.z - pz));
    const victim = extra[0];
    if (Math.hypot(victim.x - px, victim.z - pz) < 60) return;
    victim.model.removeFromParent();
    this.vehicles.splice(this.vehicles.indexOf(victim), 1);
  }
}
