// Stylized low-poly cartoon models built from primitives (no model files to load).
// Bright, saturated colors, chunky shapes and big heads, in an early-2000s console style.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { state } from '../state.js';

// Three-step toon shading ramp shared by all materials.
const ramp = (() => {
  const data = new Uint8Array([110, 190, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
export const toonRamp = ramp;

const matCache = new Map();
export function toon(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }));
  return matCache.get(key);
}

const glowCache = new Map();
export function glow(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!glowCache.has(key)) glowCache.set(key, new THREE.MeshBasicMaterial({ color, ...extra }));
  return glowCache.get(key);
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
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
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

export function starShape(points = 6, outer = 1, inner = 0.55) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
const shadowGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
// Soft round blob shadow; cheap stand-in for real shadows.
export function blobShadow(rx, rz = rx) {
  const s = new THREE.Mesh(shadowGeo, shadowMat);
  s.scale.set(rx, 1, rz);
  s.position.y = 0.06;
  s.renderOrder = -60;
  return s;
}

// Merge [geometry, color] parts into one vertex-colored geometry (one draw call).
export function mergeColored(parts) {
  const c = new THREE.Color();
  const geos = parts.map(([g, color]) => {
    const geo = g.index ? g.toNonIndexed() : g;
    const n = geo.attributes.position.count;
    const cols = new Float32Array(n * 3);
    c.setHex(color);
    for (let i = 0; i < n; i++) c.toArray(cols, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
  });
  return mergeGeometries(geos);
}

export const vertexToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });

// ---------- Characters ----------

// Rigged cartoon person: big head, big hands, chunky body. Animate with rig.update().
export function makeCharacter({
  shirt = 0x1a1c22,
  pants = 0x1f2228,
  skin = 0xf0b48c,
  hair = 0x3b2a1e,
  beard = null,
  shoes = 0x161616,
  build = 1,
  headScale = 1.5,
  deputy = false,
  hairStyle = 'short',
  vest = null,
} = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group(); // squash, stretch, tumble
  root.add(inner);

  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.17 * side * build, 0.9, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.15 * build, 0.5, 3, 8), toon(pants), 0, -0.42, 0));
    pivot.add(mesh(new THREE.BoxGeometry(0.26 * build, 0.16, 0.42), toon(shoes), 0, -0.84, 0.07));
    inner.add(pivot);
    legs.push(pivot);
  }

  const upper = new THREE.Group();
  upper.position.y = 0.9;
  inner.add(upper);
  const torso = mesh(new THREE.CapsuleGeometry(0.36, 0.42, 4, 12), toon(shirt), 0, 0.42, 0);
  torso.scale.set(1.15 * build, 1, 0.85 * build);
  upper.add(torso);
  if (vest) {
    const v = mesh(new THREE.CapsuleGeometry(0.37, 0.32, 4, 12), toon(vest), 0, 0.47, 0);
    v.scale.set(1.18 * build, 1, 0.9 * build);
    upper.add(v);
  }

  if (deputy) {
    const belt = mesh(new THREE.CylinderGeometry(0.43 * build, 0.43 * build, 0.13, 16), toon(0x0d0d0d), 0, 0.08, 0);
    belt.scale.z = 0.86;
    upper.add(belt);
    upper.add(mesh(new THREE.BoxGeometry(0.13, 0.11, 0.04), toon(0xf2c230, { emissive: 0x332200 }), -0.15, 0.09, 0.37 * build));
    upper.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), toon(0x222222), -0.46 * build, 0, 0.05));
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(6, 0.12, 0.065), { depth: 0.03, bevelEnabled: false }), toon(0xe9edf2, { emissive: 0x555555 }));
    star.position.set(0.18 * build, 0.62, 0.31 * build);
    upper.add(star);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.5 * build * side, 0.74, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.12 * build, 0.42, 3, 8), toon(shirt), 0, -0.3, 0));
    pivot.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(skin), 0, -0.64, 0)); // big cartoon hands
    if (deputy && side === 1) pivot.add(mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12), toon(0x0a0a0a), 0, -0.52, 0).rotateX(Math.PI / 2));
    upper.add(pivot);
    arms.push(pivot);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  head.scale.setScalar(headScale);
  head.add(mesh(new THREE.SphereGeometry(0.29, 16, 12), toon(skin)));
  if (hairStyle === 'bun') {
    head.add(mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(hair), 0, 0.03, -0.02));
    head.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(hair), 0, 0.27, -0.12));
  } else if (hairStyle === 'cap') {
    head.add(mesh(new THREE.SphereGeometry(0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(hair), 0, 0.04, 0));
    head.add(mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), toon(hair), 0, 0.12, 0.3));
  } else if (hairStyle !== 'bald') {
    head.add(mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(hair), 0, 0.03, -0.02));
  }
  if (beard !== null) {
    const b = mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), toon(beard), 0, 0.02, 0.025);
    b.scale.set(1.04, 1.06, 1.0);
    head.add(b);
    head.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), toon(beard), 0, -0.06, 0.26));
  }
  for (const side of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), toon(0xffffff), 0.1 * side, 0.06, 0.24)); // big eyes
    head.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), glow(0x161616), 0.1 * side, 0.06, 0.305));
    head.add(mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), toon(hair === 0xffffff ? 0x888888 : hair), 0.1 * side, 0.16, 0.27));
  }
  head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(skin), 0, -0.01, 0.3));
  upper.add(head);

  const shadow = blobShadow(0.7);
  root.add(shadow);
  rigCharacter(root, { inner, upper, head, legs, arms, shadow, torso });
  return root;
}

