/**
 * Coins (SPEC 8), and the magnet that pulls them in (SPEC 9).
 *
 * Pure logic, no Three.js. A coin is collected by touching it, within
 * COINS.pickupRadius of the middle of the player.
 *
 * A coin knows where it is as a position, not as a lane, because the magnet
 * drags it off its lane and across to the player.
 */

import { COINS, LANES, POWERUPS } from '../config';

/** A coin on the track. */
export interface Coin {
  /** Where it sits across the slide, in units. */
  x: number;
  /** How high it floats above the slide, in units. */
  y: number;
  /** Where it is along the slide, in units from the start. */
  s: number;
}

/** A coin slot in the pool. Inactive slots are reused. */
export interface PooledCoin extends Coin {
  active: boolean;
  /** The lane it was placed in, before any magnet moved it. */
  lane: number;
  /** True once a magnet has taken hold of it. */
  attracted: boolean;
}

/** Builds an empty pool. Its size never changes (CLAUDE.md rule 7). */
export function createCoinPool(size: number = COINS.poolSize): PooledCoin[] {
  const pool: PooledCoin[] = [];
  for (let i = 0; i < size; i += 1) {
    pool.push({ active: false, attracted: false, lane: 0, x: 0, y: COINS.restHeight, s: 0 });
  }
  return pool;
}

/** Puts a coin on the track in a lane. */
export function placeCoin(coin: PooledCoin, lane: number, s: number, y: number): void {
  coin.active = true;
  coin.attracted = false;
  coin.lane = lane;
  coin.x = lane * LANES.width;
  coin.y = y;
  coin.s = s;
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
  const dx = playerX - coin.x;
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

/**
 * True if the magnet should take hold of this coin (SPEC 9).
 *
 * The magnet reaches POWERUPS.magnet.radius units ahead, across all three
 * lanes. It never reaches backwards: a coin already behind the player is gone.
 */
export function withinMagnetReach(
  playerS: number,
  coin: Coin,
  radius: number = POWERUPS.magnet.radius,
): boolean {
  const ahead = coin.s - playerS;
  return ahead >= 0 && ahead <= radius;
}

/**
 * Drags a coin the magnet has hold of towards the player (SPEC 9).
 *
 * The coin is moved, not teleported, so it reads as being pulled in.
 *
 * @param playerX where the player is across the slide, in units
 * @param playerY the middle of the player's body above the slide, in units
 * @param playerS how far the player has travelled, in units
 */
export function pullCoin(
  coin: Coin,
  playerX: number,
  playerY: number,
  playerS: number,
  dt: number,
  speed: number = POWERUPS.magnet.pullSpeed,
): void {
  const dx = playerX - coin.x;
  const dy = playerY - coin.y;
  const ds = playerS - coin.s;
  const distance = Math.hypot(dx, dy, ds);
  if (distance <= 1e-6) return;

  const step = Math.min(speed * dt, distance);
  coin.x += (dx / distance) * step;
  coin.y += (dy / distance) * step;
  coin.s += (ds / distance) * step;
}
