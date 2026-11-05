import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import calls from '../data/amanda-calls.json';
import { computeResult } from '../logic/scoring.js';
import { totals } from '../logic/wawa.js';
import { closingText } from '../logic/amanda.js';
import { formatTime } from '../logic/clock.js';
import { startStep, STEPS } from '../flow.js';
import { FONT, button } from '../ui.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  init(data) {
    this.tardy = !!data.tardy;
  }

  create() {
    audio.stopMusic();
    this.add.rectangle(180, 320, 360, 640, this.tardy ? 0x2a0d0d : 0x0f2a1a);
    if (this.tardy) this.showTardy();
    else this.showWin();
  }

  showTardy() {
    audio.sfx('tardy');
    this.add.text(180, 150, 'TARDY', { ...FONT, fontSize: '48px', color: '#ff5050', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(180, 220, `The first bell rang at ${formatTime(state.clock.bell)}\nand Deputy Ciucci wasn't at the door.`, { ...FONT, fontSize: '13px', align: 'center' }).setOrigin(0.5);
    this.add.image(180, 300, 'tyler0').setScale(3);
    const stepName = STEPS[state.checkpoint.stepIndex].objective;
    button(this, 180, 400, 280, 50, `Retry this scene\n(${stepName})`, () => {
      state.restoreCheckpoint();
      startStep(this.game, state.stepIndex);
    }, { fill: 0x1f6f3f, size: 13, fixed: false });
    button(this, 180, 465, 280, 44, 'Start over', () => this.restart(), { fixed: false });
  }

  showWin() {
    audio.sfx('win');
    const cfg = state.config;
    const t = totals(state.inventory);
    const result = computeResult({
      arrivalMinutes: state.arrivalMinutes,
      bellMinutes: state.clock.bell,
      calories: t.calories,
      caffeineMg: t.caffeineMg,
      goals: cfg.wawaGoals,
      gotFavorite: state.inventory.some((i) => i.flavor === cfg.favoriteGhostFlavor),
      infractions: state.infractions,
      amandaMood: state.amandaMood,
    });
    const isBest = state.recordScore(result.score);

    this.add.text(180, 70, 'MADE IT!', { ...FONT, fontSize: '34px', color: '#7CFC9a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(180, 110, `Arrived ${formatTime(state.arrivalMinutes)} at ${cfg.schoolName}`, { ...FONT, fontSize: '11px', align: 'center', wordWrap: { width: 330 } }).setOrigin(0.5);
    let y = 150;
    for (const l of result.lines) {
      this.add.text(24, y, `${l.label}  (${l.detail})`, { ...FONT, fontSize: '12px' });
      this.add.text(336, y, `${l.points >= 0 ? '+' : ''}${l.points}`, { ...FONT, fontSize: '12px', color: l.points >= 0 ? '#7CFC9a' : '#ff8080' }).setOrigin(1, 0);
      y += 22;
    }
    y += 8;
    this.add.text(180, y, `SCORE ${result.score}${isBest ? '  (new best!)' : ''}`, { ...FONT, fontSize: '20px', color: '#f4c20d' }).setOrigin(0.5, 0);
    this.add.text(180, y + 30, `Title: ${result.title}${result.perfect ? '  - Perfect morning' : ''}`, { ...FONT, fontSize: '13px' }).setOrigin(0.5, 0);
    this.add.text(180, y + 62, closingText(state.amandaMood, calls.closing), { ...FONT, fontSize: '12px', color: '#ffb3ab', align: 'center', wordWrap: { width: 310 } }).setOrigin(0.5, 0);

    button(this, 180, 520, 260, 44, 'Play again', () => this.restart(), { fill: 0x1f6f3f, fixed: false });
    const share = button(this, 180, 574, 260, 40, 'Share', async () => {
      const text = `I got ${result.score} ("${result.title}") in Tyler Ciucci Simulator.`;
      try {
        if (navigator.share) await navigator.share({ title: 'Tyler Ciucci Simulator', text, url: location.href });
        else { await navigator.clipboard.writeText(`${text} ${location.href}`); share.text.setText('Copied!'); }
      } catch { /* share cancelled */ }
    }, { fixed: false });
  }

  restart() {
    state.newRun();
    startStep(this.game, 0);
  }
}
