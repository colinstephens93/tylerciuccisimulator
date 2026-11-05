// Amanda's phone calls: which moments she calls at, and what mood she is in.

export const CALL_TRIGGERS = ['homeWalk', 'driveWawa', 'wawaOrder', 'driveSchool', 'schoolWalk'];
export const MOOD_MIN = -3;
export const MOOD_MAX = 3;

// Pick which trigger points will ring this run.
export function planCalls(triggers, [min, max], rng = Math.random) {
  const count = Math.min(triggers.length, min + Math.floor(rng() * (max - min + 1)));
  const pool = [...triggers];
  const chosen = [];
  while (chosen.length < count) {
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return chosen;
}

// Her mood is a surprise until answered. Better running mood = more likely happy;
// declining the last call makes grumpy more likely.
export function rollMood(moodScore, declinedLast, rng = Math.random) {
  const clamp = (v) => Math.max(0.05, Math.min(0.9, v));
  const happy = clamp(0.35 + 0.1 * moodScore - (declinedLast ? 0.2 : 0));
  const grumpy = clamp(0.3 - 0.1 * moodScore + (declinedLast ? 0.25 : 0));
  const r = rng();
  if (r < happy) return 'happy';
  if (r < happy + grumpy) return 'grumpy';
  return 'neutral';
}

export function applyReply(moodScore, delta) {
  return Math.max(MOOD_MIN, Math.min(MOOD_MAX, moodScore + delta));
}

export function closingText(moodScore, closing) {
  if (moodScore >= 1) return closing.high;
  if (moodScore <= -1) return closing.low;
  return closing.mid;
}
