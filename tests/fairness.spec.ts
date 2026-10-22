import { describe, expect, it } from 'vitest';
import { COINS, DIFFICULTY, PLAYER, POWERUPS, TRACK } from '../src/config';
import { CHUNK_LIBRARY } from '../src/game/chunks';
import { chunkObstacles, coinPlacements, type Chunk } from '../src/game/chunks/types';
import { breatherForTier, chunksForTier } from '../src/game/chunks/spawner';
import { findSurvivablePath, pairNeedsSearch, START_LANES } from '../src/game/fairness';
import { MAX_TIER, tierMaxSpeed } from '../src/game/difficulty';
import { createBox, obstacleBox, type Obstacle } from '../src/game/obstacles';
import { boxesOverlap, playerBox } from '../src/game/collisions';
import { createPlayer, type PlayerState } from '../src/game/player';

/**
 * The fairness rule from SPEC 6: every chunk, and every pair of consecutive
 * chunks, must have a survivable path at the fastest speed its tiers allow,
 * from whichever lane the player happens to arrive in.
 */

/** The worst case for a chunk: the fastest speed any of its tiers can reach. */
function worstSpeed(chunk: Chunk): number {
  return tierMaxSpeed(Math.min(chunk.maxTier, MAX_TIER));
}

function describePath(obstacles: readonly Obstacle[]): string {
  return obstacles.map((o) => `${o.type}@lane${o.lane}/${o.s.toFixed(0)}`).join(', ');
}

/**
 * Every way the player can be standing at a given moment: on their feet,
 * sliding, or at some height in a jump.
 */
function poses(): Array<{ name: string; player: PlayerState; centre: number }> {
  const out: Array<{ name: string; player: PlayerState; centre: number }> = [];

  const standing = createPlayer();
  out.push({ name: 'standing', player: standing, centre: PLAYER.standHeight / 2 });

  const sliding = createPlayer();
  sliding.vertical = 'sliding';
  out.push({ name: 'sliding', player: sliding, centre: PLAYER.slideHeight / 2 });

  for (let height = 0.05; height <= PLAYER.jumpHeight + 1e-9; height += 0.05) {
    const jumping = createPlayer();
    jumping.vertical = 'jumping';
    jumping.height = height;
    out.push({
      name: `jumping at ${height.toFixed(2)}`,
      player: jumping,
      centre: height + PLAYER.standHeight / 2,
    });
  }
  return out;
}

