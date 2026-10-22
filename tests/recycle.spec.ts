import { describe, expect, it } from 'vitest';
import { TRACK } from '../src/config';
import { segmentWindowStart, wrapSegmentStart } from '../src/render/recycle';

/**
 * The slide is a handful of segments recycled around the player. These are the
 * sums behind that, including the case that broke the game: after a crash the
 * run restarts at zero, the player jumps a long way backwards, and the slide
 * has to come back with them instead of being left far down the track.
 */

const SEGMENT_COUNT = Math.ceil((TRACK.buildAhead + TRACK.recycleBehind) / TRACK.segmentLength) + 1;
const SPAN = SEGMENT_COUNT * TRACK.segmentLength;

function windowFor(playerS: number): number {
  return segmentWindowStart(playerS, TRACK.recycleBehind, TRACK.segmentLength);
}

/** Where every segment of a fresh pool starts, as createTrack lays it out. */
function freshPool(): number[] {
  return Array.from({ length: SEGMENT_COUNT }, (_, i) => windowFor(0) + i * TRACK.segmentLength);
}

describe('segmentWindowStart', () => {
  it('starts the window behind the player', () => {
    expect(windowFor(0)).toBeLessThan(0);
    expect(windowFor(100)).toBeLessThan(100);
  });

  it('moves with the player', () => {
    expect(windowFor(100) - windowFor(0)).toBe(100);
  });
});

describe('wrapSegmentStart', () => {
  it('leaves a segment already in the window alone', () => {
    const windowStart = windowFor(0);
    for (const startS of freshPool()) {
      expect(wrapSegmentStart(startS, windowStart, SPAN)).toBe(startS);
    }
  });

  it('moves a segment that has fallen behind to the front', () => {
    const windowStart = windowFor(0);
    const behind = windowStart - 1;
    expect(wrapSegmentStart(behind, windowStart, SPAN)).toBe(behind + SPAN);
  });

  it('always lands inside the window, however far out it starts', () => {
    const windowStart = windowFor(500);
    for (const startS of [-5000, -200, 0, 123, 480, 1000, 99999]) {
      const wrapped = wrapSegmentStart(startS, windowStart, SPAN);
      expect(wrapped).toBeGreaterThanOrEqual(windowStart);
      expect(wrapped).toBeLessThan(windowStart + SPAN);
    }
  });

  it('keeps segments a whole number of pool-lengths from where they were', () => {
    const windowStart = windowFor(500);
    for (const startS of [-5000, 0, 123, 99999]) {
      const moved = startS - wrapSegmentStart(startS, windowStart, SPAN);
      expect(Math.abs(moved % SPAN)).toBeCloseTo(0, 9);
    }
  });

  it('brings the whole slide back when the run restarts', () => {
    // Play forward a long way, recycling as the player goes.
    let pool = freshPool();
    for (let playerS = 0; playerS <= 1200; playerS += 7) {
      const windowStart = windowFor(playerS);
      pool = pool.map((startS) => wrapSegmentStart(startS, windowStart, SPAN));
    }
    expect(Math.max(...pool)).toBeGreaterThan(1000);

    // Now crash and restart: the player is back at zero in a single step.
    const restartWindow = windowFor(0);
    pool = pool.map((startS) => wrapSegmentStart(startS, restartWindow, SPAN));

    for (const startS of pool) {
      expect(startS).toBeGreaterThanOrEqual(restartWindow);
      expect(startS).toBeLessThan(restartWindow + SPAN);
    }
    // And the track is drawn in front of the player again, not far away.
    const nearestAhead = Math.min(...pool.filter((startS) => startS >= 0));
    expect(nearestAhead).toBeLessThanOrEqual(TRACK.segmentLength);
  });

  it('still covers the track the player can see, at any distance', () => {
    let pool = freshPool();
    for (const playerS of [0, 37, 500, 1234, 0, 88]) {
      const windowStart = windowFor(playerS);
      pool = pool.map((startS) => wrapSegmentStart(startS, windowStart, SPAN));

      const covered = [...pool].sort((a, b) => a - b);
      // No gaps: each segment starts where the one before it ends.
      for (let i = 1; i < covered.length; i += 1) {
        expect((covered[i] as number) - (covered[i - 1] as number)).toBe(TRACK.segmentLength);
      }
      // The near edge is behind the player and the far edge is past the fog.
      expect(covered[0] as number).toBeLessThanOrEqual(playerS);
      const farEdge = (covered.at(-1) as number) + TRACK.segmentLength;
      expect(farEdge).toBeGreaterThanOrEqual(playerS + TRACK.buildAhead);
    }
  });

  it('does nothing if the pool has no length', () => {
    expect(wrapSegmentStart(50, 0, 0)).toBe(50);
  });
});