// Procedural animation shared by every character: walk/run cycle, jump, kick, tumble,
// lying down, panic, and springy squash and stretch. Optional knees and elbows bend
// for the more detailed (realistic) Tyler model.
export function rigCharacter(root, { inner, upper, head, legs, arms, shadow, torso, hipY = 0.9, knees = null, elbows = null, shadowSize = 0.7, squashScale = 1 }) {
  const bend = (amp, air, pose) => {
    if (knees) {
      for (let i = 0; i < 2; i++) {
        const back = Math.max(0, legs[i].rotation.x);
        knees[i].rotation.x = pose === 'fly' ? 0.9 : air ? 1.1 - i * 0.6 : back * 1.5 + 0.08 + amp * 0.15;
      }
    }
    if (elbows) for (const e of elbows) e.rotation.x = pose === 'fly' ? -0.4 : -0.25 - amp * 1.0;
  };
  const rig = {
    inner, upper, head, legs, arms, shadow,
    phase: 0, t: 0, squash: 0, squashV: 0, tumble: 0, kickT: 0,
    // Kick: a quick, over-the-top front kick.
    kick() { this.kickT = 0.35; },
    land(power = 1) { this.squashV -= 6 * power; },
    hop() { this.squashV += 5; },
    update(dt, { speed = 0, air = false, pose = 'normal', height = 0 } = {}) {
      this.t += dt;
      // Springy squash and stretch.
      this.squashV += (-this.squash * 180 - this.squashV * 14) * dt;
      this.squash += this.squashV * dt;
      const sq = Math.max(-0.35, Math.min(0.35, this.squash)) * squashScale;
      inner.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
      shadow.position.y = 0.06 - height;
      const sh = Math.max(0.3, 1 - height * 0.08);
      shadow.scale.set(shadowSize * sh, 1, shadowSize * sh);

      if (pose === 'fly') {
        bend(0, true, 'fly');
        this.tumble += dt * 9;
        inner.rotation.x = this.tumble;
        inner.position.y = 1;
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1;
          arms[i].rotation.set(Math.sin(this.t * 28 + i) * 1.5, 0, s * (1.8 + Math.sin(this.t * 31) * 0.6));
          legs[i].rotation.x = Math.sin(this.t * 24 + i * 2) * 1.1;
        }
        return;
      }
      if (pose === 'down') {
        inner.rotation.x += (-Math.PI / 2 - inner.rotation.x) * Math.min(1, dt * 12);
        inner.position.y = 0.3;
        for (let i = 0; i < 2; i++) {
          arms[i].rotation.set(0, 0, (i ? 1 : -1) * 1.3);
          legs[i].rotation.x = 0;
          legs[i].rotation.z = (i ? 1 : -1) * 0.3;
        }
        bend(0, false, 'down');
        return;
      }
      this.tumble = 0;
      inner.rotation.x = 0;
      inner.position.y = 0;
      legs[0].rotation.z = 0;
      legs[1].rotation.z = 0;

      const amp = Math.min(1, speed / 7) * 0.95;
      if (!air) this.phase += dt * (3 + speed * 1.5);
      const s = Math.sin(this.phase);
      upper.rotation.x = Math.min(0.3, speed * 0.025);
      upper.position.y = hipY + (air ? 0 : Math.abs(Math.cos(this.phase)) * 0.13 * amp * hipY);
      torso.scale.y = 1 + Math.sin(this.t * 2.2) * 0.02;
      head.rotation.z = Math.sin(this.phase) * 0.06 * amp;

      if (air) {
        legs[0].rotation.x = -0.7;
        legs[1].rotation.x = 0.35;
        arms[0].rotation.set(0, 0, -2.3);
        arms[1].rotation.set(0, 0, 2.3);
      } else if (pose === 'panic') {
        legs[0].rotation.x = s * amp;
        legs[1].rotation.x = -s * amp;
        arms[0].rotation.set(Math.sin(this.t * 18) * 0.4, 0, -2.6);
        arms[1].rotation.set(Math.cos(this.t * 18) * 0.4, 0, 2.6);
      } else {
        legs[0].rotation.x = s * amp;
        legs[1].rotation.x = -s * amp;
        arms[0].rotation.set(-s * amp * 0.9, 0, -0.12 - amp * 0.1);
        arms[1].rotation.set(s * amp * 0.9, 0, 0.12 + amp * 0.1);
      }
      bend(amp, air, pose);
      if (this.kickT > 0) {
        this.kickT -= dt;
        const k = Math.sin((1 - this.kickT / 0.35) * Math.PI);
        legs[1].rotation.x = -1.9 * k;
        legs[0].rotation.x = 0.2 * k;
        upper.rotation.x = -0.35 * k;
        arms[0].rotation.set(0, 0, -1.4 * k);
        arms[1].rotation.set(0, 0, 1.4 * k);
        if (knees) knees[1].rotation.x = 0.1;
      }
    },
  };
  root.userData.rig = rig;
  return rig;
}