describe('chunk fairness (SPEC 6)', () => {
  it('has a library to check', () => {
    expect(CHUNK_LIBRARY.length).toBeGreaterThanOrEqual(8);
  });

  it('gives every chunk a unique id', () => {
    const ids = CHUNK_LIBRARY.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every placement on a real lane and inside the chunk', () => {
    for (const chunk of CHUNK_LIBRARY) {
      for (const placement of chunk.placements) {
        expect([-1, 0, 1], `${chunk.id}`).toContain(placement.lane);
        expect(placement.z, `${chunk.id}`).toBeGreaterThanOrEqual(0);
        expect(placement.z, `${chunk.id}`).toBeLessThanOrEqual(chunk.length);
      }
      expect(chunk.minTier, chunk.id).toBeLessThanOrEqual(chunk.maxTier);
      expect(chunk.length, chunk.id).toBeGreaterThan(0);
    }
  });

  it('never blocks more than one lane at the same point (SPEC 5, tier 0)', () => {
    for (const chunk of CHUNK_LIBRARY.filter((c) => c.minTier === 0)) {
      const obstacles = chunkObstacles(chunk, 0);
      for (const a of obstacles) {
        const sameMoment = obstacles.filter((b) => b !== a && Math.abs(b.s - a.s) < 6);
        expect(sameMoment.length, `${chunk.id} blocks two lanes at once`).toBe(0);
      }
    }
  });

  it('uses only low mines and full blockers in the warm-up tier (SPEC 5)', () => {
    for (const chunk of chunksForTier(0)) {
      for (const placement of chunk.placements) {
        expect(['lowMine', 'fullBlocker', 'coin', 'pickup'], chunk.id).toContain(placement.type);
      }
    }
  });

  describe('every chunk on its own is survivable', () => {
    for (const chunk of CHUNK_LIBRARY) {
      for (const startLane of START_LANES) {
        it(`${chunk.id} from lane ${startLane}`, () => {
          const obstacles = chunkObstacles(chunk, 0);
          const result = findSurvivablePath(obstacles, {
            speed: worstSpeed(chunk),
            startS: 0,
            endS: chunk.length,
            startLane,
          });
          expect(result.exhausted, `${chunk.id}: search gave up`).toBe(false);
          expect(
            result.survivable,
            `${chunk.id} is unfair from lane ${startLane}: ${describePath(obstacles)}`,
          ).toBe(true);
        });
      }
    }
  });

  describe('every pair of consecutive chunks is survivable', () => {
    /**
     * A pair only has to be checked at the hardest tier that allows both
     * chunks: a higher tier is strictly harder, because it is faster and its
     * breather is shorter.
     */
    const hardestTier = new Map<string, { first: Chunk; second: Chunk; tier: number }>();
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      for (const first of chunksForTier(tier)) {
        for (const second of chunksForTier(tier)) {
          // The spawner never repeats a chunk back to back (SPEC 6).
          if (first.id === second.id) continue;
          hardestTier.set(`${first.id}>${second.id}`, { first, second, tier });
        }
      }
    }
    const pairs = [...hardestTier.values()];

    it('has pairs to check', () => {
      expect(pairs.length).toBeGreaterThan(0);
    });

    for (const { first, second, tier } of pairs) {
      it(`${first.id} -> ${second.id} at tier ${tier}`, () => {
        const speed = tierMaxSpeed(tier);
        const secondStart = first.length + breatherForTier(tier);
        const firstObstacles = chunkObstacles(first, 0);
        const secondObstacles = chunkObstacles(second, secondStart);
        const lastOfFirst = firstObstacles.at(-1)?.s ?? null;
        const firstOfSecond = secondObstacles[0]?.s ?? null;

        // A wide enough gap means the pair follows from the two single-chunk
        // checks, so there is nothing new to search.
        if (!pairNeedsSearch(lastOfFirst, firstOfSecond, speed)) return;

        const obstacles = [...firstObstacles, ...secondObstacles];
        for (const startLane of START_LANES) {
          const result = findSurvivablePath(obstacles, {
            speed,
            startS: 0,
            endS: secondStart + second.length,
            startLane,
          });
          expect(result.exhausted, `${first.id} -> ${second.id}: search gave up`).toBe(false);
          expect(
            result.survivable,
            `${first.id} -> ${second.id} at tier ${tier} is unfair from lane ${startLane}: ` +
              describePath(obstacles),
          ).toBe(true);
        }
      });
    }
  });
});

