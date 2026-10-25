import { describe, expect, it } from 'vitest';
import { choosePixelScale, pixelCount, pixelGrid } from '../src/render/retro';
import { PICKUP_ICONS } from '../src/render/textures';
import { RETRO, TRACK } from '../src/config';

/**
 * The low-resolution pixel render (docs/ART-AND-SHOP.md section 1).
 *
 * Only the arithmetic is tested here; what it looks like is a thing to look
 * at, not to assert. The one claim worth pinning down is the one the
 * milestone rests on: that the retro pass gives the GPU far fewer pixels to
 * fill than it had before.
 */
describe('pixel scale', () => {
  it('gives a phone the chunky scale and a big screen a finer one', () => {
    expect(choosePixelScale(1170)).toBe(RETRO.largePixelScale);
    expect(choosePixelScale(640)).toBe(RETRO.pixelScale);
    expect(RETRO.largePixelScale).toBeLessThan(RETRO.pixelScale);
  });

  it('falls back to the chunky scale for a width it cannot use', () => {
    expect(choosePixelScale(0)).toBe(RETRO.pixelScale);
    expect(choosePixelScale(Number.NaN)).toBe(RETRO.pixelScale);
  });
});

/**
 * The phones the shimmer was measured on: CSS width and height of the screen,
 * and its device pixel ratio. The ones with a ratio that is not a whole number
 * are exactly the ones whose pixels used to swim.
 */
const PHONES: readonly (readonly [string, number, number, number])[] = [
  ['iPhone 13/14/15', 390, 844, 3],
  ['iPhone SE', 375, 667, 2],
  ['Galaxy S22/S23', 360, 780, 3],
  ['Pixel 7', 412, 915, 2.625],
  ['Galaxy A54', 412, 915, 2.625],
  ['Xiaomi (typical)', 393, 873, 2.75],
  ['desktop window', 428, 760, 1.5],
];

/** The 9:16 playfield on that screen, fitted to its width as styles.css does. */
function frame(width: number, height: number): [number, number] {
  const w = Math.min(width, (height * 9) / 16);
  return [w, (w * 16) / 9];
}

/** The resolution the frame-rate watch starts at (src/render/quality.ts). */
const startQuality = (dpr: number): number => Math.min(dpr, 2);

describe('the pixel grid', () => {
  it('makes every game pixel a whole number of screen pixels, on every phone', () => {
    for (const [name, w, h, dpr] of PHONES) {
      const [cssW, cssH] = frame(w, h);
      const grid = pixelGrid(cssW, cssH, dpr, startQuality(dpr));
      expect(Number.isInteger(grid.scale), name).toBe(true);
      expect(grid.scale, name).toBeGreaterThanOrEqual(1);
      // The picture is exactly target x scale: nothing is stretched.
      expect(grid.viewport.width, name).toBe(grid.target.width * grid.scale);
      expect(grid.viewport.height, name).toBe(grid.target.height * grid.scale);
    }
  });

  it('draws the canvas at the screen own resolution, so the browser does not rescale it', () => {
    for (const [name, w, h, dpr] of PHONES) {
      const [cssW, cssH] = frame(w, h);
      const grid = pixelGrid(cssW, cssH, dpr, startQuality(dpr));
      expect(grid.bufferWidth, name).toBe(Math.round(cssW * dpr));
      expect(grid.bufferHeight, name).toBe(Math.round(cssH * dpr));
    }
  });

  it('fits the picture inside the canvas, centred, with less than one game pixel spare', () => {
    for (const [name, w, h, dpr] of PHONES) {
      const [cssW, cssH] = frame(w, h);
      const grid = pixelGrid(cssW, cssH, dpr, startQuality(dpr));
      const spareX = grid.bufferWidth - grid.viewport.width;
      const spareY = grid.bufferHeight - grid.viewport.height;
      expect(spareX, name).toBeGreaterThanOrEqual(0);
      expect(spareY, name).toBeGreaterThanOrEqual(0);
      expect(spareX, name).toBeLessThan(grid.scale);
      expect(spareY, name).toBeLessThan(grid.scale);
      // Centred: the two sides of the border differ by at most a pixel.
      expect(Math.abs(spareX - 2 * grid.viewport.x), name).toBeLessThanOrEqual(1);
      expect(Math.abs(spareY - 2 * grid.viewport.y), name).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the M9 look: a game pixel within one screen pixel of what it was', () => {
    for (const [name, w, h, dpr] of PHONES) {
      const [cssW, cssH] = frame(w, h);
      const quality = startQuality(dpr);
      const grid = pixelGrid(cssW, cssH, dpr, quality);
      const before = (choosePixelScale(cssW * quality) * dpr) / quality;
      expect(Math.abs(grid.scale - before), name).toBeLessThanOrEqual(0.5);
    }
  });

  it('still draws the scene at about a sixteenth of the screen pixels at 4:1', () => {
    const grid = pixelGrid(375, 667, 2, 2);
    expect(grid.scale).toBe(4);
    const screen = grid.bufferWidth * grid.bufferHeight;
    expect(pixelCount(grid.target)).toBeLessThanOrEqual(screen / 16);
    expect(pixelCount(grid.target)).toBeGreaterThan(screen / 17);
  });

  it('makes game pixels bigger when the frame-rate watch steps down', () => {
    const full = pixelGrid(390, 693, 3, 2);
    const reduced = pixelGrid(390, 693, 3, 1.5);
    expect(reduced.scale).toBeGreaterThan(full.scale);
    expect(pixelCount(reduced.target)).toBeLessThan(pixelCount(full.target));
  });

  it('never shrinks the picture below the floor, however small the window', () => {
    const grid = pixelGrid(20, 30, 1, 1);
    expect(grid.target.width).toBe(RETRO.minTargetSize);
    expect(grid.target.height).toBe(RETRO.minTargetSize);
  });

  it('treats a nonsense pixel ratio as 1 rather than dividing by it', () => {
    for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const grid = pixelGrid(400, 700, bad, bad);
      expect(grid.bufferWidth).toBe(400);
      expect(grid.bufferHeight).toBe(700);
      expect(Number.isInteger(grid.scale)).toBe(true);
    }
  });
});