const SHIRTS = [0xff5a5f, 0x3fa9f5, 0xffc93c, 0x6dd47e, 0xb084f5, 0xff8c42, 0x2ec4b6, 0xf15bb5, 0xffffff];
const PANTS = [0x2b4c7e, 0x3a3a48, 0x6b4f3a, 0x1f6f5c, 0xc2b280];
const SKINS = [0xf6c9a6, 0xeab08e, 0xc68863, 0x8d5a3b, 0x5e3a24];
const HAIRS = [0x2b1d14, 0x5a3a24, 0xe0b04a, 0x9a3b1b, 0x111111, 0xdddddd];
const STYLES = ['short', 'short', 'bun', 'cap', 'bald'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function makePedestrian() {
  const style = pick(STYLES);
  const p = makeCharacter({
    shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS),
    hair: style === 'cap' ? pick(SHIRTS) : pick(HAIRS), hairStyle: style,
    beard: Math.random() < 0.2 ? pick(HAIRS) : null,
    build: 0.85 + Math.random() * 0.4, headScale: 1.45 + Math.random() * 0.25,
  });
  p.scale.setScalar(1.05);
  return p;
}

// ---------- Vehicles ----------

const CAR_COLORS = [0xff4f4f, 0x2f8cff, 0xffd23f, 0x3ddc84, 0xb36bff, 0xff8a3d, 0x29d3c2, 0xf2f2f2, 0xff6fb5];

