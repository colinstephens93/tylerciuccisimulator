// Inside the (fictional) Lawrenceville Wawa: kiosks, deli pickup, coolers, register, exit.
import * as THREE from 'three';
import { state } from '../state.js';
import { audio } from '../audio.js';
import menu from '../data/menu.json';
import { makeFood, makeGhost, goalStatus, hasUnpaid } from '../logic/wawa.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { toon, glow, makePerson, textTexture } from '../engine/models.js';
import { keys, angleLerp } from '../engine/util.js';
import { openPanel } from '../ui/panel.js';

const ORIGIN = new THREE.Vector3(5000, 0, 0); // the store interior lives away from the town
const HALF_W = 18;
const HALF_D = 13;
const SPEED = 8;

// Interaction spots in room coordinates (+z is the entrance side, facing the camera).
const STATIONS = {
  deli: { pos: [0, -6.2], label: 'Deli pickup' },
  kiosk: { pos: [-11.5, -0.5], label: 'Order kiosk' },
  cooler: { pos: [13, -1], label: 'Ghost cooler' },
  register: { pos: [-6, 6.3], label: 'Register' },
  exit: { pos: [0, 11.5], label: 'Exit' },
};

function box(w, h, d, color, x, y, z, parent, station) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? toon(color) : color);
  m.position.set(x, y, z);
  if (station) m.userData.station = station;
  parent.add(m);
  return m;
}

let interior = null;

