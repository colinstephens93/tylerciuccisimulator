// Turns places.json into concrete positions: building placement, door, parking spot,
// mission marker spot, and the road vertex used for GPS routing.
import placesConfig from '../config/places.json';
import { buildGraph, nearestVertex, route, vert } from './graph.js';

// Per-building layout in the building's local frame (+z faces the road).
const LAYOUT = {
  home: { door: [0, 6.2], marker: [-5, 12], park: [6.5, 13], parkHeading: 'toRoad' },
  wawa: { door: [0, 10.5], marker: [0, 16], park: [-17, 14.5], parkHeading: 'toBuilding' },
  school: { door: [0, 13.5], marker: [0, 20], park: [16, 26], parkHeading: 'toBuilding' },
};

function local(place, [lx, lz]) {
  const { x, z, rot } = place;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // Rotate local (lx, lz) by rot around Y, where local +z maps to the facing direction.
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

export function computePlaces(map) {
  const graph = buildGraph(map);
  const places = {};
  for (const [key, cfg] of Object.entries(placesConfig)) {
    if (key.startsWith('_')) continue;
    const [x, z] = cfg.lot || cfg.spot;
    const onRoad = new Set(map.roads.filter((r) => r.n === cfg.road).flatMap((r) => r.v));
    const roadV = nearestVertex(graph, x, z, (i) => onRoad.has(i));
    const [rx, rz] = vert(map, roadV);
    const rot = Math.atan2(rx - x, rz - z); // local +z points at the road
    const place = { key, label: cfg.label, x, z, rot, roadV, road: [rx, rz], clearRadius: cfg.clearRadius || 0, building: !!cfg.lot };
    const L = LAYOUT[key];
    if (L) {
      place.door = local(place, L.door);
      place.marker = local(place, L.marker);
      place.park = local(place, L.park);
      place.parkRot = L.parkHeading === 'toRoad' ? rot : rot + Math.PI;
    } else {
      // Open-air spot: put the marker at the roadside, on the side facing the spot.
      const d = Math.hypot(x - rx, z - rz) || 1;
      const w = Math.max(...map.roads.filter((r) => r.n === cfg.road).map((r) => r.w));
      place.marker = [rx + ((x - rx) / d) * (w / 2 + 4), rz + ((z - rz) / d) * (w / 2 + 4)];
    }
    places[key] = place;
  }
  return { graph, places };
}

// GPS path from a world position to a place, along real streets (one-ways respected).
export function gpsRoute(graph, x, z, place) {
  const from = nearestVertex(graph, x, z);
  const r = route(graph, from, place.roadV);
  return r ? [[x, z], ...r.points, place.marker] : [[x, z], place.marker];
}
