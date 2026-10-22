import { describe, expect, it } from 'vitest';
import { DIFFICULTY, PLAYER, TRACK } from '../src/config';
import { CHUNK_LIBRARY } from '../src/game/chunks';
import { TUTORIAL_CHUNKS } from '../src/game/chunks/tutorial';
import { chunkObstacles, type Chunk } from '../src/game/chunks/types';
import { breatherForTier, chunksForTier, createSpawner } from '../src/game/chunks/spawner';
import { MAX_TIER, tierForTime, tierMaxSpeed } from '../src/game/difficulty';
import { forwardSpeed } from '../src/game/speed';
import { createRng } from '../src/game/rng';
import type { Obstacle } from '../src/game/obstacles';

/**
 * The geometry a chunk has to obey to stand a chance of being fair.
 *
 * The fairness validator is the real authority, but it works by searching and
 * is slow to tell you *why* something failed. These rules are the same
 * requirements expressed as distances, so a chunk that breaks one says so in
 * a line instead of after a minute of searching.
 *
 * Everything here is worked out from the spec's own numbers: how long a lane
 * change takes, how long the player needs to react, and how fast the chunk's
 * hardest tier runs.
 */

/** Obstacles close enough together to count as one thing to deal with. */
function groupsOf(obstacles: readonly Obstacle[]): Obstacle[][] {
  const groups: Obstacle[][] = [];
  for (const obstacle of [...obstacles].sort((a, b) => a.s - b.s)) {
    const last = groups.at(-1);
    if (last !== undefined && obstacle.s - (last[0] as Obstacle).s < 4) {
      last.push(obstacle);
    } else {
      groups.push([obstacle]);
    }
  }
  return groups;
}

/** How many lanes a group shuts off completely — a jump or a duck gets past
 * the others, but a wall has to be gone around. */
function lanesWalled(group: readonly Obstacle[]): number {
  return new Set(
    group.filter((obstacle) => obstacle.type === 'fullBlocker').map((obstacle) => obstacle.lane),
  ).size;
}

interface Limits {
  speed: number;
  /** The soonest a chunk may put anything in the player's way. */
  firstZ: number;
  /** The latest it may. */
  lastZ: number;
  /** The least room between two things the player has to deal with. */
  betweenGroups: number;
  /** How far in a group that shuts two lanes has to be. */
  twoLaneZ: number;
}

function limitsFor(maxTier: number): Limits {
  const speed = tierMaxSpeed(maxTier);
  const react = DIFFICULTY.minReactionTime * speed;
  const oneLane = PLAYER.laneChangeTime * speed;
  const twoLanes = (PLAYER.laneChangeTime * 2 + DIFFICULTY.minReactionTime) * speed;
  const breather = breatherForTier(maxTier);

  // The junction rule: whatever room the end of a chunk leaves, plus the
  // breather, plus the room the next chunk leaves at its start, has to be
  // enough to react and change lane.
  const junction = react + oneLane;
  const lastZ = TRACK.chunkLength - (junction - breather) / 2;
  const firstZ = (junction - breather) / 2;

  return {
    speed,
    firstZ: Math.max(firstZ, oneLane),
    lastZ: Math.min(lastZ, TRACK.chunkLength - 4),
    betweenGroups: react,
    twoLaneZ: twoLanes,
  };
}

