/**
 * One picture of a rider, drawn onto a 2D canvas (docs/ART-AND-SHOP.md §2).
 *
 * The shop and the debug gallery both have to show a rider outside the game —
 * on a card, in a big preview, on the title screen — and they must show
 * exactly what the game would draw. So there is one painter, here, and both
 * use it: it reads the same atlas, the same cells and the same pose offsets as
 * src/render/rider.ts, a layer at a time, in the same order.
 *
 * It can also draw half a rider: an animal on its own, or a ring on its own,
 * which is what a shop card needs. Nothing here decides anything about the
 * game; it is a picture (CLAUDE.md rule 13).
 *
 * The atlas is painted onto a canvas the first time a painter is made, so
 * nothing touches `document` until something actually asks for a picture.
 */

import { RIDER } from '../config';
import { palette } from './theme';
import type { PowerUpType } from '../game/powerups';
import { effectFrame, poseLayout, RIDER_LAYOUT, ringSpinFrame, type RiderPose } from './rider-pose';
import {
  animalCell,
  EFFECT_IN_FRONT,
  effectCell,
  ringCell,
  type AnimalId,
  type Cell,
  type RingId,
} from './sprites';
import { colorToCss, paintRiderAtlas } from './textures';

/** One rider, as a picture: whatever pair was asked for. */
export interface PreviewPair {
  animal: AnimalId;
  ring: RingId;
}

/** Which layers to draw: the whole rider, or one half of it on its own. */
export type PreviewLayers = 'rider' | 'animal' | 'ring';

export interface PreviewOptions {
  /** What the rider is doing. Defaults to idling. */
  pose?: RiderPose;
  /** A power-up effect around it, or none. */
  effect?: PowerUpType | null;
  /** The clock, in seconds, that the bob and the ring's spin follow. */
  clock?: number;
  /** `sky` paints the sunset behind the rider; `none` leaves it clear. */
  background?: 'sky' | 'none';
  /** True to cover the bottom in slide water, the way the game does. */
  water?: boolean;
  layers?: PreviewLayers;
}

/**
 * One picture's size, in sprite pixels: room for the widest effect, and for
 * the animal popping up out of its ring in a crash.
 */
export const PREVIEW_SIZE = {
  width: Math.max(RIDER.effectWidth, RIDER_LAYOUT.width),
  height: Math.max(RIDER.effectHeight, RIDER_LAYOUT.height + RIDER.crashLiftPixels) + 4,
} as const;

/** Where the rider's top-left corner sits in a picture. */
const ORIGIN = {
  x: Math.floor((PREVIEW_SIZE.width - RIDER_LAYOUT.width) / 2),
  y: PREVIEW_SIZE.height - RIDER_LAYOUT.height,
} as const;

/** Where the slide's surface is: just above the bottom of the ring. */
const WATERLINE = ORIGIN.y + RIDER_LAYOUT.height - RIDER.ringSinkPixels;

export interface RiderPainter {
  /** The size of one picture, in sprite pixels. */
  readonly width: number;
  readonly height: number;
  /**
   * Which frames this moment lands on. Two moments with the same key look
   * exactly the same, so a caller can skip redrawing between them.
   */
  frameKey(options?: PreviewOptions): string;
  /** Sizes a canvas to hold one picture at `zoom` screen pixels per sprite pixel. */
  prepare(canvas: HTMLCanvasElement, zoom: number): CanvasRenderingContext2D | null;
  /** Draws one picture into a context prepared above. */
  draw(ctx: CanvasRenderingContext2D, pair: PreviewPair, options?: PreviewOptions): void;
}

export function createRiderPainter(): RiderPainter {
  const atlas = paintRiderAtlas().canvas;
  const sky = colorToCss(palette().skyBottom);
  const water = colorToCss(palette().water);

  /** Copies one atlas cell onto a picture, mirrored if asked. */
  const blit = (
    ctx: CanvasRenderingContext2D,
    cell: Cell,
    x: number,
    y: number,
    mirror = false,
  ): void => {
    if (!mirror) {
      ctx.drawImage(atlas, cell.x, cell.y, cell.width, cell.height, x, y, cell.width, cell.height);
      return;
    }
    ctx.save();
    ctx.translate(x + cell.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height);
    ctx.restore();
  };

  return {
    width: PREVIEW_SIZE.width,
    height: PREVIEW_SIZE.height,

    frameKey(options = {}) {
      const clock = options.clock ?? 0;
      const layout = poseLayout(options.pose ?? 'idle', clock);
      return [
        layout.frame,
        layout.animalDy,
        layout.riderDy,
        ringSpinFrame(clock),
        effectFrame(clock),
      ].join('/');
    },

    prepare(canvas, zoom) {
      canvas.width = PREVIEW_SIZE.width;
      canvas.height = PREVIEW_SIZE.height;
      canvas.style.width = `${PREVIEW_SIZE.width * zoom}px`;
      canvas.style.height = `${PREVIEW_SIZE.height * zoom}px`;
      const ctx = canvas.getContext('2d');
      if (ctx === null) return null;
      ctx.imageSmoothingEnabled = false;
      return ctx;
    },

    draw(ctx, pair, options = {}) {
      const pose = options.pose ?? 'idle';
      const clock = options.clock ?? 0;
      const effect = options.effect ?? null;
      const layers = options.layers ?? 'rider';
      const layout = poseLayout(pose, clock);
      const spin = ringSpinFrame(clock);
      const loop = effectFrame(clock);
      const riderY = ORIGIN.y + layout.riderDy;

      ctx.clearRect(0, 0, PREVIEW_SIZE.width, PREVIEW_SIZE.height);
      if ((options.background ?? 'none') === 'sky') {
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, PREVIEW_SIZE.width, PREVIEW_SIZE.height);
      }

      // The same layers, in the same order, as the rider in the game.
      const effectX = Math.floor((PREVIEW_SIZE.width - RIDER.effectWidth) / 2);
      const effectY = ORIGIN.y + Math.floor(RIDER_LAYOUT.height / 2 - RIDER.effectHeight / 2);
      if (effect !== null && !EFFECT_IN_FRONT[effect]) {
        blit(ctx, effectCell(effect, loop), effectX, effectY);
      }
      if (layers !== 'animal') {
        blit(
          ctx,
          ringCell(pair.ring, spin, 'back'),
          ORIGIN.x + RIDER_LAYOUT.ringX,
          riderY + RIDER_LAYOUT.ringY,
        );
      }
      if (layers !== 'ring') {
        blit(
          ctx,
          animalCell(pair.animal, layout.frame),
          ORIGIN.x + RIDER_LAYOUT.animalX,
          riderY + RIDER_LAYOUT.animalY + layout.animalDy,
          layout.mirror,
        );
      }
      if (layers !== 'animal') {
        blit(
          ctx,
          ringCell(pair.ring, spin, 'front'),
          ORIGIN.x + RIDER_LAYOUT.ringX,
          riderY + RIDER_LAYOUT.ringY,
        );
      }
      if (effect !== null && EFFECT_IN_FRONT[effect]) {
        blit(ctx, effectCell(effect, loop), effectX, effectY);
      }

      // The water hides whatever is under its surface, as the slide does.
      if (options.water === true) {
        ctx.fillStyle = water;
        ctx.fillRect(0, WATERLINE, PREVIEW_SIZE.width, PREVIEW_SIZE.height - WATERLINE);
      }
    },
  };
}
