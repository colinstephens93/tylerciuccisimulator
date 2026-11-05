// Amanda calling. On foot it pauses walking; while driving it's hands-free (steering still works).
import Phaser from 'phaser';
import { state } from '../state.js';
import { audio } from '../audio.js';
import calls from '../data/amanda-calls.json';
import { rollMood, applyReply } from '../logic/amanda.js';
import { toast } from '../flow.js';
import { FONT, button } from '../ui.js';

const MOOD_HINT = { happy: '(she sounds happy)', neutral: '(hard to read her tone)', grumpy: '(uh oh. not a good mood.)' };
const used = new Set();

export class PhoneScene extends Phaser.Scene {
  constructor() {
    super('Phone');
  }

  init(data) {
    this.handsFree = !!data.handsFree;
  }

  create() {
    const name = state.config.spouseName;
    this.parts = [];
    if (!this.handsFree) {
      state.inputLocked = true;
      this.parts.push(this.add.rectangle(180, 320, 360, 640, 0x000000, 0.5).setInteractive());
    }
    const top = this.handsFree ? 150 : 200;
    this.top = top;
    this.add.rectangle(180, top + 95, 300, 210, 0x111317, 0.95).setStrokeStyle(3, 0xe5392b);
    this.title = this.add.text(180, top + 18, `${name} calling...`, { ...FONT, fontSize: '16px', color: '#ffb3ab' }).setOrigin(0.5);
    this.body = this.add.text(180, top + 50, this.handsFree ? '(hands-free)' : '', { ...FONT, fontSize: '13px', align: 'center', wordWrap: { width: 270 } }).setOrigin(0.5, 0);

    audio.duck(true);
    audio.sfx('ring');
    this.ringTimer = this.time.addEvent({ delay: 1200, loop: true, callback: () => audio.sfx('ring') });
    this.buttons = [
      button(this, 115, top + 170, 120, 40, 'Answer', () => this.answer(), { fill: 0x1f6f3f }),
      button(this, 245, top + 170, 120, 40, 'Decline', () => this.decline(), { fill: 0x8b0000 }),
    ];
    this.missTimer = this.time.delayedCall(7000, () => this.decline());
  }

  clearButtons() {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
  }

  answer() {
    this.ringTimer.remove();
    this.missTimer.remove();
    this.clearButtons();
    const mood = rollMood(state.amandaMood, state.declinedLast, Math.random);
    state.declinedLast = false;
    const pool = calls[mood].filter((c) => !used.has(c.line));
    const call = Phaser.Utils.Array.GetRandom(pool.length ? pool : calls[mood]);
    used.add(call.line);
    this.title.setText(`${state.config.spouseName} ${MOOD_HINT[mood]}`).setFontSize(12);
    this.body.setText(`"${call.line}"`);
    const replies = call.replies;
    replies.forEach((r, i) => {
      this.buttons.push(button(this, 180, this.top + 130 + i * 44, 270, 38, r.text, () => this.reply(r), { size: 12 }));
    });
    if (this.handsFree) {
      // Don't make the player stop steering forever: auto-pick the first reply.
      this.missTimer = this.time.delayedCall(8000, () => this.reply(replies[0]));
    }
  }

  reply(r) {
    this.missTimer?.remove();
    this.clearButtons();
    state.amandaMood = applyReply(state.amandaMood, r.delta);
    this.body.setText(`Tyler: "${r.text}"\n\n${state.config.spouseName}: "${r.reaction}"`);
    this.time.delayedCall(2200, () => this.close());
  }

  decline() {
    this.ringTimer.remove();
    this.missTimer.remove();
    state.declinedLast = true;
    const game = this.game;
    const text = Phaser.Utils.Array.GetRandom(calls.missedTexts);
    setTimeout(() => {
      if (!state.clockRunning) return;
      audio.sfx('ding');
      toast(game, `${state.config.spouseName}: ${text}`);
    }, 1500);
    this.close();
  }

  close() {
    if (!this.handsFree) state.inputLocked = false;
    audio.duck(false);
    this.scene.stop();
  }
}
