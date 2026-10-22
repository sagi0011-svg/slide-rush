import { describe, expect, it } from 'vitest';
import { POWERUPS, SIM } from '../src/config';
import { powerUpRowNeedsUpdate } from '../src/ui/hud';
import { createPowerUps, grant, remainingFraction, stepPowerUps } from '../src/game/powerups';

const DT = SIM.dt;

/**
 * The HUD skips redrawing a power-up bar that has barely moved, because
 * writing to the page every frame makes the browser lay it out again. These
 * cover the thing that must never be skipped: the row going away when the
 * power-up ends.
 */
describe('powerUpRowNeedsUpdate', () => {
  it('draws a row that has never been drawn', () => {
    expect(powerUpRowNeedsUpdate(1, -1)).toBe(true);
    expect(powerUpRowNeedsUpdate(0, -1)).toBe(true);
  });

  it('skips a change too small to see', () => {
    expect(powerUpRowNeedsUpdate(0.5, 0.5)).toBe(false);
    expect(powerUpRowNeedsUpdate(0.497, 0.5)).toBe(false);
  });

  it('draws a change worth seeing', () => {
    expect(powerUpRowNeedsUpdate(0.48, 0.5)).toBe(true);
  });

  it('always draws the row appearing', () => {
    expect(powerUpRowNeedsUpdate(1, 0)).toBe(true);
    // Even a power-up granted and all but spent in the same breath.
    expect(powerUpRowNeedsUpdate(0.001, 0)).toBe(true);
  });

  it('always draws the row going away, however small the last step', () => {
    // This is the bug this function exists for: a timer reaches zero in steps
    // of a six-hundredth of the bar, far below the threshold, so the row was
    // left on screen for the rest of the run.
    expect(powerUpRowNeedsUpdate(0, 0.0033)).toBe(true);
    expect(powerUpRowNeedsUpdate(0, 0.00001)).toBe(true);
  });
});

describe('a power-up running out', () => {
  /**
   * Replays what the HUD would do over a whole power-up.
   *
   * `ticksPerDraw` stands in for the frame rate: the game thinks at a fixed
   * 60 Hz but is drawn as often as the screen allows, so the HUD sees the
   * timer at uneven moments. Which moments it happens to see decides whether
   * the last step down is small enough to be skipped, which is why this is
   * tried at several rates rather than one.
   */
  function replay(type: 'shield' | 'magnet' | 'boost', ticksPerDraw: number) {
    const state = createPowerUps();
    grant(state, type);

    let drawnWith = -1;
    let visible = false;
    let framesVisibleAfterItEnded = 0;

    for (let i = 0; i < 60 * 30; i += 1) {
      if (i % ticksPerDraw === 0) {
        const left = remainingFraction(state, type);
        if (powerUpRowNeedsUpdate(left, drawnWith)) {
          drawnWith = left;
          visible = left > 0;
        }
        if (state[type] === 0 && visible) framesVisibleAfterItEnded += 1;
      }
      stepPowerUps(state, DT, 20);
    }
    return { visible, framesVisibleAfterItEnded };
  }

  it('takes its row off the HUD when it expires, at any frame rate', () => {
    for (const type of ['shield', 'magnet', 'boost'] as const) {
      for (const ticksPerDraw of [1, 2, 3, 4, 5, 7]) {
        const { visible, framesVisibleAfterItEnded } = replay(type, ticksPerDraw);
        expect(
          visible,
          `${type} was still on the HUD after it ran out, drawn every ${ticksPerDraw} ticks`,
        ).toBe(false);
        // One frame of overlap is the frame it ended on; more is a bug.
        expect(framesVisibleAfterItEnded, `${type} at ${ticksPerDraw}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the shield row up for its whole ten seconds', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    let drawnWith = -1;
    let visible = false;

    const ticks = Math.round((POWERUPS.shield.duration - 0.2) / DT);
    for (let i = 0; i < ticks; i += 1) {
      const left = remainingFraction(state, 'shield');
      if (powerUpRowNeedsUpdate(left, drawnWith)) {
        drawnWith = left;
        visible = left > 0;
      }
      stepPowerUps(state, DT, 20);
    }
    expect(visible).toBe(true);
  });

  it('takes the shield row away the moment it absorbs a hit', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    stepPowerUps(state, DT, 20);

    const before = remainingFraction(state, 'shield');
    state.shield = 0; // what absorbing a hit does
    const after = remainingFraction(state, 'shield');

    expect(powerUpRowNeedsUpdate(after, before)).toBe(true);
    expect(after).toBe(0);
  });
});
