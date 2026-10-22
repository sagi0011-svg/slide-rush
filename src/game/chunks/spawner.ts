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

import { COINS, POWERUPS, TRACK } from '../../config';
import type { Rng } from '../rng';
import type { Obstacle, ObstacleType } from '../obstacles';
import { createCoinPool, placeCoin, type PooledCoin } from '../coins';
import { createPickup, randomPickupType, type Pickup } from '../pickups';
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
  /** The one power-up pickup allowed on the track at a time (SPEC 9). */
  readonly pickup: Pickup;
  /**
   * Asks for a pickup to be put in the next chunk that offers a slot. Ignored
   * if one is already on the track.
   */
  requestPickup(): void;
  /** True while a pickup is waiting for a slot. */
  readonly pickupPending: boolean;
  /**
   * Builds track ahead and retires what is behind.
   *
   * @param playerS how far the player has travelled, in units
   * @param tier the current difficulty tier
   * @param easyOnly keep the track gentle, for the moments around a boost
   *   (SPEC 9)
   */
  update(playerS: number, tier: number, easyOnly?: boolean): void;
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

/** How many obstacles a chunk puts in the player's way. */
export function chunkObstacleCount(chunk: Chunk): number {
  return chunk.placements.filter((placement) => isObstacleType(placement.type)).length;
}

/**
 * The gentle chunks, used while a boost is running and for a moment after it
 * ends, so the player is never dropped straight into something hard (SPEC 9).
 */
export function easyChunks(chunks: readonly Chunk[]): Chunk[] {
  return chunks.filter((chunk) => chunkObstacleCount(chunk) <= POWERUPS.easyChunkObstacles);
}

/** The empty gap placed after a chunk at this tier, in units. */
export function breatherForTier(tier: number): number {
  const gaps = TRACK.breatherByTier;
  const index = Math.min(Math.max(tier, 0), gaps.length - 1);
  return gaps[index] as number;
}

/**
 * @param scripted chunks laid down in order before the random ones, used by
 *   the first-run tutorial so its three lessons always arrive in the same
 *   place (SPEC 11)
 */
export function createSpawner(
  rng: Rng,
  library: readonly Chunk[] = CHUNK_LIBRARY,
  scripted: readonly Chunk[] = [],
): Spawner {
  const obstacles: PooledObstacle[] = [];
  for (let i = 0; i < TRACK.obstaclePoolSize; i += 1) {
    obstacles.push({ active: false, type: 'lowMine', lane: 0, s: 0 });
  }
  const coins: PooledCoin[] = createCoinPool();
  const pickup: Pickup = createPickup();
  let pickupPending = false;

  /** Where the next chunk will start, in units from the start of the slide. */
  let nextChunkS = 0;
  let lastChunkId: string | null = null;
  let scriptedPlaced = 0;
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
      if (placement.type === 'pickup') {
        // Only one pickup is ever on the track, and only when one is due.
        if (!pickupPending || pickup.active) continue;
        pickup.active = true;
        pickup.type = randomPickupType(rng);
        pickup.lane = placement.lane;
        pickup.s = startS + placement.z;
        pickup.y = placement.y ?? POWERUPS.pickupHeight;
        pickupPending = false;
        continue;
      }

      if (placement.type === 'coin') {
        const slot = takeCoin();
        if (slot === null) {
          overflowed = true;
          continue;
        }
        placeCoin(slot, placement.lane, startS + placement.z, placement.y ?? COINS.restHeight);
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

  const pick = (tier: number, easyOnly: boolean): Chunk | null => {
    // The scripted opening comes first, in order, whatever the tier says.
    if (scriptedPlaced < scripted.length) {
      const next = scripted[scriptedPlaced] as Chunk;
      scriptedPlaced += 1;
      return next;
    }

    const forTier = chunksForTier(tier, library);
    if (forTier.length === 0) return null;

    // Around a boost, prefer the gentle chunks — but never run out of track
    // if this tier has none.
    const easy = easyOnly ? easyChunks(forTier) : [];
    const allowed = easy.length > 0 ? easy : forTier;
    if (allowed.length === 1) return allowed[0] as Chunk;

    // Never the same chunk twice in a row (SPEC 6).
    const fresh = allowed.filter((chunk) => chunk.id !== lastChunkId);
    return rng.pick(fresh.length > 0 ? fresh : allowed);
  };

  return {
    obstacles,
    coins,
    pickup,
    get pickupPending() {
      return pickupPending;
    },
    requestPickup() {
      if (!pickup.active) pickupPending = true;
    },
    get lastChunkId() {
      return lastChunkId;
    },

    update(playerS: number, tier: number, easyOnly = false) {
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
      if (pickup.active && pickup.s < playerS - TRACK.despawnBehind) {
        pickup.active = false;
      }

      // If the player is suddenly far ahead — a restart, or a very long stall —
      // skip the track they never saw instead of building it behind them.
      const buildFrom = playerS - TRACK.despawnBehind;
      if (nextChunkS < buildFrom) nextChunkS = buildFrom;

      // Build forward until the track is full far enough ahead.
      let guard = 0;
      while (nextChunkS < playerS + TRACK.buildAhead) {
        const chunk = pick(tier, easyOnly);
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
      pickup.active = false;
      pickupPending = false;
      nextChunkS = 0;
      lastChunkId = null;
      scriptedPlaced = 0;
    },
  };
}
