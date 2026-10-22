/**
 * Power-ups (SPEC 9).
 *
 * Three of them, and they can all run at once. Picking up one that is already
 * running resets its timer rather than stacking a second copy.
 *
 * Pure logic, no Three.js.
 */

import { POWERUPS, SPEED } from '../config';

export type PowerUpType = 'shield' | 'magnet' | 'boost';

export const POWERUP_TYPES: readonly PowerUpType[] = ['shield', 'magnet', 'boost'];

export interface PowerUpState {
  /** Seconds left on each power-up; zero means it is not running. */
  shield: number;
  magnet: number;
  boost: number;
  /**
   * Seconds of invulnerability left over from a shield taking a hit or a
   * boost finishing (SPEC 9).
   */
  grace: number;
  /** Seconds left of the speed easing back down after a boost. */
  boostEaseOut: number;
  /** The speed the boost was carrying when it ended, in units per second. */
  boostEaseFrom: number;
  /**
   * Seconds left of the window after a boost in which the spawner keeps the
   * track easy (SPEC 9).
   */
  safeWindow: number;
}

export function createPowerUps(): PowerUpState {
  return {
    shield: 0,
    magnet: 0,
    boost: 0,
    grace: 0,
    boostEaseOut: 0,
    boostEaseFrom: 0,
    safeWindow: 0,
  };
}

/** How long each power-up runs for, in seconds. */
export function durationOf(type: PowerUpType): number {
  switch (type) {
    case 'shield':
      return POWERUPS.shield.duration;
    case 'magnet':
      return POWERUPS.magnet.duration;
    case 'boost':
      return POWERUPS.boost.duration;
  }
}

/** True if that power-up is running right now. */
export function isActive(state: PowerUpState, type: PowerUpType): boolean {
  return state[type] > 0;
}

/** How much of a power-up is left, 0..1, for the shrinking bar on the HUD. */
export function remainingFraction(state: PowerUpState, type: PowerUpType): number {
  const duration = durationOf(type);
  if (duration <= 0) return 0;
  return Math.min(Math.max(state[type] / duration, 0), 1);
}

/**
 * Starts a power-up, or puts a running one back to full (SPEC 9).
 *
 * Note what this does *not* do: starting a power-up never cancels another, so
 * all three can run together.
 */
export function grant(state: PowerUpState, type: PowerUpType): void {
  state[type] = durationOf(type);
  if (type === 'boost') {
    // A fresh boost cancels the easing from a previous one.
    state.boostEaseOut = 0;
  }
}

/** True while nothing can hurt the player (SPEC 9). */
export function isInvulnerable(state: PowerUpState): boolean {
  return state.boost > 0 || state.grace > 0;
}

/** True while the player sweeps coins in, from either the magnet or a boost. */
export function isMagnetic(state: PowerUpState): boolean {
  return state.magnet > 0 || state.boost > 0;
}

/**
 * True while the spawner should keep the track easy: during a boost, and for
 * a moment afterwards (SPEC 9).
 */
export function wantsEasyTrack(state: PowerUpState): boolean {
  return state.boost > 0 || state.safeWindow > 0;
}

/**
 * Spends the shield on a hit (SPEC 9).
 *
 * @returns true if the shield took it, false if there was no shield to spend
 */
export function absorbWithShield(state: PowerUpState): boolean {
  if (state.shield <= 0) return false;
  state.shield = 0;
  // A shield that takes a hit leaves a moment of invulnerability behind it.
  state.grace = Math.max(state.grace, POWERUPS.shield.graceAfterHit);
  return true;
}

/**
 * The forward speed once the power-ups have had their say (SPEC 9).
 *
 * A boost doubles it, up to the hard cap. When the boost ends the speed eases
 * back down rather than dropping away under the player.
 *
 * @param baseSpeed what the speed would be with no power-ups
 */
export function speedWithPowerUps(state: PowerUpState, baseSpeed: number): number {
  if (state.boost > 0) {
    return Math.min(baseSpeed * POWERUPS.boost.speedMultiplier, SPEED.cap);
  }
  if (state.boostEaseOut > 0) {
    const t = state.boostEaseOut / POWERUPS.boost.easeOutTime;
    return baseSpeed + (state.boostEaseFrom - baseSpeed) * Math.min(Math.max(t, 0), 1);
  }
  return baseSpeed;
}

/**
 * Runs every timer down by one tick.
 *
 * @param baseSpeed the speed with no power-ups, so a finishing boost knows
 *   what it is easing back towards
 */
export function stepPowerUps(state: PowerUpState, dt: number, baseSpeed: number): void {
  const boostWasRunning = state.boost > 0;
  const speedBefore = speedWithPowerUps(state, baseSpeed);

  for (const type of POWERUP_TYPES) {
    if (state[type] > 0) state[type] = Math.max(0, state[type] - dt);
  }

  if (boostWasRunning && state.boost === 0) {
    // The boost just finished: a moment of invulnerability to land in, a
    // gentle slow-down, and a stretch of easy track (SPEC 9).
    state.grace = Math.max(state.grace, POWERUPS.boost.graceAfterEnd);
    state.boostEaseOut = POWERUPS.boost.easeOutTime;
    state.boostEaseFrom = speedBefore;
    state.safeWindow = POWERUPS.boost.safeWindowAfterEnd;
  }

  if (state.grace > 0) state.grace = Math.max(0, state.grace - dt);
  if (state.boostEaseOut > 0) state.boostEaseOut = Math.max(0, state.boostEaseOut - dt);
  if (state.safeWindow > 0) state.safeWindow = Math.max(0, state.safeWindow - dt);
}
