// Heads-up display: clock, bell, Wawa tray, sound toggles, objective, toasts.
import { state } from '../state.js';
import { audio } from '../audio.js';
import { formatTime } from '../logic/clock.js';
import { totals } from '../logic/wawa.js';
import { h, $, setText, setHTML, setFlag, setClass } from './dom.js';

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.time = h('div', { class: 'time' });
    this.bell = h('div', { class: 'bell' });
    this.clock = h('div', { class: 'card clock' }, this.time, this.bell);
    this.tray = h('div', { class: 'card tray' });
    this.music = h('button', { class: 'toggle', onclick: () => this.toggle('music') }, 'MUSIC');
    this.sfx = h('button', { class: 'toggle', onclick: () => this.toggle('sfx') }, 'SFX');
    this.objective = h('div', { class: 'objective' });
    this.toastEl = h('div', { class: 'toast hidden' });
    this.root.append(
      h('div', { class: 'hud-top' }, this.clock, this.tray, h('div', { class: 'toggles' }, this.music, this.sfx)),
      this.objective,
      this.toastEl,
    );
    this.refreshToggles();
    this.toastTimer = null;
  }

  show(on) {
    this.root.hidden = !on;
  }

  toggle(kind) {
    state.settings[kind] = !state.settings[kind];
    state.saveSettings();
    audio.applySettings();
    this.refreshToggles();
  }

  refreshToggles() {
    this.music.classList.toggle('off', !state.settings.music);
    this.sfx.classList.toggle('off', !state.settings.sfx);
  }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  update() {
    const c = state.clock;
    const left = c.minutesUntilBell();
    setText(this.time, formatTime(c.minutes));
    setText(this.bell, `Bell ${formatTime(c.bell)} · ${Math.max(0, Math.ceil(left))} min`);
    setClass(this.clock, 'warn', left <= 10 && left > 5);
    setClass(this.clock, 'late', left <= 5);
    setFlag(this.tray, 'hidden', !state.showTray);
    if (state.showTray) {
      const t = totals(state.inventory);
      const g = state.config.wawaGoals;
      const okF = t.calories >= g.minCalories;
      const okC = t.caffeineMg >= g.minCaffeineMg;
      setHTML(this.tray, `<div class="${okF ? 'ok' : ''}">Food ${t.calories}/${g.minCalories} cal</div><div class="${okC ? 'ok' : ''}">Caffeine ${t.caffeineMg}/${g.minCaffeineMg} mg</div>`);
    }
    setText(this.objective, state.objective);
    setFlag(this.objective, 'hidden', !state.objective);
  }
}