function buildInterior() {
  const g = new THREE.Group();
  g.position.copy(ORIGIN);

  // Floor tiles
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x2 = c.getContext('2d');
  x2.fillStyle = '#ece6d8'; x2.fillRect(0, 0, 64, 64);
  x2.fillStyle = '#ddd5c2'; x2.fillRect(0, 0, 32, 32); x2.fillRect(32, 32, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 13);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), new THREE.MeshToonMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  // Big dark ground around the store so the void isn't visible
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon(0x8a8d92));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.05;
  g.add(outside);

  // Walls (front left open as a cutaway so the camera can see in)
  box(HALF_W * 2, 7, 0.6, 0xf3efe6, 0, 3.5, -HALF_D, g);
  box(0.6, 7, HALF_D * 2, 0xf3efe6, -HALF_W, 3.5, 0, g);
  box(0.6, 7, HALF_D * 2, 0xf3efe6, HALF_W, 3.5, 0, g);
  box(HALF_W * 2 + 0.6, 1.2, 0.7, 0xc8102e, 0, 6.4, -HALF_D, g);
  box(14, 1.2, 0.6, 0xf3efe6, -11, 0.6, HALF_D, g);
  box(14, 1.2, 0.6, 0xf3efe6, 11, 0.6, HALF_D, g);
  box(6, 0.05, 2.5, 0x3a3a3a, 0, 0.03, HALF_D - 1.2, g); // door mat

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.6), new THREE.MeshBasicMaterial({ map: textTexture('BUILD-YOUR-OWN BREAKFAST', { w: 1024, h: 128, bg: '#c8102e', fg: '#f4c20d', font: 'bold 70px system-ui, sans-serif' }) }));
  sign.position.set(0, 5.2, -HALF_D + 0.35);
  g.add(sign);

  // Deli counter with workers
  box(22, 2.0, 2.4, 0xc8102e, 0, 1.0, -9.3, g, 'deli');
  box(22.4, 0.25, 2.8, 0xf4c20d, 0, 2.1, -9.3, g, 'deli');
  for (const x of [-6, 4]) {
    const w = makePerson({ shirt: 0xc8102e, beard: null, hair: x < 0 ? 0x2b1b12 : 0x7a5230, skin: x < 0 ? 0x8d5a3b : 0xf1c7a5, build: 1 });
    w.scale.setScalar(1.6);
    w.position.set(x, 0, -11.6);
    g.add(w);
  }

  // Kiosks (glowing screens)
  for (const z of [-4, 0, 4]) {
    box(1.4, 3.4, 1.4, 0x222831, -15.5, 1.7, z, g, 'kiosk');
    const scr = box(0.1, 1.6, 1.1, glow(0x7fd6ff), -14.75, 3.0, z, g, 'kiosk');
    scr.rotation.z = 0.2;
  }

  // Coolers with colorful cans along the right wall
  box(2.2, 6, 16, 0x5b7d99, 16.6, 3, -1, g, 'cooler');
  box(0.12, 5.4, 15.4, new THREE.MeshToonMaterial({ color: 0xbfe3f7, transparent: true, opacity: 0.45 }), 15.45, 3, -1, g, 'cooler');
  const canColors = [0x6b3a1e, 0x2e6bff, 0xe23b3b, 0x3fbf5f, 0xff9f2e];
  const canGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10);
  for (let shelf = 0; shelf < 5; shelf++) {
    for (let i = 0; i < 18; i++) {
      const can = new THREE.Mesh(canGeo, toon(canColors[(i + shelf) % canColors.length]));
      can.position.set(16.1, 1.0 + shelf * 1.05, -8.5 + i * 0.85);
      can.userData.station = 'cooler';
      g.add(can);
    }
  }

  // Register counter with cashier
  box(7, 2.0, 2.2, 0x6b4c33, -6, 1.0, 8.4, g, 'register');
  box(1.2, 0.8, 0.9, 0x222222, -6, 2.4, 8.4, g, 'register');
  const cashier = makePerson({ shirt: 0xc8102e, beard: null, hair: 0x111111, skin: 0xc68a62, build: 1 });
  cashier.scale.setScalar(1.6);
  cashier.position.set(-6, 0, 10.6);
  cashier.rotation.y = Math.PI;
  g.add(cashier);

  // Aisles of snacks
  const snack = [0xf4c20d, 0xe23b3b, 0x2e86c1, 0x27ae60, 0xff9f2e, 0x8e44ad];
  for (const x of [1, 6.5]) {
    box(3, 3, 9, 0xb5a98f, x, 1.5, 1, g);
    for (let i = 0; i < 12; i++) box(0.3, 0.6, 0.6, snack[i % snack.length], x + (i % 2 ? 1.6 : -1.6), 0.8 + Math.floor(i / 4) * 0.9, -2.4 + (i % 4) * 2.2, g);
  }
  // Coffee bar on the back-left
  box(6, 2.2, 2, 0x3b2a1e, -12.5, 1.1, -11, g);
  for (let i = 0; i < 4; i++) box(0.8, 1.2, 0.8, 0x111111, -14.5 + i * 1.4, 2.8, -11.3, g);

  // Customers waiting at the deli
  for (const [x, color] of [[6, 0x2e86c1], [9, 0x27ae60]]) {
    const p = makePerson({ shirt: color, beard: null, hair: 0x5a3a24, build: 1.05 });
    p.scale.setScalar(1.6);
    p.position.set(x, 0, -6);
    p.rotation.y = Math.PI;
    g.add(p);
  }
  return g;
}

export class WawaMode {
  constructor(game) {
    this.game = game;
  }

  enter() {
    const g = this.game;
    if (!interior) {
      interior = buildInterior();
      g.world.scene.add(interior);
    }
    interior.visible = true;
    g.setOutdoors(false);
    state.showTray = true;
    this.stations = [];
    interior.traverse((o) => { if (o.userData.station) this.stations.push(o); });

    const t = g.tyler;
    t.visible = true;
    t.position.set(ORIGIN.x, 0, ORIGIN.z + 9);
    t.rotation.y = Math.PI;
    g.avatarRing.visible = true;
    this.dest = null;
    this.targetStation = null;
    this.leaving = false;
    this.labels = Object.entries(STATIONS).map(([key, s]) => {
      const l = g.world.addLabel(s.label, () => new THREE.Vector3(ORIGIN.x + s.pos[0], 7.5, ORIGIN.z + s.pos[1]), 'label station');
      l.onClick(() => this.goTo(key));
      return l;
    });

    // Frame the room: follow a point between Tyler and the middle of the store.
    const focus = new THREE.Vector3();
    g.world.setCamera({ follow: () => focus.set((t.position.x + ORIGIN.x) / 2, 0, (t.position.z + ORIGIN.z - 2) / 2), yaw: 0, pitch: 1.05, dist: 34, minDist: 18, maxDist: 44, yawLimit: [-0.8, 0.8], lookHeight: 0 });
    audio.playMusic('wawa');
    toast('Order at a kiosk, grab a Ghost from the cooler, then pay.', 3500);
  }

