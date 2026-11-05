// Three.js renderer, tilted follow camera, touch input, and floating DOM labels.
import * as THREE from 'three';

export const SKY = 0xcfe6f2;

export class World {
  constructor(container, labelLayer) {
    this.container = container;
    this.labelLayer = labelLayer;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 160, 460);

    this.camera = new THREE.PerspectiveCamera(42, 1, 2, 900); // near/far tuned for depth precision on the flat road layers

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a6a, 1.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-120, 200, 80); // morning sun from the east-southeast feel
    this.scene.add(sun);

    // Camera rig: orbit around a followed target.
    this.rig = {
      target: new THREE.Vector3(),
      follow: null, // () => THREE.Vector3
      yaw: 0, // 0 = camera south of target, looking north
      pitch: 0.95, // elevation angle in radians
      dist: 34,
      minDist: 16,
      maxDist: 80,
      minPitch: 0.5,
      maxPitch: 1.3,
      autoYaw: null, // () => desired yaw (driving: behind the car)
      userYaw: 0, // drag offset applied on top of autoYaw
      lookHeight: 2.5,
      yawLimit: null, // [min, max] for interiors
    };

    this.labels = new Set();
    this.onTap = null; // (event) => void
    this.onUpdate = null; // (dt) => void
    this.inputEnabled = true;

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
    // Portrait phones need a wider vertical view so the map doesn't feel cramped.
    this.camera.fov = w < h ? 50 : 40;
    this.camera.updateProjectionMatrix();
  }

  setupInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map();
    let dragged = false;
    let pinchStart = 0;
    let distStart = 0;

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (pointers.size === 1) dragged = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        distStart = this.rig.dist;
        dragged = true;
      }
    });

    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        if (!dragged && Math.hypot(p.x - p.sx, p.y - p.sy) > 8) dragged = true;
        if (dragged) this.rotateBy(dx, dy);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart > 0) this.setDist(distStart * (pinchStart / span));
      }
    });

    const end = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      if (!dragged && pointers.size === 0 && this.inputEnabled && this.onTap) this.onTap(e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setDist(this.rig.dist * (1 + Math.sign(e.deltaY) * 0.1));
    }, { passive: false });
  }

  rotateBy(dx, dy) {
    const r = this.rig;
    if (r.autoYaw) r.userYaw -= dx * 0.006;
    else r.yaw -= dx * 0.006;
    if (r.yawLimit) r.yaw = Math.min(r.yawLimit[1], Math.max(r.yawLimit[0], r.yaw));
    r.pitch = Math.min(r.maxPitch, Math.max(r.minPitch, r.pitch + dy * 0.004));
  }

  setDist(d) {
    this.rig.dist = Math.min(this.rig.maxDist, Math.max(this.rig.minDist, d));
  }

  // Configure the camera for a mode.
  setCamera(opts) {
    Object.assign(this.rig, { autoYaw: null, userYaw: 0, yawLimit: null, lookHeight: 2.5 }, opts);
  }

  snapCamera() {
    if (this.rig.follow) this.rig.target.copy(this.rig.follow());
    if (this.rig.autoYaw) this.rig.yaw = this.rig.autoYaw();
    this.updateCamera(1, true);
  }

  updateCamera(dt, snap = false) {
    const r = this.rig;
    if (r.follow) {
      const t = r.follow();
      if (snap) r.target.copy(t);
      else r.target.lerp(t, 1 - Math.exp(-dt * 8));
    }
    if (r.autoYaw) {
      const want = r.autoYaw() + r.userYaw;
      let diff = want - r.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      r.yaw += snap ? diff : diff * (1 - Math.exp(-dt * 3));
      r.userYaw *= Math.exp(-dt * 0.6); // drift back behind the car after a drag
    }
    const cp = Math.cos(r.pitch);
    this.camera.position.set(
      r.target.x + Math.sin(r.yaw) * cp * r.dist,
      r.target.y + Math.sin(r.pitch) * r.dist,
      r.target.z + Math.cos(r.yaw) * cp * r.dist,
    );
    this.camera.lookAt(r.target.x, r.target.y + r.lookHeight, r.target.z);
  }

  ndc(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  groundPoint(e, y = 0) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    this.groundPlane.constant = -y;
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? hit : null;
  }

  pick(e, objects) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length ? hits[0] : null;
  }

  // A DOM label that follows a 3D point. getPos returns a THREE.Vector3.
  addLabel(text, getPos, className = 'label') {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    this.labelLayer.appendChild(el);
    const label = { el, getPos, onClick: null };
    el.addEventListener('pointerdown', (ev) => {
      if (label.onClick) { ev.stopPropagation(); label.onClick(); }
    });
    this.labels.add(label);
    return {
      el,
      setText: (t) => { el.textContent = t; },
      onClick: (fn) => { label.onClick = fn; el.classList.add('clickable'); },
      remove: () => { el.remove(); this.labels.delete(label); },
    };
  }

  clearLabels() {
    for (const l of this.labels) l.el.remove();
    this.labels.clear();
  }

  updateLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.getPos()).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      if (l.visible !== visible) { l.visible = visible; l.el.style.display = visible ? '' : 'none'; }
      if (visible) {
        // Round to whole pixels so labels don't re-render for sub-pixel moves.
        const x = Math.round(((v.x + 1) / 2) * w);
        const y = Math.round(((1 - v.y) / 2) * h);
        const key = x * 10000 + y;
        if (l.pos !== key) { l.pos = key; l.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`; }
      }
    }
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.onUpdate) this.onUpdate(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}
