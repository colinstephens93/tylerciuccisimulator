// AI traffic driving the real street network around the player. Cars follow lanes, pick
// turns at intersections, slow for corners and anything in front, and pull over for the siren.
import { makeCar } from '../engine/models.js';
import { angleLerp } from '../engine/util.js';
import { vert } from '../map/graph.js';
import { Vehicle } from './vehicle.js';
import { cruiseSpeed, edgePose, laneOffset, nextEdge, nodeInRing, turnAngle } from './roadnet.js';

const KINDS = ['sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'pickup', 'pickup', 'sports', 'bus'];
const SPAWN_MIN = 90;
const SPAWN_MAX = 230;
const DESPAWN = 290;

export class Traffic {
  constructor(scene, net, count) {
    this.scene = scene;
    this.net = net;
    this.count = count;
    this.cars = [];
    this.spawnTimer = 0;
  }

  // Place a car on a random edge leaving `node`.
  spawnAt(node, kind, opts = {}) {
    const edges = this.net.out[node];
    if (!edges.length) return null;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const model = makeCar(kind, opts);
    this.scene.add(model);
    const pose = edgePose(this.net, edge, 0, laneOffset(edge.road));
    const veh = new Vehicle(model, { x: pose.x, z: pose.z, heading: pose.heading });
    const car = {
      model, veh, edge, next: null, d: 0, kind,
      lat: laneOffset(edge.road), speed: 0, x: pose.x, z: pose.z, heading: pose.heading,
      cruise: cruiseSpeed(edge.road.t) * (0.85 + Math.random() * 0.3) * (kind === 'bus' ? 0.75 : 1),
      pullOver: 0, honk: 0, special: opts.special || null,
    };
    this.cars.push(car);
    return car;
  }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  clear(keepSpecial = false) {
    for (const c of [...this.cars]) {
      if (keepSpecial && c.special) continue;
      c.model.removeFromParent();
      this.remove(c);
    }
  }

  // obstacles: [{ x, z }] the AI should not drive into (player, parked cars, pedestrians).
  update(dt, px, pz, obstacles, siren) {
    this.spawnTimer -= dt;
    const normal = this.cars.filter((c) => !c.special).length;
    if (normal < this.count && this.spawnTimer <= 0) {
      this.spawnTimer = 0.25;
      const node = nodeInRing(this.net, px, pz, SPAWN_MIN, SPAWN_MAX);
      if (node >= 0) this.spawnAt(node, KINDS[Math.floor(Math.random() * KINDS.length)]);
    }

    for (const car of [...this.cars]) {
      if (!car.special && Math.hypot(car.x - px, car.z - pz) > DESPAWN) {
        car.model.removeFromParent();
        this.remove(car);
        continue;
      }
      this.drive(car, dt, obstacles, siren, px, pz);
    }
  }

  drive(car, dt, obstacles, siren, px, pz) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const reckless = car.special === 'speeder';
    let want = car.cruise;

    // Slow for sharp turns at the end of this edge.
    if (!car.next) car.next = nextEdge(this.net, car.edge);
    const remaining = car.edge.len - car.d;
    if (car.next && remaining < 14) {
      const turn = Math.abs(turnAngle(car.edge, car.next));
      if (turn > 0.5) want = Math.min(want, reckless ? 14 : 6 + (14 - remaining) * 0.1);
    }

    // Brake for anything in front (other cars, the player, parked cars).
    if (!reckless) {
      const check = (ox, oz, gap) => {
        const dx = ox - car.x;
        const dz = oz - car.z;
        const ahead = dx * fx + dz * fz;
        if (ahead <= 0 || ahead > 22) return;
        const side = Math.abs(dx * fz - dz * fx);
        if (side > 2.6) return;
        want = Math.min(want, Math.max(0, (ahead - gap) * 1.1));
      };
      for (const o of this.cars) if (o !== car) check(o.x, o.z, 8);
      for (const o of obstacles) check(o.x, o.z, 7);
    }

    // Siren: nearby cars pull over to the curb and wait.
    if (siren && !car.special && Math.hypot(car.x - px, car.z - pz) < 60 && car.pullOver <= 0) car.pullOver = 5;
    let lat = laneOffset(car.edge.road);
    if (car.pullOver > 0) {
      car.pullOver -= dt;
      lat += car.edge.road.ow ? car.edge.road.w * 0.3 : 2.4;
      want = Math.min(want, car.pullOver > 1.5 ? 0 : 4);
    }
    if (reckless) lat += Math.sin(car.d * 0.08) * 1.4; // weaving

    const rate = want < car.speed ? 16 : car.special ? 14 : 6;
    car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), rate * dt);
    car.d += car.speed * dt;
    while (car.d >= car.edge.len) {
      car.d -= car.edge.len;
      const next = car.next || nextEdge(this.net, car.edge);
      car.next = null;
      if (!next) { car.d = car.edge.len - 0.01; car.speed = 0; break; }
      car.edge = next;
    }

    car.lat += (lat - car.lat) * Math.min(1, dt * 2.5);
    const pose = edgePose(this.net, car.edge, car.d, car.lat);
    const k = Math.min(1, dt * 9);
    const ox = car.x;
    const oz = car.z;
    car.x += (pose.x - car.x) * k;
    car.z += (pose.z - car.z) * k;
    car.heading = angleLerp(car.heading, pose.heading, Math.min(1, dt * 7));
    const v = car.veh;
    v.vx = (car.x - ox) / Math.max(dt, 1e-3);
    v.vz = (car.z - oz) / Math.max(dt, 1e-3);
    v.x = car.x;
    v.z = car.z;
    v.heading = car.heading;
    v.steer = 0;
    v.sync(dt);
    if (car.honk > 0) car.honk -= dt;
  }

  // Where a pedestrian or car would be standing: the start node of a random edge near (x, z).
  nodeNear(x, z, minD, maxD) {
    const n = nodeInRing(this.net, x, z, minD, maxD);
    return n >= 0 ? n : null;
  }

  nodePos(node) {
    return vert(this.net.map, node);
  }
}
