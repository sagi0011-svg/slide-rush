/**
 * The maths behind the low-resolution pixel render (docs/ART-AND-SHOP.md §1).
 *
 * The scene is drawn into a small target and blown back up, so the only things
 * to work out are how big one game pixel should be and how many of them fit on
 * the screen. Plain arithmetic with no Three.js, so it is tested like a game
 * rule (the same reason src/render/quality.ts and recycle.ts are separate).
 */

import { RETRO } from '../config';

/**
 * How many screen pixels wide one game pixel is.
 *
 * A phone gets the chunky 4; a big screen gets 3, because at 4 a desktop
 * window reads as a mosaic rather than as pixel art.
 *
 * @param bufferWidth the width of the drawing buffer, in screen pixels
 */
export function choosePixelScale(bufferWidth: number): number {
  if (!(bufferWidth > 0)) return RETRO.pixelScale;
  return bufferWidth >= RETRO.largeScreenWidth ? RETRO.largePixelScale : RETRO.pixelScale;
}

/** The size of the low-resolution target, in game pixels. */
export interface TargetSize {
  width: number;
  height: number;
}

/**
 * The low-resolution target for a drawing buffer of this size.
 *
 * Both sides are whole numbers of game pixels — a fractional target would put
 * the upscale off the pixel grid and soften the very edges the look depends
 * on — and neither ever falls below `RETRO.minTargetSize`, so a tiny window
 * cannot leave the game with a handful of pixels to draw into.
 *
 * @param bufferWidth width of the drawing buffer, in screen pixels
 * @param bufferHeight height of the drawing buffer, in screen pixels
 * @param scale how many screen pixels wide one game pixel is
 */
export function lowResSize(bufferWidth: number, bufferHeight: number, scale: number): TargetSize {
  const safeScale = scale >= 1 ? scale : 1;
  const width = Math.max(RETRO.minTargetSize, Math.round(bufferWidth / safeScale));
  const height = Math.max(RETRO.minTargetSize, Math.round(bufferHeight / safeScale));
  return { width, height };
}

/**
 * How many pixels a frame costs at this size, for the debug overlay: the whole
 * point of the low-res pass is that this number drops.
 */
export function pixelCount(size: TargetSize): number {
  return size.width * size.height;
}
