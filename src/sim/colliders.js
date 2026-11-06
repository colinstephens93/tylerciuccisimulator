// Static collision world: building footprints, landmark boxes and tree trunks in a spatial
// grid, plus a road-segment grid for "how far am I from the road" queries.
// Pure module (no Three.js) so it can be unit tested.

export class ColliderGrid {
  constructor(cell = 24) {
    this.cell = cell;
    this.cells = new Map();
    this.shapes = [];
    this.stamp = 0;
  }

  key(cx, cz) {
    return cx * 73856093 ^ cz * 19349663;
  }

  insert(shape) {
    shape.id = this.shapes.length;
    shape.seen = 0;
    this.shapes.push(shape);
    const c = this.cell;
    for (let cx = Math.floor(shape.minX / c); cx <= Math.floor(shape.maxX / c); cx++) {
      for (let cz = Math.floor(shape.minZ / c); cz <= Math.floor(shape.maxZ / c); cz++) {
        const k = this.key(cx, cz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(shape);
      }
    }
    return shape;
  }

  // flat = [x0, z0, x1, z1, ...]
  addPolygon(flat, tag = 'building') {
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      minX = Math.min(minX, flat[i]); maxX = Math.max(maxX, flat[i]);
      minZ = Math.min(minZ, flat[i + 1]); maxZ = Math.max(maxZ, flat[i + 1]);
    }
    return this.insert({ kind: 'poly', p: flat, minX, maxX, minZ, maxZ, tag });
  }

  // Rotated box centered at (cx, cz) with half sizes hw (local x) and hd (local z).
  addBox(cx, cz, hw, hd, rot = 0, tag = 'building') {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const flat = [];
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) flat.push(cx + lx * c + lz * s, cz - lx * s + lz * c);
    return this.addPolygon(flat, tag);
  }

  addCircle(x, z, r, tag = 'tree') {
    return this.insert({ kind: 'circle', x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, tag });
  }

  // Calls fn(shape) once for each shape whose bounds touch the circle.
  forEachNear(x, z, r, fn) {
    const c = this.cell;
    const stamp = ++this.stamp;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const s of list) {
          if (s.seen === stamp) continue;
          s.seen = stamp;
          if (x + r < s.minX || x - r > s.maxX || z + r < s.minZ || z - r > s.maxZ) continue;
          fn(s);
        }
      }
    }
  }

  // Push a circle out of everything it overlaps. Returns the corrected position, the
  // push normal (unit, or 0,0 when nothing was hit) and the deepest penetration.
  resolveCircle(x, z, r) {
    let px = x;
    let pz = z;
    let depth = 0;
    let tag = null;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.forEachNear(px, pz, r, (s) => {
        const push = s.kind === 'circle' ? pushCircle(s, px, pz, r) : pushPoly(s.p, px, pz, r);
        if (!push) return;
        px += push[0];
        pz += push[1];
        const d = Math.hypot(push[0], push[1]);
        if (d > depth) { depth = d; tag = s.tag; }
        moved = true;
      });
      if (!moved) break;
    }
    const dx = px - x;
    const dz = pz - z;
    const len = Math.hypot(dx, dz);
    return { x: px, z: pz, nx: len ? dx / len : 0, nz: len ? dz / len : 0, hit: len > 1e-6, depth, tag };
  }

  // True if the point is inside a building (used to keep spawns out of walls).
  blocked(x, z, r = 0.5, tag = null) {
    let hit = false;
    this.forEachNear(x, z, r, (s) => {
      if (hit || (tag && s.tag !== tag)) return;
      if (s.kind === 'circle') hit = Math.hypot(s.x - x, s.z - z) < s.r + r;
      else hit = insidePoly(s.p, x, z) || closestOnPoly(s.p, x, z).d < r;
    });
    return hit;
  }
}

function pushCircle(s, x, z, r) {
  const dx = x - s.x;
  const dz = z - s.z;
  const d = Math.hypot(dx, dz);
  const min = s.r + r;
  if (d >= min) return null;
  if (d < 1e-6) return [min, 0];
  return [(dx / d) * (min - d), (dz / d) * (min - d)];
}

function pushPoly(flat, x, z, r) {
  const inside = insidePoly(flat, x, z);
  const c = closestOnPoly(flat, x, z);
  if (!inside && c.d >= r) return null;
  if (c.d < 1e-6) return null;
  const ux = (c.x - x) / c.d;
  const uz = (c.z - z) / c.d;
  // Inside: move to the nearest edge, then out by r. Outside: move out to distance r.
  return inside ? [ux * (c.d + r), uz * (c.d + r)] : [-ux * (r - c.d), -uz * (r - c.d)];
}

export function insidePoly(flat, x, z) {
  let inside = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i]; const zi = flat[i + 1]; const xj = flat[j]; const zj = flat[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function closestOnSegment(ax, az, bx, bz, x, z) {
  const ex = bx - ax;
  const ez = bz - az;
  const len2 = ex * ex + ez * ez;
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2)) : 0;
  const cx = ax + ex * t;
  const cz = az + ez * t;
  return { x: cx, z: cz, t, d: Math.hypot(x - cx, z - cz) };
}

function closestOnPoly(flat, x, z) {
  let best = { x, z, d: Infinity };
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const c = closestOnSegment(flat[j], flat[j + 1], flat[i], flat[i + 1], x, z);
    if (c.d < best.d) best = c;
  }
  return best;
}

// Road segments with half widths, for on-road / off-road checks.
export class RoadGrid {
  constructor(cell = 30) {
    this.grid = new ColliderGrid(cell);
  }

  addSegment(ax, az, bx, bz, halfWidth, road) {
    const s = this.grid.insert({
      kind: 'seg', ax, az, bx, bz, hw: halfWidth, road,
      minX: Math.min(ax, bx) - halfWidth, maxX: Math.max(ax, bx) + halfWidth,
      minZ: Math.min(az, bz) - halfWidth, maxZ: Math.max(az, bz) + halfWidth,
    });
    return s;
  }

  // Distance from the point to the nearest road's edge (negative = on the road).
  // Returns Infinity if no road is within `search` meters.
  edgeDistance(x, z, search = 20) {
    let best = Infinity;
    this.grid.forEachNear(x, z, search, (s) => {
      const c = closestOnSegment(s.ax, s.az, s.bx, s.bz, x, z);
      best = Math.min(best, c.d - s.hw);
    });
    return best;
  }

  onRoad(x, z) {
    return this.edgeDistance(x, z, 10) <= 0.5;
  }
}
