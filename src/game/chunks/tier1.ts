/**
 * Tier 1 chunks: 30 to 90 seconds (SPEC 5).
 *
 * This is where the arch and the inflatable ring arrive, so the player has to
 * duck as well as jump and sidestep. Still one thing at a time: the tier tops
 * out around 23 units a second and leaves a 14 unit breather between chunks,
 * so these can be laid out more loosely than the later ones.
 *
 * A few of them carry on into tier 2 and 3, and those keep to the tighter
 * geometry the faster tiers need. tests/chunk-rules.spec.ts checks each chunk
 * against the limits of the hardest tier it can appear in.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { arc, line, low, pickupSlot } from './helpers';

const LENGTH = TRACK.chunkLength;

export const TIER1_CHUNKS: readonly Chunk[] = [
  {
    id: 't1-arch-centre',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The first arch: duck under it, or go round. The coins stay low through
    // it, which is the hint to slide.
    placements: [
      { type: 'highObstacle', lane: 0, z: 12 },
      { type: 'lowMine', lane: 1, z: 28 },
      ...low(0, 10, 16),
      ...line(-1, 24, 34),
    ],
  },
  {
    id: 't1-ring-and-arch',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // The ring only ever trips you up; the arch is deadly.
    placements: [
      pickupSlot(0, 20),
      { type: 'softObstacle', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 28 },
      ...arc(-1, 12),
      ...line(0, 20, 34),
    ],
  },
  {
    id: 't1-duck-then-jump',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // Down, then up: the two new moves back to back.
    placements: [
      { type: 'highObstacle', lane: 0, z: 12 },
      { type: 'lowMine', lane: 0, z: 28 },
      ...low(0, 10, 16),
      ...arc(0, 28),
    ],
  },
  {
    id: 't1-ring-run',
    minTier: 1,
    maxTier: 1,
    length: LENGTH,
    // Three rings in a row. Clipping one only costs you speed, so this is a
    // safe place to learn how a jump is timed.
    placements: [
      { type: 'softObstacle', lane: 0, z: 10 },
      { type: 'softObstacle', lane: 0, z: 22 },
      { type: 'softObstacle', lane: 0, z: 34 },
      ...arc(0, 10, 6),
      ...arc(0, 22, 6),
    ],
  },
  {
    id: 't1-arch-pair',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // Both edges in turn; the middle stays clear all the way through.
    placements: [
      { type: 'highObstacle', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't1-wall-and-arch',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'fullBlocker', lane: 1, z: 12 },
      { type: 'highObstacle', lane: 0, z: 28 },
      ...line(-1, 6, 22),
      ...low(0, 26, 32),
    ],
  },
  {
    id: 't1-mine-arch-weave',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'lowMine', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't1-ring-gate',
    minTier: 1,
    maxTier: 2,
    length: LENGTH,
    // Both edges soft, so the middle is the clean line — then it closes.
    placements: [
      { type: 'softObstacle', lane: -1, z: 10 },
      { type: 'softObstacle', lane: 1, z: 10 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...line(0, 6, 20),
      ...line(1, 24, 33),
    ],
  },
  {
    id: 't1-easy-arch',
    minTier: 1,
    maxTier: 3,
    length: LENGTH,
    // One thing only: the gentle chunk this tier falls back on around a boost.
    placements: [{ type: 'highObstacle', lane: 0, z: 22 }, ...low(0, 18, 28), ...line(1, 6, 14)],
  },
];
