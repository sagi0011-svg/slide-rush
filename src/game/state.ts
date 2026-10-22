/**
 * Run state — pure game logic, no Three.js (CLAUDE.md rule 4).
 *
 * A run is the clock, the seeded RNG, how far the player has travelled and the
 * player themself. Obstacles, coins and scoring join in later milestones.
 */

import { SIM, SPEED } from '../config';
import { isMoveAction, type GameAction } from './input-actions';
import { createPlayer, queueAction, stepPlayer, type PlayerState } from './player';
import { createRng, type Rng } from './rng';

export interface RunState {
  /** Deterministic randomness for this run. */
  readonly rng: Rng;
  /** Seconds of simulated time since the run started. */
  elapsed: number;
  /** Simulation ticks run so far. */
  ticks: number;
  /** Units travelled down the slide. */
  distance: number;
  /** Distance at the previous tick, so rendering can interpolate. */
  prevDistance: number;
  /** Current forward speed, in units per second. */
  speed: number;
  /** The player. */
  readonly player: PlayerState;
  /** While paused the clock stops and nothing moves. */
  paused: boolean;
}

export function createRunState(seed: number): RunState {
  return {
    rng: createRng(seed),
    elapsed: 0,
    ticks: 0,
    distance: 0,
    prevDistance: 0,
    speed: SPEED.start,
    player: createPlayer(),
    paused: false,
  };
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

/** Hands an action to the run. Pause is the run's business, the rest is the player's. */
export function applyAction(state: RunState, action: GameAction): void {
  if (action === 'pause') {
    state.paused = !state.paused;
    return;
  }
  // Inputs while paused are dropped rather than queued up for the resume.
  if (state.paused) return;
  if (isMoveAction(action)) queueAction(state.player, action);
}

/** Advances the run by exactly one fixed tick. Does nothing while paused. */
export function stepRun(state: RunState, dt: number = SIM.dt): void {
  if (state.paused) return;

  state.prevDistance = state.distance;
  state.elapsed += dt;
  state.ticks += 1;
  state.speed = forwardSpeed(state.elapsed);
  state.distance += state.speed * dt;

  stepPlayer(state.player, dt);
}
