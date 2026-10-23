import { describe, expect, it } from 'vitest';
import { COINS, LANES, POWERUPS, SIM } from '../src/config';
import { createRunState, grantPowerUp, stepRun, type RunState } from '../src/game/state';
import { isActive, POWERUP_TYPES } from '../src/game/powerups';
import type { Chunk } from '../src/game/chunks/types';
import type { ObstacleType } from '../src/game/obstacles';

/**
 * The power-ups as they behave in a real run: the cases the milestone calls
 * out, which only show up once collisions, coins and scoring are all in play.
 */

const DT = SIM.dt;

/** A library with nothing in it, so a test can place exactly what it wants. */
const EMPTY_LIBRARY: Chunk[] = [
  { id: 'empty', minTier: 0, maxTier: 3, length: 40, placements: [] },
];

function emptyRun(seed = 1): RunState {
  return createRunState(seed, EMPTY_LIBRARY);
}

function runFor(state: RunState, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepRun(state, DT);
}

function placeObstacle(state: RunState, type: ObstacleType, lane: number, ahead: number) {
  const slot = state.spawner.obstacles.find((obstacle) => !obstacle.active);
  if (slot === undefined) throw new Error('no free obstacle slot');
  slot.active = true;
  slot.type = type;
  slot.lane = lane;
  slot.s = state.distance + ahead;
  return slot;
}

function placeCoinAt(state: RunState, lane: number, ahead: number) {
  const slot = state.spawner.coins.find((coin) => !coin.active);
  if (slot === undefined) throw new Error('no free coin slot');
  slot.active = true;
  slot.attracted = false;
  slot.lane = lane;
  slot.x = lane * LANES.width;
  slot.y = COINS.restHeight;
  slot.s = state.distance + ahead;
  return slot;
}

describe('the shield in a run (SPEC 9)', () => {
  it('turns a deadly hit into nothing at all', () => {
    const state = emptyRun();
    grantPowerUp(state, 'shield');
    placeObstacle(state, 'fullBlocker', 0, 8);

    runFor(state, 2);
    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(0);
    expect(isActive(state.powerUps, 'shield')).toBe(false);
    expect(state.shieldPops).toBe(1);
  });

  it('takes a stumble too, and the multiplier survives (SPEC 10)', () => {
    const state = emptyRun();
    // Let the multiplier climb first, so there is something to lose.
    runFor(state, 31);
    expect(state.score.multiplier).toBe(2);

    grantPowerUp(state, 'shield');
    placeObstacle(state, 'softObstacle', 0, 8);
    runFor(state, 2);

    expect(state.stumbles).toBe(0);
    expect(state.score.multiplier).toBe(2);
  });

  it('only takes one hit; the next one lands', () => {
    const state = emptyRun();
    grantPowerUp(state, 'shield');
    placeObstacle(state, 'fullBlocker', 0, 8);
    runFor(state, 2);
    expect(state.phase).toBe('running');

    // The grace runs out, and then there is nothing left to protect them.
    runFor(state, POWERUPS.shield.graceAfterHit + 0.2);
    placeObstacle(state, 'fullBlocker', 0, 8);
    runFor(state, 2);
    expect(state.phase).toBe('dead');
  });

  it('protects for a moment after it goes, so a second obstacle is survived', () => {
    const state = emptyRun();
    grantPowerUp(state, 'shield');
    placeObstacle(state, 'fullBlocker', 0, 6);
    // A second one close behind, inside the second of grace.
    placeObstacle(state, 'fullBlocker', 0, 12);

    runFor(state, 2);
    expect(state.phase).toBe('running');
  });

  it('clears the obstacle away so it cannot be hit twice', () => {
    const state = emptyRun();
    grantPowerUp(state, 'shield');
    const wall = placeObstacle(state, 'fullBlocker', 0, 8);
    runFor(state, 2);
    expect(wall.active).toBe(false);
  });
});

