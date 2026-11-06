// El Cregs, a flauta food truck, and ATF Agent Dan, who meets Tyler there.
import * as THREE from 'three';
import { toon, glow, textTexture, blobShadow, rigCharacter } from './models.js';
import { pbr, part, box, cyl, sph, cap } from './tyler.js';

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function sign(text, w, h, opts) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, opts), transparent: !opts.bg }));
}

// Truck length runs along local z; the serving window faces local +x.
export function makeFoodTruck() {
  const g = new THREE.Group();
  const L = 7.6;
  const W = 2.7;
  const body = toon(0xfff3e0);
  // Box body and cab
  g.add(mesh(new THREE.BoxGeometry(W, 3.0, 5.4), body, 0, 2.15, -0.9));
  g.add(mesh(new THREE.BoxGeometry(W, 2.0, 2.0), toon(0xff7a1a), 0, 1.65, 2.75));
  g.add(mesh(new THREE.BoxGeometry(W - 0.1, 0.8, 0.1), toon(0x26334a), 0, 2.15, 3.76)); // windshield
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.7, 1.1), toon(0x26334a), (W / 2 + 0.01) * s, 2.1, 2.8));
  // Chunky orange and green stripes (Mexican-flag colors, cartoon style)
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.35, 5.4), toon(0x2fa84f), (W / 2 + 0.02) * s, 0.95, -0.9));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.22, 5.4), toon(0xe0102e), (W / 2 + 0.02) * s, 1.25, -0.9));
  }
  // Serving window, counter and awning on the +x side
  g.add(mesh(new THREE.BoxGeometry(0.06, 1.1, 3.2), toon(0x3a2a1f), W / 2 + 0.01, 2.35, -0.9));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 3.2), toon(0xc0c4ca), W / 2 + 0.25, 1.78, -0.9));
  const awning = mesh(new THREE.BoxGeometry(1.4, 0.08, 3.8), toon(0x2fa84f), W / 2 + 0.6, 3.15, -0.9);
  awning.rotation.z = -0.25;
  g.add(awning);
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.6), toon(i % 2 ? 0xffffff : 0xe0102e), W / 2 + 1.25, 2.85, -2.65 + i * 0.7));
  // Big roof sign, readable from both sides
  g.add(mesh(new THREE.BoxGeometry(0.15, 1.0, 4.6), toon(0xe0102e), 0, 4.15, -0.9));
  for (const s of [-1, 1]) {
    const t = sign('EL CREGS', 4.4, 0.85, { w: 1024, h: 190, bg: '#e0102e', fg: '#ffd23f', font: '900 150px system-ui, sans-serif' });
    t.position.set(0.08 * s, 4.15, -0.9);
    t.rotation.y = (Math.PI / 2) * s;
    g.add(t);
    const sub = sign('FLAUTAS', 2.6, 0.5, { w: 512, h: 100, bg: '#fff3e0', fg: '#2fa84f', font: '900 80px system-ui, sans-serif' });
    sub.position.set((W / 2 + 0.04) * s, 3.25, s > 0 ? 1.0 : -0.9);
    sub.rotation.y = (Math.PI / 2) * s;
    if (s < 0) g.add(sub);
  }
  // Menu board by the window
  const menu = sign('FLAUTAS  $3', 1.4, 0.5, { w: 512, h: 180, bg: '#1d2433', fg: '#ffffff', font: '900 90px system-ui, sans-serif' });
  menu.position.set(W / 2 + 0.04, 2.35, 1.1);
  menu.rotation.y = Math.PI / 2;
  g.add(menu);
  // String lights along the awning edge
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), glow([0xffd23f, 0xff6fb5, 0x3ddc84][i % 3]), W / 2 + 1.25, 2.68, -2.9 + i * 0.5));
  // Wheels
  const wheel = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14).rotateZ(Math.PI / 2);
  for (const z of [2.6, -2.6]) for (const s of [-1, 1]) g.add(mesh(wheel, toon(0x1b1b1b), (W / 2 - 0.1) * s, 0.5, z));
  // Little table with a salsa bottle out front
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), toon(0x888888), W / 2 + 3.0, 0.5, -2.6));
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), toon(0xff7a1a), W / 2 + 3.0, 1.02, -2.6));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8), toon(0xe0102e), W / 2 + 3.0, 1.18, -2.5));
  g.add(blobShadow(W * 0.8, L * 0.55));
  g.userData = { length: L, width: W };
  return g;
}

