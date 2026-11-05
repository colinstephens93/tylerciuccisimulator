// Low-poly cartoon models built from primitives (no model files to load).
import * as THREE from 'three';
import { state } from '../state.js';

// Three-step toon shading ramp shared by all materials.
const ramp = (() => {
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const matCache = new Map();
export function toon(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }));
  return matCache.get(key);
}

export function glow(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function textTexture(text, { w = 512, h = 128, bg = '#ffffff', fg = '#c8102e', font = 'bold 72px system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Number.parseInt(/(\d+)px/.exec(font)[1], 10);
  while (g.measureText(text).width > w * 0.92 && size > 12) {
    size -= 4;
    g.font = font.replace(/\d+px/, `${size}px`);
  }
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signPlane(text, width, height, opts) {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: textTexture(text, opts) }));
}

function starShape(points = 6, outer = 1, inner = 0.55) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

// ---------- People ----------

// Tyler: tall and stocky, short dark hair, full short beard, black long-sleeve uniform polo,
// silver six-point star, black pants, duty belt with flashlight and gold belt badge,
// black wristband, phone with a red grip.
export function makePerson({
  shirt = 0x1a1c22,
  pants = 0x1f2228,
  skin = 0xe9b796,
  hair = 0x3b2a1e,
  beard = 0x5a3a24,
  shoes = 0x111111,
  build = 1.15,
  height = 1,
  deputy = false,
  vest = null,
  sign = false,
} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.set(1, height, 1);
  root.add(body);

  // Legs (pivot at the hip)
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.17 * side * build, 0.95, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.15 * build, 0.6, 4, 10), toon(pants), 0, -0.45, 0));
    pivot.add(mesh(new THREE.BoxGeometry(0.24 * build, 0.14, 0.38), toon(shoes), 0, -0.88, 0.06));
    body.add(pivot);
    legs.push(pivot);
  }

  // Torso
  const torso = mesh(new THREE.CapsuleGeometry(0.36, 0.5, 6, 14), toon(shirt), 0, 1.33, 0);
  torso.scale.set(1.12 * build, 1, 0.82 * build);
  body.add(torso);
  if (vest) {
    const v = mesh(new THREE.CapsuleGeometry(0.37, 0.4, 6, 14), toon(vest), 0, 1.38, 0);
    v.scale.set(1.14 * build, 1, 0.86 * build);
    body.add(v);
  }

  // Collar
  body.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 12), toon(shirt), 0, 1.78, 0));

  if (deputy) {
    // Duty belt with gold badge and flashlight
    const belt = mesh(new THREE.CylinderGeometry(0.42 * build, 0.42 * build, 0.12, 18), toon(0x0d0d0d), 0, 0.98, 0);
    belt.scale.z = 0.82;
    body.add(belt);
    body.add(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.03), toon(0xd4a640), -0.14, 0.99, 0.36 * build));
    body.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), toon(0x222222), -0.45 * build, 0.88, 0.05));
    // Silver star on his left chest (+x, since he faces +z)
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(6, 0.1, 0.055), { depth: 0.02, bevelEnabled: false }), toon(0xdfe3e8, { emissive: 0x333333 }));
    star.position.set(0.17 * build, 1.5, 0.3 * build);
    body.add(star);
    // Shoulder patches
    for (const side of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), toon(0x6d7480), 0.47 * build * side, 1.58, 0));
  }

  // Arms (pivot at the shoulder)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.48 * build * side, 1.66, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.12 * build, 0.5, 4, 10), toon(shirt), 0, -0.34, 0));
    pivot.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), toon(skin), 0, -0.7, 0));
    if (deputy && side === 1) pivot.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), toon(0x0a0a0a), 0, -0.6, 0).rotateX(Math.PI / 2)); // wristband
    if (deputy && side === -1) {
      // Phone with the red grip
      const phone = new THREE.Group();
      phone.add(mesh(new THREE.BoxGeometry(0.1, 0.19, 0.02), toon(0x111111)));
      phone.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), toon(0xe5392b), 0, 0, -0.025).rotateX(Math.PI / 2));
      phone.position.set(0, -0.74, 0.08);
      pivot.add(phone);
    }
    if (sign && side === 1) {
      // Crossing guard STOP paddle
      pivot.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), toon(0x888888), 0, -0.4, 0.2));
      const paddle = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 8), toon(0xd62828), 0, 0.05, 0.2);
      paddle.rotation.x = Math.PI / 2;
      pivot.add(paddle);
    }
    body.add(pivot);
    arms.push(pivot);
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 2.08, 0);
  head.add(mesh(new THREE.SphereGeometry(0.29, 18, 14), toon(skin)));
  const hairCap = mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(hair), 0, 0.03, -0.02);
  head.add(hairCap);
  if (beard !== null) {
    const b = mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), toon(beard), 0, 0.02, 0.025);
    b.scale.set(1.03, 1.05, 1.0);
    head.add(b);
    head.add(mesh(new THREE.BoxGeometry(0.2, 0.045, 0.05), toon(beard), 0, -0.06, 0.26)); // mustache
  }
  for (const side of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0x1a1a1a), 0.1 * side, 0.05, 0.255)); // eyes
    head.add(mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), toon(hair), 0.1 * side, 0.12, 0.26)); // brows
    head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(skin), 0.29 * side, 0, 0)); // ears
  }
  head.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), toon(skin), 0, -0.01, 0.29)); // nose
  body.add(head);

  // Soft blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.3;
  root.add(shadow);

  let phase = 0;
  root.userData.animate = (dt, moving, speed = 1) => {
    if (moving) phase += dt * 9 * speed;
    else phase *= 0.85;
    const s = Math.sin(phase);
    legs[0].rotation.x = s * 0.6;
    legs[1].rotation.x = -s * 0.6;
    arms[0].rotation.x = -s * 0.5;
    arms[1].rotation.x = s * 0.5;
    body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.06 : 0;
  };
  return root;
}