// Chunky toy-like car. userData: { body, steer: [front wheel pivots], wheels, length, width, kind }.
export function makeCar(kind = 'sedan', { color, doorText } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const c = color ?? pick(CAR_COLORS);
  let L = 4.5;
  let W = 2.0;
  let wheelR = 0.46;
  const glass = toon(0x26334a);
  const light = glow(0xfff6c8);
  const tail = glow(0xd01010);

  if (kind === 'bus') {
    L = 10; W = 2.6; wheelR = 0.56;
    body.add(mesh(new THREE.BoxGeometry(W, 2.4, L), toon(0xffc21a), 0, 1.75, 0));
    body.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.7, L - 1.5), glass, 0, 2.3, -0.3));
    body.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.14, L), toon(0x111111), 0, 1.25, 0));
    const sign = signPlane('SCHOOL BUS', 2.0, 0.4, { bg: '#ffc21a', fg: '#111111' });
    sign.position.set(0, 2.8, -L / 2 - 0.01);
    sign.rotation.y = Math.PI;
    body.add(sign);
  } else if (kind === 'pickup') {
    L = 5.4; W = 2.1; wheelR = 0.52;
    body.add(mesh(new THREE.BoxGeometry(W, 0.85, L), toon(c), 0, 0.95, 0));
    body.add(mesh(new THREE.BoxGeometry(W - 0.1, 0.75, 1.8), toon(c), 0, 1.7, 0.6));
    body.add(mesh(new THREE.BoxGeometry(W - 0.06, 0.5, 1.4), glass, 0, 1.75, 0.65));
    body.add(mesh(new THREE.BoxGeometry(W - 0.3, 0.2, 2.2), toon(0x3a3a3a), 0, 1.4, -1.45));
  } else if (kind === 'sports') {
    L = 4.4; W = 2.05; wheelR = 0.46;
    body.add(mesh(new THREE.BoxGeometry(W, 0.6, L), toon(c), 0, 0.72, 0));
    body.add(mesh(new THREE.BoxGeometry(W - 0.3, 0.5, 1.8), glass, 0, 1.22, -0.35));
    body.add(mesh(new THREE.BoxGeometry(W, 0.08, 0.5), toon(0x111111), 0, 1.35, -L / 2 + 0.25)); // spoiler
    for (const side of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), toon(0x111111), 0.7 * side, 1.12, -L / 2 + 0.25));
    body.add(mesh(new THREE.BoxGeometry(0.35, 0.02, L * 0.9), toon(0x111111), 0, 1.03, 0)); // racing stripe
  } else {
    // sedan and patrol
    body.add(mesh(new THREE.BoxGeometry(W, 0.75, L), toon(c), 0, 0.8, 0));
    body.add(mesh(new THREE.BoxGeometry(W - 0.15, 0.62, 2.3), glass, 0, 1.45, -0.2));
    body.add(mesh(new THREE.BoxGeometry(W - 0.1, 0.1, 2.05), toon(kind === 'patrol' ? 0xf2f2f2 : c), 0, 1.8, -0.22));
  }

  // Headlight "eyes" and taillights
  if (kind !== 'bus') {
    for (const side of [-1, 1]) {
      body.add(mesh(new THREE.BoxGeometry(0.42, 0.2, 0.06), light, 0.6 * side, 0.9, L / 2 + 0.01));
      body.add(mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), tail, 0.6 * side, 0.9, -L / 2 - 0.01));
    }
    body.add(mesh(new THREE.BoxGeometry(W + 0.06, 0.22, 0.3), toon(0x2a2a2a), 0, 0.5, L / 2 - 0.05)); // bumper
    body.add(mesh(new THREE.BoxGeometry(W + 0.06, 0.22, 0.3), toon(0x2a2a2a), 0, 0.5, -L / 2 + 0.05));
  }

  let setLights = null;
  if (kind === 'patrol') {
    const pc = state.config.patrolCar;
    const text = doorText || pc.doorText;
    for (const side of [-1, 1]) {
      body.add(mesh(new THREE.BoxGeometry(0.04, 0.62, 2.1), toon(pc.doorColor), (W / 2 + 0.01) * side, 0.82, -0.1));
      const label = signPlane(text, 1.9, 0.38, { bg: pc.doorColor, fg: pc.bodyColor, font: 'bold 80px system-ui, sans-serif' });
      label.position.set((W / 2 + 0.04) * side, 0.86, -0.1);
      label.rotation.y = (Math.PI / 2) * side;
      body.add(label);
    }
    body.add(mesh(new THREE.BoxGeometry(W * 0.8, 0.5, 0.18), toon(0x2a2a2a), 0, 0.7, L / 2 + 0.15)); // push bumper
    const red = glow(0xff2a2a);
    const blue = glow(0x2a5bff);
    const redOff = toon(0x661111);
    const blueOff = toon(0x112266);
    const lbL = mesh(new THREE.BoxGeometry(0.72, 0.18, 0.34), redOff, -0.38, 1.94, -0.22);
    const lbR = mesh(new THREE.BoxGeometry(0.72, 0.18, 0.34), blueOff, 0.38, 1.94, -0.22);
    body.add(lbL, lbR);
    let t = 0;
    setLights = (on, dt = 0) => {
      t += dt;
      const flip = Math.floor(t * 8) % 2 === 0;
      lbL.material = on && flip ? red : redOff;
      lbR.material = on && !flip ? blue : blueOff;
    };
  }

  // Wheels: front ones on steering pivots.
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.34, 12).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.36, 8).rotateZ(Math.PI / 2);
  const wheels = [];
  const steer = [];
  for (const z of [L * 0.32, -L * 0.32]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set((W / 2 - 0.05) * side, wheelR, z);
      const w = new THREE.Group();
      w.add(new THREE.Mesh(wheelGeo, toon(0x1b1b1b)));
      w.add(new THREE.Mesh(hubGeo, toon(0xcfd3d8)));
      pivot.add(w);
      root.add(pivot);
      wheels.push(w);
      if (z > 0) steer.push(pivot);
    }
  }
  root.add(blobShadow(W * 0.75, L * 0.6));

  const S = 1.25;
  root.scale.setScalar(S);
  root.userData = { body, steer, wheels, wheelR: wheelR * S, length: L * S, width: W * S, kind, setLights, color: c };
  return root;
}

