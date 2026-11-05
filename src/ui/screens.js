// Title, results and tardy screens.
import { state } from '../state.js';
import calls from '../data/amanda-calls.json';
import map from '../data/lawrenceville.json';
import { formatTime, parseTime } from '../logic/clock.js';
import { closingText } from '../logic/amanda.js';
import { h, $ } from './dom.js';

function show(el) {
  const root = $('#screen');
  root.replaceChildren(el);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
}

export function clearScreen() {
  $('#screen').replaceChildren();
}

export function loadingScreen() {
  show(h('div', { class: 'screen solid' }, h('h1', {}, 'TYLER CIUCCI', h('br'), 'SIMULATOR'), h('div', { class: 'loading' }, `Loading ${state.config.townName}...`)));
}

export function titleScreen(onStart) {
  const cfg = state.config;
  show(h('div', { class: 'screen' },
    h('h1', {}, 'TYLER CIUCCI', h('br'), 'SIMULATOR'),
    h('div', { class: 'sub' }, 'The Morning Run'),
    h('div', { class: 'desc' }, `${cfg.townName}, Georgia. Grab breakfast and a Ghost at Wawa, then beat the ${formatTime(parseTime(cfg.firstBell))} bell.`),
    h('div', { class: 'actions' }, h('button', { class: 'btn gold', onclick: onStart }, 'Start shift')),
    state.best.score ? h('div', { class: 'fine' }, `Best score: ${state.best.score}`) : null,
    h('div', { class: 'fine' }, `Drag to look around · pinch to zoom · tap to walk`),
    h('div', { class: 'fine' }, `${map.attribution}. Fan game for friends; not affiliated with Wawa or Ghost.`),
  ));
}

export function tardyScreen({ stepName, onRetry, onRestart }) {
  show(h('div', { class: 'screen solid' },
    h('h1', { class: 'red' }, 'TARDY'),
    h('div', { class: 'desc' }, `The first bell rang at ${formatTime(state.clock.bell)} and Deputy Ciucci wasn't at the door.`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: onRetry }, 'Retry this part', h('small', {}, stepName)),
      h('button', { class: 'btn', onclick: onRestart }, 'Start over')),
  ));
}

export function resultsScreen({ result, isBest, onRestart }) {
  const rows = result.lines.map((l) => h('div', { class: 'r' }, h('span', {}, `${l.label} (${l.detail})`), h('span', { class: l.points >= 0 ? 'pos' : 'neg' }, `${l.points >= 0 ? '+' : ''}${l.points}`)));
  const share = h('button', { class: 'btn', onclick: async () => {
    const text = `I got ${result.score} ("${result.title}") in Tyler Ciucci Simulator.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Tyler Ciucci Simulator', text, url: location.href });
      else { await navigator.clipboard.writeText(`${text} ${location.href}`); share.textContent = 'Copied!'; }
    } catch { /* cancelled */ }
  } }, 'Share');
  show(h('div', { class: 'screen solid' },
    h('h1', {}, 'MADE IT!'),
    h('div', { class: 'sub' }, `Arrived ${formatTime(state.arrivalMinutes)} at ${state.config.schoolName}`),
    h('div', { class: 'score-table' }, rows),
    h('div', { class: 'big-score' }, `${result.score}${isBest ? ' · new best!' : ''}`),
    h('div', { class: 'sub' }, `${result.title}${result.perfect ? ' · Perfect morning' : ''}`),
    h('div', { class: 'amanda-text' }, closingText(state.amandaMood, calls.closing)),
    h('div', { class: 'actions' }, h('button', { class: 'btn gold', onclick: onRestart }, 'Play again'), share),
  ));
}
