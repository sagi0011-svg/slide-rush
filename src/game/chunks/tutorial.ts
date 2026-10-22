/**
 * The track the first-run tutorial is taught on (SPEC 11).
 *
 * One chunk per prompt, each holding exactly the obstacle that prompt is
 * about and nothing else, with a coin trail showing where to end up. The
 * spawner lays these down in order before it starts picking at random, so the
 * three lessons always arrive in the same place.
 */

import { TRACK } from '../../config';
import type { Chunk } from './types';
import { arc, line, low } from './helpers';
import { breatherForTier } from './spawner';

const LENGTH = TRACK.chunkLength;

/** Where in its own chunk each lesson's obstacle sits, in units. */
const OBSTACLE_Z = 24;

export const TUTORIAL_CHUNKS: readonly Chunk[] = [
  {
    id: 'tut-1-move',
    minTier: 0,
    maxTier: 0,
    length: LENGTH,
    // A wall straight ahead: the only way past is to move aside.
    placements: [
      { type: 'fullBlocker', lane: 0, z: OBSTACLE_Z },
      ...line(0, 6, OBSTACLE_Z - 8),
      ...line(1, OBSTACLE_Z - 2, 36),
    ],
  },
  {
    id: 'tut-2-jump',
    minTier: 0,
    maxTier: 0,
    length: LENGTH,
    // A mine, with the coins arcing over it the way a jump does.
    placements: [{ type: 'lowMine', lane: 1, z: OBSTACLE_Z }, ...arc(1, OBSTACLE_Z)],
  },
  {
    id: 'tut-3-slide',
    minTier: 0,
    maxTier: 0,
    length: LENGTH,
    // An arch, with the coins running low underneath it.
    placements: [
      { type: 'highObstacle', lane: 1, z: OBSTACLE_Z },
      ...low(1, OBSTACLE_Z - 5, OBSTACLE_Z + 5),
      ...line(1, 32, 36),
    ],
  },
];

/**
 * How far along the slide each lesson's obstacle actually ends up.
 *
 * Worked out from the chunk layout rather than written down, because the gap
 * the spawner leaves between chunks would otherwise push the prompts out of
 * step with the obstacles they are about.
 */
export const TUTORIAL_STEP_POSITIONS: readonly number[] = TUTORIAL_CHUNKS.map(
  (_, index) => index * (LENGTH + breatherForTier(0)) + OBSTACLE_Z,
);
