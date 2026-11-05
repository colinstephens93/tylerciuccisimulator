// Amanda calling. On foot, Tyler stops while he talks; driving, it's hands-free.
import { state } from '../state.js';
import { audio } from '../audio.js';
import calls from '../data/amanda-calls.json';
import { rollMood, applyReply } from '../logic/amanda.js';
import { h, $ } from './dom.js';

const MOOD_HINT = { happy: 'sounds happy', neutral: 'hard to read her tone', grumpy: 'uh oh. not a good mood.' };
const used = new Set();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Phone {
  constructor(onToast) {
    this.active = false;
    this.toast = onToast;
  }

  ring(handsFree) {
    if (this.active) return;
    this.active = true;
    this.handsFree = handsFree;
    if (!handsFree) state.inputLocked = true;
    const name = state.config.spouseName;
    this.status = h('div', { class: 'status' }, handsFree ? 'calling... (hands-free)' : 'calling...');
    this.body = h('div');
    this.el = h('div', { class: `phone ringing ${handsFree ? 'handsfree' : 'onfoot'}` },
      h('div', { class: 'who' }, h('div', { class: 'avatar' }, name[0]), h('div', {}, h('div', { class: 'name' }, name), this.status)),
      this.body);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.body.append(h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => this.answer() }, 'Answer'),
      h('button', { class: 'btn danger', onclick: () => this.decline() }, 'Decline')));
    $('#overlay').append(this.el);
    audio.duck(true);
    audio.sfx('ring');
    this.ringTimer = setInterval(() => audio.sfx('ring'), 1200);
    this.missTimer = setTimeout(() => this.decline(), 7000);
  }

  answer() {
    clearInterval(this.ringTimer);
    clearTimeout(this.missTimer);
    this.el.classList.remove('ringing');
    const mood = rollMood(state.amandaMood, state.declinedLast);
    state.declinedLast = false;
    const pool = calls[mood].filter((c) => !used.has(c.line));
    const call = pick(pool.length ? pool : calls[mood]);
    used.add(call.line);
    this.status.textContent = `(${MOOD_HINT[mood]})`;
    this.body.replaceChildren(
      h('div', { class: 'line' }, `"${call.line}"`),
      h('div', { class: 'replies' }, call.replies.map((r) => h('button', { class: 'btn', onclick: () => this.reply(r) }, r.text))),
    );
    if (this.handsFree) this.missTimer = setTimeout(() => this.reply(call.replies[0]), 9000);
  }

  reply(r) {
    clearTimeout(this.missTimer);
    state.amandaMood = applyReply(state.amandaMood, r.delta);
    this.body.replaceChildren(h('div', { class: 'line' }, `Tyler: "${r.text}"`), h('div', { class: 'line' }, `${state.config.spouseName}: "${r.reaction}"`));
    this.closeTimer = setTimeout(() => this.close(), 2400);
  }

  decline() {
    clearInterval(this.ringTimer);
    clearTimeout(this.missTimer);
    state.declinedLast = true;
    const text = pick(calls.missedTexts);
    setTimeout(() => {
      if (!state.clockRunning) return;
      audio.sfx('ding');
      this.toast(`${state.config.spouseName}: ${text}`);
    }, 1500);
    this.close();
  }

  close() {
    clearInterval(this.ringTimer);
    clearTimeout(this.missTimer);
    clearTimeout(this.closeTimer);
    if (!this.active) return;
    this.active = false;
    if (!this.handsFree) state.inputLocked = false;
    audio.duck(false);
    this.el?.remove();
  }
}
