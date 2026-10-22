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

import { TRACK } from '../../config';
import type { Chunk } from './types';

const LENGTH = TRACK.chunkLength;

export const WARMUP_CHUNKS: readonly Chunk[] = [
  {
    id: 'w0-empty',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    placements: [],
  },
  {
    id: 'w1-centre-wall',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // One wall in the middle: step either way.
    placements: [{ type: 'fullBlocker', lane: 0, z: 20 }],
  },
  {
    id: 'w2-two-mines',
    minTier: 0,
    maxTier: 2,
    length: LENGTH,
    // Same lane twice: jump, land, jump again — or just walk around.
    placements: [
      { type: 'lowMine', lane: 0, z: 13 },
      { type: 'lowMine', lane: 0, z: 30 },
    ],
  },
  {
    id: 'w3-outside-walls',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // Both edges blocked in turn; the middle is always open.
    placements: [
      { type: 'fullBlocker', lane: -1, z: 12 },
      { type: 'fullBlocker', lane: 1, z: 28 },
    ],
  },
  {
    id: 'w4-mine-weave',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'lowMine', lane: -1, z: 11 },
      { type: 'lowMine', lane: 1, z: 27 },
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
    ],
  },
  {
    id: 't1-arch-centre',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The first high obstacle: duck under it, or go round.
    placements: [
      { type: 'highObstacle', lane: 0, z: 14 },
      { type: 'lowMine', lane: 1, z: 31 },
    ],
  },
  {
    id: 't1-ring-and-arch',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The soft ring only ever trips you up; the arch is deadly.
    placements: [
      { type: 'softObstacle', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 29 },
    ],
  },
];
