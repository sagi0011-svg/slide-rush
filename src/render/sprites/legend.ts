/**
 * The one legend every rider sprite is drawn with (docs/ART-AND-SHOP.md §2).
 *
 * A sprite is a list of strings, one character per pixel; this says which
 * palette colour each character is. Sharing one legend between the animals,
 * the rings and the effects means a sprite can never quietly use a colour the
 * rest of the game does not have, and a test can check every map against it.
 *
 * Plain data and no Three.js, so the maps can be tested in node.
 */

import { PALETTE } from '../../config';

/** The character for a clear pixel. */
export const CLEAR = '.';

export const SPRITE_LEGEND: Readonly<Record<string, number>> = {
  o: PALETTE.outline,
  c: PALETTE.cream,
  g: PALETTE.forest,
  G: PALETTE.forestLight,
  d: PALETTE.forestDark,
  y: PALETTE.yellow,
  n: PALETTE.orange,
  r: PALETTE.red,
  b: PALETTE.blue,
  s: PALETTE.skyBlue,
  p: PALETTE.pink,
  P: PALETTE.pinkDark,
  m: PALETTE.brown,
  M: PALETTE.brownDark,
  e: PALETTE.grey,
  E: PALETTE.greyDark,
  k: PALETTE.charcoal,
  a: PALETTE.sand,
  A: PALETTE.slideEdge,
  u: PALETTE.mountain,
  U: PALETTE.mountainDark,
  q: PALETTE.water,
  Q: PALETTE.waterLight,
  W: PALETTE.waterDeep,
  z: PALETTE.sun,
};

/** Every character a sprite may use: the legend's, plus clear. */
export const SPRITE_CHARACTERS: ReadonlySet<string> = new Set([
  CLEAR,
  ...Object.keys(SPRITE_LEGEND),
]);
