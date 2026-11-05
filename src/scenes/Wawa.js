// Inside the (fictional) Lawrenceville Wawa: kiosk, deli pickup, coolers, register, exit.
import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import menu from '../data/menu.json';
import { makeFood, makeGhost, goalStatus, hasUnpaid } from '../logic/wawa.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { FONT, panel } from '../ui.js';

const STATIONS = {
  deli: { x: 180, y: 170, label: 'DELI PICKUP' },
  kiosk: { x: 90, y: 300, label: 'KIOSK' },
  cooler: { x: 268, y: 330, label: 'COOLERS' },
  register: { x: 100, y: 500, label: 'REGISTER' },
  exit: { x: 180, y: 590, label: 'EXIT' },
};

export class WawaScene extends Phaser.Scene {
  constructor() {
    super('Wawa');
  }

  create() {
    state.showTray = true;
    // Floor and fixtures
    for (let y = 80; y < 640; y += 24) {
      for (let x = 0; x < 360; x += 24) {
        this.add.rectangle(x + 12, y + 12, 24, 24, ((x + y) / 24) % 2 ? 0xe9e4d8 : 0xdcd5c5);
      }
    }
    this.add.rectangle(180, 115, 320, 46, 0xc8102e).setStrokeStyle(3, 0x7a0a1c); // deli counter
    this.add.text(180, 115, 'DELI', { ...FONT, fontSize: '14px', color: '#f4c20d' }).setOrigin(0.5);
    for (const y of [270, 330]) this.add.rectangle(40, y, 30, 46, 0x222831).setStrokeStyle(2, 0x9fd3ff); // kiosks
    this.add.rectangle(330, 330, 40, 260, 0x9fd3ff).setStrokeStyle(3, 0x5b7d99); // coolers
    for (let y = 215; y < 460; y += 40) this.add.rectangle(330, y, 30, 6, 0x111111, 0.4);
    this.add.rectangle(100, 465, 130, 34, 0x6b4c33).setStrokeStyle(2, 0x3e2a1c); // register counter
    this.add.rectangle(180, 632, 80, 10, 0x9fd3ff); // doors
    for (const [x, y] of [[150, 380], [210, 380]]) this.add.rectangle(x, y, 40, 90, 0xb5a98f); // aisles
    // Other customers waiting at the deli
    for (const x of [230, 270]) this.add.sprite(x, 175, 'tyler0').setTint(Phaser.Display.Color.RandomRGB(80, 220).color).setScale(1.2);

    for (const [key, s] of Object.entries(STATIONS)) {
      const t = this.add.text(s.x, s.y + (key === 'exit' ? -22 : 24), s.label, { ...FONT, fontSize: '10px', color: '#000', backgroundColor: '#f4c20dcc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(900);
      t.setInteractive().on('pointerdown', () => this.goTo(key));
    }

    this.player = this.add.sprite(180, 585, 'tyler0').setScale(1.5).setDepth(500);
    this.dest = null;
    this.targetStation = null;
    this.walkTimer = 0;

    this.input.on('pointerdown', (p) => {
      if (state.inputLocked) return;
      const station = Object.entries(STATIONS).find(([, s]) => Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < 45);
      if (station) this.goTo(station[0]);
      else { this.dest = { x: p.x, y: Phaser.Math.Clamp(p.y, 150, 600) }; this.targetStation = null; }
    });

    audio.playMusic('wawa');
    toast(this.game, 'Order at a kiosk, grab a Ghost from the cooler, then pay.');
  }

  goTo(key) {
    if (state.inputLocked) return;
    const s = STATIONS[key];
    this.dest = { x: s.x, y: s.y };
    this.targetStation = key;
  }

  update(_t, delta) {
    const o = state.order;
    if (o && !o.announced && state.clock.minutes >= o.readyAt) {
      o.announced = true;
      audio.sfx('ready');
      toast(this.game, `Order #${o.number} is ready at the deli!`);
    }
    if (state.inputLocked || !this.dest) { this.player.setTexture('tyler0'); return; }
    const p = this.player;
    const dx = this.dest.x - p.x;
    const dy = this.dest.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = 130 * (delta / 1000);
    if (d <= step) {
      p.setPosition(this.dest.x, this.dest.y);
      this.dest = null;
      if (this.targetStation) this.interact(this.targetStation);
      this.targetStation = null;
      return;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    if (dx) p.setFlipX(dx < 0);
    this.walkTimer += delta;
    p.setTexture(Math.floor(this.walkTimer / 180) % 2 ? 'tyler1' : 'tyler0');
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
    if (state.order) { toast(this.game, `Order #${state.order.number} is already in. Wait for the call.`); return; }
    this.lock(true);
    const cart = [];
    const show = () => {
      const cal = cart.reduce((s, f) => s + f.calories, 0);
      const handle = panel(this, {
        title: 'Touchscreen Kiosk',
        top: 90,
        body: cart.length ? `In order: ${cart.length} item(s), ${cal} cal` : 'Tap items to add them.',
        buttons: [
          ...menu.food.map((f) => ({ label: `${f.name}  ${f.calories} cal`, onClick: (h) => { cart.push(f); h.close(); show(); } })),
          { label: cart.length ? 'Place order' : 'Cancel', fill: 0x1f6f3f, onClick: (h) => { h.close(); this.placeOrder(cart); } },
        ],
      });
      return handle;
    };
    show();
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
    toast(this.game, `Order #${state.order.number} placed. Listen for your number.`);
    maybeCall(this.game, 'wawaOrder', { delay: 1500 });
  }

  pickUp() {
    const o = state.order;
    if (!o) { toast(this.game, "You haven't ordered anything yet."); return; }
    if (state.clock.minutes < o.readyAt) { toast(this.game, `Order #${o.number} isn't ready yet.`); return; }
    for (const id of o.items) state.inventory.push(makeFood(menu.food.find((f) => f.id === id)));
    state.order = null;
    audio.sfx('tap');
    toast(this.game, 'Picked up your order. Smells great.');
  }

  openCooler() {
    this.lock(true);
    const fav = state.config.favoriteGhostFlavor;
    panel(this, {
      title: 'Ghost Energy',
      top: 130,
      body: `${state.config.ghostCaffeineMg} mg caffeine per can.`,
      buttons: [
        ...menu.ghostFlavors.map((flavor) => ({
          label: flavor === fav ? `${flavor} (his favorite)` : flavor,
          onClick: (h) => {
            state.inventory.push(makeGhost(flavor, state.config.ghostCaffeineMg));
            audio.sfx('cooler');
            toast(this.game, flavor === fav ? 'Root Beer Ghost. The good stuff.' : `Grabbed a ${flavor} Ghost.`);
            h.close();
            this.lock(false);
          },
        })),
        { label: 'Close', onClick: (h) => { h.close(); this.lock(false); } },
      ],
    });
  }

  pay() {
    if (!hasUnpaid(state.inventory)) { toast(this.game, 'Nothing to pay for.'); return; }
    for (const i of state.inventory) i.paid = true;
    audio.sfx('register');
    toast(this.game, 'Paid. "Have a good one, Deputy!"');
  }

  tryExit() {
    if (hasUnpaid(state.inventory)) { toast(this.game, "Gotta pay first. You're literally a cop."); return; }
    const g = goalStatus(state.inventory, state.config.wawaGoals);
    if (g.foodMet && g.caffeineMet) { this.leave(); return; }
    this.lock(true);
    const goals = state.config.wawaGoals;
    panel(this, {
      title: 'Leave anyway?',
      top: 200,
      body: `Food ${g.calories} / ${goals.minCalories} cal\nCaffeine ${g.caffeineMg} / ${goals.minCaffeineMg} mg\n\nMissing goals will lower your score.`,
      buttons: [
        { label: 'Keep shopping', onClick: (h) => { h.close(); this.lock(false); } },
        { label: 'Leave', fill: 0x8b0000, onClick: (h) => { h.close(); this.leave(); } },
      ],
    });
  }

  leave() {
    this.lock(true);
    audio.sfx('chime');
    this.time.delayedCall(300, () => nextStep(this.game));
  }
}
