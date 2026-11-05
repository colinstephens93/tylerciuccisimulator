// Builds the 3D town from OpenStreetMap data: ground, roads, buildings, parks, water, trees.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from '../engine/models.js';
import { vert } from './graph.js';

const ROAD_LAYERS = [
  { types: ['service', 'living_street'], color: 0x9b9ea3, y: 0.1 },
  { types: ['residential', 'unclassified', 'tertiary', 'tertiary_link'], color: 0x7d8187, y: 0.14 },
  { types: ['secondary', 'secondary_link', 'primary', 'primary_link', 'trunk', 'trunk_link', 'motorway', 'motorway_link'], color: 0x6a6e75, y: 0.18 },
];
const BUILDING_COLORS = [0xf2ede3, 0xe9e2d0, 0xdfe6ea, 0xf0e2d0, 0xe6d8c8, 0xd9e4d4, 0xeee7da];

// Flat ribbon (plus round joints) along a polyline, appended to a positions array.
function addRibbon(out, pts, halfWidth, y) {
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
  const seg = 10;
  for (const [cx, cz] of pts) {
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
  return new THREE.Mesh(geo, toon(color, { side: THREE.DoubleSide }));
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
  return new THREE.Mesh(mergeGeometries(geos), toon(color));
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

export function buildCity(map, clearZones) {
  const city = new THREE.Group();
  const [W, H] = map.size;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 1600, H + 1600), toon(0xb4cf8f));
  ground.rotation.x = -Math.PI / 2;
  city.add(ground);

  const parks = polygonMesh(map.parks, 0x84b56a, 0.02);
  if (parks) city.add(parks);
  const water = polygonMesh(map.water, 0x6fb7e0, 0.03);
  if (water) city.add(water);

  // Roads: a light curb outline under each road, then the asphalt.
  const curb = [];
  const layers = ROAD_LAYERS.map(() => []);
  const centerLines = [];
  for (const r of map.roads) {
    const pts = r.v.map((i) => vert(map, i));
    const li = ROAD_LAYERS.findIndex((l) => l.types.includes(r.t));
    addRibbon(curb, pts, r.w / 2 + 0.9, 0.06);
    addRibbon(layers[li], pts, r.w / 2, ROAD_LAYERS[li].y);
    if (li === 2) addRibbon(centerLines, pts, 0.18, 0.22);
  }
  city.add(flatMesh(curb, 0xe7e1d3));
  layers.forEach((pos, i) => city.add(flatMesh(pos, ROAD_LAYERS[i].color)));
  city.add(flatMesh(centerLines, 0xf2c94c));

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
    color.setHex(BUILDING_COLORS[idx % BUILDING_COLORS.length]);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) color.toArray(cols, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
  });
  if (geos.length) {
    const merged = mergeGeometries(geos);
    city.add(new THREE.Mesh(merged, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0).gradientMap })));
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
  const trees = spots.filter(([x, z]) => !isClear(x, z)).slice(0, 2600);
  const pines = trees.filter(() => rand() < 0.6);
  const hardwoods = trees.filter((t) => !pines.includes(t));
  city.add(instanced(pines, [
    [new THREE.CylinderGeometry(0.3, 0.4, 6, 6).translate(0, 3, 0), 0x6b4a2b],
    [new THREE.ConeGeometry(2.6, 5, 7).translate(0, 7, 0), 0x2f6b3a],
    [new THREE.ConeGeometry(2.0, 4, 7).translate(0, 9.5, 0), 0x3a7d45],
  ], rand));
  city.add(instanced(hardwoods, [
    [new THREE.CylinderGeometry(0.35, 0.45, 3.5, 6).translate(0, 1.75, 0), 0x6b4a2b],
    [new THREE.IcosahedronGeometry(3.2, 0).translate(0, 5.5, 0), 0x4f8f3a],
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
