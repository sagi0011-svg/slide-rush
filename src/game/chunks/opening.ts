/**
 * The opening stretch of every run that does not start with the tutorial
 * (SPEC 6): coins and nothing to dodge, so the player can find their feet
 * before the first obstacle. Laid down once, before the random chunks.
 *
 * Three trails, middle then left then right, so the first thing the player
 * does is swipe for coins rather than out of trouble.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { line } from './helpers';

const LENGTH = TRACK.openingLength;
const THIRD = LENGTH / 3;

/** Room left at each end of a trail, in units, to change lane between them. */
const GAP = 5;

export const OPENING_CHUNK: Chunk = {
  id: 'opening',
  minTier: 0,
  maxTier: 0,
  length: LENGTH,
  placements: [
    ...line(0, GAP + 3, THIRD - GAP),
    ...line(-1, THIRD + GAP, 2 * THIRD - GAP),
    ...line(1, 2 * THIRD + GAP, LENGTH - GAP),
  ],
};
