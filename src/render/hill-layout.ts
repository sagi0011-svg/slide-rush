/**
 * Where the hills go on screen, in whole game pixels (docs/ART-AND-SHOP.md §1).
 *
 * The hills used to be a picture stretched over a surface in the 3D world.
 * Each of its pixels came out 1.6 by 3.5 game pixels, and the camera turns a
 * little every frame, so every column of the ridge was resampled slightly
 * differently each time — the outline crawled. Measured, 13–24% of the ridge
 * changed shape on every frame.
 *
 * Now they are a flat 2D backdrop drawn straight into the game picture: one
 * hill pixel is exactly one game pixel, and every move — following the
 * horizon as the camera tips, and the parallax as it slides sideways — is
 * rounded to a whole pixel. The ridge can only ever shift as a whole, so there
 * is nothing left to crawl. The maths is here, with no Three.js, so that
 * claim is tested rather than hoped for.
 */

import { RETRO } from '../config';

/** One layer's size on screen, in whole game pixels. */
export interface HillSize {
  /** Width of one repeat of the ridge. */
  tileWidth: number;
  /** Height of the layer, from its foot to the top of its tallest hump. */
  height: number;
  /**
   * Width of the strip actually drawn: the screen plus a tile either side, so
   * however the strip moves, its ends never come into view.
   */
  stripWidth: number;
}

/**
 * How big one layer is on a picture of this many game pixels. Tied to the
 * picture's height so the hills fill the same share of the sky on every phone.
 *
 * @param layer 0 for the far layer, 1 for the near one
 * @param cols the game picture's width, in game pixels
 * @param rows the game picture's height, in game pixels
 */
export function hillSize(layer: number, cols: number, rows: number): HillSize {
  const share = RETRO.hills.heightShare[layer] ?? RETRO.hills.heightShare[0];
  const aspect = RETRO.hills.tileAspect[layer] ?? RETRO.hills.tileAspect[0];
  const height = Math.max(RETRO.hills.minHeight, Math.round(rows * share));
  const tileWidth = Math.max(RETRO.hills.minHeight, Math.round(height * aspect));
  return { tileWidth, height, stripWidth: Math.max(1, cols) + 2 * tileWidth };
}

/** Where a layer's strip goes this frame, in whole game pixels. */
export interface HillPlacement {
  /** The strip's left edge, counted from the left of the picture. */
  left: number;
  /** The strip's bottom edge, counted up from the bottom of the picture. */
  bottom: number;
  /** How far into the ridge the strip starts: 0 up to tileWidth - 1. */
  offset: number;
}

/**
 * Rounds a layer's position for this frame onto the pixel grid.
 *
 * @param size the layer's size, from `hillSize`
 * @param centreX where the layer's middle lands this frame, in game pixels
 *   from the left (any real number: it comes from the camera)
 * @param centreY the same, up from the bottom
 * @param parallax how far the parallax has slid the ridge, in game pixels
 */
export function placeHills(
  size: HillSize,
  centreX: number,
  centreY: number,
  parallax: number,
): HillPlacement {
  const shift = Number.isFinite(parallax) ? Math.round(parallax) : 0;
  const offset = ((shift % size.tileWidth) + size.tileWidth) % size.tileWidth;
  return {
    left: Number.isFinite(centreX) ? Math.round(centreX - size.stripWidth / 2) : 0,
    bottom: Number.isFinite(centreY) ? Math.round(centreY - size.height / 2) : 0,
    offset,
  };
}

/**
 * The ridge of one layer: for each column of one tile, how many pixels tall
 * the hills are there. The hill texture is painted from this, and the tests
 * read it to prove the ridge only ever shifts.
 *
 * Every wave in it completes a whole number of cycles across the tile, so the
 * last column runs straight on into the first and the repeat has no seam.
 *
 * @param layer 0 for the far layer, 1 for the near one
 * @param tileWidth how many columns one repeat has
 * @param height the layer's height, which the tallest hump reaches
 */
export function hillRidge(layer: number, tileWidth: number, height: number): Int16Array {
  const { base, main, detail, detailRatio, detailPhase } = RETRO.hills.ridge;
  const periods = RETRO.hills.periods[layer] ?? RETRO.hills.periods[0];
  // A whole number of cycles for the detail wave too, or the seam comes back.
  const detailPeriods = Math.max(1, Math.round(periods * detailRatio));
  const ridge = new Int16Array(tileWidth);
  for (let x = 0; x < tileWidth; x += 1) {
    const t = (x / tileWidth) * Math.PI * 2;
    const h =
      base + main * Math.sin(periods * t) + detail * Math.sin(detailPeriods * t + detailPhase);
    ridge[x] = Math.min(height, Math.max(1, Math.round(h * height)));
  }
  return ridge;
}

/**
 * The skyline a layer draws this frame: for each screen column, the row (up
 * from the bottom of the picture) of the top pixel of the hills there.
 *
 * Not used to draw anything — the GPU does that — but it is exactly what the
 * GPU draws, given whole-pixel placement and one texel per pixel, which is what
 * lets the tests check the no-crawl claim column by column.
 */
export function hillSkyline(ridge: Int16Array, placement: HillPlacement, cols: number): Int16Array {
  const tileWidth = ridge.length;
  const skyline = new Int16Array(cols);
  for (let c = 0; c < cols; c += 1) {
    const intoStrip = c - placement.left;
    const x = (((intoStrip + placement.offset) % tileWidth) + tileWidth) % tileWidth;
    skyline[c] = placement.bottom + (ridge[x] as number);
  }
  return skyline;
}
