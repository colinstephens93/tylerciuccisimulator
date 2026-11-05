import { describe, it, expect } from 'vitest';
import map from '../src/data/lawrenceville.json';
import { buildGraph, route, sampleAt, polylineLength } from '../src/map/graph.js';
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
});
