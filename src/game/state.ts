/**
 * Run state — pure game logic, no Three.js (CLAUDE.md rule 4).
 *
 * A run is the clock, the seeded RNG, the player, the obstacles ahead of them
 * and what happens when the two meet. Coins and scoring join in M3.
 */

import { DEATH, LANES, OBSTACLES, PLAYER, SIM, SPEED } from '../config';
import { forwardSpeed, stumbleSpeedFactor } from './speed';
import { isMoveAction, type GameAction } from './input-actions';
import { bouncePlayer, createPlayer, queueAction, stepPlayer, type PlayerState } from './player';
import { createRng, type Rng } from './rng';
import { createSpawner, type Spawner } from './chunks/spawner';
import { checkObstacle } from './collisions';
import { coinCollected, pullCoin, withinMagnetReach } from './coins';
import { nextPickupDelay, pickupCollected } from './pickups';
import {
  absorbWithShield,
  createPowerUps,
  grant,
  isInvulnerable,
  isMagnetic,
  speedWithPowerUps,
  stepPowerUps,
  wantsEasyTrack,
  type PowerUpState,
  type PowerUpType,
} from './powerups';
import {
  addCoin,
  addDistance,
  createScore,
  resetMultiplier,
  updateMultiplier,
  type Score,
} from './scoring';
import { tierForTime } from './difficulty';
import {
  createTutorial,
  tutorialProtects,
  tutorialSpeedFactor,
  tutorialTakesAction,
  updateTutorial,
  type TutorialState,
} from './tutorial';
import { TUTORIAL_CHUNKS } from './chunks/tutorial';
import { OPENING_CHUNK } from './chunks/opening';
import type { Chunk } from './chunks/types';
import { createDebugTweaks, debugTier, type DebugTweaks } from './debug-tweaks';

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
  /** The obstacles and coins on the track. */
  readonly spawner: Spawner;
  /** Points, coins and the multiplier (SPEC 10). */
  readonly score: Score;
  /** Which power-ups are running, and for how much longer (SPEC 9). */
  readonly powerUps: PowerUpState;
  /** When the next pickup is due, in run seconds. */
  nextPickupAt: number;
  /** Counts up whenever a shield takes a hit, so the renderer can pop it. */
  shieldPops: number;
  /** The first-run tutorial, if this run is showing it (SPEC 11). */
  readonly tutorial: TutorialState;
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
  /** Speed, difficulty and invincibility overrides from debug mode (SPEC 13). */
  readonly debug: DebugTweaks;
}

export { forwardSpeed };

export interface RunOptions {
  /** Chunks to pick from. Defaults to the whole library. */
  library?: readonly Chunk[];
  /** Whether this run should teach the controls first (SPEC 11). */
  tutorial?: boolean;
  /**
   * Debug overrides. Shared rather than copied, so a slider moved during one
   * run still holds for the next (SPEC 13).
   */
  debug?: DebugTweaks;
}