describe('retro settings', () => {
  it('tiles the water pattern a whole number of times per segment', () => {
    // Otherwise a segment ends mid-pattern and every join shows as a seam.
    expect(TRACK.segmentLength % RETRO.water.patternLength).toBe(0);
  });

  it('shades with three steps and no more', () => {
    expect(RETRO.toonSteps).toBe(3);
  });

  it('keeps the scenery window inside the fog it is drawn into', () => {
    expect(RETRO.scenery.buildAhead).toBeLessThanOrEqual(TRACK.buildAhead);
    expect(RETRO.scenery.offsetMin).toBeGreaterThan(TRACK.width / 2);
    expect(RETRO.scenery.offsetMin).toBeLessThan(RETRO.scenery.offsetMax);
  });

  it('describes two layers of hills, the nearer one moving more', () => {
    const { distance, parallax, width, height, lift, humps } = RETRO.hills;
    expect(distance).toHaveLength(2);
    for (const list of [parallax, width, height, lift, humps]) {
      expect(list).toHaveLength(2);
    }
    // The near layer must slide further than the far one, or there is no
    // parallax between them at all.
    expect(parallax[1]).toBeGreaterThan(parallax[0]);
    expect(distance[1]).toBeLessThan(distance[0]);
  });

  it('spins the coin through whole frames of its strip', () => {
    expect(RETRO.coin.frames).toBe(8);
    expect(RETRO.coin.framePixels).toBeGreaterThan(0);
    expect(RETRO.coin.frameRate).toBeGreaterThan(0);
  });
});

describe('pixel maps', () => {
  it('draws every power-up icon as a square block of pixels', () => {
    const size = RETRO.pickup.iconPixels;
    for (const [type, rows] of Object.entries(PICKUP_ICONS)) {
      expect(rows, type).toHaveLength(size);
      for (const row of rows) expect(row.length, `${type}: "${row}"`).toBe(size);
    }
  });

  it('uses only characters the legend knows', () => {
    const known = new Set(['.', 'o', 'b', 'c', 'm', 'r']);
    for (const [type, rows] of Object.entries(PICKUP_ICONS)) {
      for (const row of rows) {
        for (const character of row)
          expect(known.has(character), `${type}: ${character}`).toBe(true);
      }
    }
  });

  it('gives every icon some of its own colour to show, not just an outline', () => {
    for (const [type, rows] of Object.entries(PICKUP_ICONS)) {
      const body = rows
        .join('')
        .split('')
        .filter((c) => c !== '.' && c !== 'o');
      expect(body.length, type).toBeGreaterThan(20);
    }
  });
});