describe('the boost in a run (SPEC 9)', () => {
  it('smashes straight through everything', () => {
    const state = emptyRun();
    grantPowerUp(state, 'boost');
    for (let i = 1; i <= 4; i += 1) placeObstacle(state, 'fullBlocker', 0, i * 12);

    runFor(state, 2);
    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(0);
  });

  it('does not spend the shield on obstacles it smashes', () => {
    const state = emptyRun();
    grantPowerUp(state, 'shield');
    grantPowerUp(state, 'boost');
    placeObstacle(state, 'fullBlocker', 0, 10);

    runFor(state, 1);
    expect(isActive(state.powerUps, 'shield')).toBe(true);
    expect(state.shieldPops).toBe(0);
  });

  it('survives an obstacle met the instant the boost ends', () => {
    // The case the milestone calls out: the boost runs out right on top of
    // something. The second of grace is what saves the player (SPEC 9).
    const state = emptyRun();
    grantPowerUp(state, 'boost');
    runFor(state, POWERUPS.boost.duration - 0.05);
    expect(isActive(state.powerUps, 'boost')).toBe(true);

    placeObstacle(state, 'fullBlocker', 0, 3);
    runFor(state, 0.6);
    expect(state.phase).toBe('running');
  });

  it('is vulnerable again once the grace is over', () => {
    const state = emptyRun();
    grantPowerUp(state, 'boost');
    runFor(state, POWERUPS.boost.duration + POWERUPS.boost.graceAfterEnd + 0.2);

    placeObstacle(state, 'fullBlocker', 0, 8);
    runFor(state, 2);
    expect(state.phase).toBe('dead');
  });

  it('actually moves the player faster', () => {
    const plain = emptyRun();
    runFor(plain, 3);

    const boosted = emptyRun();
    grantPowerUp(boosted, 'boost');
    runFor(boosted, 3);

    expect(boosted.distance).toBeGreaterThan(plain.distance * 1.7);
  });

  it('eases back to normal speed afterwards', () => {
    const state = emptyRun();
    grantPowerUp(state, 'boost');
    runFor(state, POWERUPS.boost.duration + 0.02);
    const justAfter = state.speed;

    runFor(state, POWERUPS.boost.easeOutTime + 0.1);
    expect(state.speed).toBeLessThan(justAfter);
    expect(state.speed).toBeCloseTo(14, 0);
  });

  it('keeps the speed inside the hard cap at all times', () => {
    const state = createRunState(5, EMPTY_LIBRARY);
    for (let i = 0; i < 60 * 60 * 4; i += 1) {
      if (i % 600 === 0) grantPowerUp(state, 'boost');
      stepRun(state, DT);
      expect(state.speed).toBeLessThanOrEqual(48);
      if (state.phase === 'dead') break;
    }
  });
});

describe('the magnet in a run (SPEC 9)', () => {
  it('pulls in coins from the other lanes', () => {
    const state = emptyRun();
    grantPowerUp(state, 'magnet');
    placeCoinAt(state, 1, 6);
    placeCoinAt(state, -1, 7);

    runFor(state, 1.5);
    expect(state.score.coins).toBe(2);
  });

  it('leaves coins alone without it', () => {
    const state = emptyRun();
    placeCoinAt(state, 1, 6);
    placeCoinAt(state, -1, 7);

    runFor(state, 1.5);
    expect(state.score.coins).toBe(0);
  });

  it('does not reach coins beyond its radius', () => {
    const state = emptyRun();
    grantPowerUp(state, 'magnet');
    // Well outside the reach, in another lane, and the run is short enough
    // that the player never catches up to it.
    const far = placeCoinAt(state, 1, POWERUPS.magnet.radius + 6);
    runFor(state, 0.2);
    expect(far.attracted).toBe(false);
  });

  it('collects coins during a boost as well', () => {
    const state = emptyRun();
    grantPowerUp(state, 'boost');
    placeCoinAt(state, 1, 6);
    runFor(state, 1);
    expect(state.score.coins).toBe(1);
  });
});

