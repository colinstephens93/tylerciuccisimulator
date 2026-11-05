// The ordered list of scenes in "The Morning Run" and helpers to move between them.
import { state } from './state.js';

export const STEPS = [
  { key: 'Walk', data: { location: 'home' }, objective: 'Walk to your patrol car' },
  { key: 'Drive', data: { route: 'toWawa' }, objective: 'Drive to Wawa' },
  { key: 'Walk', data: { location: 'wawaLot' }, objective: 'Walk into Wawa' },
  { key: 'Wawa', data: {}, objective: 'Get 1,000+ cal of food and a Ghost' },
  { key: 'Drive', data: { route: 'toSchool' }, objective: 'Drive to school before 8:00' },
  { key: 'Walk', data: { location: 'school' }, objective: 'Get to the front door' },
];

const GAMEPLAY = ['Title', 'Walk', 'Drive', 'Wawa', 'Results', 'Phone'];

function stopAll(manager, keys) {
  for (const k of keys) {
    if (manager.isActive(k) || manager.isPaused(k) || manager.isSleeping(k)) manager.stop(k);
  }
}

// Scene changes run between frames, so a scene is never shut down while its own update is running.
function betweenFrames(fn) {
  setTimeout(fn, 0);
}

export function startStep(game, index) {
  betweenFrames(() => doStartStep(game, index));
}

function doStartStep(game, index) {
  const step = STEPS[index];
  state.stepIndex = index;
  state.objective = step.objective;
  state.inputLocked = false;
  state.saveCheckpoint();
  state.clockRunning = true;
  const m = game.scene;
  stopAll(m, GAMEPLAY);
  m.start(step.key, { ...step.data });
  if (!m.isActive('Hud')) m.start('Hud');
}

export function nextStep(game) {
  if (state.stepIndex + 1 >= STEPS.length) finishRun(game, false);
  else startStep(game, state.stepIndex + 1);
}

export function finishRun(game, tardy) {
  state.clockRunning = false;
  betweenFrames(() => doFinishRun(game, tardy));
}

function doFinishRun(game, tardy) {
  const m = game.scene;
  stopAll(m, [...GAMEPLAY, 'Hud']);
  m.start('Results', { tardy });
}

// Ring Amanda at this moment if she is planned to call here.
export function maybeCall(game, trigger, { handsFree = false, delay = 600 } = {}) {
  if (!state.callPlan.includes(trigger) || state.callsDone.includes(trigger)) return;
  state.callsDone.push(trigger);
  setTimeout(() => {
    if (!state.clockRunning || game.scene.isActive('Phone')) return;
    game.scene.start('Phone', { handsFree });
  }, delay);
}

export function toast(game, message) {
  game.events.emit('toast', message);
}