export function makeTyler() {
  const t = makePerson({ deputy: true, build: 1.18, height: 1.04 });
  t.scale.setScalar(1.7); // oversized avatar so he reads well on the map
  return t;
}

// ---------- Vehicles ----------

function wheels(group, length, width, radius = 0.36) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.28, 14);
  geo.rotateZ(Math.PI / 2);
  for (const z of [length * 0.32, -length * 0.32]) {
    for (const side of [-1, 1]) group.add(mesh(geo, toon(0x151515), (width / 2) * side, radius, z));
  }
}

export function makePatrolCar() {
  const pc = state.config.patrolCar;
  const g = new THREE.Group();
  const L = 4.9;
  const W = 1.95;
  g.add(mesh(new THREE.BoxGeometry(W, 0.7, L), toon(pc.bodyColor), 0, 0.72, 0));
  // White doors
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.6, 2.1), toon(pc.doorColor), (W / 2 + 0.01) * side, 0.74, -0.1));
    const label = signPlane(pc.doorText, 1.9, 0.38, { bg: pc.doorColor, fg: pc.bodyColor, font: 'bold 80px system-ui, sans-serif' });
    label.position.set((W / 2 + 0.04) * side, 0.8, -0.1);
    label.rotation.y = (Math.PI / 2) * side;
    g.add(label);
  }
  // Cabin, roof, glass
  g.add(mesh(new THREE.BoxGeometry(W - 0.15, 0.62, 2.3), toon(0x223044), 0, 1.38, -0.2));
  g.add(mesh(new THREE.BoxGeometry(W - 0.1, 0.08, 2.0), toon(pc.doorColor), 0, 1.72, -0.25));
  // Light bar
  const red = glow(0xff2a2a);
  const blue = glow(0x2a5bff);
  const lbL = mesh(new THREE.BoxGeometry(0.7, 0.16, 0.32), red, -0.38, 1.84, -0.2);
  const lbR = mesh(new THREE.BoxGeometry(0.7, 0.16, 0.32), blue, 0.38, 1.84, -0.2);
  g.add(lbL, lbR);
  // Push bumper, headlights, taillights
  g.add(mesh(new THREE.BoxGeometry(W * 0.8, 0.5, 0.15), toon(0x2a2a2a), 0, 0.65, L / 2 + 0.1));
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), glow(0xfff6c8), 0.62 * side, 0.85, L / 2 + 0.01));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), glow(0xb00000), 0.62 * side, 0.85, -L / 2 - 0.01));
  }
  wheels(g, L, W);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, L + 0.5), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.3;
  g.add(shadow);

  let t = 0;
  g.userData.setLights = (on, dt = 0) => {
    t += dt;
    const flip = Math.floor(t * 7) % 2 === 0;
    lbL.material = on ? (flip ? red : glow(0x550000)) : toon(0x661111);
    lbR.material = on ? (flip ? glow(0x0a1a55) : blue) : toon(0x112266);
  };
  g.userData.setLights(false);
  g.scale.setScalar(1.25);
  return g;
}

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xaab7b8, 0xf5f5f5, 0x2c3e50, 0x7d3c98, 0x27ae60, 0xd35400];