export function makePatrolCar(doorText) {
  return makeCar('patrol', { color: state.config.patrolCar.bodyColor, doorText });
}

// ---------- Landmark buildings ----------

export function makeHouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(14, 5, 10), toon(0xffe6b3), 0, 2.5, 0));
  const roofShape = new THREE.Shape([new THREE.Vector2(-7.8, 0), new THREE.Vector2(7.8, 0), new THREE.Vector2(0, 4)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 11.4, bevelEnabled: false }), toon(0xc8553d));
  roof.position.set(0, 5, -5.7);
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), toon(0x2f8cff), 0, 1.3, 5.05));
  for (const x of [-4.2, 4.2]) g.add(mesh(new THREE.BoxGeometry(2, 1.6, 0.15), toon(0xbfe9ff), x, 2.8, 5.05));
  g.add(mesh(new THREE.BoxGeometry(4.5, 0.25, 3), toon(0xd8c8a0), 0, 0.12, 6.5));
  g.add(mesh(new THREE.BoxGeometry(5, 0.08, 18), toon(0xb0b0aa), 6.5, 0.05, 13));
  // Mailbox and a peach-colored flower bed for Georgia flavor
  g.add(mesh(new THREE.BoxGeometry(6, 0.4, 1.2), toon(0x8b4a2b), -4, 0.2, 5.9));
  for (let x = -6.5; x <= -1.5; x += 1) g.add(mesh(new THREE.SphereGeometry(0.35, 6, 5), toon(x % 2 ? 0xffa07a : 0xff6fb5), x, 0.6, 5.9));
  return g;
}

