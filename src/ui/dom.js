// Tiny DOM helpers.
import { audio } from '../audio.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'onclick') el.addEventListener('click', (e) => { audio.sfx('tap'); v(e); });
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const $ = (sel) => document.querySelector(sel);

// Only touch the DOM when a value actually changes. Rewriting text or classes every
// frame forces the browser to redo layout 60 times a second, which stutters on phones.
export function setText(el, text) {
  if (el._text !== text) { el._text = text; el.textContent = text; }
}
export function setHTML(el, html) {
  if (el._html !== html) { el._html = html; el.innerHTML = html; }
}
export function setFlag(el, prop, value) {
  if (el[prop] !== value) el[prop] = value;
}
export function setClass(el, cls, on) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}
