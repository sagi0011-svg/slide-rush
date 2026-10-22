/**
 * The four obstacle types and their boxes (SPEC 7).
 *
 * Pure logic, no Three.js. The sizes live in src/config.ts; this file turns
 * them into the forgiving hitboxes the collision test uses.
 */

import { LANES, OBSTACLES } from '../config';

export type ObstacleType = 'lowMine' | 'highObstacle' | 'fullBlocker' | 'softObstacle';

export const OBSTACLE_TYPES: readonly ObstacleType[] = [
  'lowMine',
  'highObstacle',
  'fullBlocker',
  'softObstacle',
];

/** What a hit with this obstacle costs (SPEC 7). */
export type HitCost = 'death' | 'stumble';

/** An axis-aligned box in world units. */
export interface Box {
  /** Centre across the slide, and half its width. */
  x: number;
  halfW: number;
  /** Bottom and top above the slide floor. */
  minY: number;
  maxY: number;
  /** Centre along the slide, and half its depth. */
  z: number;
  halfD: number;
}

/** One obstacle standing on the track. */
export interface Obstacle {
  type: ObstacleType;
  /** Lane it sits in: -1, 0 or 1. */
  lane: number;
  /** Where it is along the slide, in units from the start. */
  s: number;
}

/** What a head-on hit with this type costs. A side hit is always a stumble. */
export function frontHitCost(type: ObstacleType): HitCost {
  return type === 'softObstacle' ? 'stumble' : 'death';
}

/** True if jumping clears this type. */
export function clearedByJump(type: ObstacleType): boolean {
  return type === 'lowMine' || type === 'softObstacle';
}

/** True if sliding gets under this type. */
export function clearedBySlide(type: ObstacleType): boolean {
  return type === 'highObstacle';
}

/** True if the only way past is a lane change. */
export function laneChangeOnly(type: ObstacleType): boolean {
  return type === 'fullBlocker';
}

/** Where the middle of a lane is, across the slide, in units. */
export function laneCenter(lane: number): number {
  return lane * LANES.width;
}

/**
 * The hitbox of an obstacle: its visual size shrunk by OBSTACLES.hitboxScale,
 * so near misses feel like misses (SPEC 7).
 */
export function obstacleBox(obstacle: Obstacle, out: Box): Box {
  const size = OBSTACLES.size[obstacle.type];
  const scale = OBSTACLES.hitboxScale;
  const height = size.h * scale;
  // Shrink around the middle of the box, so a low obstacle stays low.
  const centerY = size.y + size.h / 2;

  out.x = laneCenter(obstacle.lane);
  out.halfW = (size.w * scale) / 2;
  out.minY = centerY - height / 2;
  out.maxY = centerY + height / 2;
  out.z = obstacle.s;
  out.halfD = (size.d * scale) / 2;
  return out;
}

/** A fresh, empty box, for callers that need somewhere to write. */
export function createBox(): Box {
  return { x: 0, halfW: 0, minY: 0, maxY: 0, z: 0, halfD: 0 };
}
