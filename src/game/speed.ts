/**
 * Forward speed (SPEC 5 and 7).
 *
 * Kept in its own small module so both the run and the difficulty tiers can
 * use it without importing each other.
 */

import { OBSTACLES, SPEED } from '../config';

/**
 * Speed for the current run time: a smooth ramp from SPEED.start to SPEED.max
 * over SPEED.rampTime seconds, then flat.
 */
export function forwardSpeed(elapsed: number): number {
  if (elapsed <= 0) return SPEED.start;
  if (elapsed >= SPEED.rampTime) return SPEED.max;
  const t = elapsed / SPEED.rampTime;
  // Smoothstep: no sudden jump in acceleration at either end of the ramp.
  const eased = t * t * (3 - 2 * t);
  return SPEED.start + (SPEED.max - SPEED.start) * eased;
}

/**
 * How much of its speed the run keeps while recovering from a stumble: 30% is
 * lost at the moment of the hit and eases back over OBSTACLES.stumbleDuration
 * (SPEC 7).
 *
 * @param remaining seconds of stumble recovery left
 */
export function stumbleSpeedFactor(remaining: number): number {
  if (remaining <= 0) return 1;
  const t = Math.min(remaining / OBSTACLES.stumbleDuration, 1);
  return 1 - OBSTACLES.stumbleSpeedLoss * t;
}