export function makeTrafficCar(kind = 'car') {
  const g = new THREE.Group();
  if (kind === 'bus') {
    const L = 10;
    g.add(mesh(new THREE.BoxGeometry(2.5, 2.4, L), toon(0xf4c20d), 0, 1.6, 0));
    g.add(mesh(new THREE.BoxGeometry(2.52, 0.6, L - 1.5), toon(0x223044), 0, 2.1, -0.3));
    g.add(mesh(new THREE.BoxGeometry(2.52, 0.12, L), toon(0x111111), 0, 1.15, 0));
    const sign = signPlane('SCHOOL BUS', 2.0, 0.4, { bg: '#f4c20d', fg: '#111111' });
    sign.position.set(0, 2.6, -L / 2 - 0.01);
    sign.rotation.y = Math.PI;
    g.add(sign);
    wheels(g, L, 2.5, 0.5);
    g.userData.length = L;
  } else if (kind === 'pickup') {
    const c = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    g.add(mesh(new THREE.BoxGeometry(2.0, 0.8, 5.4), toon(c), 0, 0.85, 0));
    g.add(mesh(new THREE.BoxGeometry(1.9, 0.7, 1.7), toon(0x223044), 0, 1.55, 0.6));
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.3, 2.2), toon(0x333333), 0, 1.15, -1.4));
    wheels(g, 5.4, 2.0, 0.42);
    g.userData.length = 5.4;
  } else if (kind === 'pothole') {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1.1, 12), toon(0x2a2a2a));
    p.rotation.x = -Math.PI / 2;
    p.position.y = 0.28;
    p.scale.set(1, 0.7, 1);
    g.add(p);
    g.userData.length = 2;
  } else {
    const c = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    g.add(mesh(new THREE.BoxGeometry(1.9, 0.7, 4.5), toon(c), 0, 0.7, 0));
    g.add(mesh(new THREE.BoxGeometry(1.75, 0.6, 2.2), toon(0x223044), 0, 1.33, -0.2));
    g.add(mesh(new THREE.BoxGeometry(1.8, 0.08, 1.9), toon(c), 0, 1.66, -0.25));
    wheels(g, 4.5, 1.9);
    g.userData.length = 4.5;
  }
  if (kind !== 'pothole') {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, g.userData.length + 0.4), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.3;
    g.add(shadow);
  }
  g.scale.setScalar(1.25);
  return g;
}

// ---------- Buildings and props ----------

export function makeHouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(14, 5, 10), toon(0xe8dcc4), 0, 2.5, 0));
  const roofShape = new THREE.Shape([new THREE.Vector2(-7.8, 0), new THREE.Vector2(7.8, 0), new THREE.Vector2(0, 4)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 11.4, bevelEnabled: false }), toon(0x6b3a2e));
  roof.position.set(0, 5, -5.7);
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), toon(0x3d5a80), 0, 1.3, 5.05)); // front door
  for (const x of [-4.2, 4.2]) g.add(mesh(new THREE.BoxGeometry(2, 1.6, 0.15), toon(0xbfe3f7), x, 2.8, 5.05));
  g.add(mesh(new THREE.BoxGeometry(4.5, 0.25, 3), toon(0xb0a48a), 0, 0.12, 6.5)); // porch
  g.add(mesh(new THREE.BoxGeometry(5, 0.08, 18), toon(0x9a9a96), 6.5, 0.05, 13)); // driveway
  return g;
}

export function makeWawa() {
  const g = new THREE.Group();
  // Store (faces +z toward the road)
  g.add(mesh(new THREE.BoxGeometry(30, 7, 18), toon(0xf3efe6), 0, 3.5, 0));
  g.add(mesh(new THREE.BoxGeometry(30.4, 1.6, 18.4), toon(0xc8102e), 0, 6.4, 0));
  g.add(mesh(new THREE.BoxGeometry(30.6, 0.4, 18.6), toon(0xf4c20d), 0, 5.5, 0));
  const sign = signPlane('WAWA', 10, 2.2, { bg: '#c8102e', fg: '#f4c20d', font: 'bold 96px system-ui, sans-serif' });
  sign.position.set(0, 6.4, 9.22);
  g.add(sign);
  g.add(mesh(new THREE.BoxGeometry(5, 3.6, 0.2), toon(0x9fd3ff, { emissive: 0x224455 }), 0, 1.8, 9.05)); // doors
  for (const x of [-9, 9]) g.add(mesh(new THREE.BoxGeometry(7, 3, 0.15), toon(0xbfe3f7), x, 2.4, 9.05)); // windows
  // Fuel canopy and pumps in front
  g.add(mesh(new THREE.BoxGeometry(22, 0.7, 8), toon(0xf3efe6), 6, 6.8, 31));
  g.add(mesh(new THREE.BoxGeometry(22.2, 0.4, 8.2), toon(0xc8102e), 6, 6.5, 31));
  for (const x of [-2, 6, 14]) {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 6.5, 8), toon(0xdddddd), x, 3.25, 31));
    g.add(mesh(new THREE.BoxGeometry(1.2, 1.9, 0.8), toon(0xc8102e), x + 2.2, 0.95, 31));
    g.add(mesh(new THREE.BoxGeometry(1.2, 1.9, 0.8), toon(0xc8102e), x - 2.2, 0.95, 31));
  }
  // Lot
  g.add(mesh(new THREE.BoxGeometry(48, 0.06, 46), toon(0x8a8d92), 0, 0.03, 17));
  for (let x = -21; x <= -9; x += 4) g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 5), toon(0xffffff), x, 0.05, 13));
  return g;
}

