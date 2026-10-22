/**
 * Run state — pure game logic, no Three.js (CLAUDE.md rule 4).
 *
 * At M0 a "run" is only a clock, a seed and a spinning placeholder, which is
 * enough to prove the fixed-timestep loop and interpolated rendering.
 * Later milestones grow this with the player, speed, score and spawner.
 */

import { SIM, SPEED } from '../config';
import { createRng, type Rng } from './rng';

export interface RunState {
  /** Deterministic randomness for this run. */
  readonly rng: Rng;
  /** Seconds of simulated time since the run started. */
  elapsed: number;
  /** Simulation ticks run so far. */
  ticks: number;
  /** Placeholder spin angle in radians (M0 proof of life). */
  spin: number;
  /** Spin angle at the previous tick, so rendering can interpolate between them. */
  previousSpin: number;
}

/** Radians per second the placeholder cube turns. */
export const PLACEHOLDER_SPIN_RATE = 1.2;

export function createRunState(seed: number): RunState {
  return {
    rng: createRng(seed),
    elapsed: 0,
    ticks: 0,
    spin: 0,
    previousSpin: 0,
  };
}

/** Advances the run by exactly one fixed tick. */
export function stepRun(state: RunState, dt: number = SIM.dt): void {
  state.previousSpin = state.spin;
  state.elapsed += dt;
  state.ticks += 1;
  state.spin += PLACEHOLDER_SPIN_RATE * dt;
}

/**
 * Forward speed for the current run time (SPEC 5): a smooth ramp from
 * SPEED.start to SPEED.max over SPEED.rampTime seconds, then flat.
 */
export function forwardSpeed(elapsed: number): number {
  if (elapsed <= 0) return SPEED.start;
  if (elapsed >= SPEED.rampTime) return SPEED.max;
  const t = elapsed / SPEED.rampTime;
  // Smoothstep: no sudden jump in acceleration at either end of the ramp.
  const eased = t * t * (3 - 2 * t);
  return SPEED.start + (SPEED.max - SPEED.start) * eased;
}
