import { describe, expect, it } from 'vitest';
import { DEATH, OBSTACLES, SIM } from '../src/config';
import { applyAction, createRunState, deathBeatOver, stepRun } from '../src/game/state';
import type { RunState } from '../src/game/state';
import { stumbleSpeedFactor } from '../src/game/speed';
import type { Chunk } from '../src/game/chunks/types';

const DT = SIM.dt;

/** A library with nothing in it, so a test can place its own obstacles. */
const EMPTY_LIBRARY: Chunk[] = [
  { id: 'empty', minTier: 0, maxTier: 3, length: 40, placements: [] },
];

function emptyRun(): RunState {
  return createRunState(1, EMPTY_LIBRARY);
}

/** Drops one obstacle onto the track just ahead of the player. */
function placeAhead(state: RunState, type: 'lowMine' | 'softObstacle', lane: number, ahead = 8) {
  const slot = state.spawner.obstacles.find((obstacle) => !obstacle.active);
  if (slot === undefined) throw new Error('no free obstacle slot');
  slot.active = true;
  slot.type = type;
  slot.lane = lane;
  slot.s = state.distance + ahead;
  return slot;
}

function runFor(state: RunState, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepRun(state, DT);
}

describe('stumbleSpeedFactor (SPEC 7)', () => {
  it('loses 30% of the speed at the moment of the hit', () => {
    expect(stumbleSpeedFactor(OBSTACLES.stumbleDuration)).toBeCloseTo(
      1 - OBSTACLES.stumbleSpeedLoss,
      10,
    );
  });

  it('eases all the way back', () => {
    expect(stumbleSpeedFactor(0)).toBe(1);
    expect(stumbleSpeedFactor(-1)).toBe(1);
  });

  it('recovers smoothly, never jumping back', () => {
    let previous = stumbleSpeedFactor(OBSTACLES.stumbleDuration);
    for (let t = OBSTACLES.stumbleDuration; t >= 0; t -= 0.05) {
      const factor = stumbleSpeedFactor(t);
      expect(factor).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(factor).toBeLessThanOrEqual(1);
      previous = factor;
    }
  });
});

describe('hitting things (SPEC 7)', () => {
  it('a low mine ends the run', () => {
    const state = emptyRun();
    placeAhead(state, 'lowMine', 0);
    runFor(state, 2);
    expect(state.phase).toBe('dead');
    expect(state.deathCause).toBe('obstacle');
  });

  it('a soft obstacle only trips the player up', () => {
    const state = emptyRun();
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 2);
    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(1);
  });

  it('a stumble slows the run down and then recovers', () => {
    const state = emptyRun();
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 1);
    expect(state.stumbles).toBe(1);

    const slowed = state.speed;
    runFor(state, OBSTACLES.stumbleDuration + 0.2);
    expect(state.speed).toBeGreaterThan(slowed);
    expect(state.stumbleRecovery).toBe(0);
  });

  it('asks the camera to shake on a stumble', () => {
    const state = emptyRun();
    const before = state.shakeTrigger;
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 2);
    expect(state.shakeTrigger).toBe(before + 1);
  });

  it('never hits the same obstacle twice', () => {
    const state = emptyRun();
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 3);
    expect(state.stumbles).toBe(1);
  });

  it('jumping clears a soft obstacle without a stumble', () => {
    const state = emptyRun();
    // Far enough ahead that the jump is at its peak as it passes.
    placeAhead(state, 'softObstacle', 0, state.speed * 0.33);
    applyAction(state, 'jump');
    runFor(state, 2);
    expect(state.stumbles).toBe(0);
    expect(state.phase).toBe('running');
  });

  it('a second stumble within the window is death (SPEC 7)', () => {
    const state = emptyRun();
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 1);
    expect(state.stumbles).toBe(1);
    expect(state.phase).toBe('running');

    // Another one well inside the 6 second window.
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 1);
    expect(state.phase).toBe('dead');
    expect(state.deathCause).toBe('secondStumble');
  });

  it('a second stumble after the window is survived', () => {
    const state = emptyRun();
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 1);
    expect(state.stumbles).toBe(1);

    runFor(state, OBSTACLES.secondStumbleWindow + 0.5);
    placeAhead(state, 'softObstacle', 0);
    runFor(state, 1);
    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(2);
  });

  it('moving into the side of a deadly obstacle is survived (SPEC 7)', () => {
    const state = emptyRun();
    // Level with a mine in the next lane, then move into it.
    const mine = placeAhead(state, 'lowMine', 1, 0.2);
    expect(mine.lane).toBe(1);
    applyAction(state, 'right');
    runFor(state, 0.5);

    expect(state.phase).toBe('running');
    expect(state.stumbles).toBe(1);
    // Bounced back to the lane it came from.
    expect(state.player.laneTarget).toBe(0);
  });
});

describe('death and restart', () => {
  it('stops the clock and the distance once dead', () => {
    const state = emptyRun();
    placeAhead(state, 'lowMine', 0);
    runFor(state, 2);
    expect(state.phase).toBe('dead');

    const { elapsed, distance, ticks } = state;
    runFor(state, 1);
    expect(state.elapsed).toBe(elapsed);
    expect(state.distance).toBe(distance);
    expect(state.ticks).toBe(ticks);
  });

  it('ignores input once dead', () => {
    const state = emptyRun();
    placeAhead(state, 'lowMine', 0);
    runFor(state, 2);
    applyAction(state, 'right');
    applyAction(state, 'jump');
    expect(state.player.laneTarget).toBe(0);
    expect(state.player.vertical).not.toBe('jumping');
  });

  it('cannot be paused once dead', () => {
    const state = emptyRun();
    placeAhead(state, 'lowMine', 0);
    runFor(state, 2);
    applyAction(state, 'pause');
    expect(state.paused).toBe(false);
  });

  it('says the death beat is over only once it has played', () => {
    const state = emptyRun();
    placeAhead(state, 'lowMine', 0);
    // Stop the moment it dies, so the beat has not started running down yet.
    while (state.phase === 'running') stepRun(state, DT);
    expect(deathBeatOver(state)).toBe(false);

    runFor(state, DEATH.beatTime - 0.05);
    expect(deathBeatOver(state)).toBe(false);

    runFor(state, 0.1);
    expect(deathBeatOver(state)).toBe(true);
  });

  it('never says the beat is over while alive', () => {
    const state = emptyRun();
    runFor(state, 5);
    expect(state.phase).toBe('running');
    expect(deathBeatOver(state)).toBe(false);
  });
});

describe('a real run', () => {
  it('spawns obstacles from the real library and keeps the tier up to date', () => {
    const state = createRunState(123);
    runFor(state, 3);
    expect(state.spawner.obstacles.some((obstacle) => obstacle.active)).toBe(true);
    expect(state.tier).toBe(0);
  });

  it('plays the same way twice from the same seed (rule 6)', () => {
    const play = (): { distance: number; phase: string; stumbles: number } => {
      const state = createRunState(777);
      for (let i = 0; i < 600; i += 1) {
        if (i === 100) applyAction(state, 'right');
        if (i === 200) applyAction(state, 'jump');
        if (i === 300) applyAction(state, 'left');
        stepRun(state, DT);
      }
      return { distance: state.distance, phase: state.phase, stumbles: state.stumbles };
    };
    expect(play()).toEqual(play());
  });
});
