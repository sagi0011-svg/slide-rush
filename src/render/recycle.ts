/**
 * Working out where a recycled track segment belongs.
 *
 * Kept apart from track.ts, with no Three.js in it, so the maths can be tested
 * on its own. The pool of segments covers a window that slides with the
 * player; this wraps a segment back into that window however far outside it
 * has ended up — which matters when the player jumps backwards, as they do
 * when a run restarts.
 */

/**
 * The window of track the segments cover starts this far behind the player.
 *
 * @param playerS how far the player has travelled, in units
 * @param recycleBehind how far behind the player a segment is recycled
 * @param segmentLength the length of one segment
 */
export function segmentWindowStart(
  playerS: number,
  recycleBehind: number,
  segmentLength: number,
): number {
  return playerS - recycleBehind - segmentLength;
}

/**
 * Moves a segment by whole pool-lengths until it sits in the visible window.
 *
 * Returns the segment's new start. In normal play this either leaves it alone
 * or moves it one pool-length forward; after a restart it can move it a long
 * way back in a single step.
 *
 * @param startS where the segment currently starts, in units
 * @param windowStart the first unit the window covers
 * @param span the total length of the whole pool of segments
 */
export function wrapSegmentStart(startS: number, windowStart: number, span: number): number {
  if (span <= 0) return startS;
  const steps = Math.floor((startS - windowStart) / span);
  if (steps === 0) return startS;
  return startS - steps * span;
}
