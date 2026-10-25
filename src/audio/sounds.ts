/**
 * The names of the eleven placeholder effects (SPEC 12).
 *
 * Kept in their own tiny module so the pure sound maths, the Web Audio engine
 * and the game-event watcher can all share one list without importing each
 * other.
 */

export const SFX_NAMES = [
  'coin',
  'jump',
  'slide',
  'lane',
  'stumble',
  'death',
  'powerUp',
  'powerUpEnd',
  'shieldPop',
  'uiTap',
  'purchase',
] as const;

/** One of the eleven effects. */
export type SfxName = (typeof SFX_NAMES)[number];
