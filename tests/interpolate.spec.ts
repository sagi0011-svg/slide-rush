import { describe, expect, it } from 'vitest';
import { frameAlpha, lerp } from '../src/render/interpolate';

describe('lerp', () => {
  it('returns the ends exactly', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns the middle', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('works with negative values', () => {
    expect(lerp(-5, 5, 0.5)).toBe(0);
  });
});

describe('frameAlpha', () => {
  it('passes a normal value straight through', () => {
    expect(frameAlpha(0, false)).toBe(0);
    expect(frameAlpha(0.37, false)).toBeCloseTo(0.37, 10);
    expect(frameAlpha(1, false)).toBe(1);
  });

  it('holds on the last tick while the game is frozen', () => {
    // This is the fix for the wobble during the beat after a crash: with the
    // simulation stopped, every frame must draw the same thing.
    for (const alpha of [0, 0.25, 0.5, 0.99, 1]) {
      expect(frameAlpha(alpha, true)).toBe(1);
    }
  });

  it('draws a frozen game at a standstill', () => {
    // The two ticks stay put, so every frame lands on the same position.
    const previous = 100;
    const current = 100.23; // one tick of travel
    const frames = [0.1, 0.9, 0.4, 0.75].map((alpha) =>
      lerp(previous, current, frameAlpha(alpha, true)),
    );
    expect(new Set(frames).size).toBe(1);
  });

  it('would wobble if it kept interpolating — which is what went wrong', () => {
    const previous = 100;
    const current = 100.23;
    const frames = [0.1, 0.9, 0.4, 0.75].map((alpha) =>
      lerp(previous, current, frameAlpha(alpha, false)),
    );
    expect(new Set(frames).size).toBeGreaterThan(1);
  });

  it('keeps a nonsense value from moving anything', () => {
    expect(frameAlpha(Number.NaN, false)).toBe(0);
    expect(frameAlpha(1.5, false)).toBe(1);
    expect(frameAlpha(-0.2, false)).toBe(0);
  });
});
