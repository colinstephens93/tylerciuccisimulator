// "Heat" meter: chaos fills it, calm drains it. When it fills, Sarge comes after you.
// Pure module, unit tested.

export const HEAT_MAX = 100;
export const HEAT_FOR = { prop: 3, ped: 14, crash: 9, carjack: 18, kick: 2 };
const CALM_DELAY = 3; // seconds without chaos before the meter drains
const DRAIN = 6; // per second

export class Heat {
  constructor() {
    this.reset();
  }

  reset() {
    this.value = 0;
    this.calm = 0;
    this.pursuit = false;
  }

  add(kind) {
    this.value = Math.min(HEAT_MAX, this.value + (HEAT_FOR[kind] ?? 0));
    this.calm = 0;
    if (this.value >= HEAT_MAX) this.pursuit = true;
  }

  // escaped: true while the pursuer is far away (or there is none). Returns 'ended'
  // on the frame a pursuit ends because the meter drained.
  tick(dt, escaped = true) {
    this.calm += dt;
    const draining = this.pursuit ? escaped : this.calm > CALM_DELAY;
    if (draining) this.value = Math.max(0, this.value - DRAIN * dt);
    if (this.pursuit && this.value <= 0) {
      this.pursuit = false;
      return 'ended';
    }
    return null;
  }

  get level() {
    return this.value / HEAT_MAX;
  }
}

// Fine for getting busted by Sarge.
export function bustedFine(coins) {
  return Math.min(coins, Math.max(10, Math.round(coins * 0.1)));
}