// ATF Agent Dan, modeled after reference photos with realistic proportions to match Tyler:
// a big, heavyset guy with a round face and rosy cheeks, strawberry-blond hair in a swept-back
// pompadour with short sides, a full ginger beard and mustache, light blue-grey eyes and black
// rectangular glasses. Navy "ATF" windbreaker over a white shirt and light-blue floral tie,
// khakis, brown shoes.
const D = {
  skin: 0xf0bfa3,
  cheek: 0xe79a87,
  hair: 0xd8a467,
  hairDark: 0xb98450,
  beard: 0xb8662f,
  brow: 0xc98a55,
  jacket: 0x1f2a44,
  khaki: 0xb59f78,
  shoes: 0x4a2f1f,
  tie: 0xa9c9d8,
};

function buildDanHead(head) {
  const skin = pbr(D.skin, { rough: 0.6 });
  // Round, full face.
  part(sph(0.122, 28, 20), skin, 0, 0.005, 0, head).scale.set(1.0, 1.06, 1.0);
  part(sph(0.112, 24, 16), skin, 0, -0.055, 0.015, head).scale.set(1.08, 0.9, 1.0);
  for (const s of [-1, 1]) {
    const cheek = part(sph(0.035, 14, 10), pbr(D.cheek, { rough: 0.7 }), 0.065 * s, -0.01, 0.092, head); // rosy cheeks
    cheek.scale.set(1.1, 0.8, 0.5);
    const ear = part(sph(0.03, 12, 10), skin, 0.118 * s, 0.0, -0.005, head);
    ear.scale.set(0.45, 1.15, 0.8);
  }
  const nose = part(sph(0.026, 14, 10), skin, 0, -0.012, 0.122, head);
  nose.scale.set(1.0, 0.9, 1.1);
  part(new THREE.ConeGeometry(0.02, 0.05, 10), skin, 0, 0.012, 0.118, head).rotation.x = Math.PI * 0.42;

  // Light blue-grey eyes under light ginger brows.
  for (const s of [-1, 1]) {
    part(sph(0.013, 12, 10), pbr(0xece6de, { rough: 0.4 }), 0.044 * s, 0.026, 0.104, head);
    part(sph(0.008, 10, 8), pbr(0x7f98a6, { rough: 0.2 }), 0.044 * s, 0.026, 0.114, head);
    part(box(0.052, 0.01, 0.014), pbr(D.brow, { rough: 0.9 }), 0.045 * s, 0.052, 0.112, head);
  }

  // Black rectangular glasses with brown temples.
  const frame = pbr(0x111111, { rough: 0.3 });
  for (const s of [-1, 1]) {
    const cx = 0.046 * s;
    part(box(0.062, 0.007, 0.007), frame, cx, 0.045, 0.124, head);
    part(box(0.062, 0.007, 0.007), frame, cx, 0.008, 0.122, head);
    part(box(0.007, 0.044, 0.007), frame, cx + 0.031, 0.026, 0.123, head);
    part(box(0.007, 0.044, 0.007), frame, cx - 0.031, 0.026, 0.123, head);
    part(box(0.006, 0.01, 0.11), pbr(0x5a3a24, { rough: 0.4 }), 0.112 * s, 0.035, 0.065, head); // temple arm
  }
  part(box(0.02, 0.006, 0.006), frame, 0, 0.034, 0.126, head); // bridge

  // Full ginger beard and mustache around a smiling mouth.
  const beard = pbr(D.beard, { rough: 1 });
  // Beard starts below the cheekbones and wraps the jaw and chin.
  const b = part(sph(0.124, 28, 16, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), beard, 0, 0.0, 0.01, head);
  b.scale.set(1.05, 1.25, 1.07);
  part(sph(0.07, 18, 12), beard, 0, -0.112, 0.045, head).scale.set(1.35, 0.85, 1.05); // full chin
  for (const s of [-1, 1]) {
    const burn = part(sph(0.04, 12, 10), beard, 0.105 * s, -0.035, 0.0, head); // sideburns into the beard
    burn.scale.set(0.5, 1.4, 1.0);
  }
  const stache = part(cap(0.017, 0.06, 10), beard, 0, -0.047, 0.122, head);
  stache.rotation.z = Math.PI / 2;
  stache.scale.set(1, 1, 0.7);
  part(box(0.042, 0.012, 0.01), pbr(0x8a3f35), 0, -0.07, 0.128, head); // lips
  part(box(0.034, 0.006, 0.006), pbr(0xf5f0e6), 0, -0.066, 0.133, head); // a bit of a grin

  // Strawberry-blond pompadour, swept up and back, with short sides.
  const hair = pbr(D.hair, { rough: 0.85 });
  const sides = part(sph(0.126, 28, 14, 0, Math.PI * 2, Math.PI * 0.12, Math.PI * 0.36), pbr(D.hairDark, { rough: 1 }), 0, 0.006, -0.01, head);
  sides.scale.set(0.98, 1.05, 1.02);
  const top = part(sph(0.12, 24, 14), hair, 0, 0.09, -0.005, head);
  top.scale.set(0.85, 0.5, 1.02);
  const quiff = part(sph(0.075, 18, 12), hair, 0.01, 0.135, 0.06, head); // swept-up front
  quiff.scale.set(1.25, 0.75, 1.0);
  quiff.rotation.x = -0.35;
  quiff.rotation.z = -0.15;
}

