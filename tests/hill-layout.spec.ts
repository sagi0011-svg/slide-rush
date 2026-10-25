import { describe, expect, it } from 'vitest';
import {
  hillRidge,
  hillSize,
  hillSkyline,
  placeHills,
  type HillSize,
} from '../src/render/hill-layout';
import { RETRO } from '../src/config';

/**
 * The hills as a 2D pixel backdrop (docs/ART-AND-SHOP.md section 1).
 *
 * The whole point of the change is one claim: however the camera moves, the
 * hill outline only ever shifts as a whole — it never changes shape, which is
 * what the eye saw as the hills crawling. That claim is tested directly below,
 * by moving the camera through thousands of tiny steps and checking the
 * skyline column by column.
 */

/** The game pictures the phones in tests/retro.spec.ts end up with. */
const PICTURES: readonly (readonly [number, number])[] = [
  [195, 347],
  [188, 333],
  [180, 320],
  [206, 366],
  [197, 349],
  [125, 222],
  [107, 190],
];

describe('hill size', () => {
  it('is whole game pixels for both layers on every picture', () => {
    for (const [cols, rows] of PICTURES) {
      for (const layer of [0, 1]) {
        const size = hillSize(layer, cols, rows);
        for (const value of [size.tileWidth, size.height, size.stripWidth]) {
          expect(Number.isInteger(value), `${cols}x${rows} layer ${layer}`).toBe(true);
        }
      }
    }
  });

  it('draws a strip a whole tile wider than the screen on each side', () => {
    const size = hillSize(0, 195, 347);
    expect(size.stripWidth).toBe(195 + 2 * size.tileWidth);
  });

  it('keeps the hills the same share of the sky on every phone', () => {
    for (const [cols, rows] of PICTURES) {
      const size = hillSize(0, cols, rows);
      expect(size.height / rows).toBeCloseTo(RETRO.hills.heightShare[0], 1);
    }
  });

  it('never makes a layer smaller than the floor', () => {
    const size = hillSize(1, 4, 6);
    expect(size.height).toBe(RETRO.hills.minHeight);
    expect(size.tileWidth).toBeGreaterThanOrEqual(RETRO.hills.minHeight);
  });
});

describe('hill placement', () => {
  const size: HillSize = hillSize(0, 195, 347);

  it('always lands on whole pixels, wherever the camera puts it', () => {
    for (let i = 0; i < 500; i += 1) {
      const p = placeHills(size, 97.5 + Math.sin(i) * 13.37, 250 + Math.cos(i) * 7.1, i * 0.731);
      expect(Number.isInteger(p.left)).toBe(true);
      expect(Number.isInteger(p.bottom)).toBe(true);
      expect(Number.isInteger(p.offset)).toBe(true);
      expect(p.offset).toBeGreaterThanOrEqual(0);
      expect(p.offset).toBeLessThan(size.tileWidth);
    }
  });

  it('keeps the strip over the whole screen while the camera sways', () => {
    for (let x = 97.5 - 40; x <= 97.5 + 40; x += 0.37) {
      const p = placeHills(size, x, 250, 0);
      expect(p.left).toBeLessThanOrEqual(0);
      expect(p.left + size.stripWidth).toBeGreaterThanOrEqual(195);
    }
  });

  it('wraps a parallax running the other way into the same range', () => {
    expect(placeHills(size, 0, 0, -1).offset).toBe(size.tileWidth - 1);
    expect(placeHills(size, 0, 0, -size.tileWidth).offset).toBe(0);
  });

  it('copes with a camera position it cannot use', () => {
    const p = placeHills(size, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN);
    expect(p).toEqual({ left: 0, bottom: 0, offset: 0 });
  });
});

describe('the ridge', () => {
  it('fills one tile with heights inside the layer', () => {
    for (const layer of [0, 1]) {
      const { tileWidth, height } = hillSize(layer, 195, 347);
      const ridge = hillRidge(layer, tileWidth, height);
      expect(ridge).toHaveLength(tileWidth);
      for (const h of ridge) {
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(height);
      }
    }
  });

  it('has no seam where one repeat runs into the next', () => {
    for (const layer of [0, 1]) {
      const { tileWidth, height } = hillSize(layer, 195, 347);
      const ridge = hillRidge(layer, tileWidth, height);
      // The step from the last column back round to the first is no bigger
      // than the biggest step anywhere inside the tile.
      let biggest = 0;
      for (let x = 1; x < tileWidth; x += 1) {
        biggest = Math.max(biggest, Math.abs((ridge[x] as number) - (ridge[x - 1] as number)));
      }
      const wrap = Math.abs((ridge[0] as number) - (ridge[tileWidth - 1] as number));
      expect(wrap).toBeLessThanOrEqual(biggest);
    }
  });

  it('actually has humps, not a flat line', () => {
    const { tileWidth, height } = hillSize(0, 195, 347);
    const ridge = Array.from(hillRidge(0, tileWidth, height));
    expect(Math.max(...ridge) - Math.min(...ridge)).toBeGreaterThan(height * 0.3);
  });
});

/**
 * Finds the whole-pixel shift that turns one skyline into the next, or null
 * if there is none — which would mean the outline changed shape.
 */
function wholeShift(before: Int16Array, after: Int16Array, margin: number): string | null {
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      let same = true;
      for (let c = margin; c < after.length - margin && same; c += 1) {
        if ((after[c] as number) !== (before[c - dx] as number) + dy) same = false;
      }
      if (same) return `${dx},${dy}`;
    }
  }
  return null;
}

describe('the hills never crawl', () => {
  it('only ever shift the outline as a whole, through thousands of camera moves', () => {
    for (const [cols, rows] of PICTURES) {
      for (const layer of [0, 1]) {
        const size = hillSize(layer, cols, rows);
        const ridge = hillRidge(layer, size.tileWidth, size.height);
        let before: Int16Array | null = null;
        // The camera sways, tips and slides on its own different rhythms, by
        // tiny fractions of a pixel per frame, like it does on the slide.
        for (let frame = 0; frame < 3000; frame += 1) {
          const centreX = cols / 2 + 9 * Math.sin(frame * 0.0071);
          const centreY = rows * 0.72 + 4 * Math.sin(frame * 0.0113 + 1);
          const parallax = 30 * Math.sin(frame * 0.0037);
          const skyline = hillSkyline(ridge, placeHills(size, centreX, centreY, parallax), cols);
          if (before !== null) {
            expect(
              wholeShift(before, skyline, 3),
              `${cols}x${rows} layer ${layer} frame ${frame}`,
            ).not.toBeNull();
          }
          before = skyline;
        }
      }
    }
  });

  it('would catch a crawl if the scale stopped being one pixel per pixel', () => {
    // The check above must be able to fail. Stretching the ridge by a non-whole
    // factor — what the old 3D surfaces did — is exactly the case it is for.
    const size = hillSize(0, 195, 347);
    const ridge = hillRidge(0, size.tileWidth, size.height);
    const stretched = (shift: number): Int16Array => {
      const out = new Int16Array(195);
      for (let c = 0; c < 195; c += 1) {
        const x = Math.floor((c + shift) / 1.6) % size.tileWidth;
        out[c] = ridge[x] as number;
      }
      return out;
    };
    let crawled = false;
    for (let s = 0; s < 5 && !crawled; s += 0.3) {
      if (wholeShift(stretched(s), stretched(s + 0.3), 3) === null) crawled = true;
    }
    expect(crawled).toBe(true);
  });
});
