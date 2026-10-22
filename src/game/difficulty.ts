/**
 * Difficulty tiers (SPEC 5).
 *
 * The tier comes from how long the run has lasted, not how far it has gone, so
 * a slow start never makes the game easier than it should be. M5 builds the
 * full tier behaviour on top of this; M2 only needs to know which chunks are
 * allowed and how fast they will be taken.
 */

import { DIFFICULTY, SPEED } from '../config';
import { forwardSpeed } from './speed';

/** The highest tier there is. */
export const MAX_TIER = DIFFICULTY.tierStartTimes.length - 1;

/** Which difficulty tier a run is in after this many seconds. */
export function tierForTime(elapsed: number): number {
  let tier = 0;
  for (let i = 0; i < DIFFICULTY.tierStartTimes.length; i += 1) {
    if (elapsed >= (DIFFICULTY.tierStartTimes[i] as number)) tier = i;
  }
  return tier;
}

/** The second at which a tier begins. */
export function tierStartTime(tier: number): number {
  const clamped = Math.min(Math.max(tier, 0), MAX_TIER);
  return DIFFICULTY.tierStartTimes[clamped] as number;
}

/**
 * The fastest the game can be moving while a given tier is in play — which is
 * the speed at the moment the next tier takes over. The fairness validator
 * uses this: a chunk has to be survivable at the worst speed it can be met at.
 */
export function tierMaxSpeed(tier: number): number {
  if (tier >= MAX_TIER) return SPEED.max;
  return forwardSpeed(tierStartTime(tier + 1));
}
