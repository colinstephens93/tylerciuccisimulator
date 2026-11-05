import { describe, it, expect } from 'vitest';
import config from '../src/config/game.config.json';
import menu from '../src/data/menu.json';
import calls from '../src/data/amanda-calls.json';
import { GameClock, parseTime, formatTime } from '../src/logic/clock.js';
import { makeFood, makeGhost, goalStatus, hasUnpaid, invalidMenuItems } from '../src/logic/wawa.js';
import { computeResult } from '../src/logic/scoring.js';
import { planCalls, rollMood, applyReply, closingText, CALL_TRIGGERS } from '../src/logic/amanda.js';

describe('clock', () => {
  it('starts at 7:00 AM with the bell at 8:00 AM', () => {
    const c = new GameClock(config);
    expect(formatTime(c.minutes)).toBe('7:00 AM');
    expect(c.minutesUntilBell()).toBe(60);
  });

  it('advances at clockSpeed game-seconds per real second', () => {
    const c = new GameClock(config);
    c.tick(60000 / config.clockSpeed); // enough real time for one game minute
    expect(c.minutes).toBeCloseTo(parseTime('07:01'));
  });

  it('is late at exactly the bell', () => {
    const c = new GameClock(config);
    c.addMinutes(59.9);
    expect(c.isLate()).toBe(false);
    c.addMinutes(0.1);
    expect(c.isLate()).toBe(true);
  });
});

describe('wawa goals', () => {
  const goals = config.wawaGoals;

  it('every menu food item is at least 500 calories', () => {
    expect(invalidMenuItems(menu, config.minCaloriesPerFoodItem)).toEqual([]);
  });

  it('one food item is not enough; two always are', () => {
    const one = [makeFood(menu.food[0])];
    expect(goalStatus(one, goals).foodMet).toBe(false);
    const two = [makeFood(menu.food[1]), makeFood(menu.food[1])];
    expect(goalStatus(two, goals).foodMet).toBe(true);
  });

  it('one Ghost can meets the caffeine goal and drinks add no food calories', () => {
    const inv = [makeGhost('Root Beer', config.ghostCaffeineMg)];
    const s = goalStatus(inv, goals);
    expect(s.caffeineMet).toBe(true);
    expect(s.calories).toBe(0);
  });

  it('tracks unpaid items', () => {
    const inv = [makeFood(menu.food[0])];
    expect(hasUnpaid(inv)).toBe(true);
    inv[0].paid = true;
    expect(hasUnpaid(inv)).toBe(false);
  });
});

describe('scoring', () => {
  const base = {
    arrivalMinutes: parseTime('07:50'),
    bellMinutes: parseTime('08:00'),
    calories: 1100,
    caffeineMg: 300,
    goals: config.wawaGoals,
    gotFavorite: true,
    infractions: 0,
    amandaMood: 0,
  };

  it('arriving at or after the bell is a fail', () => {
    expect(computeResult({ ...base, arrivalMinutes: parseTime('08:00') }).onTime).toBe(false);
    expect(computeResult({ ...base, arrivalMinutes: null }).onTime).toBe(false);
  });

  it('under 1,000 calories gives a lower, non-perfect score', () => {
    const full = computeResult(base);
    const light = computeResult({ ...base, calories: 560 });
    expect(full.perfect).toBe(true);
    expect(light.perfect).toBe(false);
    expect(light.score).toBeLessThan(full.score);
  });

  it('extra caffeine has no penalty', () => {
    expect(computeResult({ ...base, caffeineMg: 900 }).score).toBe(computeResult(base).score);
  });

  it('infractions cost points', () => {
    expect(computeResult({ ...base, infractions: 2 }).score).toBe(computeResult(base).score - 100);
  });
});

describe('amanda', () => {
  it('plans 3 to 4 distinct calls', () => {
    for (let i = 0; i < 50; i++) {
      const plan = planCalls(CALL_TRIGGERS, config.amandaCallsPerRun);
      expect(plan.length).toBeGreaterThanOrEqual(3);
      expect(plan.length).toBeLessThanOrEqual(4);
      expect(new Set(plan).size).toBe(plan.length);
    }
  });

  it('declining makes grumpy more likely', () => {
    const r = () => 0.66; // just past happy (0.35) + grumpy (0.30)
    expect(rollMood(0, false, r)).toBe('neutral');
    expect(rollMood(0, true, r)).toBe('grumpy');
  });

  it('mood is clamped and every mood has calls with replies', () => {
    expect(applyReply(3, 1)).toBe(3);
    expect(applyReply(-3, -1)).toBe(-3);
    for (const mood of ['happy', 'neutral', 'grumpy']) {
      expect(calls[mood].length).toBeGreaterThan(0);
      for (const c of calls[mood]) expect(c.replies.length).toBeGreaterThanOrEqual(2);
    }
    expect(closingText(2, calls.closing)).toBe(calls.closing.high);
  });
});
