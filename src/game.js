// Owns the 3D world, shared models, UI, and the current mode (walk / drive / wawa).
import { state } from './state.js';
import { audio } from './audio.js';
import map from './data/lawrenceville.json';
import { World } from './engine/world.js';
import { makeTyler, makePatrolCar, makeHouse, makeWawa, makeSchool, makeAvatarRing } from './engine/models.js';
import { toWorld } from './engine/util.js';
import { buildCity } from './map/cityMesh.js';
import { computePlaces, driveRoute } from './map/places.js';
import { Hud } from './ui/hud.js';
import { Phone } from './ui/phone.js';
import { titleScreen, loadingScreen, clearScreen, tardyScreen, resultsScreen } from './ui/screens.js';
import { $ } from './ui/dom.js';
import { computeResult } from './logic/scoring.js';
import { totals } from './logic/wawa.js';
import { bindGame, startStep, finishRun, STEPS } from './flow.js';
import { WalkMode } from './modes/walk.js';
import { DriveMode } from './modes/drive.js';
import { WawaMode } from './modes/wawa.js';

const MODES = { walk: WalkMode, drive: DriveMode, wawa: WawaMode };

export class Game {
  constructor() {
    bindGame(this);
    this.world = new World($('#view'), $('#labels'));
    this.hud = new Hud();
    this.phone = new Phone((m) => this.hud.toast(m));
    this.mode = null;
    this.idle = null; // camera drift for title/results
  }

  async load() {
    loadingScreen();
    await new Promise((r) => setTimeout(r, 50));
    const { graph, places } = computePlaces(map);
    this.graph = graph;
    this.places = places;
    this.city = buildCity(map, Object.values(places).map((p) => ({ x: p.x, z: p.z, r: p.clearRadius })));
    const scene = this.world.scene;
    scene.add(this.city);

    const place = (obj, p) => { obj.position.set(p.x, 0, p.z); obj.rotation.y = p.rot; scene.add(obj); return obj; };
    this.landmarks = [place(makeHouse(), places.home), place(makeWawa(), places.wawa), place(makeSchool(), places.school)];
    this.wawaBuilding = this.landmarks[1];
    this.schoolBuilding = this.landmarks[2];

    this.tyler = makeTyler();
    this.avatarRing = makeAvatarRing();
    this.car = makePatrolCar();
    scene.add(this.tyler, this.avatarRing, this.car);

    this.routes = {
      toWawa: driveRoute(graph, places.home, places.wawa),
      toSchool: driveRoute(graph, places.wawa, places.school),
    };

    this.world.onUpdate = (dt) => this.update(dt);
    this.world.onTap = (e) => this.mode?.onTap?.(e);
    this.showTitle();
  }

  parkCar(placeKey) {
    const p = this.places[placeKey];
    this.car.position.set(p.park[0], 0, p.park[1]);
    this.car.rotation.y = p.parkRot;
    this.car.visible = true;
    this.car.userData.setLights(false);
  }

  // Spot next to the driver's door (driver's left = car's local +x).
  carDoor() {
    const [x, z] = toWorld(this.car.position.x, this.car.position.z, this.car.rotation.y, 3.6, 0.5);
    return [x, z];
  }

  setOutdoors(on) {
    this.city.visible = on;
    for (const l of this.landmarks) l.visible = on;
    this.car.visible = on;
  }

  idleCamera(target, yaw) {
    const w = this.world;
    w.setCamera({ follow: () => target, yaw, pitch: 0.55, dist: 30, lookHeight: 3 });
    w.snapCamera();
    this.idle = (dt) => { w.rig.yaw += dt * 0.12; };
  }

  showTitle() {
    this.parkCar('home');
    const [x, z] = this.carDoor();
    this.tyler.position.set(x, 0, z);
    this.tyler.rotation.y = this.car.rotation.y;
    this.tyler.visible = true;
    this.avatarRing.visible = false;
    this.idleCamera(this.tyler.position.clone(), this.car.rotation.y + 0.6);
    this.hud.show(false);
    titleScreen(() => this.start());
  }

  start() {
    audio.unlock();
    state.newRun();
    clearScreen();
    this.idle = null;
    this.hud.show(true);
    startStep(0);
  }

  enterStep(step) {
    this.idle = null;
    this.mode?.exit();
    this.world.clearLabels();
    $('#controls').replaceChildren();
    $('#overlay').replaceChildren();
    this.phone.close();
    clearScreen();
    this.hud.show(true);
    this.setOutdoors(true);
    this.mode = new MODES[step.mode](this, step.data);
    this.mode.enter();
    this.world.snapCamera();
  }

  update(dt) {
    if (this.idle) this.idle(dt);
    this.tyler.userData.animate(dt, false);
    if (!state.clockRunning) return;
    state.clock.tick(dt * 1000);
    this.hud.update();
    this.mode?.update(dt);
    if (state.clockRunning && state.clock.isLate()) {
      audio.sfx('bell');
      finishRun(true);
    }
  }

  showResults(tardy) {
    this.mode?.exit();
    this.mode = null;
    this.phone.close();
    this.world.clearLabels();
    $('#controls').replaceChildren();
    $('#overlay').replaceChildren();
    this.hud.show(false);
    this.setOutdoors(true);
    audio.stopMusic();
    this.tyler.visible = true;
    this.avatarRing.visible = false;
    this.idleCamera(this.tyler.position.clone(), this.world.rig.yaw);

    if (tardy) {
      audio.sfx('tardy');
      tardyScreen({
        stepName: STEPS[state.checkpoint.stepIndex].objective,
        onRetry: () => { state.restoreCheckpoint(); startStep(state.stepIndex); },
        onRestart: () => this.start(),
      });
      return;
    }
    audio.sfx('win');
    const cfg = state.config;
    const t = totals(state.inventory);
    const result = computeResult({
      arrivalMinutes: state.arrivalMinutes,
      bellMinutes: state.clock.bell,
      calories: t.calories,
      caffeineMg: t.caffeineMg,
      goals: cfg.wawaGoals,
      gotFavorite: state.inventory.some((i) => i.flavor === cfg.favoriteGhostFlavor),
      infractions: state.infractions,
      amandaMood: state.amandaMood,
    });
    resultsScreen({ result, isBest: state.recordScore(result.score), onRestart: () => this.start() });
  }
}
