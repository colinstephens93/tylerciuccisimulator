// Lane network for AI traffic and pedestrians, built from the OSM road graph.
// Pure module (no Three.js) so it can be unit tested.
import { vert } from '../map/graph.js';

export const TRAFFIC_TYPES = new Set([
  'residential', 'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
  'primary', 'primary_link', 'trunk', 'trunk_link', 'living_street',
]);
export const WALK_TYPES = new Set([...TRAFFIC_TYPES]);

const CRUISE = { residential: 10, living_street: 7, unclassified: 10, tertiary: 13, tertiary_link: 11 };
export function cruiseSpeed(type) {
  return CRUISE[type] ?? 15;
}

// out[v] = [{ to, road, len, heading }]. Driving respects one-way streets; walking does not.
export function buildLaneNet(map, { types, oneWay }) {
  const n = map.verts.length / 2;
  const out = Array.from({ length: n }, () => []);
  for (const r of map.roads) {
    if (!types.has(r.t)) continue;
    for (let i = 0; i < r.v.length - 1; i++) {
      const a = r.v[i];
      const b = r.v[i + 1];
      const [ax, az] = vert(map, a);
      const [bx, bz] = vert(map, b);
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      out[a].push({ from: a, to: b, road: r, len, heading: Math.atan2(bx - ax, bz - az) });
      if (!oneWay || !r.ow) out[b].push({ from: b, to: a, road: r, len, heading: Math.atan2(ax - bx, az - bz) });
    }
  }
  const nodes = [];
  const cells = new Map(); // spatial index so spawns near the player are cheap to find
  for (let i = 0; i < n; i++) {
    if (!out[i].length) continue;
    nodes.push(i);
    const k = cellKey(map.verts[2 * i], map.verts[2 * i + 1]);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(i);
  }
  return { map, out, nodes, cells };
}

const CELL = 50;
function cellKey(x, z) {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
}

// Pick the next edge at the end of `edge`. Prefers going roughly straight, avoids U-turns
// unless it is a dead end. rng returns [0, 1).
export function nextEdge(net, edge, rng = Math.random) {
  const options = net.out[edge.to].filter((e) => e.to !== edge.from);
  if (!options.length) return net.out[edge.to][0] || null;
  let total = 0;
  const weights = options.map((e) => {
    const turn = Math.abs(Math.atan2(Math.sin(e.heading - edge.heading), Math.cos(e.heading - edge.heading)));
    const w = turn < 0.5 ? 3 : turn < 1.8 ? 1 : 0.2;
    total += w;
    return w;
  });
  let pick = rng() * total;
  for (let i = 0; i < options.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return options[i];
  }
  return options[options.length - 1];
}

// Signed turn (radians) from edge a into edge b.
export function turnAngle(a, b) {
  return Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading));
}

// Lateral offset to the right of the centerline for a vehicle on this road.
export function laneOffset(road) {
  return road.ow ? 0 : Math.max(1.8, road.w * 0.26);
}

// Position on an edge at distance d with lateral offset `lat` (right of travel direction).
export function edgePose(net, edge, d, lat) {
  const [ax, az] = vert(net.map, edge.from);
  const [bx, bz] = vert(net.map, edge.to);
  const t = Math.max(0, Math.min(1, d / edge.len));
  const h = edge.heading;
  return { x: ax + (bx - ax) * t - Math.cos(h) * lat, z: az + (bz - az) * t + Math.sin(h) * lat, heading: h };
}

// A random node whose distance to (x, z) is within [minD, maxD], or -1.
export function nodeInRing(net, x, z, minD, maxD, rng = Math.random) {
  const found = [];
  for (let cx = Math.floor((x - maxD) / CELL); cx <= Math.floor((x + maxD) / CELL); cx++) {
    for (let cz = Math.floor((z - maxD) / CELL); cz <= Math.floor((z + maxD) / CELL); cz++) {
      const list = net.cells.get(`${cx},${cz}`);
      if (!list) continue;
      for (const v of list) {
        const d = Math.hypot(net.map.verts[2 * v] - x, net.map.verts[2 * v + 1] - z);
        if (d >= minD && d <= maxD) found.push(v);
      }
    }
  }
  return found.length ? found[Math.floor(rng() * found.length)] : -1;
}
