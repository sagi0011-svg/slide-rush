/**
 * Keeping the frame rate up on a slow phone (SPEC 13).
 *
 * The scene is light — a couple of dozen draw calls — so what a phone
 * struggles with is pixels: a sharp screen at 2x has four times as many to
 * fill as at 1x. This watches how long frames take while the game is being
 * played and, if they stay too slow, steps the resolution down a notch. It
 * never steps back up, so the picture cannot flicker between the two.
 *
 * Plain arithmetic with no Three.js, so it is tested like a game rule.
 */

import { RENDER } from '../config';

export interface QualityGovernor {
  /** The pixel ratio to render at right now. */
  readonly pixelRatio: number;
  /**
   * Counts one frame. Returns true when the pixel ratio just changed and the
   * renderer needs resizing.
   */
  sample(frameSeconds: number): boolean;
}

/** The starting pixel ratio: the screen's own, but never more than the cap. */
export function startingPixelRatio(devicePixelRatio: number): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, RENDER.maxPixelRatio);
}

export function createQualityGovernor(devicePixelRatio: number): QualityGovernor {
  let pixelRatio = startingPixelRatio(devicePixelRatio);
  let windowTime = 0;
  let slowTime = 0;

  return {
    get pixelRatio() {
      return pixelRatio;
    },

    sample(frameSeconds) {
      // A huge frame is the tab coming back or a one-off stall, not a sign
      // that the phone cannot keep up; it says nothing either way.
      if (!(frameSeconds > 0) || frameSeconds > RENDER.ignoreFrameSeconds) return false;
      if (pixelRatio <= RENDER.minPixelRatio) return false;

      windowTime += frameSeconds;
      if (frameSeconds > RENDER.slowFrameSeconds) slowTime += frameSeconds;
      if (windowTime < RENDER.sampleSeconds) return false;

      // Most of the last stretch spent in slow frames: drop a notch.
      const tooSlow = slowTime / windowTime > RENDER.slowShare;
      windowTime = 0;
      slowTime = 0;
      if (!tooSlow) return false;

      pixelRatio = Math.max(RENDER.minPixelRatio, pixelRatio - RENDER.pixelRatioStep);
      return true;
    },
  };
}
