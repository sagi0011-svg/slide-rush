import { describe, expect, it } from 'vitest';
import { SIM } from '../src/config';
import { createRunState, stepRun } from '../src/game/state';
import { findSurvivablePath } from '../src/game/fairness';
import type { Obstacle } from '../src/game/obstacles';

const DT = SIM.dt;

/** Plays a run doing nothing at all, and reports how it went. */
function playPassively(seed: number, maxSeconds = 60) {
  const state = createRunState(seed);
  const ticks = Math.round(maxSeconds / DT);
  for (let i = 0; i < ticks; i += 1) {
    stepRun(state, DT);
    if (state.phase === 'dead') break;
  }
  return state;
}

describe('a real run with the real chunk library', () => {
  it('kills a player who never touches the controls', () => {
    // Over many seeds, standing still must always end badly — otherwise the
    // track is not actually putting anything in the way.
    for (let seed = 0; seed < 25; seed += 1) {
      const state = playPassively(seed);
      expect(state.phase, `seed ${seed} survived doing nothing`).toBe('dead');
      expect(state.distance, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('usually dies within the first few chunks', () => {
    const distances: number[] = [];
    for (let seed = 0; seed < 25; seed += 1) {
      distances.push(playPassively(seed).distance);
    }
    const median = [...distances].sort((a, b) => a - b)[Math.floor(distances.length / 2)] as number;
    expect(median).toBeLessThan(500);
  });

  it('is survivable by a player who plays well', () => {
    // The fairness search plays the real track for a while and must get through.
    for (let seed = 0; seed < 5; seed += 1) {
      const state = createRunState(seed);
      // Build the track without moving the player, then read the obstacles.
      state.spawner.update(0, 0);
      const obstacles: Obstacle[] = state.spawner.obstacles
        .filter((obstacle) => obstacle.active && obstacle.s < 120)
        .map((obstacle) => ({ type: obstacle.type, lane: obstacle.lane, s: obstacle.s }));

      const result = findSurvivablePath(obstacles, {
        speed: 16,
        startS: 0,
        endS: 120,
        startLane: 0,
      });
      expect(result.survivable, `seed ${seed}: the real track was unsurvivable`).toBe(true);
    }
  });
});