export function makeWawa() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(30, 7, 18), toon(0xfff6e6), 0, 3.5, 0));
  g.add(mesh(new THREE.BoxGeometry(30.4, 1.6, 18.4), toon(0xe0102e), 0, 6.4, 0));
  g.add(mesh(new THREE.BoxGeometry(30.6, 0.4, 18.6), toon(0xffc21a), 0, 5.5, 0));
  const sign = signPlane('WAWA', 10, 2.2, { bg: '#e0102e', fg: '#ffc21a', font: 'bold 96px system-ui, sans-serif' });
  sign.position.set(0, 6.4, 9.22);
  g.add(sign);
  g.add(mesh(new THREE.BoxGeometry(5, 3.6, 0.2), toon(0x9fd3ff, { emissive: 0x224455 }), 0, 1.8, 9.05));
  for (const x of [-9, 9]) g.add(mesh(new THREE.BoxGeometry(7, 3, 0.15), toon(0xbfe9ff), x, 2.4, 9.05));
  g.add(mesh(new THREE.BoxGeometry(22, 0.7, 8), toon(0xfff6e6), 6, 6.8, 31));
  g.add(mesh(new THREE.BoxGeometry(22.2, 0.4, 8.2), toon(0xe0102e), 6, 6.5, 31));
  for (const x of [-2, 6, 14]) {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 6.5, 8), toon(0xdddddd), x, 3.25, 31));
    g.add(mesh(new THREE.BoxGeometry(1.2, 1.9, 0.8), toon(0xe0102e), x + 2.2, 0.95, 31));
    g.add(mesh(new THREE.BoxGeometry(1.2, 1.9, 0.8), toon(0xe0102e), x - 2.2, 0.95, 31));
  }
  g.add(mesh(new THREE.BoxGeometry(48, 0.06, 46), toon(0x8a8d92), 0, 0.03, 17));
  for (let x = -21; x <= -9; x += 4) g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 5), toon(0xffffff), x, 0.05, 13));
  return g;
}

export function makeSchool() {
  const g = new THREE.Group();
  const brick = toon(0xc0533f);
  g.add(mesh(new THREE.BoxGeometry(60, 9, 18), brick, 0, 4.5, 0));
  g.add(mesh(new THREE.BoxGeometry(18, 9, 30), brick, -32, 4.5, -6));
  g.add(mesh(new THREE.BoxGeometry(18, 9, 30), brick, 32, 4.5, -6));
  g.add(mesh(new THREE.BoxGeometry(61, 0.6, 19), toon(0xf2ead8), 0, 9.2, 0));
  g.add(mesh(new THREE.BoxGeometry(12, 0.6, 6), toon(0xf2ead8), 0, 4.6, 12));
  for (const x of [-5.5, 5.5]) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 10), toon(0xffffff), x, 2.3, 14.5));
  g.add(mesh(new THREE.BoxGeometry(6, 3.4, 0.2), toon(0x9fd3ff, { emissive: 0x224455 }), 0, 1.7, 9.05));
  for (let x = -26; x <= 26; x += 6.5) if (Math.abs(x) > 5) g.add(mesh(new THREE.BoxGeometry(3.6, 2, 0.15), toon(0xbfe9ff), x, 5.6, 9.05));
  const sign = signPlane(state.config.schoolName.toUpperCase(), 22, 2.2, { w: 1024, h: 110, bg: '#f2ead8', fg: '#7a2b20' });
  sign.position.set(0, 7.6, 9.15);
  g.add(sign);
  g.add(mesh(new THREE.BoxGeometry(9, 3, 0.8), toon(0x7a2b20), -20, 1.8, 34));
  const marquee = signPlane(`HOME OF THE ${state.config.schoolMascot.toUpperCase()}`, 8.4, 1.4, { bg: '#ffffff', fg: '#7a2b20', font: 'bold 60px system-ui, sans-serif' });
  marquee.position.set(-20, 2.1, 34.45);
  g.add(marquee);
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 8), toon(0xdddddd), 14, 7, 22));
  g.add(mesh(new THREE.BoxGeometry(0.05, 2.2, 3.4), toon(0xb22234), 14, 12.6, 23.8));
  g.add(mesh(new THREE.BoxGeometry(5, 0.07, 26), toon(0xe6e0d0), 0, 0.04, 22));
  g.add(mesh(new THREE.BoxGeometry(48, 0.06, 20), toon(0x8a8d92), 22, 0.03, 26));
  return g;
}

