// Driving mode: top-down, vertically scrolling road in the patrol car.
import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { nextStep, maybeCall, toast } from '../flow.js';
import { FONT, button } from '../ui.js';

const ROAD_L = 90;
const ROAD_R = 270;
const LANES = [120, 180, 240];
const MAX_SPEED = 300; // px/s at full speed
const LIGHTS_SPEED = 380;
const MPH_PER_PX = 45 / MAX_SPEED;

const ROUTES = {
  toWawa: { length: 8000, label: 'Wawa', trigger: 'driveWawa', schoolZone: null },
  toSchool: { length: 11000, label: state.config.schoolName, trigger: 'driveSchool', schoolZone: { from: 0.68, to: 0.9, limitMph: 25 } },
};

const TRAFFIC = [
  { key: 'carRed', speed: 170 },
  { key: 'carBlue', speed: 150 },
  { key: 'carSilver', speed: 190 },
  { key: 'pickup', speed: 90 },
  { key: 'bus', speed: 120 },
  { key: 'pothole', speed: 0 },
];

export class DriveScene extends Phaser.Scene {
  constructor() {
    super('Drive');
  }

  init(data) {
    this.route = ROUTES[data.route];
    this.routeKey = data.route;
  }

  create() {
    this.add.rectangle(180, 320, 360, 640, 0x4f7f3a); // grass
    this.zoneTint = this.add.rectangle(180, 320, ROAD_R - ROAD_L + 40, 640, 0xf4c20d, 0.18).setVisible(false);
    this.add.rectangle(180, 320, ROAD_R - ROAD_L, 640, 0x44484e); // road
    this.add.rectangle(ROAD_L, 320, 4, 640, 0xffffff);
    this.add.rectangle(ROAD_R, 320, 4, 640, 0xffffff);
    this.dashes = [];
    for (let i = 0; i < 12; i++) {
      for (const x of [150, 210]) this.dashes.push(this.add.rectangle(x, i * 60, 4, 30, 0xf4f4f4));
    }
    this.scenery = [];
    for (let i = 0; i < 10; i++) {
      this.scenery.push(this.add.image(i % 2 ? Phaser.Math.Between(300, 345) : Phaser.Math.Between(15, 60), i * 70, 'pine'));
    }

    this.car = this.add.image(180, 500, 'patrol').setDepth(10);
    this.speed = 0;
    this.distance = 0;
    this.obstacles = [];
    this.nextSpawn = 400;
    this.lightsUntil = 0;
    this.lightsCooldownUntil = 0;
    this.overLimitMs = 0;
    this.finished = false;
    this.calledMid = false;

    this.lightBar = this.add.rectangle(180, 500, 20, 5, 0xff0000).setDepth(11).setVisible(false);

    // Controls: hold left / brake / right; lights button.
    this.hold = { left: false, right: false, brake: false };
    this.input.addPointer(2);
    const mk = (x, label, key) => {
      const b = button(this, x, 595, 110, 80, label, () => {}, { size: 18 });
      b.rect.on('pointerdown', () => { this.hold[key] = true; });
      for (const ev of ['pointerup', 'pointerout']) b.rect.on(ev, () => { this.hold[key] = false; });
      return b;
    };
    mk(62, '<', 'left');
    mk(180, 'BRAKE', 'brake');
    mk(298, '>', 'right');
    this.lightsBtn = button(this, 312, 100, 80, 34, 'LIGHTS', () => this.useLights(), { size: 12, fill: 0x8b0000 });

    this.speedText = this.add.text(10, 90, '', { ...FONT, fontSize: '14px', backgroundColor: '#000a', padding: { x: 4, y: 2 } }).setDepth(20);
    this.progressBg = this.add.rectangle(180, 548, 300, 6, 0x000000, 0.6).setDepth(20);
    this.progress = this.add.rectangle(30, 548, 0, 6, 0xf4c20d).setOrigin(0, 0.5).setDepth(20);
    this.zoneText = this.add.text(180, 170, '', { ...FONT, fontSize: '14px', color: '#000', backgroundColor: '#f4c20d', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(20).setVisible(false);

    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,DOWN,A,D,S,SPACE,L');
    this.keys.L.on('down', () => this.useLights());

    audio.playMusic('drive');
    audio.sfx('carDoor');
    if (this.routeKey === 'toSchool' && state.inventory.some((i) => i.type === 'drink')) {
      this.time.delayedCall(800, () => { audio.sfx('gulp'); toast(this.game, 'Ghost Energy: activated.'); });
    }
  }

  useLights() {
    const now = this.time.now;
    if (now < this.lightsCooldownUntil || this.finished) return;
    this.lightsUntil = now + 3500;
    this.lightsCooldownUntil = now + 7000;
    state.infractions++;
    audio.sfx('siren');
    toast(this.game, 'Lights for a breakfast run? +1 infraction');
    for (const o of this.obstacles) {
      if (o.y > -120 && o.y < 620 && !o.cleared) {
        o.cleared = true;
        this.tweens.add({ targets: o, x: o.x < 180 ? ROAD_L - 30 : ROAD_R + 30, duration: 500 });
      }
    }
  }

  spawn() {
    const t = Phaser.Utils.Array.GetRandom(TRAFFIC);
    const lane = Phaser.Utils.Array.GetRandom(LANES);
    const o = this.add.image(lane, -80, t.key).setDepth(5);
    if (t.key !== 'pothole') o.setFlipY(false);
    o.trafficSpeed = t.speed;
    o.cleared = false;
    this.obstacles.push(o);
  }

  update(time, delta) {
    if (this.finished) return;
    const dt = delta / 1000;
    const k = this.keys;
    const left = this.hold.left || k.LEFT.isDown || k.A.isDown;
    const right = this.hold.right || k.RIGHT.isDown || k.D.isDown;
    const brake = this.hold.brake || k.DOWN.isDown || k.S.isDown || k.SPACE.isDown;
    const lights = time < this.lightsUntil;

    const top = lights ? LIGHTS_SPEED : MAX_SPEED;
    if (brake) this.speed = Math.max(0, this.speed - 420 * dt);
    else this.speed = Math.min(top, this.speed + 150 * dt);
    if (left) this.car.x -= 200 * dt;
    if (right) this.car.x += 200 * dt;
    this.car.x = Phaser.Math.Clamp(this.car.x, ROAD_L + 16, ROAD_R - 16);
    this.car.setAngle(left && !right ? -6 : right && !left ? 6 : 0);
    this.lightBar.setPosition(this.car.x, this.car.y - 4).setVisible(lights)
      .setFillStyle(Math.floor(time / 150) % 2 ? 0xff2a2a : 0x2a5bff);

    const dy = this.speed * dt;
    this.distance += dy;
    for (const d of this.dashes) { d.y += dy; if (d.y > 660) d.y -= 720; }
    for (const s of this.scenery) { s.y += dy; if (s.y > 680) s.y -= 700; }

    // Traffic
    if (!lights && this.distance >= this.nextSpawn && this.distance < this.route.length - 600) {
      this.spawn();
      this.nextSpawn = this.distance + Phaser.Math.Between(260, 480);
    }
    for (const o of this.obstacles) {
      o.y += (this.speed - o.trafficSpeed) * dt;
      if (!o.cleared && this.hits(o)) this.collide(o);
    }
    this.obstacles = this.obstacles.filter((o) => {
      if (o.y > 720 || o.y < -400) { o.destroy(); return false; }
      return true;
    });

    // School zone
    const frac = this.distance / this.route.length;
    const z = this.route.schoolZone;
    const mph = Math.round(this.speed * MPH_PER_PX);
    const inZone = z && frac >= z.from && frac <= z.to;
    this.zoneTint.setVisible(!!inZone);
    if (inZone) {
      this.zoneText.setVisible(true).setText(`SCHOOL ZONE  ${z.limitMph} MPH`);
      if (mph > z.limitMph) {
        this.overLimitMs += delta;
        if (this.overLimitMs > 1500) {
          this.overLimitMs = 0;
          state.infractions++;
          toast(this.game, 'Speeding in a school zone! +1 infraction');
        }
      }
    } else {
      this.zoneText.setVisible(false);
    }
    this.speedText.setText(`${mph} MPH`).setColor(inZone && mph > z.limitMph ? '#ff5050' : '#ffffff');
    this.progress.width = 300 * Math.min(1, frac);

    if (!this.calledMid && frac > 0.35) {
      this.calledMid = true;
      maybeCall(this.game, this.route.trigger, { handsFree: true, delay: 0 });
    }

    // Music speeds up as the bell approaches.
    const left5 = state.clock.minutesUntilBell();
    audio.setTempo(left5 < 10 ? 1.25 : left5 < 20 ? 1.1 : 1);

    if (this.distance >= this.route.length) {
      this.finished = true;
      toast(this.game, `Arrived at ${this.route.label}`);
      this.time.delayedCall(500, () => nextStep(this.game));
    }
  }

  hits(o) {
    const a = this.car.getBounds();
    const b = o.getBounds();
    Phaser.Geom.Rectangle.Inflate(a, -4, -6);
    Phaser.Geom.Rectangle.Inflate(b, -3, -4);
    return Phaser.Geom.Intersects.RectangleToRectangle(a, b);
  }

  collide(o) {
    o.cleared = true;
    this.speed = 40;
    state.infractions++;
    state.clock.addMinutes(state.config.collisionPenaltyMinutes);
    audio.sfx('crash');
    this.cameras.main.shake(200, 0.01);
    this.tweens.add({ targets: o, x: o.x < this.car.x ? o.x - 60 : o.x + 60, angle: 25, alpha: 0.4, duration: 400 });
    toast(this.game, `Fender bender! +${state.config.collisionPenaltyMinutes} min`);
  }
}
