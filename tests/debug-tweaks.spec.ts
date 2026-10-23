import { describe, expect, it } from 'vitest';
import { DEBUG, LANES, SIM, SPEED } from '../src/config';
import {
  createDebugTweaks,
  debugTier,
  setSpeedScale,
  setTierOverride,
} from '../src/game/debug-tweaks';
import { MAX_TIER } from '../src/game/difficulty';
import { collectHitboxes, createHitboxList } from '../src/game/hitboxes';
import { playerBox } from '../src/game/collisions';
import { createBox, frontHitCost, obstacleBox } from '../src/game/obstacles';
import { createRunState, stepRun, type RunState } from '../src/game/state';
import type { Chunk } from '../src/game/chunks/types';

/**
 * Debug mode's controls (SPEC 13): the speed and difficulty sliders, the
 * invincibility switch, and the hitboxes it draws. A normal game must never
 * feel any of it, so the defaults are tested as carefully as the overrides.
 */

const DT = SIM.dt;

/** One wall straight ahead in the middle lane, and nothing else. */
const WALL_AHEAD: Chunk[] = [
  {
    id: 'wall',
    minTier: 0,
    maxTier: 3,
    length: 40,
    placements: [{ type: 'fullBlocker', lane: 0, z: 20 }],
  },
];

function runFor(state: RunState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) stepRun(state, DT);
}

describe('the defaults change nothing', () => {
  it('starts at normal speed, following the clock, and vulnerable', () => {
    const tweaks = createDebugTweaks();
    expect(tweaks).toEqual({ speedScale: 1, tier: null, invincible: false });
    expect(debugTier(tweaks, 2)).toBe(2);
  });

  it('gives a run the same speed with or without debug tweaks', () => {
    const plain = createRunState(5);
    const tweaked = createRunState(5, { debug: createDebugTweaks() });
    runFor(plain, 3);
    runFor(tweaked, 3);
    expect(tweaked.speed).toBe(plain.speed);
    expect(tweaked.distance).toBe(plain.distance);
  });
});

describe('the speed slider', () => {
  it('multiplies the forward speed', () => {
    const tweaks = createDebugTweaks();
    setSpeedScale(tweaks, 0.5);
    const state = createRunState(1, { debug: tweaks });
    stepRun(state, DT);
    expect(state.speed).toBeCloseTo(SPEED.start * 0.5, 6);
  });

  it('stays inside its range and ignores nonsense', () => {
    const tweaks = createDebugTweaks();
    setSpeedScale(tweaks, 100);
    expect(tweaks.speedScale).toBe(DEBUG.speedScaleMax);
    setSpeedScale(tweaks, 0);
    expect(tweaks.speedScale).toBe(DEBUG.speedScaleMin);
    setSpeedScale(tweaks, Number.NaN);
    expect(tweaks.speedScale).toBe(DEBUG.speedScaleMin);
  });

  it('holds across runs, because the runs share it', () => {
    const tweaks = createDebugTweaks();
    const first = createRunState(1, { debug: tweaks });
    setSpeedScale(tweaks, 1.5);
    const second = createRunState(2, { debug: tweaks });
    expect(first.debug.speedScale).toBe(1.5);
    expect(second.debug.speedScale).toBe(1.5);
  });
});

describe('the difficulty slider', () => {
  it('holds the run at the chosen tier', () => {
    const tweaks = createDebugTweaks();
    setTierOverride(tweaks, MAX_TIER);
    const state = createRunState(1, { debug: tweaks });
    stepRun(state, DT);
    expect(state.tier).toBe(MAX_TIER);
  });

  it('goes back to the clock on null', () => {
    const tweaks = createDebugTweaks();
    setTierOverride(tweaks, 2);
    setTierOverride(tweaks, null);
    const state = createRunState(1, { debug: tweaks });
    stepRun(state, DT);
    expect(state.tier).toBe(0);
  });

  it('only ever picks a real tier', () => {
    const tweaks = createDebugTweaks();
    setTierOverride(tweaks, 99);
    expect(tweaks.tier).toBe(MAX_TIER);
    setTierOverride(tweaks, -4);
    expect(tweaks.tier).toBe(0);
    setTierOverride(tweaks, 1.6);
    expect(tweaks.tier).toBe(2);
  });
});

describe('invincibility', () => {
  it('dies at the wall without it', () => {
    const state = createRunState(1, WALL_AHEAD);
    runFor(state, 10);
    expect(state.phase).toBe('dead');
  });

  it('passes straight through with it, and leaves the wall standing', () => {
    const tweaks = createDebugTweaks();
    tweaks.invincible = true;
    const state = createRunState(1, { library: WALL_AHEAD, debug: tweaks });
    runFor(state, 10);
    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(0);
    expect(state.score.multiplier).toBeGreaterThanOrEqual(1);
  });
});

describe('hitboxes', () => {
  it('draws exactly the boxes the collision code tests', () => {
    const state = createRunState(1, WALL_AHEAD);
    runFor(state, 1);
    const list = createHitboxList();
    collectHitboxes(state, list);

    expect(list.player).toEqual(playerBox(state.player, state.distance, createBox()));
    expect(list.count).toBeGreaterThan(0);
    const visible = state.spawner.obstacles.filter(
      (obstacle) =>
        obstacle.active &&
        obstacle.s - state.distance <= DEBUG.hitboxRange &&
        obstacle.s - state.distance >= -DEBUG.hitboxRangeBehind,
    );
    expect(list.count).toBe(visible.length);
    for (let i = 0; i < list.count; i += 1) {
      const obstacle = visible[i];
      if (obstacle === undefined) throw new Error('missing obstacle');
      expect(list.obstacles[i]).toEqual(obstacleBox(obstacle, createBox()));
      expect(list.deadly[i]).toBe(frontHitCost(obstacle.type) === 'death');
    }
  });

  it('follows the player as drawn between ticks, at the same size', () => {
    const state = createRunState(1, WALL_AHEAD);
    runFor(state, 1);
    const list = createHitboxList();
    const exact = playerBox(state.player, state.distance, createBox());
    collectHitboxes(state, list, 0.4, 1.2);
    expect(list.player.x).toBeCloseTo(0.4 * LANES.width, 9);
    expect(list.player.minY).toBe(1.2);
    expect(list.player.maxY - list.player.minY).toBeCloseTo(exact.maxY - exact.minY, 9);
    expect(list.player.halfW).toBe(exact.halfW);
  });

  it('reuses its boxes rather than making new ones every frame', () => {
    const state = createRunState(1, WALL_AHEAD);
    runFor(state, 1);
    const list = createHitboxList();
    collectHitboxes(state, list);
    const first = list.obstacles[0];
    collectHitboxes(state, list);
    expect(list.obstacles[0]).toBe(first);
  });

  it('forgets obstacles that have gone', () => {
    const tweaks = createDebugTweaks();
    tweaks.invincible = true;
    const state = createRunState(1, { library: WALL_AHEAD, debug: tweaks });
    const list = createHitboxList();
    runFor(state, 1);
    collectHitboxes(state, list);
    const before = list.count;
    for (const obstacle of state.spawner.obstacles) obstacle.active = false;
    collectHitboxes(state, list);
    expect(before).toBeGreaterThan(0);
    expect(list.count).toBe(0);
  });
});
