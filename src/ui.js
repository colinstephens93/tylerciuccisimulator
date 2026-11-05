// Small UI helpers shared by scenes.
import { audio } from './audio.js';

export const FONT = { fontFamily: 'monospace', color: '#ffffff' };

export function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const { fill = 0x2b2f3a, stroke = 0xffffff, size = 14, color = '#ffffff', fixed = true, depth = 100 } = opts;
  const rect = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke).setDepth(depth);
  const text = scene.add.text(x, y, label, { ...FONT, fontSize: `${size}px`, color, align: 'center', wordWrap: { width: w - 10 } })
    .setOrigin(0.5).setDepth(depth + 1);
  if (fixed) {
    rect.setScrollFactor(0);
    text.setScrollFactor(0);
  }
  rect.setInteractive({ useHandCursor: true });
  rect.on('pointerdown', (p, lx, ly, ev) => {
    ev?.stopPropagation?.();
    audio.sfx('tap');
    onClick();
  });
  return { rect, text, destroy() { rect.destroy(); text.destroy(); }, setVisible(v) { rect.setVisible(v); text.setVisible(v); } };
}

// A modal panel with a title, body text and a list of buttons. Returns a close() handle.
export function panel(scene, { title, body = '', buttons = [], width = 320, top = 120 }) {
  const parts = [];
  const blocker = scene.add.rectangle(180, 320, 360, 640, 0x000000, 0.55).setScrollFactor(0).setDepth(2000).setInteractive();
  parts.push(blocker);
  const btnH = 40;
  const bodyText = scene.add.text(180, top + 44, body, { ...FONT, fontSize: '13px', align: 'center', wordWrap: { width: width - 30 } })
    .setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
  const height = 70 + bodyText.height + buttons.length * (btnH + 8) + 10;
  parts.push(scene.add.rectangle(180, top + height / 2, width, height, 0x1b1e26).setStrokeStyle(2, 0xf4c20d).setScrollFactor(0).setDepth(2001));
  parts.push(scene.add.text(180, top + 18, title, { ...FONT, fontSize: '16px', color: '#f4c20d' }).setOrigin(0.5).setScrollFactor(0).setDepth(2002));
  parts.push(bodyText);
  let y = top + 60 + bodyText.height + btnH / 2;
  const handle = { close() { parts.forEach((p) => p.destroy()); } };
  for (const b of buttons) {
    parts.push(button(scene, 180, y, width - 40, btnH, b.label, () => b.onClick(handle), { depth: 2003, fill: b.fill ?? 0x2b2f3a, size: 13 }));
    y += btnH + 8;
  }
  return handle;
}
