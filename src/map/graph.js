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
