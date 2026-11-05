// The ordered steps of "The Morning Run" and helpers to move between them.
import { state } from './state.js';

let game = null;
export function bindGame(g) {
  game = g;
}

export const STEPS = [
  { mode: 'walk', data: { location: 'home' }, objective: 'Walk to your patrol car' },
  { mode: 'drive', data: { route: 'toWawa' }, objective: 'Drive to Wawa' },
  { mode: 'walk', data: { location: 'wawaLot' }, objective: 'Walk into Wawa' },
  { mode: 'wawa', data: {}, objective: 'Get 1,000+ cal of food and a Ghost' },
  { mode: 'drive', data: { route: 'toSchool' }, objective: 'Drive to school before the bell' },
  { mode: 'walk', data: { location: 'school' }, objective: 'Get to the front door' },
];

// Mode changes run outside the frame update so a mode never tears itself down mid-update.
const later = (fn) => setTimeout(fn, 0);

export function startStep(index) {
  later(() => {
    const step = STEPS[index];
    state.stepIndex = index;
    state.objective = step.objective;
    state.inputLocked = false;
    state.saveCheckpoint();
    state.clockRunning = true;
    game.enterStep(step);
  });
}

export function nextStep() {
  if (state.stepIndex + 1 >= STEPS.length) finishRun(false);
  else startStep(state.stepIndex + 1);
}

export function finishRun(tardy) {
  state.clockRunning = false;
  later(() => game.showResults(tardy));
}

// Ring Amanda at this moment if she is planned to call here.
export function maybeCall(trigger, { handsFree = false, delay = 600 } = {}) {
  if (!state.callPlan.includes(trigger) || state.callsDone.includes(trigger)) return;
  state.callsDone.push(trigger);
  setTimeout(() => {
    if (!state.clockRunning || game.phone.active) return;
    game.phone.ring(handsFree);
  }, delay);
}

export function toast(message) {
  game.hud.toast(message);
}
