/**
 * The floating pickups that grant power-ups (SPEC 9).
 *
 * One spawns roughly every 20 to 30 seconds, only in a slot a chunk offers,
 * and never two on the track at once. Which of the three it is is random with
 * equal weights, drawn from the run's seeded RNG (CLAUDE.md rule 6).
 */

import { COINS, LANES, POWERUPS } from '../config';
import type { Rng } from './rng';
import { POWERUP_TYPES, type PowerUpType } from './powerups';

export interface Pickup {
  active: boolean;
  type: PowerUpType;
  lane: number;
  /** Where it is along the slide, in units from the start. */
  s: number;
  /** How high it floats above the slide, in units. */
  y: number;
}

export function createPickup(): Pickup {
  return { active: false, type: 'shield', lane: 0, s: 0, y: POWERUPS.pickupHeight };
}

/** Picks which power-up a pickup gives: all three equally likely (SPEC 9). */
export function randomPickupType(rng: Rng): PowerUpType {
  return rng.pick(POWERUP_TYPES);
}

/** How long to wait before the next pickup, in seconds (SPEC 9). */
export function nextPickupDelay(rng: Rng): number {
  return rng.range(POWERUPS.spawnIntervalMin, POWERUPS.spawnIntervalMax);
}

/**
 * Whether the player touched the pickup on this tick.
 *
 * Uses the same generous, swept test as the coins, so a pickup can never be
 * passed straight through at speed.
 */
export function pickupCollected(
  playerX: number,
  playerY: number,
  previousS: number,
  currentS: number,
  pickup: Pickup,
  radius: number = COINS.pickupRadius + POWERUPS.pickupSize / 2,
): boolean {
  const dx = playerX - pickup.lane * LANES.width;
  const dy = playerY - pickup.y;
  const sideways = dx * dx + dy * dy;
  const radiusSquared = radius * radius;
  if (sideways > radiusSquared) return false;

  const reach = Math.sqrt(radiusSquared - sideways);
  const from = Math.min(previousS, currentS) - reach;
  const to = Math.max(previousS, currentS) + reach;
  return pickup.s >= from && pickup.s <= to;
}
