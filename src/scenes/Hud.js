import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { formatTime } from '../logic/clock.js';
import { totals } from '../logic/wawa.js';
import { finishRun } from '../flow.js';
import { FONT, button } from '../ui.js';

export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    const cfg = state.config;
    this.add.rectangle(180, 26, 360, 52, 0x000000, 0.75).setInteractive(); // eats taps on the bar
    this.clockText = this.add.text(10, 6, '', { ...FONT, fontSize: '22px' });
    this.bellText = this.add.text(10, 32, '', { ...FONT, fontSize: '11px', color: '#ccc' });
    this.trayText = this.add.text(145, 8, '', { ...FONT, fontSize: '11px', lineSpacing: 4 });
    this.objText = this.add.text(180, 64, '', { ...FONT, fontSize: '12px', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } }).setOrigin(0.5);

    this.musicBtn = button(this, 300, 16, 50, 22, '', () => this.toggle('music'), { size: 10 });
    this.sfxBtn = button(this, 300, 40, 50, 22, '', () => this.toggle('sfx'), { size: 10 });
    this.refreshToggles();

    this.toastText = this.add.text(180, 100, '', { ...FONT, fontSize: '13px', backgroundColor: '#f4c20d', color: '#000', padding: { x: 8, y: 4 }, align: 'center', wordWrap: { width: 300 } })
      .setOrigin(0.5, 0).setVisible(false).setDepth(50);
    const onToast = (msg) => this.showToast(msg);
    this.game.events.on('toast', onToast);
    this.events.once('shutdown', () => this.game.events.off('toast', onToast));

    this.bellLabel = formatTime(state.clock.bell);
    this.cfg = cfg;
  }

  toggle(kind) {
    state.settings[kind] = !state.settings[kind];
    state.saveSettings();
    audio.applySettings();
    this.refreshToggles();
  }

  refreshToggles() {
    this.musicBtn.text.setText(`MUS ${state.settings.music ? 'ON' : 'OFF'}`);
    this.sfxBtn.text.setText(`SFX ${state.settings.sfx ? 'ON' : 'OFF'}`);
  }

  showToast(msg) {
    this.toastText.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2200, duration: 400, onComplete: () => this.toastText.setVisible(false) });
  }

  update(_t, delta) {
    const clock = state.clock;
    if (state.clockRunning) clock.tick(delta);
    const left = clock.minutesUntilBell();
    this.clockText.setText(formatTime(clock.minutes));
    this.clockText.setColor(left <= 5 ? '#ff5050' : left <= 10 ? '#ffd24a' : '#ffffff');
    this.bellText.setText(`Bell ${this.bellLabel}  (${Math.max(0, Math.ceil(left))} min)`);
    if (state.showTray) {
      const t = totals(state.inventory);
      const g = this.cfg.wawaGoals;
      const mark = (ok) => (ok ? ' OK' : '');
      this.trayText.setText(`Food ${t.calories}/${g.minCalories}${mark(t.calories >= g.minCalories)}\nCaff ${t.caffeineMg}/${g.minCaffeineMg}mg${mark(t.caffeineMg >= g.minCaffeineMg)}`);
    } else {
      this.trayText.setText('');
    }
    this.objText.setText(state.objective);
    if (state.clockRunning && clock.isLate()) {
      state.clockRunning = false;
      audio.sfx('bell');
      finishRun(this.game, true);
    }
  }
}
