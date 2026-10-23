/**
 * Tier 2 chunks: 90 to 180 seconds (SPEC 5).
 *
 * Denser, and built around combinations — jump then step aside, duck then
 * jump, or a gate that leaves exactly one lane open. The speed reaches its
 * ceiling of 32 units a second here, but there is still a short breather
 * between chunks, so these have a little more room than the tier 3 pool.
 *
 * Chunks that may also be drawn at tier 3 keep to the tighter tier 3
 * geometry; tests/chunk-rules.spec.ts holds each one to the limits of the
 * hardest tier it can appear in.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { arc, line, low, pickupSlot } from './helpers';

const LENGTH = TRACK.chunkLength;

export const TIER2_CHUNKS: readonly Chunk[] = [
  {
    id: 't2-jump-then-shift',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // Clear the mine, land, and be off that lane before the wall.
    placements: [
      { type: 'lowMine', lane: 0, z: 12 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...arc(0, 12),
      ...line(1, 24, 34),
    ],
  },
  {
    id: 't2-duck-then-shift',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'highObstacle', lane: 0, z: 12 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...low(0, 10, 16),
      ...line(-1, 24, 34),
    ],
  },
  {
    id: 't2-gate-left',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // Two lanes shut at once: there is exactly one way through.
    placements: [
      pickupSlot(-1, 16),
      { type: 'fullBlocker', lane: 0, z: 26 },
      { type: 'fullBlocker', lane: 1, z: 26 },
      ...line(-1, 6, 34),
    ],
  },
  {
    id: 't2-mine-staircase',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // A step across the lanes. Weave it, or simply jump.
    placements: [
      pickupSlot(0, 20),
      { type: 'lowMine', lane: -1, z: 12 },
      { type: 'lowMine', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't2-ring-then-wall',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    placements: [
      { type: 'softObstacle', lane: 0, z: 12 },
      { type: 'fullBlocker', lane: 0, z: 28 },
      ...arc(0, 12),
      ...line(-1, 24, 34),
    ],
  },
  {
    id: 't2-arch-run',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // Two arches in the same lane: stay down, or step out and back.
    placements: [
      { type: 'highObstacle', lane: 0, z: 12 },
      { type: 'highObstacle', lane: 0, z: 28 },
      ...low(0, 10, 30),
    ],
  },
  {
    id: 't2-side-gates',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    placements: [
      pickupSlot(0, 20),
      { type: 'fullBlocker', lane: -1, z: 12 },
      { type: 'fullBlocker', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't2-arch-over-mine',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // The arch and the mine share a lane: duck then jump, or step across.
    placements: [
      pickupSlot(0, 20),
      { type: 'highObstacle', lane: 1, z: 12 },
      { type: 'lowMine', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't2-ring-pair',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    placements: [
      pickupSlot(0, 20),
      { type: 'softObstacle', lane: -1, z: 12 },
      { type: 'softObstacle', lane: 1, z: 28 },
      ...line(0, 6, 34),
    ],
  },
  {
    id: 't2-long-wall',
    minTier: 2,
    maxTier: 3,
    length: LENGTH,
    // One thing only, but late enough to need noticing.
    placements: [pickupSlot(-1, 20), { type: 'fullBlocker', lane: 1, z: 24 }, ...line(-1, 8, 34)],
  },
];
