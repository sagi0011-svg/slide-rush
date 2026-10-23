/**
 * The hitboxes the game is actually testing, gathered up for the debug view
 * (SPEC 13).
 *
 * They come from the same functions the collision code uses, so what is drawn
 * is exactly what is checked — never a second guess at it. Boxes are filled
 * into a list made once, so turning hitboxes on adds no garbage per frame
 * (CLAUDE.md rule 7).
 */

import { DEBUG } from '../config';
import { playerBox } from './collisions';
import { createBox, frontHitCost, obstacleBox, type Box } from './obstacles';
import type { RunState } from './state';

export interface HitboxList {
  /** The player's box. */
  readonly player: Box;
  /** The obstacle boxes in use are the first `count`. */
  readonly obstacles: Box[];
  /** For each obstacle box, whether running into its front ends the run. */
  readonly deadly: boolean[];
  count: number;
}

export function createHitboxList(): HitboxList {
  return { player: createBox(), obstacles: [], deadly: [], count: 0 };
}

/**
 * Fills the list with the player's box and every obstacle close enough to
 * see. The list only ever grows, and only until it is as big as the pool.
 */
export function collectHitboxes(state: RunState, list: HitboxList): void {
  playerBox(state.player, state.distance, list.player);

  let count = 0;
  for (const obstacle of state.spawner.obstacles) {
    if (!obstacle.active) continue;
    const ahead = obstacle.s - state.distance;
    if (ahead > DEBUG.hitboxRange || ahead < -DEBUG.hitboxRange / 4) continue;

    let box = list.obstacles[count];
    if (box === undefined) {
      box = createBox();
      list.obstacles.push(box);
      list.deadly.push(false);
    }
    obstacleBox(obstacle, box);
    list.deadly[count] = frontHitCost(obstacle.type) === 'death';
    count += 1;
  }
  list.count = count;
}
