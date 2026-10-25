/**
 * The rider gallery, `?debug=1&gallery=1` (docs/ART-AND-SHOP.md §2).
 *
 * Every animal in every ring, side by side, so each pair can be checked at
 * phone size before anyone has to buy it. It draws through the one rider
 * painter in src/render/rider-preview.ts, which the shop uses too, so what
 * shows here is what the game would draw — including the bottom of the ring
 * disappearing under the water.
 *
 * The game itself is not started on this page: the gallery is all there is.
 */

import { RIDER } from '../config';
import type { PowerUpType } from '../game/powerups';
import { POWERUP_TYPES } from '../game/powerups';
import { RIDER_POSES, type RiderPose } from '../render/rider-pose';
import { createRiderPainter, PREVIEW_SIZE } from '../render/rider-preview';
import { ANIMAL_IDS, RING_IDS, type AnimalId, type RingId } from '../render/sprites';
import { STRINGS } from '../ui/strings';

export function isGalleryEnabled(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search);
  return params.get('debug') === '1' && params.get('gallery') === '1';
}

interface Tile {
  animal: AnimalId;
  ring: RingId;
  ctx: CanvasRenderingContext2D;
}

export function createGallery(parent: HTMLElement): void {
  // The same painter the shop draws its cards with (§2).
  const painter = createRiderPainter();

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
      const ctx = painter.prepare(canvas, zoom);
      if (ctx === null) continue;
      const caption = document.createElement('figcaption');
      caption.textContent = STRINGS.rings[ring];
      figure.append(canvas, caption);
      grid.appendChild(figure);
      tiles.push({ animal, ring, ctx });
    }
  }

  function sizeTiles(): void {
    for (const tile of tiles) {
      tile.ctx.canvas.style.width = `${PREVIEW_SIZE.width * zoom}px`;
      tile.ctx.canvas.style.height = `${PREVIEW_SIZE.height * zoom}px`;
    }
  }

  // Redrawn only when a frame actually changes, not sixty times a second.
  let clock = 0;
  let last = performance.now();
  let drawnKey = '';
  function redraw(force = false): void {
    // A jump would lift the rider clear of the water, so it is drawn in the air.
    const options = { pose, effect, clock, background: 'sky', water: pose !== 'jump' } as const;
    const key = painter.frameKey(options);
    if (!force && key === drawnKey) return;
    drawnKey = key;
    for (const tile of tiles) {
      painter.draw(tile.ctx, { animal: tile.animal, ring: tile.ring }, options);
    }
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
