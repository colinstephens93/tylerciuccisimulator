import { describe, it, expect } from 'vitest';
import map from '../src/data/lawrenceville.json';
import { buildGraph, route, polylineLength } from '../src/map/graph.js';
import { computePlaces, gpsRoute } from '../src/map/places.js';
import { buildLaneNet, TRAFFIC_TYPES, WALK_TYPES, nextEdge, edgePose, nodeInRing, laneOffset } from '../src/sim/roadnet.js';

describe('Lawrenceville map data', () => {
  it('has roads, buildings, and OSM attribution', () => {
    expect(map.roads.length).toBeGreaterThan(500);
    expect(map.buildings.length).toBeGreaterThan(500);
    expect(map.attribution).toMatch(/OpenStreetMap/);
  });
});

describe('places and GPS routing', () => {
  const { graph, places } = computePlaces(map);

  it('places each location next to its named road, with a marker spot', () => {
    for (const p of Object.values(places)) {
      expect(Math.hypot(p.road[0] - p.x, p.road[1] - p.z)).toBeLessThan(80);
      expect(p.marker).toHaveLength(2);
      expect(p.label).toBeTruthy();
    }
  });

  it('routes between every pair of places along real streets', () => {
    for (const a of Object.values(places)) {
      for (const b of Object.values(places)) {
        if (a === b) continue;
        const r = route(graph, a.roadV, b.roadV);
        expect(r, `${a.key} -> ${b.key}`).not.toBeNull();
        expect(polylineLength(r.points)).toBeLessThan(3500);
      }
    }
  });

  it('home -> school passes through town on New Hope Road', () => {
    const r = route(graph, places.home.roadV, places.school.roadV);
    expect(r.roads).toContain('New Hope Road');
  });

  it('GPS route starts at the player and ends at the marker', () => {
    const pts = gpsRoute(graph, -900, -250, places.wawa);
    expect(pts[0]).toEqual([-900, -250]);
    expect(pts[pts.length - 1]).toEqual(places.wawa.marker);
  });

  it('respects one-way streets', () => {
    const g = buildGraph({ verts: [0, 0, 10, 0], roads: [{ t: 'residential', w: 8, n: 'A', ow: 1, v: [0, 1] }] });
    expect(route(g, 0, 1)).not.toBeNull();
    expect(route(g, 1, 0)).toBeNull();
  });
});

describe('lane network for traffic and pedestrians', () => {
  const drive = buildLaneNet(map, { types: TRAFFIC_TYPES, oneWay: true });
  const walk = buildLaneNet(map, { types: WALK_TYPES, oneWay: false });

  it('has plenty of nodes and keeps traffic off parking aisles', () => {
    expect(drive.nodes.length).toBeGreaterThan(1000);
    for (const v of drive.nodes) for (const e of drive.out[v]) expect(e.road.t).not.toBe('service');
  });

  it('pedestrians may walk both ways down one-way streets', () => {
    const tiny = { verts: [0, 0, 10, 0], roads: [{ t: 'residential', w: 8, n: 'A', ow: 1, v: [0, 1] }] };
    expect(buildLaneNet(tiny, { types: WALK_TYPES, oneWay: true }).out[1]).toHaveLength(0);
    expect(buildLaneNet(tiny, { types: WALK_TYPES, oneWay: false }).out[1]).toHaveLength(1);
    expect(walk.nodes.length).toBeGreaterThanOrEqual(drive.nodes.length);
  });

  it('nextEdge continues from the end of the edge and avoids U-turns when it can', () => {
    let checked = 0;
    for (const v of drive.nodes.slice(0, 400)) {
      for (const e of drive.out[v]) {
        const n = nextEdge(drive, e, () => 0.5);
        if (!n) continue;
        expect(n.from).toBe(e.to);
        if (drive.out[e.to].some((x) => x.to !== e.from)) expect(n.to).not.toBe(e.from);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('cars drive on the right-hand side of two-way roads', () => {
    const net = buildLaneNet({ verts: [0, 0, 0, 100], roads: [{ t: 'residential', w: 8, n: 'A', ow: 0, v: [0, 1] }] }, { types: TRAFFIC_TYPES, oneWay: true });
    const south = net.out[0][0]; // heading +z (south): right-hand side is west (-x)
    const p = edgePose(net, south, 50, laneOffset(south.road));
    expect(p.x).toBeLessThan(0);
    expect(p.z).toBeCloseTo(50);
  });

  it('finds spawn nodes in a ring around the player', () => {
    for (let k = 0; k < 20; k++) {
      const v = nodeInRing(drive, 0, 0, 90, 230);
      expect(v).toBeGreaterThanOrEqual(0);
      const d = Math.hypot(map.verts[2 * v], map.verts[2 * v + 1]);
      expect(d).toBeGreaterThanOrEqual(90);
      expect(d).toBeLessThanOrEqual(230);
    }
    expect(nodeInRing(drive, 99999, 99999, 0, 50)).toBe(-1);
  });
});