describe('chunk design rules', () => {
  it('has at least 25 chunks (SPEC 6)', () => {
    expect(CHUNK_LIBRARY.length).toBeGreaterThanOrEqual(25);
  });

  it('gives every tier a decent pool to pick from', () => {
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      expect(chunksForTier(tier).length, `tier ${tier}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('leaves every tier something gentle for the moments around a boost', () => {
    // The spawner keeps to easy chunks while a boost runs (SPEC 9).
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      const easy = chunksForTier(tier).filter((chunk) => chunkObstacles(chunk, 0).length <= 1);
      expect(easy.length, `tier ${tier} has no easy chunk`).toBeGreaterThan(0);
    }
  });

  describe('spacing', () => {
    const check = (chunk: Chunk): string[] => {
      const limits = limitsFor(chunk.maxTier);
      const groups = groupsOf(chunkObstacles(chunk, 0));
      const problems: string[] = [];
      if (groups.length === 0) return problems;

      const first = (groups[0] as Obstacle[])[0] as Obstacle;
      if (first.s < limits.firstZ) {
        problems.push(
          `starts at ${first.s}, too soon for tier ${chunk.maxTier} ` +
            `(needs ${limits.firstZ.toFixed(1)})`,
        );
      }

      const last = (groups.at(-1) as Obstacle[])[0] as Obstacle;
      if (last.s > limits.lastZ) {
        problems.push(
          `ends at ${last.s}, too late for tier ${chunk.maxTier} ` +
            `(needs ${limits.lastZ.toFixed(1)})`,
        );
      }

      for (let i = 1; i < groups.length; i += 1) {
        const gap =
          ((groups[i] as Obstacle[])[0] as Obstacle).s -
          ((groups[i - 1] as Obstacle[])[0] as Obstacle).s;
        if (gap < limits.betweenGroups) {
          problems.push(
            `only ${gap.toFixed(1)} between two groups (needs ${limits.betweenGroups.toFixed(1)})`,
          );
        }
      }

      for (const group of groups) {
        const walled = lanesWalled(group);
        if (walled >= 3) {
          problems.push(`walls off every lane at ${(group[0] as Obstacle).s}`);
        } else if (walled === 2 && (group[0] as Obstacle).s < limits.twoLaneZ) {
          problems.push(
            `walls off two lanes at ${(group[0] as Obstacle).s}, too soon ` +
              `(needs ${limits.twoLaneZ.toFixed(1)})`,
          );
        }
      }

      return problems;
    };

    // The tutorial's own chunks are held to the same rules.
    for (const chunk of [...CHUNK_LIBRARY, ...TUTORIAL_CHUNKS]) {
      it(chunk.id, () => {
        expect(check(chunk).join('; ')).toBe('');
      });
    }
  });

  describe('tier contents (SPEC 5)', () => {
    it('keeps the warm-up to low mines and full blockers', () => {
      for (const chunk of chunksForTier(0)) {
        for (const placement of chunk.placements) {
          expect(['lowMine', 'fullBlocker', 'coin', 'pickup'], chunk.id).toContain(placement.type);
        }
      }
    });

    it('introduces the arch and the ring at tier 1', () => {
      const newTypes = chunksForTier(1).flatMap((chunk) =>
        chunk.placements.map((placement) => placement.type),
      );
      expect(newTypes).toContain('highObstacle');
      expect(newTypes).toContain('softObstacle');
    });

    it('gets denser as the tiers go up', () => {
      const averageObstacles = (tier: number): number => {
        const chunks = chunksForTier(tier);
        const total = chunks.reduce((sum, chunk) => sum + chunkObstacles(chunk, 0).length, 0);
        return total / chunks.length;
      };
      expect(averageObstacles(3)).toBeGreaterThan(averageObstacles(0));
    });

    it('uses all four obstacle types by the top tier', () => {
      const types = new Set(
        chunksForTier(3).flatMap((chunk) =>
          chunkObstacles(chunk, 0).map((obstacle) => obstacle.type),
        ),
      );
      expect([...types].sort()).toEqual(
        ['fullBlocker', 'highObstacle', 'lowMine', 'softObstacle'].sort(),
      );
    });
  });
});

describe('a four minute run (SPEC 5)', () => {
  /**
   * Walks the spawner through four minutes of track, the way a run would, and
   * checks the shape of what it builds: the tiers arrive on time, the chunks
   * come from the right pool, nothing repeats back to back, and the track
   * genuinely gets busier as it goes.
   */
  function walk(seed: number) {
    const rng = createRng(seed);
    const spawner = createSpawner(rng);
    const perTier = new Map<number, string[]>();
    let distance = 0;

    for (let t = 0; t < 240; t += 1 / 60) {
      const tier = tierForTime(t);
      distance += forwardSpeed(t) / 60;
      const before = spawner.lastChunkId;
      spawner.update(distance, tier);
      const after = spawner.lastChunkId;
      if (after !== null && after !== before) {
        const list = perTier.get(tier) ?? [];
        list.push(after);
        perTier.set(tier, list);
      }
    }
    return perTier;
  }

  it('reaches every tier inside four minutes', () => {
    const perTier = walk(1);
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      expect(perTier.get(tier)?.length ?? 0, `tier ${tier} never came up`).toBeGreaterThan(0);
    }
  });

  it('only ever spawns chunks the tier allows', () => {
    const perTier = walk(2);
    for (const [tier, ids] of perTier) {
      const allowed = new Set(chunksForTier(tier).map((chunk) => chunk.id));
      for (const id of ids) {
        expect(allowed.has(id), `${id} appeared at tier ${tier}`).toBe(true);
      }
    }
  });

  it('never repeats a chunk back to back (SPEC 6)', () => {
    for (let seed = 0; seed < 6; seed += 1) {
      const all = [...walk(seed).values()].flat();
      for (let i = 1; i < all.length; i += 1) {
        expect(all[i], `seed ${seed}`).not.toBe(all[i - 1]);
      }
    }
  });

  it('works through a good spread of the library, not the same few', () => {
    const seen = new Set([...walk(3).values()].flat());
    expect(seen.size).toBeGreaterThanOrEqual(Math.floor(CHUNK_LIBRARY.length * 0.6));
  });

  it('gets busier as the run goes on', () => {
    const perTier = walk(4);
    const density = (tier: number): number => {
      const ids = perTier.get(tier) ?? [];
      if (ids.length === 0) return 0;
      const total = ids.reduce((sum, id) => {
        const chunk = CHUNK_LIBRARY.find((c) => c.id === id);
        return sum + (chunk === undefined ? 0 : chunkObstacles(chunk, 0).length);
      }, 0);
      // Per unit of track, counting the breather, so the gaps count too.
      return total / (ids.length * (TRACK.chunkLength + breatherForTier(tier)));
    };
    expect(density(3)).toBeGreaterThan(density(0));
    expect(density(2)).toBeGreaterThan(density(0));
  });
});
