// On-foot mode: Tyler stays centered on an overhead town map; tap to walk.
// Placeholder layouts; the real Lawrenceville street map (OpenStreetMap) replaces these later.
import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { FONT } from '../ui.js';

const W = 540;
const H = 900;

const LOCATIONS = {
  home: {
    start: { x: 270, y: 680 },
    target: { x: 390, y: 450, label: 'Patrol car', sprite: 'patrol' },
    trigger: 'homeWalk',
    draw(s) {
      s.add.rectangle(270, 330, W, 70, 0x555a60); // street
      for (let x = 20; x < W; x += 60) s.add.rectangle(x, 330, 30, 4, 0xf4e04d);
      s.add.rectangle(390, 520, 60, 300, 0x8a8f96); // driveway
      s.add.rectangle(270, 790, 220, 130, 0x7a3b2e).setStrokeStyle(3, 0x4e241b); // house roof (top-down)
      s.add.rectangle(270, 790, 220, 6, 0x5e2b20); // roof ridge
      s.add.rectangle(270, 722, 30, 8, 0x5b3a1e); // front door
      s.add.rectangle(270, 700, 60, 30, 0xb0a48a); // porch
      s.add.text(270, 880, "Tyler's house", { ...FONT, fontSize: '11px' }).setOrigin(0.5);
      s.add.ellipse(110, 560, 120, 70, 0xa0522d, 0.7); // red clay
    },
  },
  wawaLot: {
    start: { x: 150, y: 760 },
    target: { x: 270, y: 330, label: 'Wawa entrance' },
    trigger: null,
    draw(s) {
      s.add.rectangle(270, 560, W, 560, 0x5f6368); // parking lot
      s.add.rectangle(270, 230, 380, 180, 0xf3efe6).setStrokeStyle(4, 0xc8102e); // store
      s.add.rectangle(270, 160, 380, 26, 0xc8102e);
      s.add.text(270, 160, 'WAWA', { ...FONT, fontSize: '18px', color: '#f4c20d' }).setOrigin(0.5);
      s.add.rectangle(270, 318, 50, 8, 0x9fd3ff); // doors
      for (const x of [150, 270, 390]) s.add.rectangle(x, 620, 30, 40, 0xc8102e).setStrokeStyle(2, 0xffffff); // pumps
      s.add.rectangle(270, 620, 400, 120, 0xffffff, 0.12); // canopy shadow
      s.add.image(150, 790, 'patrol').setScale(1.4);
      s.add.text(270, 880, 'Wawa (fictional location)', { ...FONT, fontSize: '11px' }).setOrigin(0.5);
    },
  },
  school: {
    start: { x: 120, y: 790 },
    target: { x: 270, y: 330, label: 'Front entrance' },
    trigger: 'schoolWalk',
    draw(s) {
      s.add.rectangle(270, 640, W, 420, 0x5f6368); // car-rider lot
      for (let x = 60; x < W; x += 70) s.add.rectangle(x, 560, 4, 50, 0xffffff);
      s.add.rectangle(270, 200, 460, 240, 0x9c4a3a).setStrokeStyle(4, 0x5e2b20); // brick building
      s.add.rectangle(270, 318, 60, 10, 0x9fd3ff);
      s.add.text(270, 150, state.config.schoolName.toUpperCase(), { ...FONT, fontSize: '16px', color: '#fff', align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5);
      s.add.text(270, 180, `Home of the ${state.config.schoolMascot}`, { ...FONT, fontSize: '11px' }).setOrigin(0.5);
      s.add.rectangle(440, 380, 4, 80, 0xcccccc); // flagpole
      s.add.image(120, 820, 'patrol').setScale(1.4);
      s.add.image(300, 600, 'bus').setScale(1.2);
    },
  },
};

export class WalkScene extends Phaser.Scene {
  constructor() {
    super('Walk');
  }

  init(data) {
    this.loc = LOCATIONS[data.location];
    this.locKey = data.location;
  }

  create() {
    const L = this.loc;
    this.add.rectangle(W / 2, H / 2, W, H, 0x6aa84f);
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(10, W - 10);
      const y = Phaser.Math.Between(60, H - 20);
      if (Math.abs(x - L.target.x) > 60 || Math.abs(y - L.target.y) > 60) this.add.image(x, y, 'pine').setDepth(y);
    }
    L.draw(this);

    const t = L.target;
    if (t.sprite) this.add.image(t.x, t.y, t.sprite).setScale(1.4);
    this.arrow = this.add.triangle(t.x, t.y - 50, 0, 0, 20, 0, 10, 14, 0xf4c20d).setDepth(999);
    this.tweens.add({ targets: this.arrow, y: t.y - 40, yoyo: true, repeat: -1, duration: 400 });
    this.add.text(t.x, t.y - 70, t.label, { ...FONT, fontSize: '11px', backgroundColor: '#000a', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(999);

    // Pulsing range ring under Tyler, like a location-map avatar.
    this.ring = this.add.ellipse(L.start.x, L.start.y + 18, 60, 22, 0x4fc3f7, 0.25).setStrokeStyle(2, 0x4fc3f7);
    this.tweens.add({ targets: this.ring, scaleX: 1.3, scaleY: 1.3, alpha: 0.4, yoyo: true, repeat: -1, duration: 900 });
    this.player = this.add.sprite(L.start.x, L.start.y, 'tyler0').setScale(1.5);
    this.dest = null;
    this.walkTimer = 0;
    this.arrived = false;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.15, 0.15);

    this.input.on('pointerdown', (p) => {
      if (state.inputLocked) return;
      this.dest = cam.getWorldPoint(p.x, p.y);
    });
    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');

    audio.playMusic('walk');
    if (this.locKey === 'home') toast(this.game, 'Tap the map to walk.');
    if (L.trigger) maybeCall(this.game, L.trigger, { delay: 900 });
  }

  update(_t, delta) {
    if (this.arrived || state.inputLocked) return;
    const dt = delta / 1000;
    const speed = 120;
    const p = this.player;
    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (k.LEFT.isDown || k.A.isDown) vx = -1;
    if (k.RIGHT.isDown || k.D.isDown) vx = 1;
    if (k.UP.isDown || k.W.isDown) vy = -1;
    if (k.DOWN.isDown || k.S.isDown) vy = 1;
    if (vx || vy) {
      this.dest = null;
    } else if (this.dest) {
      const dx = this.dest.x - p.x;
      const dy = this.dest.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) this.dest = null;
      else { vx = dx / d; vy = dy / d; }
    }
    const moving = vx || vy;
    if (moving) {
      const n = Math.hypot(vx, vy);
      p.x = Phaser.Math.Clamp(p.x + (vx / n) * speed * dt, 10, W - 10);
      p.y = Phaser.Math.Clamp(p.y + (vy / n) * speed * dt, 60, H - 10);
      if (vx) p.setFlipX(vx < 0);
      this.walkTimer += delta;
      p.setTexture(Math.floor(this.walkTimer / 180) % 2 ? 'tyler1' : 'tyler0');
    } else {
      p.setTexture('tyler0');
    }
    this.ring.setPosition(p.x, p.y + 18);
    p.setDepth(p.y);

    const t = this.loc.target;
    if (Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y) < 34) this.arrive();
  }

  arrive() {
    this.arrived = true;
    if (this.locKey === 'school') {
      state.arrivalMinutes = state.clock.minutes;
      state.clockRunning = false;
      state.objective = '';
      this.time.delayedCall(400, () => nextStep(this.game));
      return;
    }
    audio.sfx(this.locKey === 'wawaLot' ? 'chime' : 'carDoor');
    this.time.delayedCall(250, () => nextStep(this.game));
  }
}
