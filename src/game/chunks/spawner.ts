/**
 * The chunk spawner (SPEC 6).
 *
 * Fills the track ahead of the player with chunks picked from the pool allowed
 * by the current tier, never the same chunk twice in a row, with a short empty
 * breather between them at the lower tiers.
 *
 * Obstacles live in a fixed pool that is never grown or reallocated, so the
 * hot loop makes no garbage (CLAUDE.md rule 7). All randomness goes through
 * the run's seeded RNG (rule 6).
 */

import { COINS, TRACK } from '../../config';
import type { Rng } from '../rng';
import type { Obstacle, ObstacleType } from '../obstacles';
import { createCoinPool, type PooledCoin } from '../coins';
import type { Chunk } from './types';
import { CHUNK_LIBRARY } from './index';

/** An obstacle slot in the pool. Inactive slots are reused. */
export interface PooledObstacle extends Obstacle {
  active: boolean;
}

export interface Spawner {
  /** Every slot in the pool. Only the ones with `active` set are on the track. */
  readonly obstacles: readonly PooledObstacle[];
  /** The same, for coins. */
  readonly coins: readonly PooledCoin[];
  /**
   * Builds track ahead and retires what is behind.
   *
   * @param playerS how far the player has travelled, in units
   * @param tier the current difficulty tier
   */
  update(playerS: number, tier: number): void;
  /** The chunk most recently placed, for the debug overlay and tests. */
  readonly lastChunkId: string | null;
  /** Clears everything, for a restart. */
  reset(): void;
}

function isObstacleType(type: string): type is ObstacleType {
  return type !== 'coin' && type !== 'pickup';
}

/** The chunks a tier is allowed to use. */
export function chunksForTier(tier: number, library: readonly Chunk[] = CHUNK_LIBRARY): Chunk[] {
  return library.filter((chunk) => tier >= chunk.minTier && tier <= chunk.maxTier);
}

/** The empty gap placed after a chunk at this tier, in units. */
export function breatherForTier(tier: number): number {
  const gaps = TRACK.breatherByTier;
  const index = Math.min(Math.max(tier, 0), gaps.length - 1);
  return gaps[index] as number;
}

export function createSpawner(rng: Rng, library: readonly Chunk[] = CHUNK_LIBRARY): Spawner {
  const obstacles: PooledObstacle[] = [];
  for (let i = 0; i < TRACK.obstaclePoolSize; i += 1) {
    obstacles.push({ active: false, type: 'lowMine', lane: 0, s: 0 });
  }
  const coins: PooledCoin[] = createCoinPool();

  /** Where the next chunk will start, in units from the start of the slide. */
  let nextChunkS = 0;
  let lastChunkId: string | null = null;
  /** Counted so a full pool is a loud failure in tests, not a silent gap. */
  let overflowed = false;

  const takeObstacle = (): PooledObstacle | null => {
    for (const slot of obstacles) {
      if (!slot.active) return slot;
    }
    return null;
  };

  const takeCoin = (): PooledCoin | null => {
    for (const slot of coins) {
      if (!slot.active) return slot;
    }
    return null;
  };

  const placeChunk = (chunk: Chunk, startS: number): void => {
    for (const placement of chunk.placements) {
      if (placement.type === 'pickup') continue; // power-ups: M4

      if (placement.type === 'coin') {
        const slot = takeCoin();
        if (slot === null) {
          overflowed = true;
          continue;
        }
        slot.active = true;
        slot.lane = placement.lane;
        slot.s = startS + placement.z;
        slot.y = placement.y ?? COINS.restHeight;
        continue;
      }

      if (!isObstacleType(placement.type)) continue;
      const slot = takeObstacle();
      if (slot === null) {
        overflowed = true;
        return;
      }
      slot.active = true;
      slot.type = placement.type;
      slot.lane = placement.lane;
      slot.s = startS + placement.z;
    }
  };

  const pick = (tier: number): Chunk | null => {
    const allowed = chunksForTier(tier, library);
    if (allowed.length === 0) return null;
    if (allowed.length === 1) return allowed[0] as Chunk;
    // Never the same chunk twice in a row (SPEC 6).
    const fresh = allowed.filter((chunk) => chunk.id !== lastChunkId);
    return rng.pick(fresh.length > 0 ? fresh : allowed);
  };

  return {
    obstacles,
    coins,
    get lastChunkId() {
      return lastChunkId;
    },

    update(playerS: number, tier: number) {
      // Retire what the player has already passed.
      for (const slot of obstacles) {
        if (slot.active && slot.s < playerS - TRACK.despawnBehind) {
          slot.active = false;
        }
      }
      for (const slot of coins) {
        if (slot.active && slot.s < playerS - TRACK.despawnBehind) {
          slot.active = false;
        }
      }

      // If the player is suddenly far ahead — a restart, or a very long stall —
      // skip the track they never saw instead of building it behind them.
      const buildFrom = playerS - TRACK.despawnBehind;
      if (nextChunkS < buildFrom) nextChunkS = buildFrom;

      // Build forward until the track is full far enough ahead.
      let guard = 0;
      while (nextChunkS < playerS + TRACK.buildAhead) {
        const chunk = pick(tier);
        if (chunk === null) break;
        placeChunk(chunk, nextChunkS);
        lastChunkId = chunk.id;
        nextChunkS += chunk.length + breatherForTier(tier);
        guard += 1;
        // A chunk of zero length would otherwise spin here forever.
        if (guard > 64) break;
      }

      if (overflowed) {
        console.warn('Slide Rush: a spawn pool is full; raise its size in src/config.ts');
        overflowed = false;
      }
    },

    reset() {
      for (const slot of obstacles) slot.active = false;
      for (const slot of coins) slot.active = false;
      nextChunkS = 0;
      lastChunkId = null;
    },
  };
}
