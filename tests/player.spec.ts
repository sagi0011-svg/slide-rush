import { describe, expect, it } from 'vitest';
import { LANES, PLAYER, SIM } from '../src/config';
import {
  createPlayer,
  isAirborne,
  isChangingLane,
  isSliding,
  queueAction,
  stepPlayer,
  type PlayerState,
} from '../src/game/player';
import type { MoveAction } from '../src/game/input-actions';

const DT = SIM.dt;

/** Runs the simulation for a number of seconds, one fixed tick at a time. */
function run(player: PlayerState, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepPlayer(player, DT);
}

/** Does an action and then runs for a while. */
function act(player: PlayerState, action: MoveAction, seconds = 0): void {
  queueAction(player, action);
  if (seconds > 0) run(player, seconds);
}

describe('createPlayer (SPEC 3)', () => {
  it('starts standing in the centre lane', () => {
    const player = createPlayer();
    expect(player.laneTarget).toBe(LANES.start);
    expect(player.laneOffset).toBe(LANES.start);
    expect(player.vertical).toBe('running');
    expect(player.height).toBe(0);
    expect(player.buffered).toBeNull();
    expect(isChangingLane(player)).toBe(false);
  });
});

describe('lane changes', () => {
  it('takes PLAYER.laneChangeTime to reach the next lane', () => {
    const player = createPlayer();
    act(player, 'right');
    expect(isChangingLane(player)).toBe(true);

    run(player, PLAYER.laneChangeTime / 2);
    expect(player.laneOffset).toBeGreaterThan(0);
    expect(player.laneOffset).toBeLessThan(1);

    run(player, PLAYER.laneChangeTime / 2);
    expect(player.laneOffset).toBeCloseTo(1, 6);
    expect(isChangingLane(player)).toBe(false);
  });

  it('lands exactly on the lane, never past it', () => {
    const player = createPlayer();
    act(player, 'right', 1);
    expect(player.laneOffset).toBe(1);
    expect(player.laneTarget).toBe(1);
  });

  it('eases: it is slower at the start than in the middle', () => {
    const player = createPlayer();
    act(player, 'right');
    run(player, PLAYER.laneChangeTime * 0.1);
    const early = player.laneOffset;
    run(player, PLAYER.laneChangeTime * 0.4);
    const middle = player.laneOffset - early;
    expect(early).toBeLessThan(middle);
  });

  it('moves only one lane per swipe', () => {
    const player = createPlayer();
    act(player, 'right', 1);
    expect(player.laneTarget).toBe(1);
  });

  it('retargets immediately, so a fast double-swipe crosses two lanes', () => {
    const player = createPlayer();
    act(player, 'left', 1);
    expect(player.laneOffset).toBe(-1);

    // Two swipes inside a single lane-change window.
    act(player, 'right');
    run(player, PLAYER.laneChangeTime * 0.3);
    act(player, 'right', 1);
    expect(player.laneTarget).toBe(1);
    expect(player.laneOffset).toBe(1);
  });

  it('never snaps when retargeting mid-move', () => {
    const player = createPlayer();
    act(player, 'left');
    run(player, PLAYER.laneChangeTime * 0.5);
    const before = player.laneOffset;
    queueAction(player, 'right');
    stepPlayer(player, DT);
    // One tick of travel, not a jump back to another lane.
    expect(Math.abs(player.laneOffset - before)).toBeLessThan(0.2);
  });

  it('does nothing at the left edge, but reports a bump (SPEC 3)', () => {
    const player = createPlayer();
    act(player, 'left', 1);
    expect(player.laneOffset).toBe(-1);

    act(player, 'left');
    expect(player.laneTarget).toBe(-1);
    expect(player.bump).toBe(1);
    run(player, 1);
    expect(player.laneOffset).toBe(-1);
  });

  it('does nothing at the right edge either', () => {
    const player = createPlayer();
    act(player, 'right', 1);
    act(player, 'right', 1);
    expect(player.laneTarget).toBe(1);
    expect(player.laneOffset).toBe(1);
  });

  it('fades the bump out', () => {
    const player = createPlayer();
    act(player, 'left', 1);
    act(player, 'left');
    expect(player.bump).toBe(1);
    run(player, PLAYER.bumpDecayTime + 0.05);
    expect(player.bump).toBe(0);
  });

  it('never buffers a lane change: edge swipes are simply dropped', () => {
    const player = createPlayer();
    act(player, 'left', 1);
    act(player, 'left');
    expect(player.buffered).toBeNull();
  });

  it('keeps the player inside the three lanes whatever the input', () => {
    const player = createPlayer();
    const actions: MoveAction[] = ['left', 'left', 'left', 'right', 'right', 'right', 'right'];
    for (const action of actions) act(player, action, 0.2);
    expect(player.laneOffset).toBeGreaterThanOrEqual(-1);
    expect(player.laneOffset).toBeLessThanOrEqual(1);
  });
});