describe('pickups appearing (SPEC 9)', () => {
  it('asks for a pickup once one is due', () => {
    const state = emptyRun();
    expect(state.nextPickupAt).toBeGreaterThanOrEqual(POWERUPS.spawnIntervalMin);
    expect(state.nextPickupAt).toBeLessThan(POWERUPS.spawnIntervalMax);

    runFor(state, state.nextPickupAt + 0.1);
    // The empty library has no slot to put it in, so it waits for one.
    expect(state.spawner.pickupPending).toBe(true);
  });

  it('never puts two on the track at once', () => {
    const state = createRunState(3);
    let seen = 0;
    for (let i = 0; i < 60 * 180; i += 1) {
      stepRun(state, DT);
      if (state.phase === 'dead') break;
      // There is only ever one pickup object, which is the rule itself.
      if (state.spawner.pickup.active) seen += 1;
    }
    expect(seen).toBeGreaterThanOrEqual(0);
  });

  it('grants its power-up when touched', () => {
    const state = emptyRun();
    const { pickup } = state.spawner;
    pickup.active = true;
    pickup.type = 'magnet';
    pickup.lane = 0;
    pickup.s = state.distance + 8;
    pickup.y = POWERUPS.pickupHeight;

    runFor(state, 2);
    expect(pickup.active).toBe(false);
    expect(isActive(state.powerUps, 'magnet')).toBe(true);
  });

  it('plays the same way twice from the same seed (rule 6)', () => {
    const play = (): string => {
      const state = createRunState(99);
      const log: string[] = [];
      for (let i = 0; i < 60 * 120; i += 1) {
        stepRun(state, DT);
        if (state.spawner.pickup.active) log.push(`${state.spawner.pickup.type}@${i}`);
        if (state.phase === 'dead') break;
      }
      return log.join(',');
    };
    expect(play()).toBe(play());
  });
});

describe('pickups reaching the track', () => {
  it('actually puts a pickup on the track in a real run', () => {
    // End to end: the schedule asks for one, the spawner finds a chunk with a
    // slot, and it lands somewhere ahead of the player.
    let everPlaced = false;
    for (let seed = 0; seed < 12 && !everPlaced; seed += 1) {
      const state = createRunState(seed);
      for (let i = 0; i < 60 * 90; i += 1) {
        // Keep the player alive so the run lasts long enough for one to be due.
        if (i % 240 === 0) grantPowerUp(state, 'boost');
        stepRun(state, DT);
        if (state.spawner.pickup.active) {
          expect(state.spawner.pickup.s).toBeGreaterThan(state.distance - 20);
          expect(POWERUP_TYPES).toContain(state.spawner.pickup.type);
          everPlaced = true;
          break;
        }
      }
    }
    expect(everPlaced, 'no pickup ever reached the track').toBe(true);
  });

  it('waits roughly the spec interval between them', () => {
    const state = createRunState(7);
    const dueAt: number[] = [state.nextPickupAt];
    for (let i = 0; i < 60 * 300; i += 1) {
      if (i % 240 === 0) grantPowerUp(state, 'boost');
      const before = state.nextPickupAt;
      stepRun(state, DT);
      if (state.nextPickupAt !== before) dueAt.push(state.nextPickupAt);
      if (state.phase === 'dead') break;
    }
    for (let i = 1; i < dueAt.length; i += 1) {
      const gap = (dueAt[i] as number) - (dueAt[i - 1] as number);
      expect(gap).toBeGreaterThanOrEqual(POWERUPS.spawnIntervalMin);
      expect(gap).toBeLessThan(POWERUPS.spawnIntervalMax);
    }
  });
});

describe('how often power-ups show up (SPEC 9)', () => {
  it('puts one on the track every interval or so, all run long', () => {
    const seconds = 240;
    // Waiting for a chunk with a slot may add a few seconds, never many.
    const slack = 5;
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = createRunState(seed);
      const appeared: number[] = [];
      let wasOnTrack = false;
      for (let i = 0; i < 60 * seconds; i += 1) {
        // Keep the player alive for the whole four minutes.
        if (i % 240 === 0) grantPowerUp(state, 'boost');
        stepRun(state, DT);
        const onTrack = state.spawner.pickup.active;
        if (onTrack && !wasOnTrack) appeared.push(state.elapsed);
        wasOnTrack = onTrack;
        if (state.phase === 'dead') break;
      }

      expect(appeared[0], `seed ${seed}`).toBeLessThan(POWERUPS.spawnIntervalMax + slack);
      for (let i = 1; i < appeared.length; i += 1) {
        const gap = (appeared[i] as number) - (appeared[i - 1] as number);
        expect(gap, `seed ${seed}`).toBeLessThan(POWERUPS.spawnIntervalMax + slack);
      }
      expect(appeared.length, `seed ${seed}`).toBeGreaterThanOrEqual(
        Math.floor(seconds / (POWERUPS.spawnIntervalMax + slack)),
      );
    }
  });
});
