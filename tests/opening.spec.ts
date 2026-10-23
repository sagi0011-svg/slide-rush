import { describe, expect, it } from 'vitest';
import { SIM, TRACK } from '../src/config';
import { OPENING_CHUNK } from '../src/game/chunks/opening';
import { chunkObstacleCount } from '../src/game/chunks/spawner';
import { createRunState, stepRun, type RunState } from '../src/game/state';
import type { Chunk } from '../src/game/chunks/types';

/**
 * The opening stretch (SPEC 6): a run that does not start with the tutorial
 * starts with coins and nothing to dodge.
 */

/** The nearest obstacle to the start of the slide, in units. */
function firstObstacleAt(state: RunState): number {
  let first = Number.POSITIVE_INFINITY;
  for (const obstacle of state.spawner.obstacles) {
    if (obstacle.active) first = Math.min(first, obstacle.s);
  }
  return first;
}

describe('the opening stretch', () => {
  it('is all coins', () => {
    expect(OPENING_CHUNK.length).toBe(TRACK.openingLength);
    expect(chunkObstacleCount(OPENING_CHUNK)).toBe(0);
    expect(OPENING_CHUNK.placements.length).toBeGreaterThan(0);
    for (const placement of OPENING_CHUNK.placements) {
      expect(placement.type).toBe('coin');
      expect(placement.z).toBeGreaterThanOrEqual(0);
      expect(placement.z).toBeLessThanOrEqual(TRACK.openingLength);
    }
  });

  it('starts every normal run, whatever the seed', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = createRunState(seed);
      stepRun(state, SIM.dt);
      expect(firstObstacleAt(state)).toBeGreaterThan(TRACK.openingLength);
      const coinsInOpening = state.spawner.coins.filter(
        (coin) => coin.active && coin.s < TRACK.openingLength,
      );
      expect(coinsInOpening.length).toBe(OPENING_CHUNK.placements.length);
    }
  });

  it('cannot be died on by a player who does nothing', () => {
    const state = createRunState(3);
    for (let i = 0; i < 60 * 30 && state.distance < TRACK.openingLength; i += 1)
      stepRun(state, SIM.dt);
    expect(state.phase).toBe('running');
    expect(state.distance).toBeGreaterThanOrEqual(TRACK.openingLength);
  });

  it('is left out when the tutorial is the opening', () => {
    const state = createRunState(1, { tutorial: true });
    stepRun(state, SIM.dt);
    expect(state.spawner.lastChunkId).not.toBe('opening');
    expect(firstObstacleAt(state)).toBeLessThan(TRACK.openingLength);
  });

  it("is left out of a test's own track, which starts where it is written", () => {
    const wall: Chunk[] = [
      {
        id: 'wall',
        minTier: 0,
        maxTier: 3,
        length: 40,
        placements: [{ type: 'fullBlocker', lane: 0, z: 20 }],
      },
    ];
    const state = createRunState(1, wall);
    stepRun(state, SIM.dt);
    expect(firstObstacleAt(state)).toBe(20);
  });
});
