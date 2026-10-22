import { describe, expect, it } from 'vitest';
import { SPEED, TRACK } from '../src/config';
import { createRng } from '../src/game/rng';
import { breatherForTier, chunksForTier, createSpawner } from '../src/game/chunks/spawner';
import { CHUNK_LIBRARY } from '../src/game/chunks';
import { MAX_TIER, tierForTime, tierMaxSpeed, tierStartTime } from '../src/game/difficulty';
import type { Chunk } from '../src/game/chunks/types';

function activeCount(spawner: ReturnType<typeof createSpawner>): number {
  return spawner.obstacles.filter((obstacle) => obstacle.active).length;
}

describe('difficulty tiers (SPEC 5)', () => {
  it('moves up a tier at 30, 90 and 180 seconds', () => {
    expect(tierForTime(0)).toBe(0);
    expect(tierForTime(29.9)).toBe(0);
    expect(tierForTime(30)).toBe(1);
    expect(tierForTime(89.9)).toBe(1);
    expect(tierForTime(90)).toBe(2);
    expect(tierForTime(179.9)).toBe(2);
    expect(tierForTime(180)).toBe(3);
    expect(tierForTime(10_000)).toBe(3);
  });

  it('starts each tier where the spec says', () => {
    expect(tierStartTime(0)).toBe(0);
    expect(tierStartTime(1)).toBe(30);
    expect(tierStartTime(2)).toBe(90);
    expect(tierStartTime(3)).toBe(180);
  });

  it('reports the fastest speed a tier can be met at', () => {
    // A tier's worst case is the speed at the moment the next tier takes over.
    for (let tier = 0; tier < MAX_TIER; tier += 1) {
      expect(tierMaxSpeed(tier)).toBeLessThanOrEqual(tierMaxSpeed(tier + 1));
    }
    // The speed ramp ends exactly where the last tier starts, so tiers 2 and 3
    // share the same top speed.
    expect(tierMaxSpeed(0)).toBeLessThan(tierMaxSpeed(1));
    expect(tierMaxSpeed(1)).toBeLessThan(tierMaxSpeed(2));
    expect(tierMaxSpeed(2)).toBe(SPEED.max);
    expect(tierMaxSpeed(MAX_TIER)).toBe(SPEED.max);
    expect(tierMaxSpeed(0)).toBeGreaterThan(SPEED.start);
  });
});

describe('chunksForTier (SPEC 6)', () => {
  it('gives every tier something to spawn', () => {
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      expect(chunksForTier(tier).length, `tier ${tier}`).toBeGreaterThan(0);
    }
  });

  it('only returns chunks whose range covers the tier', () => {
    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
      for (const chunk of chunksForTier(tier)) {
        expect(chunk.minTier).toBeLessThanOrEqual(tier);
        expect(chunk.maxTier).toBeGreaterThanOrEqual(tier);
      }
    }
  });

  it('keeps the warm-up tier free of high and soft obstacles (SPEC 5)', () => {
    for (const chunk of chunksForTier(0)) {
      for (const placement of chunk.placements) {
        expect(placement.type, chunk.id).not.toBe('highObstacle');
        expect(placement.type, chunk.id).not.toBe('softObstacle');
      }
    }
  });
});

describe('breatherForTier (SPEC 6)', () => {
  it('gives the lower tiers more room and shrinks with difficulty', () => {
    for (let tier = 0; tier < MAX_TIER; tier += 1) {
      expect(breatherForTier(tier)).toBeGreaterThanOrEqual(breatherForTier(tier + 1));
    }
    expect(breatherForTier(0)).toBeGreaterThan(0);
  });

  it('handles a tier outside the table', () => {
    expect(breatherForTier(-5)).toBe(breatherForTier(0));
    expect(breatherForTier(99)).toBe(breatherForTier(MAX_TIER));
  });
});

