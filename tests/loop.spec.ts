import { describe, expect, it } from 'vitest';
import { createFixedStepper } from '../src/game/loop';

const DT = 1 / 60;

describe('createFixedStepper', () => {
  it('runs one tick per frame at exactly 60 fps', () => {
    const stepper = createFixedStepper(DT, 5);
    for (let i = 0; i < 10; i += 1) {
      const plan = stepper.advance(DT);
      expect(plan.ticks).toBe(1);
      expect(plan.droppedTicks).toBe(0);
      expect(plan.alpha).toBeCloseTo(0, 10);
    }
  });

  it('runs two ticks per frame at 30 fps', () => {
    const stepper = createFixedStepper(DT, 5);
    for (let i = 0; i < 10; i += 1) {
      expect(stepper.advance(2 * DT).ticks).toBe(2);
    }
  });

  it('runs one tick every other frame at 120 fps, interpolating in between', () => {
    const stepper = createFixedStepper(DT, 5);
    const first = stepper.advance(DT / 2);
    expect(first.ticks).toBe(0);
    expect(first.alpha).toBeCloseTo(0.5, 6);
    expect(stepper.advance(DT / 2).ticks).toBe(1);
  });

  it('simulates the same total time whatever the frame rate', () => {
    const total = 2; // seconds
    const count = (frameSeconds: number): number => {
      const stepper = createFixedStepper(DT, 1000);
      let ticks = 0;
      for (let t = 0; t < total - 1e-9; t += frameSeconds) {
        ticks += stepper.advance(frameSeconds).ticks;
      }
      return ticks;
    };
    expect(count(DT)).toBe(120);
    expect(count(2 * DT)).toBe(120);
    expect(count(DT / 2)).toBe(120);
    expect(count(1 / 45)).toBeGreaterThanOrEqual(119);
    expect(count(1 / 45)).toBeLessThanOrEqual(120);
  });

  it('keeps alpha in [0, 1)', () => {
    const stepper = createFixedStepper(DT, 5);
    for (let i = 0; i < 500; i += 1) {
      const plan = stepper.advance(0.013 + (i % 7) * 0.002);
      expect(plan.alpha).toBeGreaterThanOrEqual(0);
      expect(plan.alpha).toBeLessThan(1);
    }
  });

  it('caps the catch-up after a long stall and reports dropped ticks', () => {
    const stepper = createFixedStepper(DT, 5);
    const plan = stepper.advance(2); // tab was asleep for 2 seconds
    expect(plan.ticks).toBe(5);
    expect(plan.droppedTicks).toBe(115);
    expect(plan.alpha).toBeGreaterThanOrEqual(0);
    expect(plan.alpha).toBeLessThan(1);
  });

  it('ignores zero, negative and non-finite frame times', () => {
    const stepper = createFixedStepper(DT, 5);
    expect(stepper.advance(0).ticks).toBe(0);
    expect(stepper.advance(-1).ticks).toBe(0);
    expect(stepper.advance(Number.NaN).ticks).toBe(0);
    expect(stepper.pending).toBe(0);
  });

  it('carries leftover time into the next frame', () => {
    const stepper = createFixedStepper(DT, 5);
    stepper.advance(DT * 1.5);
    expect(stepper.pending).toBeCloseTo(DT * 0.5, 10);
    expect(stepper.advance(DT * 0.5).ticks).toBe(1);
  });

  it('reset() clears carried-over time', () => {
    const stepper = createFixedStepper(DT, 5);
    stepper.advance(DT * 1.5);
    stepper.reset();
    expect(stepper.pending).toBe(0);
    expect(stepper.advance(DT * 0.9).ticks).toBe(0);
  });

  it('rejects an invalid configuration', () => {
    expect(() => createFixedStepper(0, 5)).toThrow();
    expect(() => createFixedStepper(-DT, 5)).toThrow();
    expect(() => createFixedStepper(DT, 0)).toThrow();
  });
});
