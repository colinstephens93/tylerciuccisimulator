// Builds the 3D town from OpenStreetMap data: ground, roads, buildings, parks, water, trees.
// Also fills the collision grids (buildings, tree trunks) and the road grid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, toonRamp } from '../engine/models.js';
import { vert } from './graph.js';

// Flat ground layers are drawn as decals: no depth test or depth write, painted in a fixed
// order (renderOrder) before anything that stands on the ground. Stacking them at slightly
// different heights instead causes z-fighting (flickering, jagged patches) on phone GPUs.
const ROAD_LAYERS = [
  { types: ['service', 'living_street'], color: 0x8c8f99 },
  { types: ['residential', 'unclassified', 'tertiary', 'tertiary_link'], color: 0x5f6470 },
  { types: ['secondary', 'secondary_link', 'primary', 'primary_link', 'trunk', 'trunk_link', 'motorway', 'motorway_link'], color: 0x4e535e },
];
export const DECAL_ORDER = { ground: -100, parks: -95, water: -94, curb: -90, roads: -85, centerLines: -80, route: -75 };
const Y = 0.02;

// Unlit: flat ground paint doesn't need shading, and lighting would shade any
// downward-facing triangles differently (visible as lighter patches).
const decalCache = new Map();
export function decalMaterial(color) {
  if (!decalCache.has(color)) decalCache.set(color, new THREE.MeshBasicMaterial({ color, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  return decalCache.get(color);
}

function asDecal(mesh, order) {
  mesh.renderOrder = order;
  return mesh;
}
// Saturated cartoon pastels for walls, with a matching darker roof for each.
const BUILDING_COLORS = [
  [0xffd6a5, 0xc8553d], [0xfdffb6, 0x6a8d3a], [0xcaffbf, 0x2a7f62], [0x9bf6ff, 0x2f6fb0],
  [0xa0c4ff, 0x3d4f9f], [0xffc6ff, 0x9b4f96], [0xffadad, 0xa33a3a], [0xfff1e6, 0x7a5c48],
];

// Flat ribbon (plus round joints) along a polyline, appended to a positions array.
export function addRibbon(out, pts, halfWidth, y) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const nx = (-(bz - az) / len) * halfWidth;
    const nz = ((bx - ax) / len) * halfWidth;
    out.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz);
    out.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz);
  }
  // Round joints only where the road bends or ends, so corners look smooth.
  const seg = 16;
  for (let i = 0; i < pts.length; i++) {
    const [cx, cz] = pts[i];
    if (i > 0 && i < pts.length - 1) {
      const [px, pz] = pts[i - 1];
      const [nx2, nz2] = pts[i + 1];
      const a1 = Math.atan2(cx - px, cz - pz);
      const a2 = Math.atan2(nx2 - cx, nz2 - cz);
      if (Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))) < 0.05) continue;
    }
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      out.push(cx, y, cz, cx + Math.cos(a1) * halfWidth, y, cz + Math.sin(a1) * halfWidth, cx + Math.cos(a0) * halfWidth, y, cz + Math.sin(a0) * halfWidth);
    }
  }
}

function flatMesh(positions, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return new THREE.Mesh(geo, decalMaterial(color));
}

function polygonMesh(polys, color, y) {
  const geos = [];
  for (const flat of polys) {
    const pts = [];
    for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], -flat[i + 1]));
    try {
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      geos.push(g);
    } catch {
      /* skip bad polygon */
    }
  }
  if (!geos.length) return null;
  return new THREE.Mesh(mergeGeometries(geos), decalMaterial(color));
}

function centroid(flat) {
  let x = 0;
  let z = 0;
  const n = flat.length / 2;
  for (let i = 0; i < flat.length; i += 2) { x += flat[i]; z += flat[i + 1]; }
  return [x / n, z / n];
}

