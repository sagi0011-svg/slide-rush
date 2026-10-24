/**
 * The rider gallery, `?debug=1&gallery=1` (docs/ART-AND-SHOP.md §2).
 *
 * Every animal in every ring, side by side, so each pair can be checked at
 * phone size before anyone has to buy it. It draws straight from the same
 * atlas, the same cells and the same pose offsets the game uses, so what
 * shows here is what the game would draw — including the bottom of the ring
 * disappearing under the water.
 *
 * The game itself is not started on this page: the gallery is all there is.
 */

import { PALETTE, RIDER } from '../config';
import type { PowerUpType } from '../game/powerups';
import { POWERUP_TYPES } from '../game/powerups';
import {
  effectFrame,
  poseLayout,
  ringSpinFrame,
  RIDER_LAYOUT,
  RIDER_POSES,
  type RiderPose,
} from '../render/rider-pose';
import {
  ANIMAL_IDS,
  animalCell,
  EFFECT_IN_FRONT,
  effectCell,
  RING_IDS,
  ringCell,
  type AnimalId,
  type Cell,
  type RingId,
} from '../render/sprites';
import { colorToCss, paintRiderAtlas } from '../render/textures';
import { STRINGS } from '../ui/strings';

export function isGalleryEnabled(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search);
  return params.get('debug') === '1' && params.get('gallery') === '1';
}

/**
 * One picture's size, in sprite pixels: room for the widest effect, and for
 * the animal popping up out of its ring in a crash.
 */
const VIEW = {
  width: Math.max(RIDER.effectWidth, RIDER_LAYOUT.width),
  height: Math.max(RIDER.effectHeight, RIDER_LAYOUT.height + RIDER.crashLiftPixels) + 4,
};
/** Where the rider's top-left corner sits in a picture. */
const ORIGIN = {
  x: Math.floor((VIEW.width - RIDER_LAYOUT.width) / 2),
  y: VIEW.height - RIDER_LAYOUT.height,
};

interface Tile {
  animal: AnimalId;
  ring: RingId;
  ctx: CanvasRenderingContext2D;
}

