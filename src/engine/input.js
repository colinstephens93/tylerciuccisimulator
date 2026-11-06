// Touch controls (floating virtual joystick + action buttons) and keyboard, merged into one
// input state the game reads each frame.
import { h, $, setFlag, setText, setClass } from '../ui/dom.js';

const RADIUS = 56; // px the knob can travel
const DEAD = 0.12;

// Action buttons per control scheme. `key` is the keyboard shortcut shown in desktop hints.
const SCHEMES = {
  foot: [
    { id: 'jump', label: 'JUMP', cls: 'a', key: 'Space' },
    { id: 'kick', label: 'KICK', cls: 'b', key: 'F' },
    { id: 'enter', label: 'GET IN', cls: 'y', key: 'E', context: true },
  ],
  car: [
    { id: 'drift', label: 'DRIFT', cls: 'a', key: 'Space', hold: true },
    { id: 'horn', label: 'HORN', cls: 'b', key: 'H' },
    { id: 'enter', label: 'EXIT', cls: 'y', key: 'E' },
    { id: 'siren', label: 'SIREN', cls: 'x', key: 'L', context: true },
  ],
};

const KEYMAP = {
  ' ': ['jump', 'drift'], f: ['kick'], j: ['kick'], e: ['enter'], enter: ['enter'],
  h: ['horn'], l: ['siren'], shift: ['run'],
};

export class Controls {
  constructor() {
    this.root = $('#controls');
    this.stick = { x: 0, y: 0, id: null };
    this.keys = new Set();
    this.held = new Set();
    this.pressed = new Set();
    this.buttons = new Map();
    this.scheme = null;
    this.enabled = true;
    this.buildStick();
    this.bindKeys();
  }

  buildStick() {
    this.knob = h('div', { class: 'stick-knob' });
    this.base = h('div', { class: 'stick-base idle' }, this.knob);
    this.zone = h('div', { class: 'stick-zone' }, this.base);
    this.pad = h('div', { class: 'action-pad' });
    this.root.append(this.zone, this.pad);
    const z = this.zone;
    let origin = null;
    const place = (x, y) => {
      this.base.style.transform = `translate(${x}px, ${y}px)`;
    };
    const rest = () => {
      this.base.style.transform = ''; // idle position comes from CSS
    };
    this.restStick = rest;
    z.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null || !this.enabled) return;
      e.preventDefault();
      z.setPointerCapture(e.pointerId);
      const r = z.getBoundingClientRect();
      origin = { x: e.clientX, y: e.clientY };
      this.stick.id = e.pointerId;
      place(e.clientX - r.left, e.clientY - r.top);
      this.base.classList.remove('idle');
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - origin.x;
      let dy = e.clientY - origin.y;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / RADIUS;
      this.stick.y = -dy / RADIUS;
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick = { x: 0, y: 0, id: null };
      this.knob.style.transform = '';
      this.base.classList.add('idle');
      rest();
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      for (const id of KEYMAP[k] || []) this.press(id);
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      for (const id of KEYMAP[k] || []) this.release(id);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.held.clear();
    });
  }

  press(id) {
    if (!this.enabled) return;
    this.held.add(id);
    this.pressed.add(id);
  }

  release(id) {
    this.held.delete(id);
  }

  // Swap the action buttons for on-foot or driving.
  setScheme(name) {
    if (this.scheme === name) return;
    this.scheme = name;
    this.pad.replaceChildren();
    this.buttons.clear();
    this.held.clear();
    this.pressed.clear();
    for (const b of SCHEMES[name] || []) {
      const el = h('button', { class: `act ${b.cls}` }, b.label);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('held');
        this.press(b.id);
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
        el.addEventListener(ev, () => { el.classList.remove('held'); this.release(b.id); });
      }
      if (b.context) el.hidden = true;
      this.pad.append(el);
      this.buttons.set(b.id, el);
    }
  }

  // Show/hide a context button (GET IN near a car, SIREN in the patrol car).
  showButton(id, on, label) {
    const el = this.buttons.get(id);
    if (!el) return;
    setFlag(el, 'hidden', !on);
    if (label) setText(el, label);
  }

  setButtonActive(id, on) {
    const el = this.buttons.get(id);
    if (el) setClass(el, 'on', on);
  }

  show(on) {
    this.root.hidden = !on;
    if (!on) {
      this.stick = { x: 0, y: 0, id: null };
      this.held.clear();
    }
  }

  // Movement axis: x = right, y = forward. Magnitude 0..1.
  axis() {
    let x = this.stick.x;
    let y = this.stick.y;
    const k = this.keys;
    const kx = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const ky = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0);
    if (kx || ky) return { x: kx, y: ky, m: 1, keyboard: true };
    const m = Math.hypot(x, y);
    if (m < DEAD) return { x: 0, y: 0, m: 0, keyboard: false };
    const s = Math.min(1, m);
    return { x: (x / m) * s, y: (y / m) * s, m: s, keyboard: false };
  }

  isHeld(id) {
    return this.held.has(id);
  }

  // True once per press.
  consume(id) {
    if (!this.pressed.has(id)) return false;
    this.pressed.delete(id);
    return true;
  }

  endFrame() {
    this.pressed.clear();
  }
}
