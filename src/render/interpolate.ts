/**
 * Smoothing between simulation ticks (CLAUDE.md rule 5).
 *
 * The game thinks 60 times a second, but it is drawn as often as the screen
 * allows. Rendering therefore shows a point part-way between the last two
 * ticks, which is what makes movement smooth on a 120 Hz phone and steady on
 * a slow one.
 */

/** A point `t` of the way from `a` to `b`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * How far between the last two ticks to draw.
 *
 * When the simulation is stopped — paused, or during the beat after a crash —
 * there is no next tick to head towards. Carrying on interpolating would make
 * the player and the camera jitter back and forth by one tick of travel for
 * as long as the game is frozen, because the two ticks stay put while this
 * value keeps sweeping between them. Frozen means "show the last tick".
 *
 * @param alpha how far into the next tick the loop has got, 0..1
 * @param frozen true while the simulation is not advancing
 */
export function frameAlpha(alpha: number, frozen: boolean): number {
  if (frozen) return 1;
  if (!Number.isFinite(alpha)) return 0;
  return Math.min(Math.max(alpha, 0), 1);
}
