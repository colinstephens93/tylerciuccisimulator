import { describe, it, expect } from 'vitest';
import map from '../src/data/lawrenceville.json';
import { buildGraph, route, sampleAt, polylineLength, smoothPath, resample, turnSpeedCaps } from '../src/map/graph.js';
import { computePlaces, driveRoute } from '../src/map/places.js';

describe('Lawrenceville map data', () => {
  it('has roads, buildings, and OSM attribution', () => {
    expect(map.roads.length).toBeGreaterThan(500);
    expect(map.buildings.length).toBeGreaterThan(500);
    expect(map.attribution).toMatch(/OpenStreetMap/);
  });
});

describe('routing', () => {
  const { graph, places } = computePlaces(map);

  it('places each location next to its named road', () => {
    for (const p of Object.values(places)) {
      expect(Math.hypot(p.road[0] - p.x, p.road[1] - p.z)).toBeLessThan(80);
    }
  });

  it('home -> Wawa uses West Pike Street and is a reasonable drive', () => {
    const r = driveRoute(graph, places.home, places.wawa);
    expect(r).not.toBeNull();
    expect(r.roads).toContain('West Pike Street');
    const len = polylineLength(r.points);
    expect(len).toBeGreaterThan(400);
    expect(len).toBeLessThan(2500);
  });

  it('Wawa -> school reaches New Hope Road', () => {
    const r = driveRoute(graph, places.wawa, places.school);
    expect(r).not.toBeNull();
    expect(r.roads).toContain('New Hope Road');
    expect(polylineLength(r.points)).toBeLessThan(3500);
  });

  it('respects one-way streets', () => {
    const g = buildGraph({ verts: [0, 0, 10, 0], roads: [{ t: 'residential', w: 8, n: 'A', ow: 1, v: [0, 1] }] });
    expect(route(g, 0, 1)).not.toBeNull();
    expect(route(g, 1, 0)).toBeNull();
  });

  it('samples positions along a polyline', () => {
    const p = sampleAt([[0, 0], [10, 0], [10, 10]], 15);
    expect(p.x).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(5);
  });

  it('smoothing rounds corners but keeps endpoints and straight roads', () => {
    const sharp = [[0, 0], [100, 0], [100, 100]];
    const smooth = smoothPath(sharp);
    expect(smooth[0]).toEqual([0, 0]);
    expect(smooth[smooth.length - 1]).toEqual([100, 100]);
    // Never strays far from the real corner
    for (const [x, z] of smooth) expect(Math.min(Math.abs(z), Math.abs(x - 100))).toBeLessThan(7);
  });

  it('drive routes slow the car for sharp turns (no fast whipping around corners)', () => {
    const MAX = 38;
    for (const r of [driveRoute(graph, places.home, places.wawa), driveRoute(graph, places.wawa, places.school)]) {
      const caps = turnSpeedCaps(r.points, MAX);
      for (let i = 2; i < r.points.length; i++) {
        const a1 = Math.atan2(r.points[i - 1][0] - r.points[i - 2][0], r.points[i - 1][1] - r.points[i - 2][1]);
        const a2 = Math.atan2(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]);
        const turn = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
        // Heading change per second at the capped speed stays under ~3 rad/s.
        expect((turn / 2) * caps[i - 1]).toBeLessThan(3.2);
      }
      expect(Math.max(...caps)).toBeGreaterThan(MAX * 0.9); // straights stay fast
    }
  });

  it('resamples at even spacing', () => {
    const pts = resample([[0, 0], [10, 0]], 2);
    expect(pts.length).toBe(6);
    expect(pts[1][0]).toBeCloseTo(2);
  });
});
