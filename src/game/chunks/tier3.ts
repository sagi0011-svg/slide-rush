/**
 * Tier 3 chunks: from 180 seconds on (SPEC 5).
 *
 * The hardest pool, and the one the player stays in for the rest of the run.
 * The speed is flat out at 32 units a second here and there is no breather
 * between chunks, which is what makes these the tightest chunks in the game:
 * nothing may start before z 12 or finish after z 28, two things the player
 * has to deal with must be at least 16 apart, and a gate that shuts two lanes
 * cannot come before z 26. tests/chunk-rules.spec.ts works those numbers out
 * from the spec and holds every chunk to them.
 *
 * The variety at this tier is in *what* is in the way and *where*, not in the
 * rhythm — at this speed the rhythm is fixed by what a person can react to.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { arc, line, low, pickupSlot } from './helpers';

const LENGTH = TRACK.chunkLength;

export const TIER3_CHUNKS: readonly Chunk[] = [
  {
    id: 't3-gauntlet',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    // A gate with one way through, and nothing else to think about.
    placements: [
      pickupSlot(1, 16),
      { type: 'fullBlocker', lane: -1, z: 26 },
      { type: 'fullBlocker', lane: 0, z: 26 },
      ...line(1, 6, 34),
    ],
  },
  {
    id: 't3-double-gate',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    // The same, the other way round.
    placements: [
      pickupSlot(-1, 16),
      { type: 'fullBlocker', lane: 1, z: 26 },
      { type: 'fullBlocker', lane: 0, z: 26 },
      ...line(-1, 6, 34),
    ],
  },
  {
    id: 't3-mine-then-wall',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    // Two lanes mined: one jump clears both, or take the open lane.
    placements: [
      { type: 'lowMine', lane: 0, z: 12 },
      { type: 'lowMine', lane: 1, z: 12 },
      { type: 'fullBlocker', lane: -1, z: 28 },
      ...arc(0, 12),
      ...line(1, 24, 34),
    ],
  },
  {
    id: 't3-duck-then-jump',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'highObstacle', lane: 0, z: 12 },
      { type: 'lowMine', lane: 0, z: 28 },
      ...low(0, 10, 16),
      ...arc(0, 28),
    ],
  },
  {
    id: 't3-wall-weave',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    placements: [
      pickupSlot(1, 20),
      { type: 'fullBlocker', lane: 0, z: 12 },
      { type: 'fullBlocker', lane: -1, z: 28 },
      ...line(1, 6, 34),
    ],
  },
  {
    id: 't3-arch-gate',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    // Both edges arched: duck through, or hold the middle — which then mines.
    placements: [
      { type: 'highObstacle', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 12 },
      { type: 'lowMine', lane: 0, z: 28 },
      ...line(0, 6, 20),
      ...arc(0, 28),
    ],
  },
  {
    id: 't3-ring-gauntlet',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    // Rings only trip you, but a second trip inside six seconds ends the run,
    // so at this speed they are not free any more.
    placements: [
      { type: 'softObstacle', lane: -1, z: 12 },
      { type: 'softObstacle', lane: 0, z: 28 },
      ...arc(-1, 12),
      ...line(1, 22, 34),
    ],
  },
  {
    id: 't3-squeeze',
    minTier: 3,
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
    id: 't3-mine-arch',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    placements: [
      pickupSlot(0, 20),
      { type: 'lowMine', lane: -1, z: 12 },
      { type: 'highObstacle', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't3-wall-ring',
    minTier: 3,
    maxTier: 3,
    length: LENGTH,
    placements: [
      pickupSlot(0, 20),
      { type: 'fullBlocker', lane: -1, z: 12 },
      { type: 'softObstacle', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
];
