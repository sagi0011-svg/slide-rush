/**
 * The chunk data format (SPEC 6).
 *
 * A chunk is a short, hand-authored pattern of obstacles, coins and an
 * optional pickup slot. Chunks are plain data so they can be checked by the
 * fairness validator without running the game.
 */

import type { Obstacle, ObstacleType } from '../obstacles';

/** What can be placed in a chunk. Coins and pickups arrive in M3 and M4. */
export type PlacementType = ObstacleType | 'coin' | 'pickup';

export interface Placement {
  type: PlacementType;
  /** Lane: -1, 0 or 1. */
  lane: number;
  /** Distance from the start of the chunk, in units. */
  z: number;
}

export interface Chunk {
  /** Unique name, used by the no-repeat rule and by test failures. */
  id: string;
  /** Lowest and highest difficulty tier this chunk may appear in (SPEC 5). */
  minTier: number;
  maxTier: number;
  /** Length of the chunk, in units. */
  length: number;
  placements: readonly Placement[];
}

/** The obstacles in a chunk, in the order the player meets them. */
export function obstaclePlacements(chunk: Chunk): Placement[] {
  return chunk.placements
    .filter((placement) => placement.type !== 'coin' && placement.type !== 'pickup')
    .sort((a, b) => a.z - b.z);
}

/** The chunk's obstacles as they would stand on the track, in absolute units. */
export function chunkObstacles(chunk: Chunk, startS: number): Obstacle[] {
  return obstaclePlacements(chunk).map((placement) => ({
    type: placement.type as ObstacleType,
    lane: placement.lane,
    s: startS + placement.z,
  }));
}
