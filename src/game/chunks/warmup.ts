/**
 * The first chunks of the library (SPEC 6).
 *
 * Tier 0 is the warm-up: only low mines and full blockers, wide spacing, and
 * never more than one lane blocked at a time (SPEC 5). Two tier-1 chunks add
 * the high and soft obstacles so all four types appear in a run; the library
 * grows to 25+ chunks in M5.
 *
 * Every chunk here is checked by the fairness validator in tests/fairness.spec.ts.
 */

import { COINS, PLAYER, TRACK } from '../../config';
import type { Chunk, Placement } from './types';

const LENGTH = TRACK.chunkLength;

/** A straight line of coins down one lane, to show the way through (SPEC 6). */
function line(lane: number, from: number, to: number, step = 2.5): Placement[] {
  const coins: Placement[] = [];
  for (let z = from; z <= to + 1e-9; z += step) {
    coins.push({ type: 'coin', lane, z: Math.round(z * 100) / 100 });
  }
  return coins;
}

/**
 * An arc of coins over something you jump: it rises and falls the way the
 * player does, so following the coins is the same as timing the jump.
 */
function arc(lane: number, center: number, width = 7, step = 1.75): Placement[] {
  const coins: Placement[] = [];
  for (let offset = -width / 2; offset <= width / 2 + 1e-9; offset += step) {
    const t = offset / (width / 2); // -1 at the ends, 0 at the top
    const height = COINS.restHeight + (PLAYER.jumpHeight - COINS.restHeight) * (1 - t * t);
    coins.push({
      type: 'coin',
      lane,
      z: Math.round((center + offset) * 100) / 100,
      y: Math.round(height * 100) / 100,
    });
  }
  return coins;
}

export const WARMUP_CHUNKS: readonly Chunk[] = [
  {
    id: 'w0-empty',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    // A breather, and a free handful of coins down the middle.
    placements: [{ type: 'pickup', lane: 0, z: 20 }, ...line(0, 8, 32)],
  },
  {
    id: 'w1-centre-wall',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // One wall in the middle: step either way. The coins show you where.
    placements: [
      { type: 'pickup', lane: 1, z: 30 },
      { type: 'fullBlocker', lane: 0, z: 20 },
      ...line(0, 4, 12),
      ...line(1, 17, 34),
    ],
  },
  {
    id: 'w2-two-mines',
    minTier: 0,
    maxTier: 2,
    length: LENGTH,
    // Same lane twice: jump, land, jump again — or just walk around.
    // An arc of coins over each mine rewards the jump.
    placements: [
      { type: 'lowMine', lane: 0, z: 13 },
      { type: 'lowMine', lane: 0, z: 30 },
      ...arc(0, 13),
      ...arc(0, 30),
    ],
  },
  {
    id: 'w3-outside-walls',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // Both edges blocked in turn; the middle is always open, and that is
    // exactly where the coins are.
    placements: [
      { type: 'pickup', lane: 0, z: 20 },
      { type: 'fullBlocker', lane: -1, z: 12 },
      { type: 'fullBlocker', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 'w4-mine-weave',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'pickup', lane: 0, z: 19 },
      { type: 'lowMine', lane: -1, z: 11 },
      { type: 'lowMine', lane: 1, z: 27 },
      ...line(0, 5, 35),
    ],
  },
  {
    id: 'w5-wall-then-mine',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // Leave the middle for the wall, then deal with the mine on the left.
    placements: [
      { type: 'fullBlocker', lane: 0, z: 12 },
      { type: 'lowMine', lane: -1, z: 28 },
      ...line(1, 8, 34),
    ],
  },
  {
    id: 'w6-mine-then-wall',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // Jump the mine, then move off the lane before the wall.
    placements: [
      { type: 'lowMine', lane: 0, z: 14 },
      { type: 'fullBlocker', lane: 0, z: 30 },
      ...arc(0, 14),
      ...line(-1, 24, 36),
    ],
  },
  {
    id: 'w7-right-then-centre',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'fullBlocker', lane: 1, z: 10 },
      { type: 'fullBlocker', lane: 0, z: 27 },
      ...line(0, 4, 16),
      ...line(-1, 22, 36),
    ],
  },
  {
    id: 't1-arch-centre',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The first high obstacle: duck under it, or go round. The coins stay low
    // through the arch, which is the hint to slide.
    placements: [
      { type: 'highObstacle', lane: 0, z: 14 },
      { type: 'lowMine', lane: 1, z: 31 },
      { type: 'coin', lane: 0, z: 11, y: 0.5 },
      { type: 'coin', lane: 0, z: 14, y: 0.5 },
      { type: 'coin', lane: 0, z: 17, y: 0.5 },
      ...line(-1, 24, 36),
    ],
  },
  {
    id: 't1-ring-and-arch',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The soft ring only ever trips you up; the arch is deadly.
    placements: [
      { type: 'pickup', lane: 0, z: 34 },
      { type: 'softObstacle', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 29 },
      ...arc(-1, 12),
      ...line(0, 22, 36),
    ],
  },
];
