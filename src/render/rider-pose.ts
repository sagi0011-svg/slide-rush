/**
 * What the rider is doing this frame, and where its layers go
 * (docs/ART-AND-SHOP.md §2).
 *
 * This is the decision half of the rider: which frame of the atlas to show and
 * how many sprite pixels to move each layer by. It reads the pose the game is
 * already in and decides nothing about the game — the player is exactly where
 * src/game/ put it, whichever frame is shown (CLAUDE.md rules 4 and 13). Plain
 * arithmetic with no Three.js, so it is tested like a game rule, and the debug
 * gallery uses it too, so it shows exactly what the game would draw.
 */

import { RIDER } from '../config';
import type { AnimalFrame } from './sprites';

export type RiderPose = 'idle' | 'leanLeft' | 'leanRight' | 'jump' | 'duck' | 'land' | 'crash';

/** Every pose, in the order the gallery offers them. */
export const RIDER_POSES: readonly RiderPose[] = [
  'idle',
  'leanLeft',
  'leanRight',
  'jump',
  'duck',
  'land',
  'crash',
];

export interface PoseInput {
  /** Height above the slide, in units. */
  height: number;
  /** True while the game has the player in the low slide pose. */
  sliding: boolean;
  /** True once the run has ended. */
  dead: boolean;
  /** How fast the player is moving across the slide, in lane units per second. */
  laneSpeed: number;
  /** Seconds since the rider last came down onto the water. */
  sinceLanding: number;
}

/** The pose to show, most important first: a crash beats everything. */
export function choosePose(input: PoseInput): RiderPose {
  if (input.dead) return 'crash';
  if (input.height > RIDER.airborneHeight) return 'jump';
  if (input.sliding) return 'duck';
  if (input.sinceLanding < RIDER.landTime) return 'land';
  if (input.laneSpeed > RIDER.leanThreshold) return 'leanRight';
  if (input.laneSpeed < -RIDER.leanThreshold) return 'leanLeft';
  return 'idle';
}

/** Where the layers go for a pose. All offsets in sprite pixels, + is down. */
export interface PoseLayout {
  /** Which animal frame to show. */
  frame: AnimalFrame;
  /** True to draw that frame mirrored (the left lean). */
  mirror: boolean;
  /** How far the animal is moved within the ring. */
  animalDy: number;
  /** How far the whole rider, ring and all, is moved. */
  riderDy: number;
}

/**
 * The idle bob: 0 or 1 sprite pixel, never anything in between, so the
 * animal moves by whole pixels and stays on the grid.
 */
export function bobOffset(elapsed: number): number {
  return Math.floor(elapsed * RIDER.bobRate * 2) % 2 === 0 ? 0 : RIDER.bobPixels;
}

export function poseLayout(pose: RiderPose, elapsed: number): PoseLayout {
  switch (pose) {
    case 'idle':
      return { frame: 'idle', mirror: false, animalDy: bobOffset(elapsed), riderDy: 0 };
    case 'leanLeft':
      return { frame: 'lean', mirror: true, animalDy: 0, riderDy: 0 };
    case 'leanRight':
      return { frame: 'lean', mirror: false, animalDy: 0, riderDy: 0 };
    case 'jump':
      return { frame: 'jump', mirror: false, animalDy: 0, riderDy: 0 };
    case 'duck':
      return {
        frame: 'idle',
        mirror: false,
        animalDy: RIDER.duckSinkPixels,
        riderDy: RIDER.duckDropPixels,
      };
    case 'land':
      return { frame: 'idle', mirror: false, animalDy: RIDER.landSinkPixels, riderDy: 0 };
    case 'crash':
      return { frame: 'crash', mirror: false, animalDy: -RIDER.crashLiftPixels, riderDy: 0 };
  }
}

/** Which spin frame the ring shows at this moment. */
export function ringSpinFrame(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) * RIDER.ringSpinRate) % RIDER.ringSpinFrames;
}

/** Which frame of a power-up effect shows at this moment. */
export function effectFrame(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) * RIDER.effectFrameRate) % RIDER.effectFrames;
}

/**
 * Where the layers sit in one composite picture of the rider, in sprite
 * pixels from its top-left corner: the ring along the bottom, the animal
 * centred above it with its bottom edge on `RIDER.animalBottomRow` of the
 * ring. The game and the gallery both place the layers from this.
 */
export const RIDER_LAYOUT = {
  width: RIDER.ringWidth,
  height: RIDER.animalPixels - RIDER.animalBottomRow + RIDER.ringHeight,
  ringX: 0,
  ringY: RIDER.animalPixels - RIDER.animalBottomRow,
  animalX: (RIDER.ringWidth - RIDER.animalPixels) / 2,
  animalY: 0,
} as const;
