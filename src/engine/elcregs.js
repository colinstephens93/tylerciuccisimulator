// El Cregs, a flauta food truck, and ATF Agent Dan, who meets Tyler there.
import * as THREE from 'three';
import { toon, glow, textTexture, blobShadow, makeCharacter } from './models.js';

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

// ATF Agent Dan: navy windbreaker with "ATF" on the back, khakis, sunglasses, ball cap.
export function makeDan() {
  const d = makeCharacter({ shirt: 0x1f2a44, pants: 0xb59f78, skin: 0xf0c4a4, hair: 0x1f2a44, hairStyle: 'cap', build: 1.05, headScale: 1.2, shoes: 0x3a2a1f });
  const rig = d.userData.rig;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.22), new THREE.MeshBasicMaterial({ map: textTexture('ATF', { w: 256, h: 100, bg: null, fg: '#ffd23f', font: '900 90px system-ui, sans-serif' }), transparent: true }));
  back.position.set(0, 0.55, -0.33);
  back.rotation.y = Math.PI;
  rig.upper.add(back);
  // Sunglasses
  for (const s of [-1, 1]) rig.head.add(mesh(new THREE.BoxGeometry(0.11, 0.06, 0.03), toon(0x111111), 0.1 * s, 0.07, 0.28));
  rig.head.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), toon(0x111111), 0, 0.09, 0.29));
  d.scale.setScalar(1.15);
  return d;
}
