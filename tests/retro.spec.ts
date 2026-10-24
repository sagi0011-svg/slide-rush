import { describe, expect, it } from 'vitest';
import { choosePixelScale, lowResSize, pixelCount } from '../src/render/retro';
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

describe('low-resolution target', () => {
  it('is a whole number of game pixels on both sides', () => {
    const size = lowResSize(641, 1139, 4);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });

  it('draws the scene at a sixteenth of the pixels at a scale of 4', () => {
    const buffer = { width: 640, height: 1136 };
    const size = lowResSize(buffer.width, buffer.height, 4);
    const before = buffer.width * buffer.height;
    // 4x4 screen pixels per game pixel, so one sixteenth of the work.
    expect(pixelCount(size)).toBeCloseTo(before / 16, -2);
    expect(pixelCount(size)).toBeLessThan(before);
  });

  it('never shrinks below the floor, however small the window', () => {
    const size = lowResSize(40, 30, 4);
    expect(size.width).toBe(RETRO.minTargetSize);
    expect(size.height).toBe(RETRO.minTargetSize);
  });

  it('treats a nonsense scale as 1 rather than dividing by it', () => {
    const size = lowResSize(800, 600, 0);
    expect(size.width).toBe(800);
    expect(size.height).toBe(600);
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
