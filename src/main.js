import Phaser from 'phaser';
import { TitleScene } from './scenes/Title.js';
import { WalkScene } from './scenes/Walk.js';
import { DriveScene } from './scenes/Drive.js';
import { WawaScene } from './scenes/Wawa.js';
import { ResultsScene } from './scenes/Results.js';
import { HudScene } from './scenes/Hud.js';
import { PhoneScene } from './scenes/Phone.js';
import { state } from './state.js';

// Scene order = draw order: HUD and Phone are last so they render on top.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 360,
  height: 640,
  backgroundColor: '#111111',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [TitleScene, WalkScene, DriveScene, WawaScene, ResultsScene, HudScene, PhoneScene],
});

// Handy for debugging in the browser console.
window.__game = game;
window.__state = state;
