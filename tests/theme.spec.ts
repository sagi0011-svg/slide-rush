import { describe, expect, it } from 'vitest';
import { PALETTE, SAVE, THEMES, VISUAL_STYLES, type Palette } from '../src/config';
import { palette, setVisualStyle, theme, visualStyle } from '../src/render/theme';
import { pixelCount, pixelGrid, smoothGrid } from '../src/render/retro';

/**
 * The three visual styles (docs/VISUAL-STYLES.md).
 *
 * What a look looks like is a thing to look at. What can be pinned down is
 * that each one is complete, that Sunset Pixel is the v0.2 look untouched, that
 * Retro Pixel keeps to its seven colours, and that the pixel looks stay at
 * least as cheap to draw as v0.2 was.
 */

const RETRO_SEVEN = [0x0e3a63, 0x15558c, 0x071e33, 0x3fd0e0, 0xff6b4a, 0xffd23f, 0xbff7ff];

/** The keys that are not the world: the riders' own colours and the debug boxes. */
const NOT_WORLD = new Set<keyof Palette>([
  'pink',
  'pinkDark',
  'brown',
  'brownDark',
  'grey',
  'greyDark',
  'charcoal',
  'debugPlayer',
  'debugDeadly',
  'debugStumble',
]);

describe('the themes', () => {
  it('has one for every style', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...VISUAL_STYLES].sort());
  });

  it('gives every style every colour', () => {
    for (const style of VISUAL_STYLES) {
      const colors = THEMES[style].palette;
      for (const key of Object.keys(PALETTE) as (keyof Palette)[]) {
        const value = colors[key];
        expect(Number.isInteger(value), `${style}.${key}`).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('keeps Sunset Pixel exactly the v0.2 look', () => {
    const sunset = THEMES.sunset;
    expect(sunset.palette).toBe(PALETTE);
    expect(sunset.pixelated).toBe(true);
    expect(sunset.shading).toBe('toon');
    expect(sunset.outlines).toBe(true);
    expect(sunset.smoothTextures).toBe(false);
    expect(sunset.skyDither).toBe(true);
  });

  it('keeps Retro Pixel to its seven colours for the whole world', () => {
    const colors = THEMES.pixel.palette;
    for (const key of Object.keys(colors) as (keyof Palette)[]) {
      if (NOT_WORLD.has(key)) continue;
      expect(RETRO_SEVEN, key).toContain(colors[key]);
    }
  });

  it('keeps the riders the same colours in every style', () => {
    for (const style of VISUAL_STYLES) {
      for (const key of NOT_WORLD) {
        expect(THEMES[style].palette[key], `${style}.${key}`).toBe(PALETTE[key]);
      }
    }
  });

  it('makes the pixel looks pixelated and Classic 3D smooth', () => {
    expect(THEMES.pixel.pixelated).toBe(true);
    expect(THEMES.pixel.shading).toBe('flat');
    expect(THEMES.classic.pixelated).toBe(false);
    expect(THEMES.classic.smoothTextures).toBe(true);
    expect(THEMES.classic.outlines).toBe(false);
  });
});

describe('the active theme', () => {
  it('starts on the default look and follows the switch', () => {
    expect(visualStyle()).toBe(SAVE.defaultVisualStyle);
    for (const style of VISUAL_STYLES) {
      setVisualStyle(style);
      expect(visualStyle()).toBe(style);
      expect(theme()).toBe(THEMES[style]);
      expect(palette()).toBe(THEMES[style].palette);
    }
    setVisualStyle(SAVE.defaultVisualStyle);
  });
});

describe('how much each look draws (docs/VISUAL-STYLES.md section 5)', () => {
  // A common phone: 390 x 844 CSS pixels at 3x, capped at 2x by the governor.
  const phone = [390, 844, 3, 2] as const;

  it('draws Retro Pixel at no more pixels than Sunset Pixel', () => {
    const sunset = pixelGrid(...phone, THEMES.sunset);
    const retro = pixelGrid(...phone, THEMES.pixel);
    expect(retro.scale).toBeGreaterThanOrEqual(sunset.scale);
    expect(pixelCount(retro.target)).toBeLessThanOrEqual(pixelCount(sunset.target));
  });

  it('keeps every Retro Pixel game pixel a whole number of screen pixels', () => {
    for (const dpr of [1, 1.5, 2, 2.625, 2.75, 3]) {
      const grid = pixelGrid(390, 844, dpr, Math.min(dpr, 2), THEMES.pixel);
      expect(Number.isInteger(grid.scale)).toBe(true);
      expect(grid.viewport.width).toBe(grid.target.width * grid.scale);
    }
  });

  it('draws Classic 3D at the resolution the frame-rate watch allows, filling the screen', () => {
    const grid = smoothGrid(...phone);
    expect(grid.target).toEqual({ width: 780, height: 1688 });
    expect(grid.viewport).toEqual({ x: 0, y: 0, width: 1170, height: 2532 });
    // The watch stepping down draws fewer pixels.
    expect(pixelCount(smoothGrid(390, 844, 3, 1).target)).toBeLessThan(pixelCount(grid.target));
  });

  it('never draws Classic 3D sharper than the screen itself', () => {
    expect(smoothGrid(400, 800, 1, 2).target).toEqual({ width: 400, height: 800 });
  });
});
