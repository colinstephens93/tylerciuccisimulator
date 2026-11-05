import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import { startStep } from '../flow.js';
import { makeTextures } from '../gfx/textures.js';
import { FONT } from '../ui.js';
import { formatTime, parseTime } from '../logic/clock.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    makeTextures(this);
    this.add.rectangle(180, 320, 360, 640, 0x1e3a2b);
    for (let i = 0; i < 14; i++) this.add.image(20 + (i % 7) * 52, i < 7 ? 70 : 590, 'pine');
    this.add.text(180, 150, 'TYLER CIUCCI\nSIMULATOR', { ...FONT, fontSize: '30px', align: 'center', color: '#f4c20d', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(180, 220, 'The Morning Run', { ...FONT, fontSize: '16px' }).setOrigin(0.5);
    this.add.image(130, 320, 'tyler0').setScale(3);
    this.add.image(230, 320, 'patrol').setScale(2);
    this.add.text(180, 410, `${state.config.townName}, Georgia\nGet breakfast. Beat the ${formatTime(parseTime(state.config.firstBell))} bell.`, { ...FONT, fontSize: '13px', align: 'center' }).setOrigin(0.5);
    const tap = this.add.text(180, 480, 'TAP TO START', { ...FONT, fontSize: '20px', color: '#f4c20d' }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    if (state.best.score > 0) this.add.text(180, 520, `Best score: ${state.best.score}`, { ...FONT, fontSize: '12px' }).setOrigin(0.5);
    this.add.text(180, 620, 'A fan game made for friends. Not affiliated with Wawa or Ghost.', { ...FONT, fontSize: '9px', color: '#9aa' }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      audio.unlock();
      state.newRun();
      startStep(this.game, 0);
    });
  }
}