function insidePoly(flat, x, z) {
  let inside = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i]; const zi = flat[i + 1]; const xj = flat[j]; const zj = flat[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildCity(map, clearZones, colliders, roadGrid) {
  const city = new THREE.Group();
  const [W, H] = map.size;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 1600, H + 1600), decalMaterial(0x8fd16a));
  ground.rotation.x = -Math.PI / 2;
  city.add(asDecal(ground, DECAL_ORDER.ground));

  const parks = polygonMesh(map.parks, 0x6cc24a, Y);
  if (parks) city.add(asDecal(parks, DECAL_ORDER.parks));
  const water = polygonMesh(map.water, 0x4fc3f7, Y);
  if (water) city.add(asDecal(water, DECAL_ORDER.water));

  // Roads: a light curb outline under each road, then the asphalt.
  const curb = [];
  const layers = ROAD_LAYERS.map(() => []);
  const centerLines = [];
  for (const r of map.roads) {
    const pts = r.v.map((i) => vert(map, i));
    const li = ROAD_LAYERS.findIndex((l) => l.types.includes(r.t));
    addRibbon(curb, pts, r.w / 2 + (li === 0 ? 0.6 : 2.2), Y);
    addRibbon(layers[li], pts, r.w / 2, Y);
    if (li === 2) addRibbon(centerLines, pts, 0.2, Y);
    for (let i = 0; i < pts.length - 1; i++) roadGrid.addSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r.w / 2, r);
  }
  city.add(asDecal(flatMesh(curb, 0xe8e2d2), DECAL_ORDER.curb));
  layers.forEach((pos, i) => city.add(asDecal(flatMesh(pos, ROAD_LAYERS[i].color), DECAL_ORDER.roads + i)));
  city.add(asDecal(flatMesh(centerLines, 0xffd23f), DECAL_ORDER.centerLines));

  // Buildings (skipping lots where we place our own Wawa, school and house)
  const isClear = (x, z) => clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r);
  const geos = [];
  const color = new THREE.Color();
  map.buildings.forEach((b, idx) => {
    const [cx, cz] = centroid(b.p);
    if (isClear(cx, cz)) return;
    for (let i = 0; i < b.p.length; i += 2) if (isClear(b.p[i], b.p[i + 1])) return;
    const pts = [];
    for (let i = 0; i < b.p.length; i += 2) pts.push(new THREE.Vector2(b.p[i], -b.p[i + 1]));
    let g;
    try {
      g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: b.h, bevelEnabled: false });
    } catch {
      return;
    }
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    const [wall, roof] = BUILDING_COLORS[idx % BUILDING_COLORS.length];
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const normals = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      color.setHex(normals.getY(i) > 0.5 ? roof : wall);
      color.toArray(cols, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
    colliders.addPolygon(b.p);
  });
  if (geos.length) {
    const merged = mergeGeometries(geos);
    city.add(new THREE.Mesh(merged, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp })));
  }

  // Trees: pines and hardwoods in parks and along residential streets.
  const rand = seeded(42);
  const spots = [];
  for (const p of map.parks) {
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
      minZ = Math.min(minZ, p[i + 1]); maxZ = Math.max(maxZ, p[i + 1]);
    }
    const count = Math.min(40, ((maxX - minX) * (maxZ - minZ)) / 400);
    for (let k = 0; k < count; k++) {
      const x = minX + rand() * (maxX - minX);
      const z = minZ + rand() * (maxZ - minZ);
      if (insidePoly(p, x, z)) spots.push([x, z]);
    }
  }
  for (const r of map.roads) {
    if (r.t !== 'residential') continue;
    for (let i = 0; i < r.v.length - 1; i++) {
      const [ax, az] = vert(map, r.v[i]);
      const [bx, bz] = vert(map, r.v[i + 1]);
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 10; d < len; d += 22) {
        const t = d / len;
        const side = rand() < 0.5 ? -1 : 1;
        const off = r.w / 2 + 5 + rand() * 6;
        spots.push([ax + (bx - ax) * t + (-(bz - az) / len) * off * side, az + (bz - az) * t + ((bx - ax) / len) * off * side]);
      }
    }
  }
  const trees = spots.filter(([x, z]) => !isClear(x, z) && roadGrid.edgeDistance(x, z, 6) > 2 && !colliders.blocked(x, z, 1.5)).slice(0, 2600);
  for (const [x, z] of trees) colliders.addCircle(x, z, 0.7);
  const pines = trees.filter(() => rand() < 0.6);
  const hardwoods = trees.filter((t) => !pines.includes(t));
  city.add(instanced(pines, [
    [new THREE.CylinderGeometry(0.3, 0.4, 6, 6).translate(0, 3, 0), 0x6b4a2b],
    [new THREE.ConeGeometry(2.6, 5, 7).translate(0, 7, 0), 0x2f8f45],
    [new THREE.ConeGeometry(2.0, 4, 7).translate(0, 9.5, 0), 0x3fae55],
  ], rand));
  city.add(instanced(hardwoods, [
    [new THREE.CylinderGeometry(0.35, 0.45, 3.5, 6).translate(0, 1.75, 0), 0x6b4a2b],
    [new THREE.IcosahedronGeometry(3.2, 0).translate(0, 5.5, 0), 0x5cc23a],
  ], rand));

  return city;
}

function instanced(spots, parts, rand) {
  const g = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const mats = spots.map(([x, z]) => {
    const k = 0.75 + rand() * 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    return new THREE.Matrix4().compose(p.set(x, 0, z), q, s.set(k, k, k));
  });
  for (const [geo, color] of parts) {
    const im = new THREE.InstancedMesh(geo, toon(color), spots.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, m.copy(mm)));
    g.add(im);
  }
  return g;
}
