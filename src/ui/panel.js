// Modal panels (kiosk, cooler, confirmations).
import { h, $ } from './dom.js';

export function openPanel({ title, body = '', items = [] }) {
  const overlay = $('#overlay');
  const close = () => back.remove();
  const list = h('div', { class: 'list' });
  for (const it of items) {
    list.append(h('button', { class: `btn ${it.style || ''}`, onclick: () => it.onClick(close) },
      it.right ? h('div', { class: 'row' }, h('span', {}, it.label), h('span', { class: 'kcal' }, it.right)) : it.label,
      it.sub ? h('small', {}, it.sub) : null));
  }
  const panel = h('div', { class: 'panel' }, h('h2', {}, title), body ? h('p', {}, body) : null, list);
  const back = h('div', { class: 'backdrop' }, panel);
  back.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.append(back);
  return { close, setBody: (t) => { const p = panel.querySelector('p'); if (p) p.textContent = t; } };
}
