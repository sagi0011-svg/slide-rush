/**
 * Where every rider frame sits in the one sprite atlas (docs/ART-AND-SHOP.md
 * §2).
 *
 * The atlas is three blocks stacked on top of each other, each a grid of
 * same-sized cells:
 *
 * - **animals**: one column per animal, one row per frame (ANIMAL_FRAMES);
 * - **rings**: one column per ring, two rows per spin frame — back half, then
 *   front half;
 * - **effects**: one column per power-up, one row per effect frame.
 *
 * The cell sizes and frame counts come from RIDER in src/config.ts; the
 * positions are worked out from them here. Plain arithmetic and data with no
 * Three.js and no canvas, so the layout is tested in node — and the painter in
 * textures.ts and the rider's UVs both read the same functions, so they can
 * never disagree about where a frame is.
 */

import { RIDER } from '../../config';
import { POWERUP_TYPES, type PowerUpType } from '../../game/powerups';
import { ANIMAL_FRAMES, ANIMAL_IDS, animalRows, type AnimalFrame, type AnimalId } from './animals';
import { effectRows } from './effects';
import { RING_IDS, ringRows, type RingHalf, type RingId } from './rings';

/** A rectangle of the atlas, in pixels from its top-left corner. */
export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

const animalBlock = {
  top: 0,
  width: ANIMAL_IDS.length * RIDER.animalPixels,
  height: ANIMAL_FRAMES.length * RIDER.animalPixels,
};
const ringBlock = {
  top: animalBlock.top + animalBlock.height,
  width: RING_IDS.length * RIDER.ringWidth,
  height: RIDER.ringSpinFrames * 2 * RIDER.ringHeight,
};
const effectBlock = {
  top: ringBlock.top + ringBlock.height,
  width: POWERUP_TYPES.length * RIDER.effectWidth,
  height: RIDER.effectFrames * RIDER.effectHeight,
};

/** The size of the whole atlas, in pixels. */
export const ATLAS_SIZE = {
  width: Math.max(animalBlock.width, ringBlock.width, effectBlock.width),
  height: effectBlock.top + effectBlock.height,
} as const;

export function animalCell(id: AnimalId, frame: AnimalFrame): Cell {
  const size = RIDER.animalPixels;
  return {
    x: ANIMAL_IDS.indexOf(id) * size,
    y: animalBlock.top + ANIMAL_FRAMES.indexOf(frame) * size,
    width: size,
    height: size,
  };
}

/** Wraps a spin frame into range, so the caller can just count up. */
export function wrapSpin(spinFrame: number): number {
  const frames = RIDER.ringSpinFrames;
  return ((Math.floor(spinFrame) % frames) + frames) % frames;
}

export function ringCell(id: RingId, spinFrame: number, half: RingHalf): Cell {
  const row = wrapSpin(spinFrame) * 2 + (half === 'front' ? 1 : 0);
  return {
    x: RING_IDS.indexOf(id) * RIDER.ringWidth,
    y: ringBlock.top + row * RIDER.ringHeight,
    width: RIDER.ringWidth,
    height: RIDER.ringHeight,
  };
}

export function effectCell(type: PowerUpType, frame: number): Cell {
  const frames = RIDER.effectFrames;
  const loop = ((Math.floor(frame) % frames) + frames) % frames;
  return {
    x: POWERUP_TYPES.indexOf(type) * RIDER.effectWidth,
    y: effectBlock.top + loop * RIDER.effectHeight,
    width: RIDER.effectWidth,
    height: RIDER.effectHeight,
  };
}

/** One frame of the atlas: where it goes and what is drawn there. */
export interface AtlasEntry {
  /** What the frame is, for test messages. */
  name: string;
  /** Whose frame it is: an animal, ring or power-up id. */
  id: string;
  cell: Cell;
  rows: readonly string[];
}

/** Every frame in the atlas, with its pixels. Built once, at startup. */
export function atlasEntries(): AtlasEntry[] {
  const entries: AtlasEntry[] = [];
  for (const id of ANIMAL_IDS) {
    for (const frame of ANIMAL_FRAMES) {
      entries.push({
        name: `${id}/${frame}`,
        id,
        cell: animalCell(id, frame),
        rows: animalRows(id, frame),
      });
    }
  }
  for (const id of RING_IDS) {
    for (let spin = 0; spin < RIDER.ringSpinFrames; spin += 1) {
      for (const half of ['back', 'front'] as const) {
        entries.push({
          name: `${id}/${spin}/${half}`,
          id,
          cell: ringCell(id, spin, half),
          rows: ringRows(id, spin, half),
        });
      }
    }
  }
  for (const type of POWERUP_TYPES) {
    for (let frame = 0; frame < RIDER.effectFrames; frame += 1) {
      entries.push({
        name: `${type}/${frame}`,
        id: type,
        cell: effectCell(type, frame),
        rows: effectRows(type, frame),
      });
    }
  }
  return entries;
}
