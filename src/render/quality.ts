/**
 * Keeping the frame rate up on a slow phone (SPEC 13).
 *
 * The scene is light — a couple of dozen draw calls — so what a phone
 * struggles with is pixels: a sharp screen at 2x has four times as many to
 * fill as at 1x. This watches how long frames take while the game is being
 * played and, if they stay too slow, steps the resolution down a notch.
 *
 * Slow frames are not always the pixels' fault: a phone in battery saver caps
 * every page at 30 fps, however little it draws. So each step down is a trial.
 * If the frames got clearly faster it stays and watching carries on; if they
 * did not, the resolution goes back to where it was and is left alone for
 * good. Either way it never climbs above where it started, so the picture
 * cannot flicker between two sizes.
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

/**
 * - `watching`: judging stretches of play at the current resolution;
 * - `trial`: just stepped down, waiting to see whether it helped;
 * - `settled`: a step down did not help, so nothing changes any more.
 */
type Mode = 'watching' | 'trial' | 'settled';

export function createQualityGovernor(devicePixelRatio: number): QualityGovernor {
  let pixelRatio = startingPixelRatio(devicePixelRatio);
  let mode: Mode = 'watching';
  let windowTime = 0;
  let windowFrames = 0;
  let slowTime = 0;
  /** The average frame before the step on trial, to compare against. */
  let averageBefore = 0;
  /** The ratio to go back to if the trial fails. */
  let ratioBefore = pixelRatio;

  return {
    get pixelRatio() {
      return pixelRatio;
    },

    sample(frameSeconds) {
      if (mode === 'settled') return false;
      // A huge frame is the tab coming back or a one-off stall, not a sign
      // that the phone cannot keep up; it says nothing either way.
      if (!(frameSeconds > 0) || frameSeconds > RENDER.ignoreFrameSeconds) return false;

      windowTime += frameSeconds;
      windowFrames += 1;
      if (frameSeconds > RENDER.slowFrameSeconds) slowTime += frameSeconds;
      if (windowTime < RENDER.sampleSeconds) return false;

      const average = windowTime / windowFrames;
      const tooSlow = slowTime / windowTime > RENDER.slowShare;
      windowTime = 0;
      windowFrames = 0;
      slowTime = 0;

      if (mode === 'trial') {
        if (average < averageBefore * RENDER.trialSpeedup) {
          // Fewer pixels really did help: keep them, and keep watching.
          mode = 'watching';
          return false;
        }
        // No faster with fewer pixels: something else sets the pace (a
        // battery-saver cap, say). Put the picture back and stop trying.
        pixelRatio = ratioBefore;
        mode = 'settled';
        return true;
      }

      if (!tooSlow || pixelRatio <= RENDER.minPixelRatio) return false;
      ratioBefore = pixelRatio;
      averageBefore = average;
      pixelRatio = Math.max(RENDER.minPixelRatio, pixelRatio - RENDER.pixelRatioStep);
      mode = 'trial';
      return true;
    },
  };
}