  goTo(key) {
    if (state.inputLocked || this.leaving) return;
    const [x, z] = STATIONS[key].pos;
    this.dest = new THREE.Vector3(ORIGIN.x + x, 0, ORIGIN.z + z);
    this.targetStation = key;
  }

  onTap(e) {
    if (state.inputLocked || this.leaving) return;
    const w = this.game.world;
    const hit = w.pick(e, this.stations);
    if (hit) {
      let o = hit.object;
      while (o && !o.userData.station) o = o.parent;
      if (o) { this.goTo(o.userData.station); return; }
    }
    const p = w.groundPoint(e);
    if (!p) return;
    p.x = Math.max(ORIGIN.x - HALF_W + 2, Math.min(ORIGIN.x + HALF_W - 3, p.x));
    p.z = Math.max(ORIGIN.z - 7, Math.min(ORIGIN.z + HALF_D - 1, p.z));
    this.dest = p;
    this.targetStation = null;
  }

  update(dt) {
    const g = this.game;
    const t = g.tyler;
    const o = state.order;
    if (o && !o.announced && state.clock.minutes >= o.readyAt) {
      o.announced = true;
      audio.sfx('ready');
      toast(`Order #${o.number} is ready at the deli!`);
    }
    g.avatarRing.position.set(t.position.x, 0, t.position.z);
    g.avatarRing.userData.animate(dt);
    if (state.inputLocked || this.leaving) { t.userData.animate(dt, false); return; }

    let vx = 0;
    let vz = 0;
    let kx = 0;
    let kz = 0;
    if (keys.has('arrowup') || keys.has('w')) kz -= 1;
    if (keys.has('arrowdown') || keys.has('s')) kz += 1;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;
    if (kx || kz) {
      const yaw = g.world.rig.yaw;
      vx = kx * Math.cos(yaw) + kz * Math.sin(yaw);
      vz = -kx * Math.sin(yaw) + kz * Math.cos(yaw);
      this.dest = null;
      this.targetStation = null;
    } else if (this.dest) {
      vx = this.dest.x - t.position.x;
      vz = this.dest.z - t.position.z;
    }
    const len = Math.hypot(vx, vz);
    if (this.dest && len < 0.25) {
      this.dest = null;
      const st = this.targetStation;
      this.targetStation = null;
      t.userData.animate(dt, false);
      if (st) this.interact(st);
      return;
    }
    if (len > 0) {
      const step = Math.min(len, SPEED * dt);
      t.position.x = Math.max(ORIGIN.x - HALF_W + 1.5, Math.min(ORIGIN.x + HALF_W - 2.5, t.position.x + (vx / len) * step));
      t.position.z = Math.max(ORIGIN.z - 7.5, Math.min(ORIGIN.z + HALF_D - 0.5, t.position.z + (vz / len) * step));
      t.rotation.y = angleLerp(t.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-dt * 12));
    }
    t.userData.animate(dt, len > 0, 1.1);
  }

  lock(on) {
    state.inputLocked = on;
  }

  interact(key) {
    ({
      kiosk: () => this.openKiosk(),
      deli: () => this.pickUp(),
      cooler: () => this.openCooler(),
      register: () => this.pay(),
      exit: () => this.tryExit(),
    })[key]();
  }

  openKiosk() {
    if (state.order) { toast(`Order #${state.order.number} is already in. Listen for your number.`); return; }
    this.lock(true);
    const cart = [];
    const render = () => {
      const cal = cart.reduce((s, f) => s + f.calories, 0);
      return openPanel({
        title: 'Touchscreen kiosk',
        body: cart.length ? `In your order: ${cart.map((f) => f.name).join(', ')}\n${cal} cal` : 'Tap items to add them to your order.',
        items: [
          ...menu.food.map((f) => ({ label: f.name, right: `${f.calories} cal`, onClick: (close) => { cart.push(f); close(); render(); } })),
          { label: cart.length ? `Place order (${cart.length})` : 'Cancel', style: cart.length ? 'primary' : '', onClick: (close) => { close(); this.placeOrder(cart); } },
        ],
      });
    };
    render();
  }

  placeOrder(cart) {
    this.lock(false);
    if (!cart.length) return;
    state.orderCounter++;
    state.order = {
      number: state.orderCounter,
      items: cart.map((f) => f.id),
      readyAt: state.clock.minutes + state.config.orderPrepMinutes,
      announced: false,
    };
    audio.sfx('register');
    toast(`Order #${state.order.number} placed. Listen for your number.`);
    maybeCall('wawaOrder', { delay: 1500 });
  }

  pickUp() {
    const o = state.order;
    if (!o) { toast("You haven't ordered anything yet. Try a kiosk."); return; }
    if (state.clock.minutes < o.readyAt) { toast(`Order #${o.number} isn't ready yet.`); return; }
    for (const id of o.items) state.inventory.push(makeFood(menu.food.find((f) => f.id === id)));
    state.order = null;
    audio.sfx('tap');
    toast('Picked up your order. Smells great.');
  }

  openCooler() {
    this.lock(true);
    const fav = state.config.favoriteGhostFlavor;
    openPanel({
      title: 'Ghost Energy',
      body: `${state.config.ghostCaffeineMg} mg caffeine per can.`,
      items: [
        ...menu.ghostFlavors.map((flavor) => ({
          label: flavor,
          sub: flavor === fav ? "Tyler's favorite" : undefined,
          style: flavor === fav ? 'gold' : '',
          onClick: (close) => {
            state.inventory.push(makeGhost(flavor, state.config.ghostCaffeineMg));
            audio.sfx('cooler');
            toast(flavor === fav ? 'Root Beer Ghost. The good stuff.' : `Grabbed a ${flavor} Ghost.`);
            close();
            this.lock(false);
          },
        })),
        { label: 'Close', onClick: (close) => { close(); this.lock(false); } },
      ],
    });
  }

  pay() {
    if (!hasUnpaid(state.inventory)) { toast('Nothing to pay for.'); return; }
    for (const i of state.inventory) i.paid = true;
    audio.sfx('register');
    toast('Paid. "Have a good one, Deputy!"');
  }

  tryExit() {
    if (hasUnpaid(state.inventory)) { toast("Gotta pay first. You're literally a cop."); return; }
    const goals = state.config.wawaGoals;
    const s = goalStatus(state.inventory, goals);
    if (s.foodMet && s.caffeineMet) { this.leave(); return; }
    this.lock(true);
    openPanel({
      title: 'Leave anyway?',
      body: `Food ${s.calories} / ${goals.minCalories} cal\nCaffeine ${s.caffeineMg} / ${goals.minCaffeineMg} mg\n\nMissing a goal lowers your score.`,
      items: [
        { label: 'Keep shopping', onClick: (close) => { close(); this.lock(false); } },
        { label: 'Leave', style: 'danger', onClick: (close) => { close(); this.leave(); } },
      ],
    });
  }

  leave() {
    this.leaving = true;
    this.lock(false);
    audio.sfx('chime');
    setTimeout(() => nextStep(), 300);
  }

  exit() {
    interior.visible = false;
    for (const l of this.labels) l.remove();
    this.game.avatarRing.visible = false;
  }
}
