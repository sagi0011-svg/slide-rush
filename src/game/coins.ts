/**
 * Coins (SPEC 8).
 *
 * Pure logic, no Three.js. A coin is collected by touching it, within
 * COINS.pickupRadius of the middle of the player.
 */

import { COINS, LANES } from '../config';

/** A coin on the track. */
export interface Coin {
  /** Lane it sits in: -1, 0 or 1. */
  lane: number;
  /** Where it is along the slide, in units from the start. */
  s: number;
  /** How high it floats above the slide, in units. */
  y: number;
}

/** A coin slot in the pool. Inactive slots are reused. */
export interface PooledCoin extends Coin {
  active: boolean;
}

/** Builds an empty pool. Its size never changes (CLAUDE.md rule 7). */
export function createCoinPool(size: number = COINS.poolSize): PooledCoin[] {
  const pool: PooledCoin[] = [];
  for (let i = 0; i < size; i += 1) {
    pool.push({ active: false, lane: 0, s: 0, y: COINS.restHeight });
  }
  return pool;
}

/**
 * Whether the player collected a coin on this tick.
 *
 * The test sweeps along the slide rather than only looking at where the player
 * ended up: at 32 units a second the player moves half a unit per tick, so a
 * coin checked only at tick positions could be passed straight through.
 *
 * @param playerX where the player is across the slide, in units
 * @param playerY the middle of the player's body above the slide, in units
 * @param previousS how far the player had travelled at the previous tick
 * @param currentS how far the player has travelled now
 */
export function coinCollected(
  playerX: number,
  playerY: number,
  previousS: number,
  currentS: number,
  coin: Coin,
  radius: number = COINS.pickupRadius,
): boolean {
  const dx = playerX - coin.lane * LANES.width;
  const dy = playerY - coin.y;
  const sideways = dx * dx + dy * dy;
  const radiusSquared = radius * radius;
  if (sideways > radiusSquared) return false;

  // Whatever of the pickup radius is left over reaches this far along the slide.
  const reach = Math.sqrt(radiusSquared - sideways);
  const from = Math.min(previousS, currentS) - reach;
  const to = Math.max(previousS, currentS) + reach;
  return coin.s >= from && coin.s <= to;
}
