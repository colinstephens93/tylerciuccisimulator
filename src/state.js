// Saved progress (coins, hidden Ghost cans, mission records) and settings, in localStorage.
import config from './config/game.config.json';

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
    /* storage unavailable: progress just won't persist */
  }
}

const FRESH = () => ({ coins: 0, cans: [], missions: {}, seenIntro: false });

export const state = {
  config,
  settings: load('tcs.settings', { music: true, sfx: true }),
  save: load('tcs.save', FRESH()),

  saveSettings() {
    save('tcs.settings', this.settings);
  },

  persist() {
    save('tcs.save', this.save);
  },

  addCoins(n) {
    this.save.coins = Math.max(0, this.save.coins + n);
    this.dirty = true;
  },

  collectCan(id) {
    if (this.save.cans.includes(id)) return false;
    this.save.cans.push(id);
    this.persist();
    return true;
  },

  // Returns true if this is a new best time.
  recordMission(id, seconds) {
    const rec = this.save.missions[id] || { done: 0, best: null };
    rec.done++;
    const isBest = rec.best === null || seconds < rec.best;
    if (isBest) rec.best = Math.round(seconds * 10) / 10;
    this.save.missions[id] = rec;
    this.persist();
    return isBest;
  },

  resetSave() {
    this.save = FRESH();
    this.persist();
  },
};

// Coins change often; write them out every few seconds rather than every pickup.
setInterval(() => {
  if (state.dirty) {
    state.dirty = false;
    state.persist();
  }
}, 4000);