describe('jumping (SPEC 3)', () => {
  it('lasts PLAYER.jumpTime and ends back on the floor', () => {
    const player = createPlayer();
    act(player, 'jump');
    expect(isAirborne(player)).toBe(true);

    run(player, PLAYER.jumpTime - 0.02);
    expect(isAirborne(player)).toBe(true);

    run(player, 0.04);
    expect(isAirborne(player)).toBe(false);
    expect(player.height).toBe(0);
  });

  it('reaches PLAYER.jumpHeight at the top', () => {
    const player = createPlayer();
    act(player, 'jump');
    let peak = 0;
    const ticks = Math.round(PLAYER.jumpTime / DT);
    for (let i = 0; i < ticks; i += 1) {
      stepPlayer(player, DT);
      peak = Math.max(peak, player.height);
    }
    expect(peak).toBeCloseTo(PLAYER.jumpHeight, 2);
  });

  it('peaks halfway through the jump', () => {
    const player = createPlayer();
    act(player, 'jump', PLAYER.jumpTime / 2);
    expect(player.height).toBeCloseTo(PLAYER.jumpHeight, 2);
  });

  it('never goes below the floor', () => {
    const player = createPlayer();
    act(player, 'jump');
    for (let i = 0; i < 200; i += 1) {
      stepPlayer(player, DT);
      expect(player.height).toBeGreaterThanOrEqual(0);
    }
  });

  it('allows a lane change in mid-air (SPEC 3)', () => {
    const player = createPlayer();
    act(player, 'jump', PLAYER.jumpTime / 2);
    expect(isAirborne(player)).toBe(true);
    act(player, 'right', PLAYER.laneChangeTime);
    expect(player.laneOffset).toBeCloseTo(1, 6);
    expect(isAirborne(player)).toBe(true);
  });
});

describe('sliding (SPEC 3)', () => {
  it('lasts PLAYER.slideTime then stands back up', () => {
    const player = createPlayer();
    act(player, 'slide');
    expect(isSliding(player)).toBe(true);
    run(player, PLAYER.slideTime - 0.02);
    expect(isSliding(player)).toBe(true);
    run(player, 0.04);
    expect(isSliding(player)).toBe(false);
    expect(player.vertical).toBe('running');
  });

  it('allows a lane change while sliding', () => {
    const player = createPlayer();
    act(player, 'slide', 0.1);
    act(player, 'left', PLAYER.laneChangeTime);
    expect(player.laneOffset).toBeCloseTo(-1, 6);
    expect(isSliding(player)).toBe(true);
  });

  it('jumping cancels a slide straight away', () => {
    const player = createPlayer();
    act(player, 'slide', 0.1);
    act(player, 'jump');
    expect(isAirborne(player)).toBe(true);
    expect(isSliding(player)).toBe(false);
  });
});

