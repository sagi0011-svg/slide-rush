/**
 * The chunk library (SPEC 6).
 *
 * All authored chunks in one place. M5 grows this to 25+ chunks across tiers.
 */

import { WARMUP_CHUNKS } from './warmup';
import type { Chunk } from './types';

export const CHUNK_LIBRARY: readonly Chunk[] = [...WARMUP_CHUNKS];

/** Looks a chunk up by id, for tests and debugging. */
export function chunkById(id: string): Chunk | undefined {
  return CHUNK_LIBRARY.find((chunk) => chunk.id === id);
}

export type { Chunk, Placement, PlacementType } from './types';
export { obstaclePlacements } from './types';