describe('the validator itself', () => {
  it('rejects a wall across all three lanes', () => {
    const obstacles: Obstacle[] = [
      { type: 'fullBlocker', lane: -1, s: 20 },
      { type: 'fullBlocker', lane: 0, s: 20 },
      { type: 'fullBlocker', lane: 1, s: 20 },
    ];
    const result = findSurvivablePath(obstacles, {
      speed: 15,
      startS: 0,
      endS: 40,
      startLane: 0,
    });
    expect(result.survivable).toBe(false);
  });

  it('rejects obstacles that demand more lane changes than there is time for', () => {
    // Forced into the far left lane, then into the far right one a tenth of a
    // second later: crossing two lanes takes 0.3 s, so nothing can save it.
    const speed = 30;
    const obstacles: Obstacle[] = [
      { type: 'fullBlocker', lane: 0, s: 20 },
      { type: 'fullBlocker', lane: 1, s: 20 },
      { type: 'fullBlocker', lane: -1, s: 23 },
      { type: 'fullBlocker', lane: 0, s: 23 },
    ];
    const result = findSurvivablePath(obstacles, {
      speed,
      startS: 0,
      endS: 40,
      startLane: 0,
    });
    expect(result.survivable).toBe(false);
  });

  it('never returns a path whose moves are closer than the reaction time', () => {
    // Whatever it finds, a human could actually do it (SPEC 5).
    for (const chunk of CHUNK_LIBRARY) {
      const speed = worstSpeed(chunk);
      const result = findSurvivablePath(chunkObstacles(chunk, 0), {
        speed,
        startS: 0,
        endS: chunk.length,
        startLane: 1,
      });
      for (let i = 1; i < result.path.length; i += 1) {
        const gap = ((result.path[i]?.atS ?? 0) - (result.path[i - 1]?.atS ?? 0)) / speed;
        expect(gap, `${chunk.id}: two moves only ${gap.toFixed(2)} s apart`).toBeGreaterThanOrEqual(
          DIFFICULTY.minReactionTime - 1e-9,
        );
      }
    }
  });

  it('accepts an empty stretch of track', () => {
    const result = findSurvivablePath([], { speed: 32, startS: 0, endS: 80, startLane: 0 });
    expect(result.survivable).toBe(true);
    expect(result.path).toHaveLength(0);
  });

  it('finds the jump over a lone mine when every lane is blocked around it', () => {
    const obstacles: Obstacle[] = [
      { type: 'lowMine', lane: 0, s: 25 },
      { type: 'fullBlocker', lane: -1, s: 25 },
      { type: 'fullBlocker', lane: 1, s: 25 },
    ];
    const result = findSurvivablePath(obstacles, {
      speed: 15,
      startS: 0,
      endS: TRACK.chunkLength,
      startLane: 0,
    });
    expect(result.survivable).toBe(true);
    expect(result.path.map((move) => move.action)).toContain('jump');
  });

  it('finds the slide under a lone arch when every lane is blocked around it', () => {
    const obstacles: Obstacle[] = [
      { type: 'highObstacle', lane: 0, s: 25 },
      { type: 'fullBlocker', lane: -1, s: 25 },
      { type: 'fullBlocker', lane: 1, s: 25 },
    ];
    const result = findSurvivablePath(obstacles, {
      speed: 15,
      startS: 0,
      endS: TRACK.chunkLength,
      startLane: 0,
    });
    expect(result.survivable).toBe(true);
    expect(result.path.map((move) => move.action)).toContain('slide');
  });

  it('treats a soft obstacle as something to avoid too', () => {
    // The validator is strict: it wants a path with no hits at all, even ones
    // that would only be a stumble.
    const obstacles: Obstacle[] = [
      { type: 'softObstacle', lane: 0, s: 25 },
      { type: 'fullBlocker', lane: -1, s: 25 },
      { type: 'fullBlocker', lane: 1, s: 25 },
    ];
    const result = findSurvivablePath(obstacles, {
      speed: 15,
      startS: 0,
      endS: TRACK.chunkLength,
      startLane: 0,
    });
    expect(result.survivable).toBe(true);
    expect(result.path.map((move) => move.action)).toContain('jump');
  });
});

