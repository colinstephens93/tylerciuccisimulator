// All sound is synthesized with the Web Audio API (original chiptune, no files to load).
import { state } from './state.js';

let ctx = null;
let master;
let musicGain;
let sfxGain;
let ducked = false;

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function noteFreq(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const midi = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// Original loops. Each token is one eighth-note step; "." is a rest.
const TRACKS = {
  title: {
    bpm: 140, leadWave: 'square',
    lead: 'C5 . E5 G5 A5 . G5 E5 D5 . E5 G5 C6 . A5 . G5 . E5 D5 C5 . D5 E5 G5 . E5 . D5 . C5 .',
    bass: 'C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 . C3 . G3 . C3 . G2 .',
  },
  walk: {
    bpm: 104, leadWave: 'triangle',
    lead: 'E5 . . G5 . . A5 . G5 . E5 . D5 . . . C5 . . D5 . . E5 . G5 . E5 . D5 . . .',
    bass: 'C3 . . . G2 . . . A2 . . . F2 . . . C3 . . . G2 . . . F2 . . . G2 . . .',
  },
  drive: {
    bpm: 160, leadWave: 'square',
    lead: 'A4 C5 E5 A5 G5 E5 C5 E5 F4 A4 C5 F5 E5 C5 A4 C5 G4 B4 D5 G5 F5 D5 B4 D5 E4 G#4 B4 E5 D5 B4 G#4 B4',
    bass: 'A2 . A3 A2 . A2 A3 . F2 . F3 F2 . F2 F3 . G2 . G3 G2 . G2 G3 . E2 . E3 E2 . E2 E3 .',
  },
  wawa: {
    bpm: 112, leadWave: 'triangle',
    lead: 'G4 . B4 . D5 . B4 . C5 . E5 . G5 . E5 . A4 . C5 . E5 . C5 . D5 . F#5 . A5 . . .',
    bass: 'G2 . . . D3 . . . C3 . . . G2 . . . A2 . . . E3 . . . D3 . . . D2 . . .',
  },
};

const music = { track: null, step: 0, nextTime: 0, timer: null, tempo: 1 };

function tone(freq, dur, { type = 'square', vol = 0.5, slideTo = null, delay = 0, dest = sfxGain } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.4, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(g).connect(sfxGain);
  src.start(t);
}

const SFX = {
  tap: () => tone(880, 0.05, { vol: 0.25 }),
  carDoor: () => { noise(0.08, { vol: 0.5 }); tone(90, 0.12, { vol: 0.5 }); },
  chime: () => { tone(1046, 0.3, { type: 'triangle' }); tone(784, 0.5, { type: 'triangle', delay: 0.25 }); },
  crash: () => { noise(0.35, { vol: 0.6 }); tone(160, 0.3, { slideTo: 50, vol: 0.5 }); },
  horn: () => { tone(400, 0.3, { vol: 0.3 }); tone(500, 0.3, { vol: 0.3 }); },
  siren: () => { for (let i = 0; i < 3; i++) tone(700, 0.45, { slideTo: 1100, vol: 0.25, delay: i * 0.45 }); },
  ready: () => [0, 0.15, 0.3].forEach((d) => tone(1320, 0.1, { vol: 0.3, delay: d })),
  cooler: () => { noise(0.15, { vol: 0.25 }); tone(220, 0.2, { type: 'triangle', vol: 0.3 }); },
  gulp: () => { noise(0.05, { vol: 0.4 }); tone(320, 0.12, { slideTo: 140, delay: 0.15 }); tone(300, 0.12, { slideTo: 130, delay: 0.35 }); },
  register: () => { tone(1500, 0.08, { vol: 0.3 }); tone(1500, 0.08, { vol: 0.3, delay: 0.12 }); },
  bell: () => { for (let i = 0; i < 20; i++) tone(i % 2 ? 1250 : 1180, 0.05, { vol: 0.25, delay: i * 0.05 }); },
  ring: () => [0, 0.12, 0.24, 0.36].forEach((d, i) => tone(i % 2 ? 1600 : 1300, 0.1, { vol: 0.25, delay: d })),
  ding: () => tone(1568, 0.4, { type: 'triangle', vol: 0.4 }),
  win: () => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(noteFreq(n), 0.2, { vol: 0.35, delay: i * 0.12 })),
  tardy: () => ['G4', 'F#4', 'F4', 'E4'].forEach((n, i) => tone(noteFreq(n), i === 3 ? 0.8 : 0.3, { type: 'triangle', vol: 0.4, delay: i * 0.3 })),
};

function schedule() {
  const tr = TRACKS[music.track];
  if (!tr) return;
  const lead = tr.lead.split(' ');
  const bass = tr.bass.split(' ');
  const stepDur = 60 / (tr.bpm * music.tempo) / 2;
  while (music.nextTime < ctx.currentTime + 0.12) {
    const i = music.step % lead.length;
    const delay = Math.max(0, music.nextTime - ctx.currentTime);
    if (lead[i] !== '.') tone(noteFreq(lead[i]), stepDur * 0.9, { type: tr.leadWave, vol: 0.35, delay, dest: musicGain });
    const b = bass[i % bass.length];
    if (b !== '.') tone(noteFreq(b), stepDur * 1.6, { type: 'triangle', vol: 0.5, delay, dest: musicGain });
    music.nextTime += stepDur;
    music.step++;
  }
}

export const audio = {
  // Must be called from a tap: mobile browsers block audio until then.
  unlock() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      master = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      master.connect(ctx.destination);
      musicGain.connect(master);
      sfxGain.connect(master);
      this.applySettings();
    }
    if (ctx.state === 'suspended') ctx.resume();
  },

  applySettings() {
    if (!ctx) return;
    musicGain.gain.value = state.settings.music ? 0.16 * (ducked ? 0.3 : 1) : 0;
    sfxGain.gain.value = state.settings.sfx ? 0.45 : 0;
  },

  sfx(name) {
    if (ctx && SFX[name]) SFX[name]();
  },

  playMusic(name) {
    if (!ctx || music.track === name) return;
    this.stopMusic();
    music.track = name;
    music.step = 0;
    music.tempo = 1;
    music.nextTime = ctx.currentTime + 0.05;
    music.timer = setInterval(schedule, 25);
  },

  stopMusic() {
    clearInterval(music.timer);
    music.timer = null;
    music.track = null;
  },

  setTempo(scale) {
    music.tempo = scale;
  },

  duck(on) {
    ducked = on;
    this.applySettings();
  },
};