function danLimb(parent, color, x, y, upperLen, lowerLen, r, lowerColor) {
  const top = new THREE.Group();
  top.position.set(x, y, 0);
  parent.add(top);
  part(sph(r, 14, 10), pbr(color, { rough: 0.85 }), 0, 0, 0, top);
  part(cyl(r, r * 0.88, upperLen, 16), pbr(color, { rough: 0.85 }), 0, -upperLen / 2, 0, top);
  const joint = new THREE.Group();
  joint.position.y = -upperLen;
  top.add(joint);
  part(sph(r * 0.88, 12, 10), pbr(color, { rough: 0.85 }), 0, 0, 0, joint);
  part(cyl(r * 0.88, r * 0.72, lowerLen, 14), pbr(lowerColor ?? color, { rough: 0.85 }), 0, -lowerLen / 2, 0, joint);
  return { top, joint };
}

export function makeDan() {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  // Legs: khakis and brown shoes.
  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const { top, joint } = danLimb(inner, D.khaki, 0.15 * side, 0.95, 0.46, 0.42, 0.13);
    part(box(0.13, 0.08, 0.29), pbr(D.shoes, { rough: 0.5 }), 0, -0.46, 0.05, joint);
    legs.push(top);
    knees.push(joint);
  }

  const upper = new THREE.Group();
  upper.position.y = 0.95;
  inner.add(upper);
  const jacket = pbr(D.jacket, { rough: 0.6 });
  part(cyl(0.29, 0.29, 0.18, 20), pbr(D.khaki, { rough: 0.85 }), 0, 0.0, 0, upper).scale.z = 0.85; // hips
  // Big frame and a round belly that blends into the chest.
  const torso = part(cap(0.25, 0.3, 20), jacket, 0, 0.33, 0, upper);
  torso.scale.set(1.3, 1, 1.0);
  part(sph(0.25, 22, 16), jacket, 0, 0.22, 0.05, upper).scale.set(1.22, 1.05, 1.08);
  // Open collar: white shirt and a light-blue floral tie.
  part(box(0.11, 0.13, 0.03), pbr(0xf6f6f2, { rough: 0.7 }), 0, 0.57, 0.225, upper).rotation.x = -0.35;
  part(box(0.045, 0.2, 0.02), pbr(D.tie, { rough: 0.8 }), 0, 0.5, 0.245, upper).rotation.x = -0.2;
  for (let i = 0; i < 4; i++) part(sph(0.008, 6, 4), pbr(0x7fb08a), (i % 2 ? 0.01 : -0.01), 0.58 - i * 0.04, 0.26 - i * 0.01, upper); // tiny flowers
  part(box(0.006, 0.36, 0.01), pbr(0x9aa3b5, { rough: 0.3, metal: 0.6 }), 0.08, 0.32, 0.27, upper).rotation.x = -0.12; // zipper
  part(cyl(0.085, 0.095, 0.12, 16), pbr(D.skin, { rough: 0.6 }), 0, 0.66, 0, upper); // thick neck
  const atf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: textTexture('ATF', { w: 256, h: 100, bg: null, fg: '#ffd23f', font: '900 90px system-ui, sans-serif' }), transparent: true }));
  atf.position.set(0, 0.45, -0.262);
  atf.rotation.y = Math.PI;
  upper.add(atf);

  // Arms in long windbreaker sleeves.
  const arms = [];
  const elbows = [];
  for (const side of [-1, 1]) {
    const { top, joint } = danLimb(upper, D.jacket, 0.36 * side, 0.57, 0.3, 0.26, 0.095);
    const hand = part(sph(0.055, 14, 10), pbr(D.skin, { rough: 0.6 }), 0, -0.32, 0.005, joint);
    hand.scale.set(0.85, 1.3, 0.65);
    arms.push(top);
    elbows.push(joint);
  }

  const head = new THREE.Group();
  head.position.y = 0.87;
  head.scale.setScalar(1.08);
  upper.add(head);
  buildDanHead(head);

  const shadow = blobShadow(0.7);
  root.add(shadow);
  rigCharacter(root, { inner, upper, head, legs, arms, shadow, torso, hipY: 0.95, knees, elbows, shadowSize: 0.7, squashScale: 0.45 });
  root.scale.setScalar(1.36); // a bit bigger than Tyler
  return root;
}
