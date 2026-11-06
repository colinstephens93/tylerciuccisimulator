// Heads-up display: mini-map, heat meter, coins and Ghost cans, mission objective and
// timer, speedometer, toasts and big banner messages. Sized for small phone screens.
import { state } from '../state.js';
import { formatTimer } from '../missions/logic.js';
import { Minimap } from './minimap.js';
import { h, $, setText, setFlag, setClass } from './dom.js';

export class Hud {
  constructor(map, onPause) {
    this.root = $('#hud');
    const canvas = h('canvas', { class: 'minimap' });
    this.heatFill = h('div', { class: 'heat-fill' });
    this.heat = h('div', { class: 'heat' }, h('span', { class: 'heat-label' }, 'HEAT'), h('div', { class: 'heat-bar' }, this.heatFill));
    this.coins = h('div', { class: 'pill coins' }, h('i', { class: 'coin-icon' }), h('span', {}, '0'));
    this.cansEl = h('div', { class: 'pill cans' }, h('i', { class: 'can-icon' }), h('span', {}, '0'));
    this.pauseBtn = h('button', { class: 'pill pause', 'aria-label': 'Pause', onclick: onPause }, h('i', { class: 'pause-icon' }));
    this.missionTitle = h('div', { class: 'm-title' });
    this.objective = h('div', { class: 'm-obj' });
    this.timer = h('div', { class: 'm-timer' });
    this.mission = h('div', { class: 'mission' }, this.missionTitle, this.objective, this.timer);
    this.speedo = h('div', { class: 'speedo' }, h('b', {}, '0'), h('small', {}, 'MPH'));
    this.toastEl = h('div', { class: 'toast hidden' });
    this.banner = h('div', { class: 'banner hidden' });
    this.root.append(
      h('div', { class: 'hud-left' }, canvas, this.heat),
      h('div', { class: 'hud-right' }, this.coins, this.cansEl, this.pauseBtn),
      this.mission, this.speedo, this.toastEl, this.banner,
    );
    this.minimap = new Minimap(canvas, map);
    this.toastTimer = null;
    this.bannerTimer = null;
    this.shownCoins = state.save.coins;
  }

  show(on) {
    this.root.hidden = !on;
  }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  // Big slam-in text, e.g. "MISSION COMPLETE", "BUSTED!".
  bannerText(text, cls = '', ms = 2000) {
    this.banner.className = `banner ${cls}`;
    this.banner.textContent = text;
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add('slam');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.add('hidden'), ms);
  }

  bumpCoins() {
    this.coins.classList.remove('bump');
    void this.coins.offsetWidth;
    this.coins.classList.add('bump');
  }

  // s: { heat, pursuit, mission (MissionRunner|null), speedMph|null, cans, cansTotal, map view }
  update(s) {
    // Count coins up smoothly so pickups feel rewarding.
    const target = state.save.coins;
    if (this.shownCoins !== target) {
      const step = Math.max(1, Math.ceil(Math.abs(target - this.shownCoins) * 0.15));
      this.shownCoins += Math.sign(target - this.shownCoins) * Math.min(step, Math.abs(target - this.shownCoins));
    }
    setText(this.coins.lastChild, String(this.shownCoins));
    setText(this.cansEl.lastChild, `${s.cans}/${s.cansTotal}`);

    const lvl = Math.round(s.heat * 20) / 20;
    if (this.heatFill._lvl !== lvl) { this.heatFill._lvl = lvl; this.heatFill.style.transform = `scaleX(${lvl})`; }
    setClass(this.heat, 'hot', s.heat > 0.6);
    setClass(this.heat, 'pursuit', s.pursuit);

    const m = s.mission;
    setFlag(this.mission, 'hidden', !m);
    if (m) {
      setText(this.missionTitle, m.def.title);
      setText(this.objective, m.run.objective());
      setText(this.timer, formatTimer(m.run.timeLeft));
      setClass(this.timer, 'low', m.run.timeLeft < 10);
    }

    setFlag(this.speedo, 'hidden', s.speedMph === null);
    if (s.speedMph !== null) setText(this.speedo.firstChild, String(s.speedMph));

    this.minimap.draw(s.view);
  }
}
