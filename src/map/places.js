// Turns places.json (lot centers) into concrete positions: building placement,
// door, parking spot, and the road vertex used for routing.
import placesConfig from '../config/places.json';
import { buildGraph, nearestVertex, route, vert, smoothPath, resample } from './graph.js';

// Per-place layout in the building's local frame (+z faces the road).
const LAYOUT = {
  home: { door: [0, 6.2], park: [6.5, 13], parkHeading: 'toRoad' },
  wawa: { door: [0, 10.5], park: [-17, 14.5], parkHeading: 'toBuilding' },
  school: { door: [0, 13.5], park: [16, 26], parkHeading: 'toBuilding' },
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
    const [x, z] = cfg.lot;
    const onRoad = new Set(map.roads.filter((r) => r.n === cfg.road).flatMap((r) => r.v));
    const roadV = nearestVertex(graph, x, z, (i) => onRoad.has(i));
    const [rx, rz] = vert(map, roadV);
    const rot = Math.atan2(rx - x, rz - z); // local +z points at the road
    const place = { key, x, z, rot, roadV, road: [rx, rz], clearRadius: cfg.clearRadius };
    const L = LAYOUT[key];
    place.door = local(place, L.door);
    place.park = local(place, L.park);
    place.parkRot = L.parkHeading === 'toRoad' ? rot : rot + Math.PI;
    places[key] = place;
  }
  return { graph, places };
}

// Full drive: pull out of the parking spot, follow real streets, pull into the next spot.
export function driveRoute(graph, from, to) {
  const r = route(graph, from.roadV, to.roadV);
  if (!r) return null;
  // Smooth the corners so the car turns in arcs instead of snapping at each map point.
  const points = resample(smoothPath([from.park, ...r.points, to.park], 4, 9), 2);
  return { points, roads: r.roads };
}
