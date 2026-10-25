/**
 * Where the grass strip under the slide lies (docs/ART-AND-SHOP.md §1).
 *
 * Plain arithmetic with no Three.js, so it can be tested: the strip is cut
 * into rows across the slide, and each row sits at a point along the slide
 * worked out from the player's position alone. Row 0 is the far edge.
 */

import { RETRO } from '../config';

/** How far behind the player the grass reaches, in units: as far as the scenery does. */
export const GROUND_BEHIND = RETRO.scenery.recycleBehind;

/** How far ahead of the player it reaches, in units: into the fog, like the scenery. */
export const GROUND_AHEAD = RETRO.scenery.buildAhead;

/** Units of slide between two rows of the strip. */
export function groundRowSpacing(): number {
  return (GROUND_AHEAD + GROUND_BEHIND) / RETRO.ground.rows;
}

/**
 * Where along the slide a row of the strip sits, in units from the start.
 *
 * @param playerS how far the player has travelled, in units
 * @param row 0 for the far edge, up to RETRO.ground.rows for the near one
 */
export function groundRowS(playerS: number, row: number): number {
  return playerS + GROUND_AHEAD - row * groundRowSpacing();
}

/**
 * Where the grass pattern starts counting from, for this player position: the
 * last whole pattern before them.
 *
 * Texture coordinates are measured from here rather than from the start of
 * the slide, so they stay small however long the run goes. A phone's GPU may
 * hold them at low precision, and a coordinate in the thousands would turn the
 * grass into smeared blocks. Because the base is always a whole number of
 * patterns, moving it on never makes the pattern jump.
 */
export function groundPatternBase(playerS: number): number {
  const pattern = RETRO.ground.patternLength;
  return Math.floor(playerS / pattern) * pattern;
}
