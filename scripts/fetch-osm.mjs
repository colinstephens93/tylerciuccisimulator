// Downloads OpenStreetMap data for central Lawrenceville, GA and writes a compact
// game map to src/data/lawrenceville.json. Map data (c) OpenStreetMap contributors, ODbL.
//
//   node scripts/fetch-osm.mjs
//
// Coordinates are converted to local meters around CENTER: x = east, z = south.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const CENTER = { lat: 33.9562, lon: -83.988 }; // historic courthouse square
const HALF_LAT = 0.0115; // ~1.3 km
const HALF_LON = 0.0135; // ~1.25 km
const TILES = 4;
const CACHE = 'scripts/.osm-cache';
const OUT = 'src/data/lawrenceville.json';

const M_PER_LAT = 110574;
const M_PER_LON = 111320 * Math.cos((CENTER.lat * Math.PI) / 180);
const project = (lat, lon) => [
  Math.round((lon - CENTER.lon) * M_PER_LON * 10) / 10,
  Math.round(-(lat - CENTER.lat) * M_PER_LAT * 10) / 10,
];

const ROAD_WIDTH = {
  motorway: 14, trunk: 14, primary: 13, secondary: 11, tertiary: 10,
  unclassified: 8, residential: 8, living_street: 6, service: 5,
  motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 8, tertiary_link: 8,
};
const DRIVABLE = new Set(Object.keys(ROAD_WIDTH));

async function fetchTile(minLon, minLat, maxLon, maxLat, i) {
  const file = `${CACHE}/tile-${i}.osm`;
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'tylerciuccisimulator-mapbuilder/0.1' } });
    if (res.ok) {
      const text = await res.text();
      writeFileSync(file, text);
      return text;
    }
    console.warn(`tile ${i}: HTTP ${res.status}, retrying`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`tile ${i} failed`);
}

const attr = (s, name) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(s);
  return m ? m[1] : undefined;
};

function parse(xml, nodes, ways) {
  const nodeRe = /<node\s([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const id = attr(m[1], 'id');
    nodes.set(id, [Number(attr(m[1], 'lat')), Number(attr(m[1], 'lon'))]);
  }
  const wayRe = /<way\s([^>]*?)>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml))) {
    const id = attr(m[1], 'id');
    if (ways.has(id)) continue;
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]);
    const tags = {};
    for (const t of m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    ways.set(id, { refs, tags });
  }
}

function levels(tags) {
  if (tags.height) return Math.max(3, Number.parseFloat(tags.height) || 6);
  if (tags['building:levels']) return Math.max(3, (Number.parseFloat(tags['building:levels']) || 1) * 3.2);
  const big = ['commercial', 'retail', 'office', 'school', 'church', 'civic', 'government', 'apartments', 'hospital'];
  return big.includes(tags.building) ? 8 : 5;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const nodes = new Map();
  const ways = new Map();
  const minLat = CENTER.lat - HALF_LAT;
  const minLon = CENTER.lon - HALF_LON;
  const dLat = (2 * HALF_LAT) / TILES;
  const dLon = (2 * HALF_LON) / TILES;
  let i = 0;
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const a = (minLon + tx * dLon).toFixed(5);
      const b = (minLat + ty * dLat).toFixed(5);
      const c = (minLon + (tx + 1) * dLon).toFixed(5);
      const d = (minLat + (ty + 1) * dLat).toFixed(5);
      const xml = await fetchTile(a, b, c, d, i++);
      parse(xml, nodes, ways);
      process.stdout.write('.');
    }
  }
  console.log(`\n${nodes.size} nodes, ${ways.size} ways`);

  const inBounds = ([x, z]) => Math.abs(x) <= HALF_LON * M_PER_LON + 50 && Math.abs(z) <= HALF_LAT * M_PER_LAT + 50;

  // Road graph: shared vertex list so intersections connect.
  const vertIndex = new Map();
  const verts = [];
  const vid = (ref) => {
    if (!vertIndex.has(ref)) {
      const [lat, lon] = nodes.get(ref);
      vertIndex.set(ref, verts.length);
      verts.push(project(lat, lon));
    }
    return vertIndex.get(ref);
  };

  const roads = [];
  const buildings = [];
  const parks = [];
  const water = [];
  for (const { refs, tags } of ways.values()) {
    if (!refs.every((r) => nodes.has(r))) continue;
    if (tags.highway && DRIVABLE.has(tags.highway) && tags.area !== 'yes' && tags.access !== 'private') {
      roads.push({ t: tags.highway, w: ROAD_WIDTH[tags.highway], n: tags.name || '', ow: tags.oneway === 'yes' ? 1 : 0, v: refs.map(vid) });
      continue;
    }
    const pts = refs.map((r) => project(...nodes.get(r)));
    if (pts.length < 4 || refs[0] !== refs[refs.length - 1]) continue;
    if (!pts.some(inBounds)) continue;
    pts.pop();
    if (tags.building) buildings.push({ h: levels(tags), p: pts.flat() });
    else if (['park', 'garden', 'pitch', 'playground'].includes(tags.leisure) || ['grass', 'forest', 'meadow', 'cemetery', 'recreation_ground'].includes(tags.landuse) || tags.natural === 'wood') parks.push(pts.flat());
    else if (tags.natural === 'water' || tags.landuse === 'reservoir') water.push(pts.flat());
  }

  const out = {
    attribution: 'Map data (c) OpenStreetMap contributors, ODbL',
    center: CENTER,
    size: [Math.round(2 * HALF_LON * M_PER_LON), Math.round(2 * HALF_LAT * M_PER_LAT)],
    verts: verts.flat(),
    roads,
    buildings,
    parks,
    water,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`roads ${roads.length}, buildings ${buildings.length}, parks ${parks.length}, water ${water.length}`);
  console.log(`wrote ${OUT}: ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
}

main();
