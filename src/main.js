import './style.css';
import { Game } from './game.js';
import { state } from './state.js';

const game = new Game();
game.load();

// Handy for debugging in the browser console.
window.__game = game;
window.__state = state;
