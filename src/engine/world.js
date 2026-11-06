// Three.js renderer, third-person chase camera (drag to orbit, pinch to zoom, screen shake),
// lighting, and floating DOM labels.
import * as THREE from 'three';
import { state } from '../state.js';

export const SKY = 0x8fd8ff;
const HAZE = 0xcdeefc;

export class World {
  constructor(container, labelLayer) {
    this.container = container;
    this.labelLayer = labelLayer;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, state.config.graphics.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(HAZE, 140, 420);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.8, 600);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8f5a, 1.7));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    sun.position.set(-120, 200, 80); // morning sun
    this.scene.add(sun);

    // Chase camera rig: orbits a followed target. yaw 0 = camera south of the target.
    this.rig = {
      target: new THREE.Vector3(),
      follow: null, // () => THREE.Vector3
      yaw: 0,
      pitch: 0.42,
      basePitch: 0.42,
      dist: 13,
      minDist: 7,
      maxDist: 40,
      minPitch: 0.12,
      maxPitch: 1.25,
      autoYaw: null, // () => desired yaw, or null to leave yaw alone
      userYaw: 0, // drag offset on top of autoYaw; drifts back
      dragIdle: 99, // seconds since the last drag
      lookHeight: 2.2,
      shake: 0,
      clipDist: 99, // distance allowed by walls between the target and the camera
      fovKick: 0, // extra FOV at speed
    };

    this.labels = new Set();
    this.cameraBlock = null; // (x, z, dirX, dirZ, maxDist) => free ground distance
    this.onUpdate = null; // (dt) => void
    this.paused = false;

    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 62 : 50; // portrait phones need a wider vertical view
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  // Drag on the open screen to orbit the camera; pinch or wheel to zoom.
  setupInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map();
    let pinchStart = 0;
    let distStart = 0;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        distStart = this.rig.dist;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) this.rotateBy(dx, dy);
      else if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        this.setDist(distStart * (pinchStart / Math.hypot(a.x - b.x, a.y - b.y)));
      }
    });
    const end = (e) => pointers.delete(e.pointerId);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setDist(this.rig.dist * (1 + Math.sign(e.deltaY) * 0.1));
    }, { passive: false });
  }

  rotateBy(dx, dy) {
    const r = this.rig;
    if (r.autoYaw) r.userYaw -= dx * 0.007;
    else r.yaw -= dx * 0.007;
    r.pitch = Math.min(r.maxPitch, Math.max(r.minPitch, r.pitch + dy * 0.004));
    r.dragIdle = 0;
  }

  setDist(d) {
    this.rig.dist = Math.min(this.rig.maxDist, Math.max(this.rig.minDist, d));
  }

  setCamera(opts) {
    Object.assign(this.rig, opts);
  }

  addShake(amount) {
    this.rig.shake = Math.min(1.5, this.rig.shake + amount);
  }

  snapCamera() {
    if (this.rig.follow) this.rig.target.copy(this.rig.follow());
    if (this.rig.autoYaw) this.rig.yaw = this.rig.autoYaw();
    this.updateCamera(1, true);
  }

  updateCamera(dt, snap = false) {
    const r = this.rig;
    r.dragIdle += dt;
    if (r.follow) {
      const t = r.follow();
      if (snap) r.target.copy(t);
      else r.target.lerp(t, 1 - Math.exp(-dt * 10));
    }
    if (r.autoYaw) {
      const want = r.autoYaw() + r.userYaw;
      const diff = Math.atan2(Math.sin(want - r.yaw), Math.cos(want - r.yaw));
      r.yaw += snap ? diff : diff * (1 - Math.exp(-dt * 4));
      if (r.dragIdle > 1.2) r.userYaw *= Math.exp(-dt * 1.5); // swing back behind after a drag
    }
    if (r.dragIdle > 2) r.pitch += (r.basePitch - r.pitch) * (1 - Math.exp(-dt * 1.5));
    // Keep walls from getting between the camera and the player: pull in fast, ease out.
    let dist = r.dist;
    if (this.cameraBlock) {
      const free = this.cameraBlock(r.target.x, r.target.z, Math.sin(r.yaw), Math.cos(r.yaw), r.dist * Math.cos(r.pitch));
      const want = free / Math.max(0.2, Math.cos(r.pitch));
      r.clipDist = snap || want < r.clipDist ? want : r.clipDist + (want - r.clipDist) * (1 - Math.exp(-dt * 2));
      dist = Math.max(3, Math.min(r.dist, r.clipDist));
    }
    const cp = Math.cos(r.pitch);
    let sx = 0;
    let sy = 0;
    if (r.shake > 0.01) {
      sx = (Math.random() - 0.5) * r.shake;
      sy = (Math.random() - 0.5) * r.shake;
      r.shake *= Math.exp(-dt * 7);
    }
    this.camera.position.set(
      r.target.x + Math.sin(r.yaw) * cp * dist + sx,
      r.target.y + Math.sin(r.pitch) * dist + sy,
      r.target.z + Math.cos(r.yaw) * cp * dist,
    );
    this.camera.lookAt(r.target.x, r.target.y + r.lookHeight, r.target.z);
    const fov = this.baseFov + r.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }

  // A DOM label that follows a 3D point. getPos returns a THREE.Vector3.
  addLabel(text, getPos, className = 'label', maxDist = Infinity) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    this.labelLayer.appendChild(el);
    const label = { el, getPos, maxDist };
    this.labels.add(label);
    return {
      el,
      setText: (t) => { if (el.textContent !== t) el.textContent = t; },
      remove: () => { el.remove(); this.labels.delete(label); },
    };
  }

  // Short-lived cartoon text ("SMASH!", "+3") that pops up at a world point.
  popText(text, pos, className = 'pop', ms = 900) {
    const p = pos.clone();
    const l = this.addLabel(text, () => p, className);
    setTimeout(() => l.remove(), ms);
  }

  clearLabels() {
    for (const l of this.labels) l.el.remove();
    this.labels.clear();
  }

  updateLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const cam = this.camera.position;
    for (const l of this.labels) {
      const pos = l.getPos();
      v.copy(pos).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 && pos.distanceTo(cam) < l.maxDist;
      if (l.visible !== visible) { l.visible = visible; l.el.style.display = visible ? '' : 'none'; }
      if (visible) {
        const x = Math.round(((v.x + 1) / 2) * w);
        const y = Math.round(((1 - v.y) / 2) * h);
        const key = x * 10000 + y;
        if (l.pos !== key) { l.pos = key; l.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`; }
      }
    }
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!this.paused && this.onUpdate) this.onUpdate(dt);
    this.updateCamera(this.paused ? 0 : dt);
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}

// Vertical gradient sky: deep blue overhead fading to a warm morning haze at the horizon.
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3fa9f5');
  grad.addColorStop(0.55, '#8fd8ff');
  grad.addColorStop(0.8, '#cdeefc');
  grad.addColorStop(1, '#ffe9c7');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
