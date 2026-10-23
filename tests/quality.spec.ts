import { describe, expect, it } from 'vitest';
import { RENDER } from '../src/config';
import { createQualityGovernor, startingPixelRatio } from '../src/render/quality';

/**
 * The frame-rate watch (SPEC 13): a phone whose frames are slow because of the
 * pixels gets fewer of them, a notch at a time. A phone that is fast enough,
 * or slow for some other reason, keeps its picture.
 */

type Governor = ReturnType<typeof createQualityGovernor>;

/**
 * Plays for `seconds`, with each frame taking what `frameTime` says for the
 * resolution in use at that moment.
 */
function play(governor: Governor, frameTime: (ratio: number) => number, seconds: number): number {
  let changes = 0;
  for (let t = 0; t < seconds;) {
    const frame = frameTime(governor.pixelRatio);
    if (governor.sample(frame)) changes += 1;
    t += frame;
  }
  return changes;
}

/** A GPU that is the bottleneck: frame time grows with the pixels drawn. */
const pixelBound = (ratio: number): number => 0.012 * ratio * ratio;
/** A page capped at 30 fps whatever it draws, as in battery saver. */
const capped30 = (): number => 1 / 30;

describe('the starting resolution', () => {
  it("uses the screen's own, up to the cap", () => {
    expect(startingPixelRatio(1)).toBe(1);
    expect(startingPixelRatio(1.5)).toBe(1.5);
    expect(startingPixelRatio(3)).toBe(RENDER.maxPixelRatio);
  });

  it('falls back to 1 for a nonsense ratio', () => {
    expect(startingPixelRatio(0)).toBe(1);
    expect(startingPixelRatio(Number.NaN)).toBe(1);
  });
});

describe('stepping down', () => {
  it('leaves a phone at 60 fps alone, however long it plays', () => {
    const governor = createQualityGovernor(3);
    expect(play(governor, () => 1 / 60, 120)).toBe(0);
    expect(governor.pixelRatio).toBe(RENDER.maxPixelRatio);
  });

  it('steps down while the pixels are what makes it slow', () => {
    // At 2x a frame takes 48 ms, at 1.5x 27 ms, at 1x 12 ms.
    const governor = createQualityGovernor(2);
    play(governor, pixelBound, 30);
    expect(governor.pixelRatio).toBe(RENDER.minPixelRatio);
  });

  it('stops as soon as it is fast enough', () => {
    // 2x is slow (24 ms), 1.5x is comfortably fast (13.5 ms).
    const governor = createQualityGovernor(2);
    play(governor, (ratio) => 0.006 * ratio * ratio, 30);
    expect(governor.pixelRatio).toBe(1.5);
  });

  it('puts the picture back when fewer pixels did not help (30 fps cap)', () => {
    const governor = createQualityGovernor(2);
    const changes = play(governor, capped30, 60);
    // One step down to try, one step back up when it made no difference.
    expect(changes).toBe(2);
    expect(governor.pixelRatio).toBe(2);
  });

  it('never tries again once a step down has failed', () => {
    const governor = createQualityGovernor(2);
    play(governor, capped30, 10);
    expect(play(governor, pixelBound, 30)).toBe(0);
    expect(governor.pixelRatio).toBe(2);
  });

  it('ignores a single hitch', () => {
    const governor = createQualityGovernor(2);
    governor.sample(0.1);
    expect(play(governor, () => 1 / 60, 10)).toBe(0);
    expect(governor.pixelRatio).toBe(2);
  });

  it('ignores the tab coming back after a long time away', () => {
    const governor = createQualityGovernor(2);
    for (let i = 0; i < 20; i += 1) governor.sample(5);
    expect(governor.pixelRatio).toBe(2);
  });

  it('does nothing on a screen that is already at the floor', () => {
    const governor = createQualityGovernor(1);
    expect(play(governor, () => 1 / 15, 30)).toBe(0);
    expect(governor.pixelRatio).toBe(1);
  });
});
