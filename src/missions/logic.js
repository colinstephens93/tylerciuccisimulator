// Mission rules: stages, timers and progress. Pure module (no Three.js), unit tested.
// The 3D side (beacons, spawned targets) lives in missions/runner.js.

export const STAGE_TYPES = ['reach', 'collect', 'smash', 'pursuit'];

export function stageGoal(stage) {
  if (stage.type === 'reach') return 1;
  if (stage.type === 'pursuit') return stage.hits;
  return stage.count;
}

export class MissionRun {
  constructor(def) {
    this.def = def;
    this.stageIndex = 0;
    this.status = 'active'; // active | complete | failed
    this.failReason = null;
    this.elapsed = 0;
    this.stageChanged = true;
    this.startStage();
  }

  get stage() {
    return this.def.stages[this.stageIndex];
  }

  get goal() {
    return stageGoal(this.stage);
  }

  startStage() {
    this.progress = 0;
    this.timeLeft = this.stage.time;
    this.stageChanged = true;
  }

  tick(dt) {
    if (this.status !== 'active') return;
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fail('time');
    }
  }

  // Record progress on the current stage (a reach, a pickup, a smash, a hit).
  advance(n = 1) {
    if (this.status !== 'active') return;
    this.progress = Math.min(this.goal, this.progress + n);
    if (this.progress < this.goal) return;
    if (this.stageIndex + 1 < this.def.stages.length) {
      this.stageIndex++;
      this.startStage();
    } else {
      this.status = 'complete';
    }
  }

  fail(reason) {
    if (this.status !== 'active') return;
    this.status = 'failed';
    this.failReason = reason;
  }

  // Text for the objective pill, e.g. "Collect Ghost cans 3/8".
  objective() {
    const s = this.stage;
    const count = s.type === 'reach' ? '' : ` ${this.progress}/${this.goal}`;
    return `${s.text}${count}`;
  }
}

export function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Validates mission data so bad edits are caught by the tests, not by players.
export function validateMissions(missions, placeKeys) {
  const errors = [];
  const ids = new Set();
  for (const m of missions) {
    if (!m.id || ids.has(m.id)) errors.push(`duplicate or missing id: ${m.id}`);
    ids.add(m.id);
    if (!placeKeys.includes(m.start)) errors.push(`${m.id}: unknown start ${m.start}`);
    if (!m.stages?.length) errors.push(`${m.id}: no stages`);
    for (const s of m.stages || []) {
      if (!STAGE_TYPES.includes(s.type)) errors.push(`${m.id}: bad stage type ${s.type}`);
      if (!(s.time > 0)) errors.push(`${m.id}: stage needs a time`);
      if (s.type === 'reach' && !placeKeys.includes(s.target)) errors.push(`${m.id}: unknown target ${s.target}`);
      if ((s.type === 'collect' || s.type === 'smash') && !(s.count > 0)) errors.push(`${m.id}: stage needs a count`);
      if (s.type === 'pursuit' && !(s.hits > 0)) errors.push(`${m.id}: stage needs hits`);
    }
  }
  return errors;
}
