import { describe, it, expect } from 'vitest';
import { ColliderGrid, RoadGrid, insidePoly } from '../src/sim/colliders.js';
import { Heat, HEAT_MAX, bustedFine } from '../src/logic/heat.js';

describe('collision grid', () => {
  const grid = new ColliderGrid(10);
  grid.addBox(0, 0, 5, 5); // 10 x 10 building at the origin
  grid.addCircle(30, 0, 1); // tree

  it('pushes a circle out of a wall it overlaps', () => {
    const r = grid.resolveCircle(5.5, 0, 1);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(6);
    expect(r.nx).toBeCloseTo(1);
  });

  it('pushes a circle that ended up inside a building out the nearest side', () => {
    const r = grid.resolveCircle(0, 4, 1);
    expect(r.z).toBeCloseTo(6);
    expect(insidePoly(grid.shapes[0].p, r.x, r.z)).toBe(false);
  });

  it('leaves open ground alone', () => {
    const r = grid.resolveCircle(15, 15, 1);
    expect(r.hit).toBe(false);
    expect([r.x, r.z]).toEqual([15, 15]);
  });

  it('collides with tree trunks', () => {
    const r = grid.resolveCircle(31.5, 0, 1);
    expect(r.x).toBeCloseTo(32);
    expect(grid.blocked(30.5, 0)).toBe(true);
    expect(grid.blocked(30.5, 0, 0.5, 'building')).toBe(false);
  });

  it('works for rotated boxes', () => {
    const g = new ColliderGrid();
    g.addBox(0, 0, 10, 1, Math.PI / 2); // long axis now along z
    expect(g.blocked(0, 8, 0.1)).toBe(true);
    expect(g.blocked(8, 0, 0.1)).toBe(false);
  });
});

describe('road grid', () => {
  it('measures distance to the road edge', () => {
    const roads = new RoadGrid();
    roads.addSegment(0, 0, 100, 0, 4, {});
    expect(roads.edgeDistance(50, 0)).toBeCloseTo(-4);
    expect(roads.edgeDistance(50, 10)).toBeCloseTo(6);
    expect(roads.onRoad(50, 3)).toBe(true);
    expect(roads.onRoad(50, 9)).toBe(false);
    expect(roads.edgeDistance(500, 500)).toBe(Infinity);
  });
});

describe('heat meter', () => {
  it('fills with chaos and starts a pursuit when full', () => {
    const h = new Heat();
    h.add('prop');
    expect(h.value).toBeGreaterThan(0);
    expect(h.pursuit).toBe(false);
    for (let i = 0; i < 20; i++) h.add('ped');
    expect(h.value).toBe(HEAT_MAX);
    expect(h.pursuit).toBe(true);
  });

  it('drains only after a calm spell, and a pursuit only ends once you escape', () => {
    const h = new Heat();
    h.add('crash');
    const v = h.value;
    h.tick(1);
    expect(h.value).toBe(v);
    h.tick(10);
    expect(h.value).toBe(0);

    for (let i = 0; i < 20; i++) h.add('ped');
    h.tick(30, false); // pursuer still close: no draining
    expect(h.pursuit).toBe(true);
    let ended = null;
    for (let i = 0; i < 40 && !ended; i++) ended = h.tick(1, true);
    expect(ended).toBe('ended');
    expect(h.pursuit).toBe(false);
  });

  it('busted fine is 10% with a 10 coin minimum, never more than you have', () => {
    expect(bustedFine(500)).toBe(50);
    expect(bustedFine(40)).toBe(10);
    expect(bustedFine(3)).toBe(3);
  });
});
