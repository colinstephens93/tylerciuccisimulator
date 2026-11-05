// Road graph built from the OSM map data, with shortest-path routing (Dijkstra).
// Pure module (no Three.js) so it can be unit tested.

const COST = { service: 3, living_street: 1.5, residential: 1.15 }; // prefer real streets over parking aisles

export function vert(map, i) {
  return [map.verts[2 * i], map.verts[2 * i + 1]];
}

export function buildGraph(map) {
  const n = map.verts.length / 2;
  const adj = Array.from({ length: n }, () => []);
  for (const r of map.roads) {
    const k = COST[r.t] ?? 1;
    for (let i = 0; i < r.v.length - 1; i++) {
      const a = r.v[i];
      const b = r.v[i + 1];
      const [ax, az] = vert(map, a);
      const [bx, bz] = vert(map, b);
      const d = Math.hypot(bx - ax, bz - az);
      adj[a].push({ to: b, cost: d * k, road: r });
      if (!r.ow) adj[b].push({ to: a, cost: d * k, road: r });
    }
  }
  return { map, adj };
}

export function nearestVertex(graph, x, z, filter = () => true) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < graph.adj.length; i++) {
    if (!graph.adj[i].length || !filter(i)) continue;
    const [vx, vz] = vert(graph.map, i);
    const d = (vx - x) ** 2 + (vz - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Minimal binary heap keyed by priority.
class Heap {
  constructor() { this.a = []; }
  push(item, p) {
    const a = this.a;
    a.push([p, item]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top[1];
  }
  get size() { return this.a.length; }
}

// Returns { points: [[x,z]...], length, roads: [names in order] } or null.
export function route(graph, from, to) {
  const n = graph.adj.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevRoad = new Array(n);
  const heap = new Heap();
  dist[from] = 0;
  heap.push(from, 0);
  while (heap.size) {
    const u = heap.pop();
    if (u === to) break;
    for (const e of graph.adj[u]) {
      const nd = dist[u] + e.cost;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
        prevRoad[e.to] = e.road;
        heap.push(e.to, nd);
      }
    }
  }
  if (from !== to && prev[to] === -1) return null;
  const ids = [];
  for (let v = to; v !== -1; v = prev[v]) ids.push(v);
  ids.reverse();
  const points = ids.map((i) => vert(graph.map, i));
  const roads = [];
  for (const id of ids.slice(1)) {
    const name = prevRoad[id].n || 'unnamed road';
    if (roads[roads.length - 1] !== name) roads.push(name);
  }
  return { points, length: polylineLength(points), roads, widths: ids.slice(1).map((id) => prevRoad[id].w) };
}

export function polylineLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return s;
}

// Position and heading at distance s along a polyline.
export function sampleAt(points, s) {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (acc + seg >= s || i === points.length - 1) {
      const t = seg ? Math.min(1, Math.max(0, (s - acc) / seg)) : 0;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading: Math.atan2(bx - ax, bz - az), index: i };
    }
    acc += seg;
  }
  const [x, z] = points[0];
  return { x, z, heading: 0, index: 0 };
}

// Round off sharp corners (Chaikin-style corner cutting with a capped cut distance,
// so long straight roads stay on their real line and corners become ~maxCut-radius curves).
export function smoothPath(points, iterations = 3, maxCut = 7, minSpacing = 6) {
  // Drop points bunched closer than minSpacing (OSM often has clusters at intersections),
  // otherwise those tiny segments can't be rounded.
  let pts = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [lx, lz] = pts[pts.length - 1];
    if (Math.hypot(points[i][0] - lx, points[i][1] - lz) >= minSpacing) pts.push(points[i]);
  }
  pts.push(points[points.length - 1]);
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, pz] = pts[i - 1];
      const [cx, cz] = pts[i];
      const [nx, nz] = pts[i + 1];
      const l1 = Math.hypot(cx - px, cz - pz);
      const l2 = Math.hypot(nx - cx, nz - cz);
      // Sharper corners get cut deeper so hairpins become real curves.
      const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(nx - cx, nz - cz) - Math.atan2(cx - px, cz - pz)), Math.cos(Math.atan2(nx - cx, nz - cz) - Math.atan2(cx - px, cz - pz))));
      const frac = turn > 1.2 ? 0.42 : 0.25;
      const cut = turn > 1.2 ? maxCut * 1.5 : maxCut;
      const c1 = l1 > 0 ? Math.min(l1 * frac, cut) / l1 : 0;
      const c2 = l2 > 0 ? Math.min(l2 * frac, cut) / l2 : 0;
      out.push([cx + (px - cx) * c1, cz + (pz - cz) * c1], [cx + (nx - cx) * c2, cz + (nz - cz) * c2]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

// Evenly spaced points along a polyline (keeps per-frame motion steady).
export function resample(points, step = 2) {
  const total = polylineLength(points);
  const n = Math.max(2, Math.ceil(total / step) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = sampleAt(points, (total * i) / (n - 1));
    out.push([p.x, p.z]);
  }
  return out;
}

// Safe speed at each point of an evenly spaced path, from the curve radius just around it:
// v = sqrt(lateralAccel * radius). Straight = maxSpeed; tight corners and hairpins = slow.
export function turnSpeedCaps(points, maxSpeed, lateralAccel = 18, window = 2) {
  const n = points.length;
  const turnAt = new Float32Array(n); // curvature (radians per meter) entering point i
  for (let i = 2; i < n; i++) {
    const a1 = Math.atan2(points[i - 1][0] - points[i - 2][0], points[i - 1][1] - points[i - 2][1]);
    const a2 = Math.atan2(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const step = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) || 1;
    turnAt[i] = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))) / step;
  }
  const caps = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window + 1); j++) k = Math.max(k, turnAt[j]);
    caps[i] = k > 0 ? Math.min(maxSpeed, Math.max(4, Math.sqrt(lateralAccel / k))) : maxSpeed;
  }
  return caps;
}
