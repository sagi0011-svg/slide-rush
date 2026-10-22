/**
 * The chunk library (SPEC 6).
 *
 * Hand-authored patterns, grouped by the difficulty tier they belong to
 * (SPEC 5). The spawner only ever picks from the chunks a tier allows, so a
 * chunk's tier range is what decides when the player meets it.
 *
 * Every chunk, and every pair of chunks that can follow one another, is
 * checked by the fairness validator in tests/fairness.spec.ts.
 */

import { WARMUP_CHUNKS } from './warmup';
import { TIER1_CHUNKS } from './tier1';
import { TIER2_CHUNKS } from './tier2';
import { TIER3_CHUNKS } from './tier3';
import type { Chunk } from './types';

export const CHUNK_LIBRARY: readonly Chunk[] = [
  ...WARMUP_CHUNKS,
  ...TIER1_CHUNKS,
  ...TIER2_CHUNKS,
  ...TIER3_CHUNKS,
];

/** Looks a chunk up by id, for tests and debugging. */
export function chunkById(id: string): Chunk | undefined {
  return CHUNK_LIBRARY.find((chunk) => chunk.id === id);
}

export type { Chunk, Placement, PlacementType } from './types';
export { obstaclePlacements, coinPlacements, chunkObstacles } from './types';
