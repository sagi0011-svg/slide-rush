import { describe, expect, it } from 'vitest';
import { SIM, SPEED } from '../src/config';
import { createRunState, forwardSpeed, PLACEHOLDER_SPIN_RATE, stepRun } from '../src/game/state';

describe('createRunState', () => {
  it('starts a run at zero with the given seed', () => {
    const state = createRunState(321);
    expect(state.elapsed).toBe(0);
    expect(state.ticks).toBe(0);
    expect(state.spin).toBe(0);
    expect(state.previousSpin).toBe(0);
    expect(state.rng.seed).toBe(321);
  });
});

describe('stepRun', () => {
  it('advances the clock by one fixed tick', () => {
    const state = createRunState(1);
    stepRun(state);
    expect(state.ticks).toBe(1);
    expect(state.elapsed).toBeCloseTo(SIM.dt, 10);
  });

  it('reaches one second after exactly 60 ticks', () => {
    const state = createRunState(1);
    for (let i = 0; i < SIM.hz; i += 1) stepRun(state);
    expect(state.elapsed).toBeCloseTo(1, 10);
    expect(state.spin).toBeCloseTo(PLACEHOLDER_SPIN_RATE, 10);
  });

  it('keeps the previous spin so rendering can interpolate', () => {
    const state = createRunState(1);
    stepRun(state);
    const afterFirst = state.spin;
    stepRun(state);
    expect(state.previousSpin).toBeCloseTo(afterFirst, 10);
    expect(state.spin).toBeGreaterThan(state.previousSpin);
  });

  it('is identical whether stepped in small or large frames', () => {
    const a = createRunState(5);
    const b = createRunState(5);
    for (let i = 0; i < 180; i += 1) stepRun(a);
    for (let i = 0; i < 90; i += 1) {
      stepRun(b);
      stepRun(b);
    }
    expect(a.elapsed).toBeCloseTo(b.elapsed, 10);
    expect(a.spin).toBeCloseTo(b.spin, 10);
  });
});

describe('forwardSpeed (SPEC 5)', () => {
  it('starts at the spec start speed', () => {
    expect(forwardSpeed(0)).toBe(SPEED.start);
    expect(forwardSpeed(-1)).toBe(SPEED.start);
  });

  it('reaches max speed at the end of the ramp and stays flat', () => {
    expect(forwardSpeed(SPEED.rampTime)).toBe(SPEED.max);
    expect(forwardSpeed(SPEED.rampTime + 60)).toBe(SPEED.max);
    expect(forwardSpeed(10_000)).toBe(SPEED.max);
  });

  it('never decreases and stays inside the start..max band', () => {
    let previous = forwardSpeed(0);
    for (let t = 0; t <= SPEED.rampTime + 30; t += 0.5) {
      const speed = forwardSpeed(t);
      expect(speed).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(speed).toBeGreaterThanOrEqual(SPEED.start);
      expect(speed).toBeLessThanOrEqual(SPEED.max);
      previous = speed;
    }
  });

  it('is halfway up the ramp at half the ramp time', () => {
    const middle = (SPEED.start + SPEED.max) / 2;
    expect(forwardSpeed(SPEED.rampTime / 2)).toBeCloseTo(middle, 6);
  });

  it('never exceeds the hard speed cap', () => {
    expect(SPEED.max).toBeLessThanOrEqual(SPEED.cap);
  });
});