describe('the spawner (SPEC 6)', () => {
  it('fills the track ahead of the player', () => {
    const spawner = createSpawner(createRng(1));
    spawner.update(0, 0);
    expect(activeCount(spawner)).toBeGreaterThan(0);

    for (const obstacle of spawner.obstacles) {
      if (!obstacle.active) continue;
      expect(obstacle.s).toBeGreaterThanOrEqual(0);
      expect(obstacle.s).toBeLessThanOrEqual(TRACK.buildAhead + TRACK.chunkLength);
    }
  });

  it('keeps building as the player moves', () => {
    const spawner = createSpawner(createRng(2));
    let furthest = 0;
    for (let s = 0; s < 2000; s += 10) {
      spawner.update(s, 0);
      for (const obstacle of spawner.obstacles) {
        if (obstacle.active) furthest = Math.max(furthest, obstacle.s);
      }
      // There is always track built ahead of the player.
      expect(furthest).toBeGreaterThan(s);
    }
  });

  it('retires obstacles once they are behind the player', () => {
    const spawner = createSpawner(createRng(3));
    spawner.update(0, 0);
    spawner.update(500, 0);
    for (const obstacle of spawner.obstacles) {
      if (!obstacle.active) continue;
      expect(obstacle.s).toBeGreaterThanOrEqual(500 - TRACK.despawnBehind);
    }
  });

  it('never runs out of pool slots over a long run', () => {
    const spawner = createSpawner(createRng(4));
    for (let s = 0; s < 6000; s += 7) {
      spawner.update(s, tierForTime(s / 20));
      expect(activeCount(spawner)).toBeLessThanOrEqual(TRACK.obstaclePoolSize);
    }
  });

  it('never allocates a new slot: the pool is fixed (rule 7)', () => {
    const spawner = createSpawner(createRng(5));
    const before = spawner.obstacles.length;
    for (let s = 0; s < 3000; s += 11) spawner.update(s, 1);
    expect(spawner.obstacles.length).toBe(before);
    expect(before).toBe(TRACK.obstaclePoolSize);
  });

  it('never places the same chunk twice in a row (SPEC 6)', () => {
    // A library of two chunks makes any repeat obvious.
    const library: Chunk[] = [
      { id: 'a', minTier: 0, maxTier: 3, length: 40, placements: [] },
      { id: 'b', minTier: 0, maxTier: 3, length: 40, placements: [] },
    ];
    const seen: string[] = [];
    const spawner = createSpawner(createRng(6), library);
    for (let s = 0; s < 2000; s += 20) {
      spawner.update(s, 0);
      const id = spawner.lastChunkId;
      if (id !== null && seen.at(-1) !== id) seen.push(id);
    }
    expect(seen.length).toBeGreaterThan(5);
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).not.toBe(seen[i - 1]);
    }
  });

  it('only spawns chunks the tier allows', () => {
    const spawner = createSpawner(createRng(7));
    const tier0Ids = new Set(chunksForTier(0).map((chunk) => chunk.id));
    for (let s = 0; s < 1500; s += 20) {
      spawner.update(s, 0);
      expect(tier0Ids.has(spawner.lastChunkId ?? '')).toBe(true);
    }
  });

  it('is reproducible from a seed (rule 6)', () => {
    const run = (): string[] => {
      const spawner = createSpawner(createRng(42));
      const ids: string[] = [];
      for (let s = 0; s < 1000; s += 20) {
        spawner.update(s, 1);
        ids.push(spawner.lastChunkId ?? '');
      }
      return ids;
    };
    expect(run()).toEqual(run());
  });

  it('starts over cleanly after a reset', () => {
    const spawner = createSpawner(createRng(8));
    spawner.update(800, 2);
    expect(activeCount(spawner)).toBeGreaterThan(0);

    spawner.reset();
    expect(activeCount(spawner)).toBe(0);
    expect(spawner.lastChunkId).toBeNull();

    spawner.update(0, 0);
    for (const obstacle of spawner.obstacles) {
      if (obstacle.active) expect(obstacle.s).toBeLessThan(TRACK.buildAhead + TRACK.chunkLength);
    }
  });

  it('only ever places obstacles from the library', () => {
    const spawner = createSpawner(createRng(9));
    const known = new Set(
      CHUNK_LIBRARY.flatMap((chunk) => chunk.placements.map((placement) => placement.type)),
    );
    for (let s = 0; s < 1500; s += 25) spawner.update(s, 3);
    for (const obstacle of spawner.obstacles) {
      if (obstacle.active) expect(known.has(obstacle.type)).toBe(true);
    }
  });
});
