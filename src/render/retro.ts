/**
 * The maths behind the low-resolution pixel render (docs/ART-AND-SHOP.md §1).
 *
 * The scene is drawn into a small target and blown back up, so the only things
 * to work out are how big one game pixel should be and how many of them fit on
 * the screen. Plain arithmetic with no Three.js, so it is tested like a game
 * rule (the same reason src/render/quality.ts and recycle.ts are separate).
 */

import { RETRO } from '../config';

/** How big a game pixel is on a phone, and on a big screen. */
export interface PixelScales {
  pixelScale: number;
  largePixelScale: number;
}

/** The v0.2 game pixel (docs/ART-AND-SHOP.md §1). */
const SUNSET_SCALES: PixelScales = {
  pixelScale: RETRO.pixelScale,
  largePixelScale: RETRO.largePixelScale,
};

/**
 * How many screen pixels wide one game pixel is.
 *
 * A phone gets the chunky 4; a big screen gets 3, because at 4 a desktop
 * window reads as a mosaic rather than as pixel art. A look can ask for other
 * sizes (docs/VISUAL-STYLES.md).
 *
 * @param bufferWidth the width of the drawing buffer, in screen pixels
 */
export function choosePixelScale(bufferWidth: number, scales = SUNSET_SCALES): number {
  if (!(bufferWidth > 0)) return scales.pixelScale;
  return bufferWidth >= RETRO.largeScreenWidth ? scales.largePixelScale : scales.pixelScale;
}

/** The size of the low-resolution target, in game pixels. */
export interface TargetSize {
  width: number;
  height: number;
}

/** A rectangle on the canvas, in device pixels. */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the game picture lands on the screen, worked out once per resize. */
export interface PixelGrid {
  /** The drawing buffer: the canvas at the screen's own resolution. */
  bufferWidth: number;
  bufferHeight: number;
  /**
   * How many device pixels wide one game pixel is. Always a whole number for
   * a pixel look; any number for a smooth one (`smoothGrid`).
   */
  scale: number;
  /** The low-resolution target the scene is drawn into, in game pixels. */
  target: TargetSize;
  /** Where the blown-up target sits in the buffer: centred, never stretched. */
  viewport: Viewport;
}

/**
 * Lays the game's pixels out so every one of them is exactly the same whole
 * number of real screen pixels, on every phone.
 *
 * That is the point of the whole function. In M9 the picture was stretched to
 * fill the canvas, and the canvas was then stretched again by the browser to
 * the screen. On a phone whose pixel ratio is not a whole number (2.625 on a
 * Pixel 7, 2.75 on many Xiaomis) that made one game pixel 5.25 screen pixels
 * wide — so some came out 5 wide and some 6, and as anything moved its pixels
 * changed width under it. The eye reads that as the picture swimming.
 *
 * So now the canvas is drawn at the screen's own resolution, one game pixel is
 * a whole number of those screen pixels, and the picture is placed at exactly
 * that size in the middle of the canvas. Whatever does not divide evenly is a
 * border of at most `scale - 1` pixels round the edge, in the frame colour.
 *
 * Drawing the canvas at full resolution costs nothing worth counting: the 3D
 * scene still renders into the small target, and the canvas only receives one
 * flat copy of it.
 *
 * @param cssWidth the canvas width, in CSS pixels
 * @param cssHeight the canvas height, in CSS pixels
 * @param devicePixelRatio the screen's own ratio of device to CSS pixels
 * @param qualityRatio the resolution the frame-rate watch currently allows
 *   (src/render/quality.ts). When it steps down, game pixels get bigger, so
 *   there are fewer of them to fill — the same job it always had.
 * @param scales how big a game pixel is; the v0.2 sizes unless a look says
 */
export function pixelGrid(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  qualityRatio: number,
  scales: PixelScales = SUNSET_SCALES,
): PixelGrid {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const quality =
    Number.isFinite(qualityRatio) && qualityRatio > 0 ? Math.min(qualityRatio, dpr) : dpr;
  const bufferWidth = Math.max(1, Math.round(cssWidth * dpr));
  const bufferHeight = Math.max(1, Math.round(cssHeight * dpr));

  // The game pixel M9 chose, measured in the old capped buffer's pixels, then
  // turned into real device pixels and rounded to a whole number. That keeps
  // the look within one device pixel of what it was, and makes it exact.
  const chosen = choosePixelScale(cssWidth * quality, scales);
  const scale = Math.max(1, Math.round((chosen * dpr) / quality));

  const target = {
    width: Math.max(RETRO.minTargetSize, Math.floor(bufferWidth / scale)),
    height: Math.max(RETRO.minTargetSize, Math.floor(bufferHeight / scale)),
  };
  const width = target.width * scale;
  const height = target.height * scale;
  return {
    bufferWidth,
    bufferHeight,
    scale,
    target,
    viewport: {
      x: Math.floor((bufferWidth - width) / 2),
      y: Math.floor((bufferHeight - height) / 2),
      width,
      height,
    },
  };
}

/**
 * The layout for a smooth look (Classic 3D, docs/VISUAL-STYLES.md §5): the
 * scene is drawn at the resolution the frame-rate watch allows, never more
 * than the screen's own, and smoothed up to fill the whole canvas. No border:
 * nothing here has to land on whole pixels.
 *
 * Takes the same arguments as `pixelGrid`.
 */
export function smoothGrid(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  qualityRatio: number,
): PixelGrid {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const quality =
    Number.isFinite(qualityRatio) && qualityRatio > 0 ? Math.min(qualityRatio, dpr) : dpr;
  const bufferWidth = Math.max(1, Math.round(cssWidth * dpr));
  const bufferHeight = Math.max(1, Math.round(cssHeight * dpr));
  const target = {
    width: Math.max(1, Math.round(cssWidth * quality)),
    height: Math.max(1, Math.round(cssHeight * quality)),
  };
  return {
    bufferWidth,
    bufferHeight,
    scale: bufferWidth / target.width,
    target,
    viewport: { x: 0, y: 0, width: bufferWidth, height: bufferHeight },
  };
}

/**
 * How many pixels a frame costs at this size, for the debug overlay: the whole
 * point of the low-res pass is that this number drops.
 */
export function pixelCount(size: TargetSize): number {
  return size.width * size.height;
}
