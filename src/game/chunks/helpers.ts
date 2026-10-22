/**
 * Small helpers for writing chunks by hand (SPEC 6).
 *
 * Coin trails are what tell the player where the safe path is, so they are
 * built from these rather than written out coin by coin.
 */

import { COINS, PLAYER } from '../../config';
import type { Placement } from './types';

/** Rounds to a sensible number of decimals, so chunk data stays readable. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A straight line of coins down one lane, to show the way through. */
export function line(lane: number, from: number, to: number, step = 2.5): Placement[] {
  const coins: Placement[] = [];
  for (let z = from; z <= to + 1e-9; z += step) {
    coins.push({ type: 'coin', lane, z: tidy(z) });
  }
  return coins;
}

/**
 * An arc of coins over something you jump: it rises and falls the way the
 * player does, so following the coins is the same as timing the jump.
 */
export function arc(lane: number, center: number, width = 7, step = 1.75): Placement[] {
  const coins: Placement[] = [];
  for (let offset = -width / 2; offset <= width / 2 + 1e-9; offset += step) {
    const t = offset / (width / 2); // -1 at the ends, 0 at the top
    const height = COINS.restHeight + (PLAYER.jumpHeight - COINS.restHeight) * (1 - t * t);
    coins.push({ type: 'coin', lane, z: tidy(center + offset), y: tidy(height) });
  }
  return coins;
}

/**
 * A low line of coins, the height of a sliding player. Used under an arch,
 * where it is the hint to duck rather than go round.
 */
export function low(lane: number, from: number, to: number, step = 3): Placement[] {
  const coins: Placement[] = [];
  for (let z = from; z <= to + 1e-9; z += step) {
    coins.push({ type: 'coin', lane, z: tidy(z), y: PLAYER.slideHeight / 2 });
  }
  return coins;
}

/** A slot where a power-up pickup may appear, if one is due (SPEC 9). */
export function pickupSlot(lane: number, z: number): Placement {
  return { type: 'pickup', lane, z };
}
