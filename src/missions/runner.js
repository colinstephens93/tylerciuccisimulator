// Runs a mission in the 3D world: places beacons, spawns cans and the speeder, and turns
// world events (reaching a spot, smashing, ramming) into MissionRun progress.
import { makeBeacon } from '../engine/models.js';
import { MissionRun } from './logic.js';
import { gpsRoute } from '../map/places.js';

const REACH_RADIUS = 7;
const LOSE_DISTANCE = 330;

export class MissionRunner {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.run = new MissionRun(def);
    this.beacon = null;
    this.cans = [];
    this.speeder = null;
    this.hitCooldown = 0;
    this.route = null;
    this.routeTimer = 0;
    this.messages = [];
  }

  get status() {
    return this.run.status;
  }

  setupStage() {
    this.cleanupStage();
    const g = this.game;
    const s = this.run.stage;
    if (s.type === 'reach') {
      const p = g.places[s.target];
      this.beacon = makeBeacon(0x3fa9f5);
      this.beacon.position.set(p.marker[0], 0, p.marker[1]);
      g.world.scene.add(this.beacon);
      this.beaconLabel = g.world.addLabel(p.label, () => this.beacon.position.clone().setY(13), 'label dest');
    } else if (s.type === 'collect') {
      const [px, pz] = g.playerPos();
      for (let i = 0; i < s.count; i++) {
        const spot = g.findSpotNear(px, pz, 25, s.radius, this.cans);
        if (spot) this.cans.push(g.cans.add(`mission${i}`, spot[0], spot[1], 0xff8a3d, 14));
      }
      // If the map was too cramped to fit them all, ask for fewer.
      this.run.def = { ...this.run.def, stages: this.run.def.stages.map((st, i) => (i === this.run.stageIndex ? { ...st, count: Math.max(1, this.cans.length) } : st)) };
    } else if (s.type === 'pursuit') {
      const [px, pz] = g.playerPos();
      const node = g.traffic.nodeNear(px, pz, 50, 110);
      if (node !== null) {
        this.speeder = g.traffic.spawnAt(node, 'sports', { color: 0xffd23f, special: 'speeder' });
        this.speeder.cruise = 26;
        this.speederLabel = g.world.addLabel('SPEEDER', () => this.speeder.model.position.clone().setY(5), 'label target');
      } else {
        this.run.fail('lost');
      }
    }
    this.route = null;
    this.routeTimer = 0;
  }

  cleanupStage() {
    const g = this.game;
    this.beacon?.removeFromParent();
    this.beacon = null;
    this.beaconLabel?.remove();
    this.beaconLabel = null;
    for (const c of this.cans) if (g.cans.list.includes(c)) g.cans.remove(c);
    this.cans = [];
    if (this.speeder) {
      this.speeder.model.removeFromParent();
      g.traffic.remove(this.speeder);
      this.speeder = null;
    }
    this.speederLabel?.remove();
    this.speederLabel = null;
  }

  // Where the GPS arrow should point, or null.
  target() {
    const s = this.run.stage;
    if (this.run.status !== 'active') return null;
    if (s.type === 'reach') {
      const p = this.game.places[s.target];
      return { x: p.marker[0], z: p.marker[1] };
    }
    if (s.type === 'pursuit' && this.speeder) return { x: this.speeder.x, z: this.speeder.z };
    if (s.type === 'collect' && this.cans.length) {
      const [px, pz] = this.game.playerPos();
      let best = null;
      for (const c of this.cans) if (!best || Math.hypot(c.x - px, c.z - pz) < Math.hypot(best.x - px, best.z - pz)) best = c;
      return { x: best.x, z: best.z };
    }
    return null;
  }

  // Called by the game when a mission can is picked up. Returns true if it was ours.
  collect(can) {
    const i = this.cans.indexOf(can);
    if (i < 0) return false;
    this.cans.splice(i, 1);
    this.game.cans.remove(can);
    this.advance();
    return true;
  }

  smashed() {
    if (this.run.stage.type === 'smash') this.advance();
  }

  // The player's car hit a traffic car; counts if it's the speeder.
  rammed(car, impact) {
    if (this.run.stage.type !== 'pursuit' || car !== this.speeder || this.hitCooldown > 0 || impact < 3) return false;
    this.hitCooldown = 1;
    this.speeder.speed *= 0.4;
    this.speeder.cruise += 2; // he gets desperate
    this.advance();
    return true;
  }

  advance() {
    const before = this.run.stageIndex;
    const doneText = this.run.stage.done;
    this.run.advance();
    if (this.run.stageIndex !== before || this.run.status === 'complete') {
      if (doneText) this.messages.push(doneText);
      if (this.run.status === 'active') this.setupStage();
    }
  }

  update(dt) {
    const g = this.game;
    this.run.tick(dt);
    this.hitCooldown -= dt;
    if (this.run.status !== 'active') return;
    const s = this.run.stage;
    const [px, pz] = g.playerPos();
    this.beacon?.userData.animate(dt);
    if (s.type === 'reach') {
      const p = g.places[s.target];
      if (Math.hypot(p.marker[0] - px, p.marker[1] - pz) < REACH_RADIUS) this.advance();
    }
    if (s.type === 'pursuit' && this.speeder && Math.hypot(this.speeder.x - px, this.speeder.z - pz) > LOSE_DISTANCE) this.run.fail('lost');

    // GPS route for the mini-map, refreshed now and then.
    this.routeTimer -= dt;
    if (this.routeTimer <= 0) {
      this.routeTimer = 1.5;
      const t = this.target();
      this.route = s.type === 'reach' && t ? gpsRoute(g.graph, px, pz, g.places[s.target]) : null;
    }
  }

  end() {
    this.cleanupStage();
  }
}
