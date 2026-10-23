import { describe, expect, it } from 'vitest';
import { RENDER } from '../src/config';
import { createQualityGovernor, startingPixelRatio } from '../src/render/quality';

/**
 * The frame-rate watch (SPEC 13): a phone that cannot keep up gets fewer
 * pixels to fill, a notch at a time, and a phone that can is left alone.
 */

/** Feeds the governor `seconds` worth of frames of one length. */
function play(
  governor: ReturnType<typeof createQualityGovernor>,
  frameSeconds: number,
  seconds: number,
): number {
  let changes = 0;
  for (let t = 0; t < seconds; t += frameSeconds) {
    if (governor.sample(frameSeconds)) changes += 1;
  }
  return changes;
}

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
    expect(play(governor, 1 / 60, 120)).toBe(0);
    expect(governor.pixelRatio).toBe(RENDER.maxPixelRatio);
  });

  it('steps down a notch when frames stay slow', () => {
    const governor = createQualityGovernor(2);
    const changes = play(governor, 1 / 30, RENDER.sampleSeconds + 0.1);
    expect(changes).toBe(1);
    expect(governor.pixelRatio).toBe(2 - RENDER.pixelRatioStep);
  });

  it('keeps stepping while it stays slow, but never below the floor', () => {
    const governor = createQualityGovernor(3);
    play(governor, 1 / 20, 60);
    expect(governor.pixelRatio).toBe(RENDER.minPixelRatio);
  });

  it('ignores a single hitch', () => {
    const governor = createQualityGovernor(2);
    governor.sample(0.1);
    expect(play(governor, 1 / 60, 10)).toBe(0);
    expect(governor.pixelRatio).toBe(2);
  });

  it('ignores the tab coming back after a long time away', () => {
    const governor = createQualityGovernor(2);
    for (let i = 0; i < 20; i += 1) governor.sample(5);
    expect(governor.pixelRatio).toBe(2);
  });

  it('does nothing on a screen that is already at the floor', () => {
    const governor = createQualityGovernor(1);
    expect(play(governor, 1 / 15, 30)).toBe(0);
    expect(governor.pixelRatio).toBe(1);
  });
});