export function makeSchool() {
  const g = new THREE.Group();
  const brick = toon(0xa34a3a);
  g.add(mesh(new THREE.BoxGeometry(60, 9, 18), brick, 0, 4.5, 0));
  g.add(mesh(new THREE.BoxGeometry(18, 9, 30), brick, -32, 4.5, -6));
  g.add(mesh(new THREE.BoxGeometry(18, 9, 30), brick, 32, 4.5, -6));
  g.add(mesh(new THREE.BoxGeometry(61, 0.6, 19), toon(0xe8e2d4), 0, 9.2, 0));
  // Entrance canopy
  g.add(mesh(new THREE.BoxGeometry(12, 0.6, 6), toon(0xe8e2d4), 0, 4.6, 12));
  for (const x of [-5.5, 5.5]) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 10), toon(0xf2f2f2), x, 2.3, 14.5));
  g.add(mesh(new THREE.BoxGeometry(6, 3.4, 0.2), toon(0x9fd3ff, { emissive: 0x224455 }), 0, 1.7, 9.05));
  for (let x = -26; x <= 26; x += 6.5) if (Math.abs(x) > 5) g.add(mesh(new THREE.BoxGeometry(3.6, 2, 0.15), toon(0xbfe3f7), x, 5.6, 9.05));
  const sign = signPlane(state.config.schoolName.toUpperCase(), 22, 2.2, { w: 1024, h: 110, bg: '#e8e2d4', fg: '#5e2b20' });
  sign.position.set(0, 7.6, 9.15);
  g.add(sign);
  // Marquee sign by the road
  g.add(mesh(new THREE.BoxGeometry(9, 3, 0.8), toon(0x5e2b20), -20, 1.8, 34));
  const marquee = signPlane(`HOME OF THE ${state.config.schoolMascot.toUpperCase()}`, 8.4, 1.4, { bg: '#ffffff', fg: '#5e2b20', font: 'bold 60px system-ui, sans-serif' });
  marquee.position.set(-20, 2.1, 34.45);
  g.add(marquee);
  // Flagpole
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 8), toon(0xdddddd), 14, 7, 22));
  g.add(mesh(new THREE.BoxGeometry(0.05, 2.2, 3.4), toon(0xb22234), 14, 12.6, 23.8));
  // Front walk and car-rider lot
  g.add(mesh(new THREE.BoxGeometry(5, 0.07, 26), toon(0xd9d4c7), 0, 0.04, 22));
  g.add(mesh(new THREE.BoxGeometry(48, 0.06, 20), toon(0x8a8d92), 22, 0.03, 26));
  return g;
}

export function makeBeacon(color = 0xf4c20d) {
  const g = new THREE.Group();
  const pin = new THREE.Group();
  pin.add(mesh(new THREE.ConeGeometry(0.9, 2.2, 16), toon(color, { emissive: 0x332200 }), 0, 0, 0).rotateX(Math.PI));
  pin.add(mesh(new THREE.SphereGeometry(1.15, 16, 12), toon(color, { emissive: 0x332200 }), 0, 1.3, 0));
  pin.add(mesh(new THREE.SphereGeometry(0.45, 12, 10), toon(0xffffff), 0, 1.35, 0.85));
  pin.position.y = 8;
  g.add(pin);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  g.add(ring);
  let t = 0;
  g.userData.animate = (dt) => {
    t += dt;
    pin.position.y = 8 + Math.sin(t * 2.5) * 0.6;
    pin.rotation.y += dt * 1.5;
    const s = 1 + (t % 1.4) * 0.5;
    ring.scale.set(s, s, s);
    ring.material.opacity = 0.7 * (1 - (t % 1.4) / 1.4);
  };
  return g;
}

export function makeAvatarRing() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 40), new THREE.MeshBasicMaterial({ color: 0x3fa9f5, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.32;
  let t = 0;
  ring.userData.animate = (dt) => {
    t += dt;
    const s = 1 + Math.sin(t * 2) * 0.08;
    ring.scale.set(s, s, s);
  };
  return ring;
}

export function makeSchoolZoneSign() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), toon(0x999999), 0, 1.7, 0));
  const s = signPlane('SCHOOL ZONE 25', 2.6, 1.6, { w: 256, h: 160, bg: '#f4e04d', fg: '#111', font: 'bold 44px system-ui, sans-serif' });
  s.position.set(0, 3.6, 0.06);
  g.add(s);
  const back = s.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.06;
  g.add(back);
  g.scale.setScalar(1.4);
  return g;
}