describe('coin trails (SPEC 6 and 8)', () => {
  it('puts coins in every chunk that is not a breather', () => {
    const withCoins = CHUNK_LIBRARY.filter((chunk) =>
      chunk.placements.some((placement) => placement.type === 'coin'),
    );
    expect(withCoins.length).toBe(CHUNK_LIBRARY.length);
  });

  it('never puts a coin somewhere it can only be reached by being hit', () => {
    // Coins are meant to show the way through. A coin that can only be
    // collected from a pose that hits something would do the exact opposite.
    const box = createBox();

    for (const chunk of CHUNK_LIBRARY) {
      const obstacles = chunkObstacles(chunk, 0);

      for (const coin of coinPlacements(chunk)) {
        const coinY = coin.y ?? COINS.restHeight;

        // Only obstacles the player would be inside when taking this coin matter.
        const inTheWay = obstacles.filter((obstacle) => {
          if (obstacle.lane !== coin.lane) return false;
          obstacleBox(obstacle, box);
          return Math.abs(coin.z - box.z) < box.halfD + PLAYER.radius;
        });
        if (inTheWay.length === 0) continue;

        const safe = poses().filter((pose) => {
          // Close enough to pick the coin up?
          if (Math.abs(pose.centre - coinY) > COINS.pickupRadius) return false;
          // And not touching anything while doing it?
          return inTheWay.every((obstacle) => {
            const player = playerBox(pose.player, coin.z, createBox());
            return !boxesOverlap(player, obstacleBox(obstacle, createBox()));
          });
        });

        expect(
          safe.length,
          `${chunk.id}: the coin at lane ${coin.lane}, z ${coin.z}, height ${coinY} ` +
            `can only be taken by hitting ${inTheWay.map((o) => o.type).join(' or ')}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every coin within reach of a player on the slide', () => {
    // Nothing should be floating higher than a jump can take you.
    for (const chunk of CHUNK_LIBRARY) {
      for (const coin of coinPlacements(chunk)) {
        const y = coin.y ?? COINS.restHeight;
        expect(y, `${chunk.id}: a coin at height ${y}`).toBeGreaterThan(0);
        expect(y, `${chunk.id}: a coin at height ${y}`).toBeLessThanOrEqual(
          PLAYER.jumpHeight + COINS.pickupRadius,
        );
      }
    }
  });

  it('never stacks two coins in the same spot', () => {
    for (const chunk of CHUNK_LIBRARY) {
      const seen = new Set<string>();
      for (const coin of coinPlacements(chunk)) {
        const key = `${coin.lane}/${coin.z.toFixed(2)}/${(coin.y ?? COINS.restHeight).toFixed(2)}`;
        expect(seen.has(key), `${chunk.id}: two coins at ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });
});

describe('pickup slots (SPEC 9)', () => {
  it('offers somewhere to put a pickup', () => {
    const withSlots = CHUNK_LIBRARY.filter((chunk) =>
      chunk.placements.some((placement) => placement.type === 'pickup'),
    );
    expect(withSlots.length).toBeGreaterThanOrEqual(3);
  });

  it('never puts two slots in one chunk', () => {
    for (const chunk of CHUNK_LIBRARY) {
      const slots = chunk.placements.filter((placement) => placement.type === 'pickup');
      expect(slots.length, chunk.id).toBeLessThanOrEqual(1);
    }
  });

  it('never puts a pickup somewhere it can only be reached by being hit', () => {
    // The same rule as the coins: a power-up that lures you into a wall would
    // be worse than no power-up at all.
    const reach = COINS.pickupRadius + POWERUPS.pickupSize / 2;

    for (const chunk of CHUNK_LIBRARY) {
      const obstacles = chunkObstacles(chunk, 0);
      const slot = chunk.placements.find((placement) => placement.type === 'pickup');
      if (slot === undefined) continue;

      const slotY = slot.y ?? POWERUPS.pickupHeight;
      const inTheWay = obstacles.filter((obstacle) => {
        if (obstacle.lane !== slot.lane) return false;
        obstacleBox(obstacle, createBox());
        return Math.abs(slot.z - obstacle.s) < 3 + PLAYER.radius;
      });

      const safe = poses().filter((pose) => {
        if (Math.abs(pose.centre - slotY) > reach) return false;
        return inTheWay.every(
          (obstacle) =>
            !boxesOverlap(
              playerBox(pose.player, slot.z, createBox()),
              obstacleBox(obstacle, createBox()),
            ),
        );
      });

      expect(
        safe.length,
        `${chunk.id}: the pickup at lane ${slot.lane}, z ${slot.z} cannot be taken safely`,
      ).toBeGreaterThan(0);
    }
  });
});
