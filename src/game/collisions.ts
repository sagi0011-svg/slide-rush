/**
 * Collisions (SPEC 7).
 *
 * Simple axis-aligned boxes: one per obstacle, and one for the player that
 * shrinks when sliding and rises when jumping. Both are about 15% smaller than
 * what you see, so near misses feel like misses.
 *
 * Pure logic, no Three.js, and no allocation — callers pass in the box to fill.
 */

import { LANES, OBSTACLES, PLAYER } from '../config';
import { isSliding, type PlayerState } from './player';
import { createBox, frontHitCost, obstacleBox, type Box, type HitCost } from './obstacles';
import type { Obstacle } from './obstacles';

/** How the player met the obstacle. */
export type HitKind = 'front' | 'side';

export interface Hit {
  kind: HitKind;
  cost: HitCost;
}

/** Fills `out` with the player's hitbox and returns it. */
export function playerBox(player: PlayerState, distance: number, out: Box): Box {
  const scale = OBSTACLES.hitboxScale;
  const standing = isSliding(player) ? PLAYER.slideHeight : PLAYER.standHeight;

  out.x = player.laneOffset * LANES.width;
  out.halfW = PLAYER.radius * scale;
  out.minY = player.height;
  out.maxY = player.height + standing * scale;
  out.z = distance;
  out.halfD = PLAYER.radius * scale;
  return out;
}

function overlapsX(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < a.halfW + b.halfW;
}

function overlapsY(a: Box, b: Box): boolean {
  return a.minY < b.maxY && b.minY < a.maxY;
}

function overlapsZ(a: Box, b: Box): boolean {
  return Math.abs(a.z - b.z) < a.halfD + b.halfD;
}

/** True if two boxes overlap on all three axes. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return overlapsX(a, b) && overlapsY(a, b) && overlapsZ(a, b);
}

// Scratch boxes, reused on every test so the hot loop never allocates (rule 7).
const currentBox = createBox();
const previousBox = createBox();
const targetBox = createBox();

/**
 * Checks the player against one obstacle.
 *
 * Returns null if they are not touching. Otherwise it works out whether the
 * player ran into the front of it or slid into its side: if they were already
 * level with the obstacle and only now overlap across the slide, they moved
 * into its side, which is always a stumble rather than death (SPEC 7).
 *
 * @param previousLaneOffset where the player was across the slide last tick
 * @param previousDistance how far the player had travelled last tick
 */
export function checkObstacle(
  player: PlayerState,
  distance: number,
  previousDistance: number,
  obstacle: Obstacle,
): Hit | null {
  const box = obstacleBox(obstacle, targetBox);
  const now = playerBox(player, distance, currentBox);
  if (!boxesOverlap(now, box)) return null;

  // Rebuild the player's box as it was on the previous tick.
  previousBox.x = player.prevLaneOffset * LANES.width;
  previousBox.halfW = now.halfW;
  previousBox.minY = player.prevHeight;
  previousBox.maxY = player.prevHeight + (now.maxY - now.minY);
  previousBox.z = previousDistance;
  previousBox.halfD = now.halfD;

  const wasAlongside = overlapsZ(previousBox, box);
  const wasInLane = overlapsX(previousBox, box);

  // Already level with it and only now in its lane: they moved into its side.
  if (wasAlongside && !wasInLane) {
    return { kind: 'side', cost: 'stumble' };
  }

  return { kind: 'front', cost: frontHitCost(obstacle.type) };
}