export function createRunState(
  seed: number,
  libraryOrOptions?: readonly Chunk[] | RunOptions,
): RunState {
  const options: RunOptions = Array.isArray(libraryOrOptions)
    ? { library: libraryOrOptions }
    : ((libraryOrOptions as RunOptions | undefined) ?? {});
  const withTutorial = options.tutorial === true;
  // The tutorial is its own gentle start. Otherwise a run on the real track
  // opens with a stretch of coins and nothing else (SPEC 6); a test's own
  // library is laid from the very start, as written.
  const opening = withTutorial
    ? TUTORIAL_CHUNKS
    : options.library === undefined
      ? [OPENING_CHUNK]
      : [];
  const rng = createRng(seed);
  return {
    rng,
    elapsed: 0,
    ticks: 0,
    distance: 0,
    prevDistance: 0,
    speed: SPEED.start,
    player: createPlayer(),
    spawner: createSpawner(rng, options.library ?? undefined, opening),
    tutorial: createTutorial(withTutorial),
    score: createScore(),
    powerUps: createPowerUps(),
    nextPickupAt: nextPickupDelay(rng),
    shieldPops: 0,
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
    debug: options.debug ?? createDebugTweaks(),
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
  if (!isMoveAction(action)) return;

  // A prompt waiting for this move is satisfied by it, and the move still
  // happens — the player is being taught by doing (SPEC 11).
  tutorialTakesAction(state.tutorial, action);
  queueAction(state.player, action);
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
  // A stumble knocks the multiplier back to x1 (SPEC 10).
  resetMultiplier(state.score, state.elapsed);
}

// Filled in place by playerCentre, so asking for it makes no garbage (rule 7).
const centre = { x: 0, y: 0 };

/**
 * Where the middle of the player's body is, for coins and pickups. The answer
 * is shared and overwritten by the next call, so read it straight away.
 */
function playerCentre(state: RunState): { readonly x: number; readonly y: number } {
  const { player } = state;
  const bodyHeight = player.vertical === 'sliding' ? PLAYER.slideHeight : PLAYER.standHeight;
  centre.x = player.laneOffset * LANES.width;
  centre.y = player.height + bodyHeight / 2;
  return centre;
}

/** Drags nearby coins in while a magnet or a boost is running (SPEC 9). */
function applyMagnet(state: RunState, dt: number): void {
  if (!isMagnetic(state.powerUps)) return;
  const { x, y } = playerCentre(state);

  const { coins } = state.spawner;
  for (let i = 0; i < coins.length; i += 1) {
    const coin = coins[i] as (typeof coins)[number];
    if (!coin.active) continue;
    if (!coin.attracted && !withinMagnetReach(state.distance, coin)) continue;
    // Once the magnet has a coin it keeps it, even as the player goes past.
    coin.attracted = true;
    pullCoin(coin, x, y, state.distance, dt);
  }
}

/** Picks up the power-up pickup, if the player touched it (SPEC 9). */
function collectPickup(state: RunState): void {
  const { pickup } = state.spawner;
  if (!pickup.active) return;
  if (Math.abs(pickup.s - state.distance) > 4) return;

  const { x, y } = playerCentre(state);
  if (!pickupCollected(x, y, state.prevDistance, state.distance, pickup)) return;

  pickup.active = false;
  grant(state.powerUps, pickup.type);
}

/** Asks for a new pickup when one is due and none is about (SPEC 9). */
function schedulePickup(state: RunState): void {
  if (state.elapsed < state.nextPickupAt) return;
  if (state.spawner.pickup.active || state.spawner.pickupPending) return;
  state.spawner.requestPickup();
  state.nextPickupAt = state.elapsed + nextPickupDelay(state.rng);
}

/** Grants a power-up directly. Used by the debug keys (SPEC 13). */
export function grantPowerUp(state: RunState, type: PowerUpType): void {
  grant(state.powerUps, type);
}

/** Picks up any coin the player touched on this tick (SPEC 8). */
function collectCoins(state: RunState): void {
  const { x: playerX, y: playerY } = playerCentre(state);

  const { coins } = state.spawner;
  for (let i = 0; i < coins.length; i += 1) {
    const coin = coins[i] as (typeof coins)[number];
    if (!coin.active) continue;
    // Cheap reject: anything far along the slide cannot have been touched.
    // A coin the magnet is dragging in is always worth testing.
    if (!coin.attracted && Math.abs(coin.s - state.distance) > 4) continue;
    if (!coinCollected(playerX, playerY, state.prevDistance, state.distance, coin)) continue;
    coin.active = false;
    addCoin(state.score);
  }
}

/** Checks the player against every obstacle they could be touching. */
function resolveCollisions(state: RunState): void {
  // Debug invincibility: the player passes straight through (SPEC 13).
  if (state.debug.invincible) return;
  const { obstacles } = state.spawner;
  for (let i = 0; i < obstacles.length; i += 1) {
    const obstacle = obstacles[i] as (typeof obstacles)[number];
    if (!obstacle.active) continue;
    // Cheap reject: anything far from the player cannot be touching them.
    if (Math.abs(obstacle.s - state.distance) > 4) continue;

    const hit = checkObstacle(state.player, state.distance, state.prevDistance, obstacle);
    if (hit === null) continue;

    // Nothing on the tutorial's track can hurt a first-time player, even
    // just after the last lesson (SPEC 11).
    if (tutorialProtects(state.tutorial, state.distance)) continue;

    // Boosting, or in a moment of grace: the obstacle is smashed aside and
    // nothing happens to the player (SPEC 9).
    if (isInvulnerable(state.powerUps)) {
      obstacle.active = false;
      continue;
    }

    // A shield takes one hit of any kind, deadly or not, and the obstacle
    // goes with it. The multiplier survives (SPEC 9 and 10).
    if (absorbWithShield(state.powerUps)) {
      obstacle.active = false;
      state.shieldPops += 1;
      continue;
    }

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
    // The death beat (SPEC 11): the world keeps moving, far slower, so the
    // crash reads as a moment rather than a freeze. Nothing is scored and
    // nothing else can be hit.
    state.deadFor += dt;
    if (state.deadFor <= DEATH.beatTime) {
      state.prevDistance = state.distance;
      state.distance += state.speed * DEATH.slowMoFactor * dt;
    }
    return;
  }

  state.prevDistance = state.distance;
  state.elapsed += dt;
  state.ticks += 1;
  state.tier = debugTier(state.debug, tierForTime(state.elapsed));

  if (state.stumbleRecovery > 0) {
    state.stumbleRecovery = Math.max(0, state.stumbleRecovery - dt);
  }
  // A tutorial prompt eases the slide to a stop until the player acts.
  updateTutorial(state.tutorial, state.distance);
  const baseSpeed =
    forwardSpeed(state.elapsed) *
    stumbleSpeedFactor(state.stumbleRecovery) *
    tutorialSpeedFactor(state.tutorial, state.distance) *
    state.debug.speedScale;
  state.speed = speedWithPowerUps(state.powerUps, baseSpeed);
  state.distance += state.speed * dt;
  stepPowerUps(state.powerUps, dt, baseSpeed);

  // Points for the ground covered, at whatever the multiplier is now (SPEC 10).
  updateMultiplier(state.score, state.elapsed);
  addDistance(state.score, state.distance - state.prevDistance);

  stepPlayer(state.player, dt);
  schedulePickup(state);
  state.spawner.update(state.distance, state.tier, wantsEasyTrack(state.powerUps));
  applyMagnet(state, dt);
  collectCoins(state);
  collectPickup(state);
  resolveCollisions(state);
}

/** True once the death beat has played and the game over screen is due. */
export function deathBeatOver(state: RunState): boolean {
  return state.phase === 'dead' && state.deadFor >= DEATH.beatTime;
}