describe('mid-air slide: fast drop (SPEC 3)', () => {
  it('cuts the jump short and slides on landing', () => {
    const player = createPlayer();
    act(player, 'jump', PLAYER.jumpTime / 2);
    const apex = player.height;
    expect(apex).toBeGreaterThan(1);

    act(player, 'slide');
    expect(player.fastDropping).toBe(true);

    // The drop is faster than the rest of the jump would have been.
    run(player, apex / PLAYER.fastDropSpeed + DT);
    expect(player.height).toBe(0);
    expect(isSliding(player)).toBe(true);
    expect(player.fastDropping).toBe(false);
  });

  it('lands sooner than a full jump would have', () => {
    const dropper = createPlayer();
    act(dropper, 'jump', PLAYER.jumpTime / 2);
    act(dropper, 'slide');
    let dropTicks = 0;
    while (dropper.vertical === 'jumping' && dropTicks < 1000) {
      stepPlayer(dropper, DT);
      dropTicks += 1;
    }
    expect(dropTicks * DT).toBeLessThan(PLAYER.jumpTime / 2);
  });

  it('runs a full slide after landing', () => {
    const player = createPlayer();
    act(player, 'jump', 0.1);
    act(player, 'slide');
    while (player.vertical === 'jumping') stepPlayer(player, DT);
    expect(isSliding(player)).toBe(true);
    run(player, PLAYER.slideTime - 0.02);
    expect(isSliding(player)).toBe(true);
    run(player, 0.04);
    expect(player.vertical).toBe('running');
  });
});

describe('input buffering (SPEC 3)', () => {
  it('a jump pressed just before landing fires on landing', () => {
    const player = createPlayer();
    act(player, 'jump');
    // Press jump again with less than the buffer window left in the air.
    run(player, PLAYER.jumpTime - PLAYER.inputBufferTime / 2);
    queueAction(player, 'jump');
    expect(player.buffered).toBe('jump');

    run(player, PLAYER.inputBufferTime / 2 + DT);
    expect(player.buffered).toBeNull();
    expect(isAirborne(player)).toBe(true);
    expect(player.verticalTimer).toBeLessThan(0.1);
  });

  it('forgets an action that waited longer than the buffer window', () => {
    const player = createPlayer();
    act(player, 'jump');
    // Pressed at the very start of a long jump: it can never become valid in time.
    queueAction(player, 'jump');
    expect(player.buffered).toBe('jump');

    run(player, PLAYER.inputBufferTime + DT);
    expect(player.buffered).toBeNull();

    run(player, PLAYER.jumpTime);
    // The stale jump did not fire on landing.
    expect(player.vertical).toBe('running');
  });

  it('buffers only one action at a time', () => {
    const player = createPlayer();
    act(player, 'jump');
    run(player, PLAYER.jumpTime - 0.1);
    queueAction(player, 'jump');
    expect(player.buffered).toBe('jump');
    // A mid-air slide applies at once (fast drop), so it never displaces the buffer.
    queueAction(player, 'slide');
    expect(player.fastDropping).toBe(true);
    expect(player.buffered).toBe('jump');
  });

  it('extends a slide instead of restarting it', () => {
    const player = createPlayer();
    act(player, 'slide');
    run(player, PLAYER.slideTime - PLAYER.inputBufferTime / 2);
    queueAction(player, 'slide');
    expect(player.buffered).toBe('slide');

    run(player, PLAYER.inputBufferTime / 2 + DT);
    expect(isSliding(player)).toBe(true);
    expect(player.verticalTimer).toBeLessThan(0.1);
  });

  it('never buffers a lane change', () => {
    const player = createPlayer();
    act(player, 'jump', 0.1);
    queueAction(player, 'right');
    expect(player.buffered).toBeNull();
    expect(player.laneTarget).toBe(1);
  });
});

describe('interpolation data', () => {
  it('keeps the previous lane offset and height for the renderer', () => {
    const player = createPlayer();
    act(player, 'right');
    act(player, 'jump');
    stepPlayer(player, DT);
    const laneAfterOne = player.laneOffset;
    const heightAfterOne = player.height;

    stepPlayer(player, DT);
    expect(player.prevLaneOffset).toBeCloseTo(laneAfterOne, 10);
    expect(player.prevHeight).toBeCloseTo(heightAfterOne, 10);
  });
});

describe('determinism', () => {
  it('two players given the same actions end up identical', () => {
    const a = createPlayer();
    const b = createPlayer();
    const script: Array<[MoveAction, number]> = [
      ['right', 0.1],
      ['jump', 0.2],
      ['slide', 0.3],
      ['left', 0.05],
      ['left', 0.4],
      ['jump', 0.5],
    ];
    for (const [action, wait] of script) {
      act(a, action, wait);
      act(b, action, wait);
    }
    expect(a).toEqual(b);
  });
});
