// Placeholder pixel art generated at startup (no image files yet).
// Each sprite is a grid of palette characters; "." is transparent.
import { state } from '../state.js';

const PALETTE = {
  H: '#3b2a1e', // hair
  S: '#e8b896', // skin
  B: '#5a3a24', // beard
  E: '#1d1d1d', // eyes
  K: '#15171c', // black uniform
  W: '#d9dde3', // silver star badge
  D: '#2b2b2b', // belt
  G: '#d4a640', // gold belt badge
  P: '#23262d', // pants
  O: '#0b0b0b', // shoes
  R: '#e5392b', // red phone grip
};

const TYLER_TOP = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SESSSSES..',
  '..SSSSSSSS..',
  '..BSSSSSSB..',
  '..BBSSSSBB..',
  '...BBBBBB...',
  '....KSSK....',
  '.KKKKKKKKKK.',
  'KKKKKKKKWKKK',
  'KKKKKKKWWWKK',
  'KKKKKKKKWKKK',
  'SKKKKKKKKKKS',
  'SKKKKKKKKKKR',
  'SKDDDDDDGDKS',
];
const LEGS_A = ['..PPPPPPPP..', '..PPP..PPP..', '..PPP..PPP..', '..OOO..OOO..'];
const LEGS_B = ['..PPPPPPPP..', '..PPP..PPP..', '...PP..PPP..', '...OO..OOO..'];

function drawGrid(scene, key, rows, px) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle(Number.parseInt(PALETTE[ch].slice(1), 16), 1);
      g.fillRect(x * px, y * px, px, px);
    });
  });
  g.generateTexture(key, rows[0].length * px, rows.length * px);
  g.destroy();
}

function hex(c) {
  return Number.parseInt(c.slice(1), 16);
}

function drawCar(scene, key, { body, roof, w = 30, h = 52, patrol = false }) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x111111, 1).fillRect(0, 6, 4, 10).fillRect(w - 4, 6, 4, 10).fillRect(0, h - 16, 4, 10).fillRect(w - 4, h - 16, 4, 10);
  g.fillStyle(body, 1).fillRect(3, 0, w - 6, h);
  if (patrol) {
    g.fillStyle(hex(state.config.patrolCar.doorColor), 1).fillRect(3, 16, w - 6, 18);
    g.fillStyle(0x333333, 1).fillRect(5, h - 3, w - 10, 3); // push bumper at rear
    g.fillStyle(0x444444, 1).fillRect(6, 0, w - 12, 3); // push bumper front
  }
  g.fillStyle(0x9fd3ff, 1).fillRect(6, 9, w - 12, 6); // windshield
  g.fillStyle(roof, 1).fillRect(6, 16, w - 12, 18);
  g.fillStyle(0x7fb3df, 1).fillRect(6, 34, w - 12, 4); // rear window
  if (patrol) {
    g.fillStyle(0xff2a2a, 1).fillRect(6, 22, (w - 12) / 2, 4);
    g.fillStyle(0x2a5bff, 1).fillRect(w / 2, 22, (w - 12) / 2, 4);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene) {
  if (scene.textures.exists('tyler0')) return;
  drawGrid(scene, 'tyler0', [...TYLER_TOP, ...LEGS_A], 2);
  drawGrid(scene, 'tyler1', [...TYLER_TOP, ...LEGS_B], 2);

  const pc = state.config.patrolCar;
  drawCar(scene, 'patrol', { body: hex(pc.bodyColor), roof: hex(pc.doorColor), patrol: true });
  drawCar(scene, 'carRed', { body: 0xc0392b, roof: 0xa93226 });
  drawCar(scene, 'carBlue', { body: 0x2e86c1, roof: 0x21618c });
  drawCar(scene, 'carSilver', { body: 0xaab7b8, roof: 0x909b9c });
  drawCar(scene, 'pickup', { body: 0x7d5a3c, roof: 0x6b4c33, h: 58 });
  drawCar(scene, 'bus', { body: 0xf4c20d, roof: 0xe0b000, w: 34, h: 96 });

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x2d2d2d, 1).fillEllipse(14, 9, 28, 18);
  g.fillStyle(0x1a1a1a, 1).fillEllipse(14, 10, 18, 10);
  g.generateTexture('pothole', 28, 18);
  g.clear();
  // Pine tree
  g.fillStyle(0x5b3a1e, 1).fillRect(10, 26, 4, 8);
  g.fillStyle(0x1e5631, 1).fillTriangle(12, 0, 0, 18, 24, 18);
  g.fillStyle(0x2a7a44, 1).fillTriangle(12, 8, 1, 28, 23, 28);
  g.generateTexture('pine', 24, 34);
  g.destroy();
}
