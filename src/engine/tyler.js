// Deputy Tyler Ciucci, modeled after the reference photo with realistic proportions:
// stocky build, short dark-brown hair with faded sides, a full mustache, black short-sleeve
// uniform shirt under a black plate-carrier vest (silver star, name tape, magazine and radio
// pouches, body camera), black duty pants and boots, duty belt with a gold star badge and
// holster, black watch (left wrist), bracelet (right wrist), and a phone with a red grip.
// Generic insignia only: no agency patches, names or numbers.
import * as THREE from 'three';
import { blobShadow, rigCharacter, starShape } from './models.js';

const matCache = new Map();
// Physically based material (soft, slightly rough) so Tyler reads as "real" next to the toon world.
function pbr(color, { rough = 0.8, metal = 0, emissive = 0 } = {}) {
  const key = `${color}|${rough}|${metal}|${emissive}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive }));
  return matCache.get(key);
}

const C = {
  skin: 0xe3a98b,
  skinShade: 0xd99e82,
  hair: 0x3a2a1f,
  stache: 0x7a5236,
  shirt: 0x1b1c20,
  vest: 0x16171a,
  pouch: 0x1e1f23,
  pants: 0x191a1e,
  boots: 0x0d0d0f,
  belt: 0x101012,
  silver: 0xd7dbe0,
  gold: 0xd9a933,
  red: 0xe5392b,
};

function part(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, ws = 20, hs = 14, ...cut) => new THREE.SphereGeometry(r, ws, hs, ...cut);
const cap = (r, len, seg = 16) => new THREE.CapsuleGeometry(r, len, 6, seg);

function buildHead(head) {
  const skin = pbr(C.skin, { rough: 0.65 });
  // Skull and face: slightly long, broad jaw.
  const skull = part(sph(0.118, 28, 20), skin, 0, 0.0, 0, head);
  skull.scale.set(0.93, 1.1, 1.0);
  const jaw = part(sph(0.1, 24, 16), skin, 0, -0.06, 0.02, head);
  jaw.scale.set(1.0, 0.85, 0.95);
  // Light stubble on the jaw line.
  const stubble = part(sph(0.102, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), pbr(C.skinShade, { rough: 0.95 }), 0, -0.055, 0.021, head);
  stubble.scale.set(1.0, 0.86, 0.96);
  // Nose
  const nose = part(new THREE.ConeGeometry(0.022, 0.06, 10), skin, 0, -0.005, 0.118, head);
  nose.rotation.x = Math.PI * 0.42;
  part(sph(0.021, 12, 8), skin, 0, -0.025, 0.12, head);
  // Ears
  for (const s of [-1, 1]) {
    const ear = part(sph(0.03, 12, 10), skin, 0.108 * s, 0.0, -0.005, head);
    ear.scale.set(0.45, 1.15, 0.8);
  }
  // Eyes: small and realistic, under a heavy brow.
  for (const s of [-1, 1]) {
    part(sph(0.0135, 12, 10), pbr(0xe8e2da, { rough: 0.4 }), 0.042 * s, 0.026, 0.097, head);
    part(sph(0.0085, 10, 8), pbr(0x3b2c22, { rough: 0.2 }), 0.042 * s, 0.025, 0.107, head);
    const brow = part(box(0.05, 0.011, 0.016), pbr(C.hair, { rough: 0.9 }), 0.044 * s, 0.05, 0.108, head);
    brow.rotation.z = -0.08 * s;
  }
  // Full mustache: thick, slightly droopy at the corners.
  const stache = pbr(C.stache, { rough: 0.95 });
  const bar = part(cap(0.02, 0.07, 10), stache, 0, -0.046, 0.112, head);
  bar.rotation.z = Math.PI / 2;
  bar.scale.set(1, 1, 0.75);
  for (const s of [-1, 1]) {
    const end = part(cap(0.015, 0.024, 8), stache, 0.05 * s, -0.06, 0.1, head);
    end.rotation.z = 0.35 * s;
  }
  // Mouth line
  part(box(0.04, 0.005, 0.01), pbr(0x8a4a3a), 0, -0.072, 0.112, head);
  // Hair: longer on top, short faded sides and back.
  const hair = pbr(C.hair, { rough: 0.95 });
  const top = part(sph(0.124, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), hair, 0, 0.022, 0.006, head);
  top.scale.set(0.95, 1.05, 1.03);
  const fade = part(sph(0.121, 28, 14, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.33), pbr(0x5a4636, { rough: 1 }), 0, 0.0, -0.008, head);
  fade.scale.set(0.95, 1.1, 1.0);
  const quiff = part(sph(0.07, 16, 10), hair, 0.012, 0.105, 0.045, head); // a little height at the front
  quiff.scale.set(1.35, 0.45, 1.0);
  // Clear coil earpiece running down from his left ear.
  const tube = part(cyl(0.004, 0.004, 0.2, 6), pbr(0xe8e2d8, { rough: 0.3 }), 0.1, -0.12, -0.02, head);
  tube.rotation.z = -0.15;
}

function buildTorso(upper) {
  // Upper-body heights are relative to the hips (upper.position.y).
  const shirt = pbr(C.shirt, { rough: 0.85 });
  const vest = pbr(C.vest, { rough: 0.75 });
  const pouch = pbr(C.pouch, { rough: 0.8 });

  // Stocky trunk.
  const torso = part(cap(0.21, 0.34, 20), shirt, 0, 0.33, 0, upper);
  torso.scale.set(1.5, 1, 0.9);
  const belly = part(sph(0.2, 20, 14), shirt, 0, 0.15, 0.03, upper);
  belly.scale.set(1.3, 0.9, 0.95);
  // Neck
  part(cyl(0.068, 0.078, 0.12, 16), pbr(C.skin, { rough: 0.65 }), 0, 0.66, 0, upper);
  part(cyl(0.085, 0.09, 0.04, 16), shirt, 0, 0.6, 0, upper); // collar

  // Plate carrier: front and back panels, shoulder straps, cummerbund.
  const front = part(box(0.42, 0.4, 0.07), vest, 0, 0.38, 0.17, upper);
  front.rotation.x = -0.04;
  part(box(0.42, 0.42, 0.07), vest, 0, 0.38, -0.17, upper);
  for (const s of [-1, 1]) part(box(0.08, 0.04, 0.36), vest, 0.15 * s, 0.6, 0, upper);
  const cummer = part(cyl(0.29, 0.29, 0.15, 24), vest, 0, 0.22, 0, upper);
  cummer.scale.z = 0.72;

  // Silver six-point star on his left chest, name tape on his right (blank).
  const star = part(new THREE.ExtrudeGeometry(starShape(6, 0.045, 0.025), { depth: 0.008, bevelEnabled: false }), pbr(C.silver, { rough: 0.35, metal: 0.3, emissive: 0x555555 }), 0.1, 0.5, 0.205, upper);
  star.rotation.x = -0.04;
  part(box(0.11, 0.028, 0.006), pbr(0x2a2b30), -0.1, 0.52, 0.206, upper);
  // Small body camera with a status light.
  part(box(0.05, 0.065, 0.025), pbr(0x101010, { rough: 0.4 }), 0.02, 0.33, 0.215, upper);
  part(sph(0.007, 8, 6), pbr(0xffd23f, { emissive: 0x665500 }), 0.02, 0.32, 0.229, upper);

  // Magazine pouches (his left), radio pouch with antenna (his right).
  for (let i = 0; i < 3; i++) part(box(0.05, 0.12, 0.05), pouch, 0.05 + i * 0.055, 0.22, 0.225, upper);
  part(box(0.07, 0.13, 0.05), pouch, -0.12, 0.25, 0.225, upper);
  part(cyl(0.006, 0.006, 0.1, 6), pbr(0x0a0a0a), -0.14, 0.36, 0.225, upper);
  part(cyl(0.017, 0.017, 0.16, 10), pbr(0x222225, { rough: 0.4, metal: 0.4 }), 0.21, 0.24, 0.17, upper); // flashlight

  // Duty belt with gold star badge, holster (his right), cuff case and keys.
  const belt = part(cyl(0.3, 0.3, 0.07, 24), pbr(C.belt, { rough: 0.6 }), 0, 0.06, 0, upper);
  belt.scale.z = 0.74;
  const badge = part(new THREE.ExtrudeGeometry(starShape(6, 0.035, 0.02), { depth: 0.008, bevelEnabled: false }), pbr(C.gold, { rough: 0.35, metal: 0.3, emissive: 0x4a3300 }), -0.1, 0.06, 0.225, upper);
  badge.add(part(new THREE.CircleGeometry(0.045, 20), pbr(0x1a1a1a), 0, 0, -0.002));
  const holster = part(box(0.06, 0.2, 0.12), pbr(0x121214, { rough: 0.5 }), -0.3, -0.04, 0.02, upper);
  holster.rotation.z = 0.08;
  part(box(0.07, 0.07, 0.05), pbr(0x121214, { rough: 0.5 }), 0.26, 0.04, -0.12, upper); // cuff case
  part(box(0.04, 0.08, 0.04), pbr(0x2a2a2a), 0.29, 0.03, 0.08, upper); // tourniquet pouch
  part(box(0.012, 0.012, 0.012), pbr(C.red), 0.29, 0.05, 0.1, upper);
  part(cyl(0.012, 0.012, 0.05, 6), pbr(0xb8bcc2, { rough: 0.3, metal: 0.8 }), -0.04, 0.0, 0.225, upper); // keys
  return torso;
}

function buildArm(side) {
  const shirt = pbr(C.shirt, { rough: 0.85 });
  const skin = pbr(C.skin, { rough: 0.65 });
  const shoulder = new THREE.Group();
  shoulder.position.set(0.31 * side, 0.57, 0);
  part(sph(0.095, 16, 12), shirt, 0, 0, 0, shoulder);
  part(cyl(0.092, 0.084, 0.18, 16), shirt, 0, -0.09, 0, shoulder); // short sleeve
  part(cyl(0.076, 0.066, 0.13, 14), skin, 0, -0.22, 0, shoulder); // upper arm
  if (side === -1) {
    // Generic shoulder patch on his right sleeve (no agency text).
    const patch = part(box(0.008, 0.07, 0.055), pbr(0x3a4250), -0.078, -0.07, 0, shoulder);
    patch.rotation.z = 0.05;
  }
  const elbow = new THREE.Group();
  elbow.position.y = -0.29;
  shoulder.add(elbow);
  part(sph(0.064, 12, 10), skin, 0, 0, 0, elbow);
  part(cyl(0.064, 0.047, 0.25, 14), skin, 0, -0.13, 0, elbow); // forearm
  const hand = part(sph(0.05, 14, 10), skin, 0, -0.31, 0.005, elbow);
  hand.scale.set(0.85, 1.35, 0.6);
  const thumb = part(cap(0.014, 0.035, 6), skin, -0.035 * side, -0.29, 0.02, elbow);
  thumb.rotation.z = 0.4 * side;
  if (side === 1) {
    // Black watch on his left wrist.
    part(cyl(0.048, 0.048, 0.025, 14), pbr(0x111111, { rough: 0.5 }), 0, -0.235, 0, elbow);
    part(box(0.04, 0.03, 0.012), pbr(0x222222, { rough: 0.2, metal: 0.3 }), 0, -0.235, 0.045, elbow);
  } else {
    // Bracelet on his right wrist, and the phone with the red grip.
    part(new THREE.TorusGeometry(0.046, 0.007, 6, 16), pbr(0x1a1a1a), 0, -0.24, 0, elbow).rotation.x = Math.PI / 2;
    const phone = new THREE.Group();
    part(box(0.075, 0.155, 0.01), pbr(0x1a1a1c, { rough: 0.3, metal: 0.2 }), 0, 0, 0, phone);
    part(cyl(0.022, 0.022, 0.018, 14), pbr(C.red, { rough: 0.6 }), 0, 0, -0.012, phone).rotation.x = Math.PI / 2;
    phone.position.set(0, -0.34, 0.035);
    elbow.add(phone);
  }
  return { shoulder, elbow };
}

function buildLeg(side) {
  const pants = pbr(C.pants, { rough: 0.9 });
  const hip = new THREE.Group();
  hip.position.set(0.12 * side, 0.95, 0);
  part(cyl(0.11, 0.085, 0.46, 16), pants, 0, -0.23, 0, hip); // thigh
  part(box(0.03, 0.12, 0.1), pants, 0.105 * side, -0.25, 0, hip); // cargo pocket
  const knee = new THREE.Group();
  knee.position.y = -0.46;
  hip.add(knee);
  part(sph(0.08, 12, 10), pants, 0, 0, 0, knee);
  part(cyl(0.08, 0.065, 0.42, 14), pants, 0, -0.21, 0, knee); // shin
  const boots = pbr(C.boots, { rough: 0.5 });
  part(cyl(0.072, 0.075, 0.12, 14), boots, 0, -0.39, 0, knee);
  part(box(0.11, 0.08, 0.27), boots, 0, -0.45, 0.05, knee);
  part(box(0.115, 0.025, 0.28), pbr(0x050505, { rough: 0.9 }), 0, -0.485, 0.05, knee); // sole
  return { hip, knee };
}

export function makeTyler() {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const { hip, knee } = buildLeg(side);
    inner.add(hip);
    legs.push(hip);
    knees.push(knee);
  }

  const upper = new THREE.Group();
  upper.position.y = 0.95;
  inner.add(upper);
  part(cyl(0.22, 0.24, 0.16, 20), pbr(C.pants, { rough: 0.9 }), 0, 0.0, 0, upper).scale.z = 0.8; // pelvis
  const torso = buildTorso(upper);

  const arms = [];
  const elbows = [];
  for (const side of [-1, 1]) {
    const { shoulder, elbow } = buildArm(side);
    upper.add(shoulder);
    arms.push(shoulder);
    elbows.push(elbow);
  }

  const head = new THREE.Group();
  head.position.y = 0.85;
  head.scale.setScalar(1.08); // a hair larger than life so his face reads on a phone
  upper.add(head);
  buildHead(head);

  const shadow = blobShadow(0.55);
  root.add(shadow);
  rigCharacter(root, { inner, upper, head, legs, arms, shadow, torso, hipY: 0.95, knees, elbows, shadowSize: 0.55, squashScale: 0.45 });
  root.scale.setScalar(1.3); // a touch larger than life so he reads on a phone screen
  return root;
}