export function createGallery(parent: HTMLElement): void {
  const atlas = paintRiderAtlas().canvas;

  const root = document.createElement('div');
  root.id = 'gallery';
  parent.appendChild(root);

  const title = document.createElement('h1');
  title.textContent = STRINGS.gallery.title;
  root.appendChild(title);

  // --- Controls --------------------------------------------------------------
  let pose: RiderPose = 'idle';
  let effect: PowerUpType | null = null;
  let zoom: number = RIDER.galleryZoom;
  let animate = true;

  const bar = document.createElement('div');
  bar.className = 'gallery-bar';
  root.appendChild(bar);

  /** A row of buttons where exactly one is on. */
  const choice = <T>(
    label: string,
    options: readonly T[],
    name: (option: T) => string,
    initial: T,
    pick: (option: T) => void,
  ): void => {
    const group = document.createElement('div');
    group.className = 'gallery-group';
    const heading = document.createElement('span');
    heading.textContent = label;
    group.appendChild(heading);
    const buttons: HTMLButtonElement[] = [];
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name(option);
      button.classList.toggle('on', option === initial);
      button.addEventListener('click', () => {
        for (const other of buttons) other.classList.toggle('on', other === button);
        pick(option);
        redraw(true);
      });
      buttons.push(button);
      group.appendChild(button);
    }
    bar.appendChild(group);
  };

  choice(
    STRINGS.gallery.pose,
    RIDER_POSES,
    (p) => STRINGS.gallery.poses[p],
    pose,
    (p) => {
      pose = p;
    },
  );
  choice<PowerUpType | null>(
    STRINGS.gallery.effect,
    [null, ...POWERUP_TYPES],
    (e) => (e === null ? STRINGS.gallery.none : STRINGS.powerUps[e]),
    effect,
    (e) => {
      effect = e;
    },
  );
  choice(
    STRINGS.gallery.zoom,
    RIDER.galleryZooms,
    (z) => `${z}×`,
    zoom,
    (z) => {
      zoom = z;
      sizeTiles();
    },
  );
  choice(
    STRINGS.gallery.animate,
    [true, false],
    (on) => (on ? 'on' : 'off'),
    animate,
    (on) => {
      animate = on;
    },
  );

  // --- The grid: one block per animal, one picture per ring --------------------
  const tiles: Tile[] = [];
  for (const animal of ANIMAL_IDS) {
    const heading = document.createElement('h2');
    heading.textContent = STRINGS.animals[animal];
    root.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    root.appendChild(grid);

    for (const ring of RING_IDS) {
      const figure = document.createElement('figure');
      const canvas = document.createElement('canvas');
      canvas.width = VIEW.width;
      canvas.height = VIEW.height;
      const ctx = canvas.getContext('2d');
      if (ctx === null) continue;
      ctx.imageSmoothingEnabled = false;
      const caption = document.createElement('figcaption');
      caption.textContent = STRINGS.rings[ring];
      figure.append(canvas, caption);
      grid.appendChild(figure);
      tiles.push({ animal, ring, ctx });
    }
  }

  function sizeTiles(): void {
    for (const tile of tiles) {
      tile.ctx.canvas.style.width = `${VIEW.width * zoom}px`;
      tile.ctx.canvas.style.height = `${VIEW.height * zoom}px`;
    }
  }

  /** Copies one atlas cell onto a picture, mirrored if asked. */
  const blit = (
    ctx: CanvasRenderingContext2D,
    cell: Cell,
    x: number,
    y: number,
    mirror = false,
  ) => {
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

  const sky = colorToCss(PALETTE.skyBottom);
  const water = colorToCss(PALETTE.water);
  // Where the slide's surface is in a picture: just above the ring's bottom.
  const waterline = ORIGIN.y + RIDER_LAYOUT.height - RIDER.ringSinkPixels;

  function drawTile(tile: Tile, clock: number): void {
    const { ctx } = tile;
    const layout = poseLayout(pose, clock);
    const spin = ringSpinFrame(clock);
    const loop = effectFrame(clock);
    const riderY = ORIGIN.y + layout.riderDy;

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // The same layers, in the same order, as the rider in the game.
    const effectX = Math.floor((VIEW.width - RIDER.effectWidth) / 2);
    const effectY = ORIGIN.y + Math.floor(RIDER_LAYOUT.height / 2 - RIDER.effectHeight / 2);
    if (effect !== null && !EFFECT_IN_FRONT[effect]) {
      blit(ctx, effectCell(effect, loop), effectX, effectY);
    }
    blit(
      ctx,
      ringCell(tile.ring, spin, 'back'),
      ORIGIN.x + RIDER_LAYOUT.ringX,
      riderY + RIDER_LAYOUT.ringY,
    );
    blit(
      ctx,
      animalCell(tile.animal, layout.frame),
      ORIGIN.x + RIDER_LAYOUT.animalX,
      riderY + RIDER_LAYOUT.animalY + layout.animalDy,
      layout.mirror,
    );
    blit(
      ctx,
      ringCell(tile.ring, spin, 'front'),
      ORIGIN.x + RIDER_LAYOUT.ringX,
      riderY + RIDER_LAYOUT.ringY,
    );
    if (effect !== null && EFFECT_IN_FRONT[effect]) {
      blit(ctx, effectCell(effect, loop), effectX, effectY);
    }

    // The water hides whatever is under its surface, as the slide does. A
    // jump would lift the rider clear of it, so a jump is drawn in the air.
    if (pose !== 'jump') {
      ctx.fillStyle = water;
      ctx.fillRect(0, waterline, VIEW.width, VIEW.height - waterline);
    }
  }

  // Redrawn only when a frame actually changes, not sixty times a second.
  let clock = 0;
  let last = performance.now();
  let drawnKey = '';
  function redraw(force = false): void {
    const key = `${poseLayout(pose, clock).animalDy}/${ringSpinFrame(clock)}/${effectFrame(clock)}`;
    if (!force && key === drawnKey) return;
    drawnKey = key;
    for (const tile of tiles) drawTile(tile, clock);
  }

  const tick = (now: number): void => {
    if (animate) clock += Math.min(0.1, (now - last) / 1000);
    last = now;
    redraw();
    window.requestAnimationFrame(tick);
  };

  sizeTiles();
  redraw(true);
  window.requestAnimationFrame(tick);
}
