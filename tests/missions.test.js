import { describe, it, expect } from 'vitest';
import missions from '../src/data/missions.json';
import placesConfig from '../src/config/places.json';
import { MissionRun, validateMissions, formatTimer, stageGoal } from '../src/missions/logic.js';

const placeKeys = Object.keys(placesConfig).filter((k) => !k.startsWith('_'));

describe('mission data', () => {
  it('is valid', () => {
    expect(validateMissions(missions, placeKeys)).toEqual([]);
  });

  it('catches mistakes', () => {
    const bad = [{ id: 'x', start: 'mars', stages: [{ type: 'reach', target: 'nowhere', time: 0 }] }];
    expect(validateMissions(bad, placeKeys).length).toBeGreaterThanOrEqual(3);
  });

  it('every mission has a title, brief, sender and reward', () => {
    for (const m of missions) {
      expect(m.title && m.brief && m.from).toBeTruthy();
      expect(m.reward).toBeGreaterThan(0);
    }
  });
});

describe('MissionRun', () => {
  const def = {
    id: 't',
    stages: [
      { type: 'reach', target: 'wawa', time: 30, text: 'Go' },
      { type: 'smash', count: 3, time: 20, text: 'Smash' },
    ],
  };

  it('moves through stages and completes', () => {
    const r = new MissionRun(def);
    expect(r.objective()).toBe('Go');
    r.advance();
    expect(r.stageIndex).toBe(1);
    expect(r.timeLeft).toBe(20); // each stage gets its own timer
    expect(r.objective()).toBe('Smash 0/3');
    r.advance();
    r.advance();
    expect(r.status).toBe('active');
    r.advance();
    expect(r.status).toBe('complete');
  });

  it('fails when time runs out, and ignores progress afterward', () => {
    const r = new MissionRun(def);
    r.tick(29);
    expect(r.status).toBe('active');
    r.tick(2);
    expect(r.status).toBe('failed');
    expect(r.failReason).toBe('time');
    r.advance();
    expect(r.stageIndex).toBe(0);
  });

  it('tracks total elapsed time for best times', () => {
    const r = new MissionRun(def);
    r.tick(5);
    r.advance();
    r.tick(3);
    expect(r.elapsed).toBeCloseTo(8);
  });

  it('goal per stage type', () => {
    expect(stageGoal({ type: 'reach' })).toBe(1);
    expect(stageGoal({ type: 'collect', count: 8 })).toBe(8);
    expect(stageGoal({ type: 'pursuit', hits: 3 })).toBe(3);
  });

  it('formats timers', () => {
    expect(formatTimer(100)).toBe('1:40');
    expect(formatTimer(9.2)).toBe('0:10');
    expect(formatTimer(-3)).toBe('0:00');
  });
});
