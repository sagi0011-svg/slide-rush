import { describe, expect, it } from 'vitest';
import { RETRO } from '../src/config';
import { curveY } from '../src/render/curve';
import {
  GROUND_AHEAD,
  GROUND_BEHIND,
  groundPatternBase,
  groundRowS,
  groundRowSpacing,
} from '../src/render/ground-layout';

/**
 * The grass under the slide (docs/ART-AND-SHOP.md section 1).
 *
 * The strip is reshaped every frame to follow the slide, but between two of
 * its rows it is only a straight line. Where the slide curves, that line can
 * rise above the slide floor and the grass would poke up through the water.
 * These tests hold the layout to what keeps that from ever happening.
 */
describe('the ground strip', () => {
  it('reaches from behind the camera to the fog, wherever the player is', () => {
    for (const playerS of [0, 13.7, 500, 12345]) {
      expect(groundRowS(playerS, 0)).toBeCloseTo(playerS + GROUND_AHEAD);
      expect(groundRowS(playerS, RETRO.ground.rows)).toBeCloseTo(playerS - GROUND_BEHIND);
    }
    expect(GROUND_AHEAD).toBeGreaterThanOrEqual(RETRO.scenery.buildAhead);
    expect(GROUND_BEHIND).toBeGreaterThanOrEqual(RETRO.scenery.recycleBehind);
  });

  it('never rises through the slide floor, even between two of its rows', () => {
    const spacing = groundRowSpacing();
    let closest = Number.POSITIVE_INFINITY;
    // Every stretch of a full drop cycle, and then some, sampled finely.
    for (let playerS = 0; playerS < 600; playerS += 1.3) {
      for (let row = 0; row < RETRO.ground.rows; row += 1) {
        const far = groundRowS(playerS, row);
        const near = far - spacing;
        const farY = curveY(far) - RETRO.ground.drop;
        const nearY = curveY(near) - RETRO.ground.drop;
        for (let t = 0; t <= 1; t += 0.125) {
          const s = near + (far - near) * t;
          const grass = nearY + (farY - nearY) * t;
          closest = Math.min(closest, curveY(s) - grass);
        }
      }
    }
    // A clear gap left over, for the slide's own straight lines between its
    // rows and for depth precision far down the track.
    expect(closest).toBeGreaterThan(0.05);
  });

  it('keeps the grass pattern coordinates small however long the run', () => {
    const pattern = RETRO.ground.patternLength;
    for (const playerS of [0, 5.9, 6, 77.7, 9999.5, 250000]) {
      const base = groundPatternBase(playerS);
      // A whole number of patterns, so moving the base never shifts the grass.
      expect(Math.abs(base / pattern - Math.round(base / pattern))).toBeLessThan(1e-9);
      expect(base).toBeLessThanOrEqual(playerS);
      expect(playerS - base).toBeLessThan(pattern);
      for (const row of [0, RETRO.ground.rows]) {
        const v = (groundRowS(playerS, row) - base) / pattern;
        expect(Math.abs(v)).toBeLessThan((GROUND_AHEAD + GROUND_BEHIND) / pattern + 1);
      }
    }
  });
});