// Collision boxes for the landmark buildings, in each building's local frame: [cx, cz, hw, hd].
export const LANDMARK_BOXES = {
  home: [[0, 0, 7, 5]],
  wawa: [[0, 0, 15, 9]],
  school: [[0, 0, 30, 9], [-32, -6, 9, 15], [32, -6, 9, 15]],
};

// ---------- Markers, pickups and props ----------

// Destination pin (bobbing, spinning) with a pulsing ground ring.
export function makeBeacon(color = 0xffc21a) {
  const g = new THREE.Group();
  const pin = new THREE.Group();
  pin.add(mesh(new THREE.ConeGeometry(1.1, 2.6, 16), toon(color, { emissive: 0x332200 })).rotateX(Math.PI));
  pin.add(mesh(new THREE.SphereGeometry(1.35, 16, 12), toon(color, { emissive: 0x332200 }), 0, 1.5, 0));
  pin.add(mesh(new THREE.SphereGeometry(0.55, 12, 10), toon(0xffffff), 0, 1.55, 1.0));
  pin.position.y = 9;
  g.add(pin);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  let t = 0;
  g.userData.animate = (dt) => {
    t += dt;
    pin.position.y = 9 + Math.sin(t * 3) * 0.7;
    pin.rotation.y += dt * 2;
    const s = 1 + (t % 1.2) * 0.6;
    ring.scale.set(s, s, s);
    ring.material.opacity = 0.8 * (1 - (t % 1.2) / 1.2);
  };
  return g;
}

// Mission start marker: glowing ring, light column and a big bouncing "!".
export function makeMissionMarker(color = 0xffc21a) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.8, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.0, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.1;
  g.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
  beam.position.y = 7;
  g.add(beam);
  const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('!', { w: 128, h: 128, bg: null, fg: '#ffc21a', font: '900 120px system-ui, sans-serif' }), depthWrite: false }));
  bang.scale.set(4, 4, 1);
  bang.position.y = 6;
  g.add(bang);
  let t = 0;
  g.userData.animate = (dt) => {
    t += dt;
    bang.position.y = 6 + Math.abs(Math.sin(t * 3)) * 1.4;
    const s = 1 + Math.sin(t * 4) * 0.06;
    ring.scale.set(s, s, s);
  };
  return g;
}

// GPS chevron that floats above the player and points at the objective.
export function makeArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.6);
  shape.lineTo(1.3, -0.2);
  shape.lineTo(0.5, -0.2);
  shape.lineTo(0.5, -1.4);
  shape.lineTo(-0.5, -1.4);
  shape.lineTo(-0.5, -0.2);
  shape.lineTo(-1.3, -0.2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }).rotateX(-Math.PI / 2).rotateY(Math.PI);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toon(0xffc21a, { emissive: 0x553300 })); // tip points along +z
  m.rotation.x = -0.55; // tip tilted up so it reads from the chase camera
  g.add(m);
  return g;
}

