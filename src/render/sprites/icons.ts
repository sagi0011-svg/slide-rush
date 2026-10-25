/**
 * Small pixel icons the HTML overlay needs (docs/ART-AND-SHOP.md §3).
 *
 * The shop writes prices as a number next to a coin, and that coin is a pixel
 * map like every other sprite rather than a downloaded image or a text symbol
 * (CLAUDE.md rule 8). It is painted onto a tiny canvas in src/render/textures.ts
 * and handed to the CSS as a background image.
 *
 * Plain data in the shared legend, so it is tested in node with the rest.
 */

/** The coin beside every price: yellow, outlined, lit from the top left. */
export const COIN_ICON: readonly string[] = [
  '..oooo..',
  '.oyyyyo.',
  'oyzzyyyo',
  'oyzyyyyo',
  'oyyyyyno',
  'oyyyynno',
  '.oynnyo.',
  '..oooo..',
];
