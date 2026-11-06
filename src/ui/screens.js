// Title screen, mission brief / result cards, and the pause menu.
import { state } from '../state.js';
import map from '../data/lawrenceville.json';
import missions from '../data/missions.json';
import { formatTimer } from '../missions/logic.js';
import { h, $ } from './dom.js';

function show(el, layer = '#screen') {
  const root = $(layer);
  root.replaceChildren(el);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  return el;
}

export function clearScreen() {
  $('#screen').replaceChildren();
}

export function loadingScreen() {
  show(h('div', { class: 'screen solid' },
    h('h1', { class: 'logo' }, 'TYLER CIUCCI', h('br'), h('span', {}, 'SIMULATOR')),
    h('div', { class: 'loading' }, `Loading ${state.config.townName}...`)));
}

export function titleScreen(onStart) {
  const s = state.save;
  const done = missions.filter((m) => s.missions[m.id]?.done).length;
  show(h('div', { class: 'screen title' },
    h('h1', { class: 'logo' }, 'TYLER CIUCCI', h('br'), h('span', {}, 'SIMULATOR')),
    h('div', { class: 'sub' }, `Free roam ${state.config.townName}, Georgia`),
    h('div', { class: 'desc' }, 'Drive anywhere, jump in any car, smash mailboxes, find hidden Ghost cans, and take on missions around town.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn gold big', onclick: onStart }, 'START SHIFT')),
    (s.coins || done) ? h('div', { class: 'fine stats' }, `${s.coins} coins · ${s.cans.length} Ghost cans · ${done}/${missions.length} missions`) : null,
    h('div', { class: 'fine' }, `${map.attribution}. A fan game for friends; not affiliated with Wawa or Ghost.`),
  ));
}

// Mission offer when the player steps into a "!" marker.
export function briefCard(def, { onAccept, onDecline }) {
  const rec = state.save.missions[def.id];
  return show(h('div', { class: 'card-wrap' },
    h('div', { class: 'brief' },
      h('div', { class: 'from' }, h('span', { class: 'avatar' }, def.from[0]), h('div', {}, h('b', {}, def.from), h('small', {}, 'Message'))),
      h('div', { class: 'bubble' }, def.brief),
      h('h2', {}, def.title),
      h('div', { class: 'meta' }, `Reward ${def.reward} coins${rec?.best ? ` · Best ${formatTimer(rec.best)}` : ''}`),
      h('div', { class: 'row2' },
        h('button', { class: 'btn', onclick: onDecline }, 'Not now'),
        h('button', { class: 'btn gold', onclick: onAccept }, 'Start')),
    )), '#overlay');
}

export function resultCard({ title, lines, primary, secondary }) {
  return show(h('div', { class: 'card-wrap' },
    h('div', { class: 'brief result' },
      h('h2', {}, title),
      ...lines.map((l) => h('div', { class: 'line' }, l)),
      h('div', { class: 'row2' },
        secondary ? h('button', { class: 'btn', onclick: secondary.onClick }, secondary.label) : null,
        h('button', { class: 'btn gold', onclick: primary.onClick }, primary.label)),
    )), '#overlay');
}

// Conversation shown one line at a time; tap to advance.
export function dialogueCard(lines, onDone) {
  let i = 0;
  const avatar = h('span', { class: 'avatar' });
  const name = h('b');
  const bubble = h('div', { class: 'bubble' });
  const next = h('button', { class: 'btn gold', onclick: () => { i++; if (i < lines.length) render(); else onDone(); } });
  const render = () => {
    const l = lines[i];
    avatar.textContent = l.who[0];
    avatar.className = `avatar ${l.who === 'Tyler' ? 'tyler' : ''}`;
    name.textContent = l.who === 'Dan' ? 'Agent Dan (ATF)' : l.who;
    bubble.textContent = l.line;
    bubble.className = `bubble ${l.who === 'Tyler' ? 'me' : ''}`;
    next.textContent = i + 1 < lines.length ? 'Next' : 'Got it';
  };
  render();
  return show(h('div', { class: 'card-wrap' },
    h('div', { class: 'brief talk' }, h('div', { class: 'from' }, avatar, h('div', {}, name, h('small', {}, 'El Cregs'))), bubble, h('div', { class: 'row2' }, next))), '#overlay');
}

export function closeCards() {
  $('#overlay').replaceChildren();
}

export function pauseMenu({ onResume, onToggle, onReset, onQuitMission, inMission }) {
  const s = state.save;
  const list = missions.map((m) => {
    const rec = s.missions[m.id];
    return h('div', { class: 'mrow' },
      h('span', { class: `check ${rec?.done ? 'on' : ''}` }),
      h('span', { class: 'mname' }, m.title),
      h('span', { class: 'mbest' }, rec?.best ? formatTimer(rec.best) : '--'));
  });
  const toggle = (key, label) => h('button', { class: `btn toggle ${state.settings[key] ? 'on' : ''}`, onclick: (e) => { onToggle(key); e.currentTarget.classList.toggle('on', state.settings[key]); } }, label);
  show(h('div', { class: 'card-wrap dim' },
    h('div', { class: 'brief pause-menu' },
      h('h2', {}, 'Paused'),
      h('div', { class: 'list' }, list),
      h('div', { class: 'meta' }, `${s.coins} coins · ${s.cans.length}/${state.config.world.hiddenCans} hidden Ghost cans`),
      h('div', { class: 'row2' }, toggle('music', 'Music'), toggle('sfx', 'Sound')),
      h('details', { class: 'help' },
        h('summary', {}, 'Controls'),
        h('p', {}, 'Left thumb: joystick (move, or steer + gas/brake in a car). Right side: action buttons. Drag the open screen to look around, pinch to zoom.'),
        h('p', {}, 'Keyboard: WASD or arrows, Space jump/drift, F kick, E get in/out, H horn, L siren.')),
      inMission ? h('button', { class: 'btn danger', onclick: onQuitMission }, 'Quit mission') : null,
      h('button', { class: 'btn small-link', onclick: () => { if (confirm('Erase coins, cans and mission records?')) onReset(); } }, 'Reset progress'),
      h('button', { class: 'btn gold', onclick: onResume }, 'Resume'),
    )), '#overlay');
}
