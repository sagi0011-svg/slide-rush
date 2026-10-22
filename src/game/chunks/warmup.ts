/**
 * Tier 0 chunks: the first 30 seconds (SPEC 5).
 *
 * The warm-up. Only low mines and full blockers, wide spacing, and never more
 * than one lane blocked at a time, so there is always somewhere obvious to go.
 * The speed here tops out around 15 units a second, which is a long time to
 * look at what is coming.
 *
 * Every chunk here is checked by the fairness validator.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { arc, line, pickupSlot } from './helpers';

const LENGTH = TRACK.chunkLength;

export const WARMUP_CHUNKS: readonly Chunk[] = [
  {
    id: 'w0-empty',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    // A breather, and a free handful of coins down the middle.
    placements: [pickupSlot(0, 20), ...line(0, 8, 32)],
  },
  {
    id: 'w1-centre-wall',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // One wall in the middle: step either way. The coins show you where.
    placements: [
      pickupSlot(1, 30),
      { type: 'fullBlocker', lane: 0, z: 20 },
      ...line(0, 4, 12),
      ...line(1, 17, 34),
    ],
  },
  {
    id: 'w2-two-mines',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    // Same lane twice: jump, land, jump again — or just walk around. An arc
    // of coins over each mine rewards the jump.
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
      pickupSlot(0, 20),
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
      pickupSlot(0, 19),
      { type: 'lowMine', lane: -1, z: 12 },
      { type: 'lowMine', lane: 1, z: 28 },
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
      ...line(1, 6, 34),
    ],
  },
  {
    id: 'w6-mine-then-wall',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    // Jump the mine, then move off the lane before the wall.
    placements: [
      { type: 'lowMine', lane: 0, z: 12 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...arc(0, 12),
      ...line(-1, 24, 34),
    ],
  },
  {
    id: 'w7-right-then-centre',
    minTier: 0,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'fullBlocker', lane: 1, z: 12 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...line(0, 4, 16),
      ...line(-1, 22, 36),
    ],
  },
  {
    id: 'w8-left-then-right',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    placements: [
      { type: 'fullBlocker', lane: -1, z: 12 },
      { type: 'lowMine', lane: 1, z: 28 },
      ...line(0, 5, 35),
    ],
  },
  {
    id: 'w9-long-mine-run',
    minTier: 0,
    maxTier: 1,
    length: LENGTH,
    // Three mines down one lane, with plenty of room between them.
    placements: [
      { type: 'lowMine', lane: 1, z: 8 },
      { type: 'lowMine', lane: 1, z: 21 },
      { type: 'lowMine', lane: 1, z: 34 },
      ...line(0, 4, 36),
    ],
  },
];
