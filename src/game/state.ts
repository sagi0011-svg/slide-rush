/**
 * Run state — pure game logic, no Three.js (CLAUDE.md rule 4).
 *
 * A run is the clock, the seeded RNG, the player, the obstacles ahead of them
 * and what happens when the two meet. Coins and scoring join in M3.
 */

import { OBSTACLES, SIM, SPEED } from '../config';
import { forwardSpeed, stumbleSpeedFactor } from './speed';
import { isMoveAction, type GameAction } from './input-actions';
import { bouncePlayer, createPlayer, queueAction, stepPlayer, type PlayerState } from './player';
import { createRng, type Rng } from './rng';
import { createSpawner, type Spawner } from './chunks/spawner';
import { checkObstacle } from './collisions';
import { tierForTime } from './difficulty';
import type { Chunk } from './chunks/types';

/** What the run is doing right now. */
export type RunPhase = 'running' | 'dead';

/** Why the run ended, for the debug overlay and for tests. */
export type DeathCause = 'obstacle' | 'secondStumble' | null;

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
  /** The obstacles on the track. */
  readonly spawner: Spawner;
  /** Current difficulty tier (SPEC 5). */
  tier: number;
  phase: RunPhase;
  deathCause: DeathCause;
  /** Seconds since the run ended, used for the death beat before a restart. */
  deadFor: number;
  /** Seconds of stumble recovery left. */
  stumbleRecovery: number;
  /** When the last stumble happened, in run seconds. */
  lastStumbleAt: number;
  /** How many stumbles this run — the HUD and tests use it. */
  stumbles: number;
  /** Counts up on every stumble, so the renderer knows to shake. */
  shakeTrigger: number;
  /** While paused the clock stops and nothing moves. */
  paused: boolean;
}

export { forwardSpeed };

export function createRunState(seed: number, library?: readonly Chunk[]): RunState {
  const rng = createRng(seed);
  return {
    rng,
    elapsed: 0,
    ticks: 0,
    distance: 0,
    prevDistance: 0,
    speed: SPEED.start,
    player: createPlayer(),
    spawner: library === undefined ? createSpawner(rng) : createSpawner(rng, library),
    tier: 0,
    phase: 'running',
    deathCause: null,
    deadFor: 0,
    stumbleRecovery: 0,
    // Far enough in the past that the first stumble is never a second one.
    lastStumbleAt: Number.NEGATIVE_INFINITY,
    stumbles: 0,
    shakeTrigger: 0,
    paused: false,
  };
}

/** Hands an action to the run. Pause is the run's business, the rest is the player's. */
export function applyAction(state: RunState, action: GameAction): void {
  if (action === 'pause') {
    // There is nothing to pause once the run is over.
    if (state.phase === 'dead') return;
    state.paused = !state.paused;
    return;
  }
  // Inputs while paused or dead are dropped rather than queued up.
  if (state.paused || state.phase === 'dead') return;
  if (isMoveAction(action)) queueAction(state.player, action);
}

function die(state: RunState, cause: DeathCause): void {
  state.phase = 'dead';
  state.deathCause = cause;
  state.deadFor = 0;
}

/**
 * Takes a stumble: speed drops, the camera shakes, and a second stumble inside
 * OBSTACLES.secondStumbleWindow is death instead (SPEC 7).
 */
function stumble(state: RunState): void {
  if (state.elapsed - state.lastStumbleAt < OBSTACLES.secondStumbleWindow) {
    die(state, 'secondStumble');
    return;
  }
  state.stumbles += 1;
  state.lastStumbleAt = state.elapsed;
  state.stumbleRecovery = OBSTACLES.stumbleDuration;
  state.shakeTrigger += 1;
  // Scoring resets the multiplier here too, once M3 adds it.
}

/** Checks the player against every obstacle they could be touching. */
function resolveCollisions(state: RunState): void {
  for (const obstacle of state.spawner.obstacles) {
    if (!obstacle.active) continue;
    // Cheap reject: anything far from the player cannot be touching them.
    if (Math.abs(obstacle.s - state.distance) > 4) continue;

    const hit = checkObstacle(state.player, state.distance, state.prevDistance, obstacle);
    if (hit === null) continue;

    if (hit.cost === 'death') {
      die(state, 'obstacle');
      return;
    }

    // A stumble: the obstacle is done with, so it cannot be hit twice.
    obstacle.active = false;
    if (hit.kind === 'side') {
      // Bounce back to the lane they came from (SPEC 7).
      bouncePlayer(state.player);
    }
    stumble(state);
    if (state.phase === 'dead') return;
  }
}

/** Advances the run by exactly one fixed tick. Does nothing while paused. */
export function stepRun(state: RunState, dt: number = SIM.dt): void {
  if (state.paused) return;

  if (state.phase === 'dead') {
    state.deadFor += dt;
    return;
  }

  state.prevDistance = state.distance;
  state.elapsed += dt;
  state.ticks += 1;
  state.tier = tierForTime(state.elapsed);

  if (state.stumbleRecovery > 0) {
    state.stumbleRecovery = Math.max(0, state.stumbleRecovery - dt);
  }
  state.speed = forwardSpeed(state.elapsed) * stumbleSpeedFactor(state.stumbleRecovery);
  state.distance += state.speed * dt;

  stepPlayer(state.player, dt);
  state.spawner.update(state.distance, state.tier);
  resolveCollisions(state);
}

/** True once the death beat has played and the run should start again. */
export function shouldRestart(state: RunState): boolean {
  return state.phase === 'dead' && state.deadFor >= OBSTACLES.restartDelay;
}
