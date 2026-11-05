// Single shared game state for a run, plus saved settings.
import config from './config/game.config.json';
import { GameClock } from './logic/clock.js';
import { planCalls, CALL_TRIGGERS } from './logic/amanda.js';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

// Fields copied into a checkpoint so "Retry this scene" can rewind.
const RUN_FIELDS = [
  'inventory', 'infractions', 'amandaMood', 'declinedLast', 'callsDone',
  'showTray', 'order', 'orderCounter', 'arrivalMinutes',
];

export const state = {
  config,
  settings: load('tcs.settings', { music: true, sfx: true }),
  best: load('tcs.best', { score: 0 }),

  newRun() {
    this.clock = new GameClock(config);
    this.inventory = [];
    this.infractions = 0;
    this.amandaMood = 0;
    this.declinedLast = false;
    this.callPlan = planCalls(CALL_TRIGGERS, config.amandaCallsPerRun);
    this.callsDone = [];
    this.showTray = false;
    this.order = null;
    this.orderCounter = 40 + Math.floor(Math.random() * 50);
    this.arrivalMinutes = null;
    this.stepIndex = 0;
    this.checkpoint = null;
    this.clockRunning = false;
    this.inputLocked = false;
    this.objective = '';
  },

  saveCheckpoint() {
    const snap = { minutes: this.clock.minutes, stepIndex: this.stepIndex };
    for (const f of RUN_FIELDS) snap[f] = structuredClone(this[f]);
    this.checkpoint = snap;
  },

  restoreCheckpoint() {
    const snap = this.checkpoint;
    this.clock.minutes = snap.minutes;
    this.stepIndex = snap.stepIndex;
    for (const f of RUN_FIELDS) this[f] = structuredClone(snap[f]);
    this.inputLocked = false;
  },

  saveSettings() {
    save('tcs.settings', this.settings);
  },

  recordScore(score) {
    if (score > this.best.score) {
      this.best = { score };
      save('tcs.best', this.best);
      return true;
    }
    return false;
  },
};

state.newRun();
