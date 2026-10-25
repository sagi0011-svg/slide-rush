/**
 * The active visual style (docs/VISUAL-STYLES.md §2).
 *
 * This is the only render code that knows which of the three looks is on.
 * Everything else asks it for what it needs — a colour, whether to outline,
 * how to filter a texture — and never checks the style itself, so a new look
 * is a new entry in `THEMES` (src/config.ts) and nothing more. Nothing in
 * src/game/ imports this: a look is only ever a picture.
 *
 * Values are read when something is built, not every frame. Changing the style
 * therefore means building the renderer again, which main.ts does from the
 * Settings screen.
 */

import { SAVE, THEMES, type Palette, type Theme, type VisualStyle } from '../config';

let active: VisualStyle = SAVE.defaultVisualStyle;

/** Switches the look that everything built from now on is drawn in. */
export function setVisualStyle(style: VisualStyle): void {
  active = style;
}

/** The look things are being built in. */
export function visualStyle(): VisualStyle {
  return active;
}

/** How the active look draws the world. */
export function theme(): Theme {
  return THEMES[active];
}

/** The active look's colours. */
export function palette(): Palette {
  return THEMES[active].palette;
}