const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16).rotateX(Math.PI / 2);
export function makeCoin() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(coinGeo, toon(0xffd23f, { emissive: 0x664400 })));
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.5, 0.14), toon(0xffeb8a, { emissive: 0x665500 })));
  return g;
}

// Ghost Energy can with a soft light column so it can be spotted from a distance.
export function makeGhostCan(color = 0x3ddc84, beamHeight = 26) {
  const g = new THREE.Group();
  const can = new THREE.Group();
  can.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 14), toon(0x141414)));
  can.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.5, 14), toon(color, { emissive: 0x113311 })));
  can.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 14), toon(0xd8d8d8), 0, 0.76, 0));
  can.position.y = 1.6;
  g.add(can);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, beamHeight, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
  beam.position.y = beamHeight / 2;
  g.add(beam);
  let t = Math.random() * 6;
  g.userData.animate = (dt) => {
    t += dt;
    can.rotation.y += dt * 2.5;
    can.position.y = 1.6 + Math.sin(t * 3) * 0.3;
  };
  return g;
}

// Breakable street props, each merged into one vertex-colored geometry for instancing.
export function propGeometries() {
  const C = THREE.CylinderGeometry;
  const B = THREE.BoxGeometry;
  return {
    hydrant: { r: 0.45, h: 1.1, geo: mergeColored([
      [new C(0.28, 0.32, 0.8, 10).translate(0, 0.4, 0), 0xff3b30],
      [new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.8, 0), 0xff3b30],
      [new C(0.1, 0.1, 0.8, 8).rotateZ(Math.PI / 2).translate(0, 0.55, 0), 0xffd23f],
      [new C(0.36, 0.36, 0.1, 10).translate(0, 0.05, 0), 0xcc2a20],
    ]) },
    mailbox: { r: 0.45, h: 1.4, geo: mergeColored([
      [new B(0.12, 1.0, 0.12).translate(0, 0.5, 0), 0x6b4a2b],
      [new B(0.45, 0.4, 0.75).translate(0, 1.15, 0), 0x2f8cff],
      [new C(0.225, 0.225, 0.75, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 1.35, 0), 0x2f8cff],
      [new B(0.04, 0.25, 0.1).translate(0.26, 1.35, -0.2), 0xff3b30],
    ]) },
    trash: { r: 0.55, h: 1.2, geo: mergeColored([
      [new C(0.45, 0.4, 1.0, 12).translate(0, 0.5, 0), 0x3ddc84],
      [new C(0.5, 0.5, 0.12, 12).translate(0, 1.06, 0), 0x2a9d5c],
      [new B(0.3, 0.08, 0.08).translate(0, 1.16, 0), 0x2a9d5c],
    ]) },
    cone: { r: 0.4, h: 1.0, geo: mergeColored([
      [new THREE.ConeGeometry(0.3, 0.9, 10).translate(0, 0.5, 0), 0xff8a3d],
      [new C(0.21, 0.24, 0.14, 10).translate(0, 0.45, 0), 0xffffff],
      [new B(0.65, 0.08, 0.65).translate(0, 0.04, 0), 0xff8a3d],
    ]) },
    newsbox: { r: 0.5, h: 1.3, geo: mergeColored([
      [new B(0.6, 0.8, 0.5).translate(0, 0.8, 0), 0xffd23f],
      [new B(0.5, 0.3, 0.02).translate(0, 0.9, 0.26), 0xbfe9ff],
      [new B(0.08, 0.4, 0.08).translate(-0.22, 0.2, 0), 0x333333],
      [new B(0.08, 0.4, 0.08).translate(0.22, 0.2, 0), 0x333333],
    ]) },
  };
}
