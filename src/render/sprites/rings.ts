/**
 * The eleven rings (docs/ART-AND-SHOP.md §2), as pixel maps worked out in code.
 *
 * A ring lying on the water, seen from behind and a little above, is an
 * ellipse with a hole in it, and its pattern — stripes, tread, sprinkles,
 * seeds — runs round it. That is far easier described than drawn: a pattern
 * is a function of the angle round the ring and the distance across it, and
 * turning the ring is adding to the angle. So every ring is painted from a
 * short recipe here, in every spin frame, rather than drawn by hand eleven
 * times over in four positions each.
 *
 * Each ring is drawn in two halves that the rider puts on either side of the
 * animal: the back half (the far side of the ring, above `RIDER.ringSplitRow`)
 * behind it, and the front half in front of it, so the animal looks like it
 * sits inside the ring.
 *
 * The output is a plain pixel map in the characters of SPRITE_LEGEND, exactly
 * like the animals', and no Three.js is involved, so it is tested in node.
 */

import { RIDER } from '../../config';
import { CLEAR } from './legend';

/** Every ring, in the order the gallery and the atlas lay them out. */
export const RING_IDS = [
  'tube',
  'tractor',
  'hoop',
  'donut',
  'pizza',
  'pineapple',
  'watermelon',
  'record',
  'onion',
  'wheel',
  'toilet',
] as const;
export type RingId = (typeof RING_IDS)[number];

/** The free starter ring (§2). */
export const STARTER_RING: RingId = 'tube';

/** Which half of a ring: behind the animal or in front of it. */
export type RingHalf = 'back' | 'front';

/**
 * Where one pixel sits on the ring, which is all a pattern needs to know.
 *
 * - `angle`: round the ring in radians, already turned by the spin; 0 is the
 *   right-hand side, and it grows towards the bottom of the sprite.
 * - `across`: 0 on the inner edge of the ring, 1 on the outer edge.
 * - `u`, `v`: where the pixel is in the ellipse, -1..1 each way; `v` is
 *   negative on the far (upper) side.
 */
interface RingPoint {
  angle: number;
  across: number;
  u: number;
  v: number;
  /** Pixel column and row, for patterns that dither on the grid. */
  x: number;
  y: number;
}

interface RingRecipe {
  /** How thick the ring is, as a share of its radius. */
  thickness: number;
  /** How far one spin frame turns the pattern, in radians. */
  spinStep: number;
  /** Whether the edge round the hole gets the dark outline too. */
  innerOutline?: boolean;
  /**
   * How much narrower the far side is than the near side, 0 for an ellipse.
   * The toilet seat is the one ring that is not round.
   */
  taper?: number;
  /** The colour of one pixel on the ring. */
  paint(point: RingPoint): string;
  /** The colour of one pixel in the hole, if the ring puts anything there. */
  hole?(point: RingPoint): string;
}

const TAU = Math.PI * 2;

/** A small, fixed hash of a pixel position, for sprinkles and crumbs. */
function hash(a: number, b: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Which of `count` equal slices round the ring this angle falls in. */
function slice(angle: number, count: number): number {
  const wrapped = ((angle % TAU) + TAU) % TAU;
  return Math.floor((wrapped / TAU) * count) % count;
}

/**
 * Three-step shading for a ring lying flat: lit on the far side's top edge,
 * shaded along the near side's bottom — the same three steps the toon ramp
 * gives the 3D props (§1).
 */
function tone(point: RingPoint, base: string, light: string, shade: string): string {
  if (point.v > 0.55 && point.across > 0.35) return shade;
  if (point.v < -0.2 && point.across > 0.3 && point.across < 0.75) return light;
  return base;
}

const RECIPES: Readonly<Record<RingId, RingRecipe>> = {
  // Blue and white segments, like a pool tube.
  tube: {
    thickness: 0.46,
    spinStep: TAU / 8 / RIDER.ringSpinFrames,
    paint: (p) => (slice(p.angle, 8) % 2 === 0 ? tone(p, 'b', 's', 'U') : tone(p, 'c', 'c', 'A')),
  },
  // A huge black tyre: chunky tread round the outside, a grey rim inside.
  tractor: {
    thickness: 0.56,
    spinStep: TAU / 14 / RIDER.ringSpinFrames,
    paint: (p) => {
      if (p.across > 0.66) return slice(p.angle, 14) % 2 === 0 ? 'o' : tone(p, 'k', 'E', 'o');
      if (p.across < 0.2) return 'E';
      return tone(p, 'k', 'E', 'k');
    },
  },
  // So thin the animal barely holds on.
  hoop: {
    thickness: 0.2,
    spinStep: TAU / 10 / RIDER.ringSpinFrames,
    innerOutline: false,
    paint: (p) => (slice(p.angle, 10) % 2 === 0 ? 'r' : 'c'),
  },
  // Pink icing on the top, sprinkles in it, dough showing underneath.
  donut: {
    thickness: 0.52,
    spinStep: TAU / 12 / RIDER.ringSpinFrames,
    paint: (p) => {
      const icingEdge = 0.25 + 0.14 * Math.sin(p.angle * 7);
      if (p.v < icingEdge && p.across > 0.12 && p.across < 0.9) {
        const sprinkle = hash(slice(p.angle, 24), Math.round(p.across * 5));
        if (sprinkle > 0.86) return 'y';
        if (sprinkle > 0.76) return 's';
        if (sprinkle > 0.68) return 'c';
        return tone(p, 'p', 'c', 'P');
      }
      return tone(p, 'a', 'A', 'm');
    },
  },
  // A whole pizza with a hole in the middle: crust, cheese, pepperoni.
  pizza: {
    thickness: 0.58,
    spinStep: TAU / 6 / RIDER.ringSpinFrames,
    paint: (p) => {
      if (p.across > 0.78) return tone(p, 'm', 'a', 'M');
      // Six slices of pepperoni, one in the middle of every slice.
      const centre = (slice(p.angle, 6) + 0.5) * (TAU / 6);
      const along = ((p.angle % TAU) + TAU) % TAU;
      const dx = Math.abs(along - centre) * 2.2;
      const dy = Math.abs(p.across - 0.42) * 3.2;
      if (dx * dx + dy * dy < 0.55) return 'r';
      // The sauce, peeking out between the cheese.
      if ((p.x + p.y) % 5 === 0) return 'n';
      return tone(p, 'y', 'z', 'n');
    },
  },
  // A pineapple ring: yellow, a brown edge, little pips round it.
  pineapple: {
    thickness: 0.42,
    spinStep: TAU / 12 / RIDER.ringSpinFrames,
    paint: (p) => {
      if (p.across > 0.8) return 'M';
      if (p.across < 0.16) return 'n';
      if (p.across > 0.44 && p.across < 0.62 && slice(p.angle, 12) % 2 === 0) return 'n';
      return tone(p, 'y', 'z', 'n');
    },
  },
  // A round slice of watermelon: rind, a pale band, red flesh, black seeds.
  watermelon: {
    thickness: 0.52,
    spinStep: TAU / 9 / RIDER.ringSpinFrames,
    paint: (p) => {
      if (p.across > 0.82) return 'd';
      if (p.across > 0.68) return 'g';
      if (p.across > 0.58) return 'c';
      const seed = slice(p.angle, 18) % 2 === 0 && p.across > 0.24 && p.across < 0.42;
      if (seed) return 'o';
      return tone(p, 'r', 'p', 'r');
    },
  },
  // A vinyl record: grooves, a red label, and a shine that turns with it.
  record: {
    thickness: 0.62,
    spinStep: TAU / 2 / RIDER.ringSpinFrames,
    paint: (p) => {
      if (p.across < 0.22) {
        return slice(p.angle, 8) === 0 ? 'c' : 'r';
      }
      // The shine: two opposite wedges, which is what makes the spin read.
      if (slice(p.angle, 8) % 4 === 0 && p.across > 0.3) return 'E';
      if (Math.round(p.across * 10) % 3 === 0) return 'o';
      return 'k';
    },
  },
  // Golden and crispy, crumbs all over.
  onion: {
    thickness: 0.44,
    spinStep: TAU / 16 / RIDER.ringSpinFrames,
    paint: (p) => {
      const crumb = hash(slice(p.angle, 32), Math.round(p.across * 4));
      if (crumb > 0.82) return 'M';
      if (crumb > 0.6) return 'n';
      return tone(p, 'y', 'z', 'n');
    },
  },
  // A steering wheel: a rim, and spokes out to a hub behind the animal.
  wheel: {
    thickness: 0.24,
    spinStep: TAU / 3 / RIDER.ringSpinFrames,
    paint: (p) => tone(p, 'k', 'E', 'k'),
    hole: (p) => {
      // Spokes only on the far half: the near half would hide the animal.
      if (p.v > 0) return CLEAR;
      const hub = p.u * p.u + (p.v + 0.15) * (p.v + 0.15) < 0.04;
      if (hub) return 'E';
      for (let i = 0; i < 3; i += 1) {
        const spoke = p.angle - (i * TAU) / 3 - Math.PI / 2;
        // Distance from the spoke's line, in the ellipse's own units.
        const off = Math.abs(Math.sin(spoke) * Math.hypot(p.u, p.v));
        const ahead = Math.cos(spoke) > 0;
        if (ahead && off < 0.09) return 'e';
      }
      return CLEAR;
    },
  },
  // The joke prize: a toilet seat, narrower at the front, hinges at the back.
  toilet: {
    thickness: 0.4,
    spinStep: 0,
    taper: 0.22,
    paint: (p) => {
      // The two hinges, on the near side in the middle.
      if (p.v > 0.6 && Math.abs(p.u) < 0.3 && Math.abs(p.u) > 0.1) return 'E';
      return tone(p, 'c', 'c', 'A');
    },
  },
};

/** How a pixel sits on a ring, or null if the ring does not cover it. */
function locate(
  recipe: RingRecipe,
  x: number,
  y: number,
  spin: number,
): RingPoint & { inRing: boolean } {
  const { ringWidth: width, ringHeight: height } = RIDER;
  const u = (x + 0.5 - width / 2) / (width / 2);
  let v = (y + 0.5 - height / 2) / (height / 2);
  // A taper squeezes the far side in, which turns the ellipse into an egg.
  const squeeze = 1 - (recipe.taper ?? 0) * Math.max(0, -v);
  const uu = u / squeeze;
  v = Math.max(-1.5, Math.min(1.5, v));
  const r = Math.hypot(uu, v);
  const inner = 1 - recipe.thickness;
  const angle = Math.atan2(v, uu) + spin;
  return {
    angle,
    across: (r - inner) / recipe.thickness,
    u: uu,
    v,
    x,
    y,
    inRing: r <= 1 && r >= inner,
  };
}

/**
 * The pixel map for one half of one ring in one spin frame: `RIDER.ringHeight`
 * rows of `RIDER.ringWidth` characters, clear wherever the other half is.
 */
export function ringRows(id: RingId, spinFrame: number, half: RingHalf): string[] {
  const recipe = RECIPES[id];
  const { ringWidth: width, ringHeight: height, ringSplitRow } = RIDER;
  const spin =
    (((spinFrame % RIDER.ringSpinFrames) + RIDER.ringSpinFrames) % RIDER.ringSpinFrames) *
    recipe.spinStep;

  const inRing = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && locate(recipe, x, y, spin).inRing;
  const inHoleOrOutside = (x: number, y: number): boolean => !inRing(x, y);

  const rows: string[] = [];
  for (let y = 0; y < height; y += 1) {
    const wanted = half === 'back' ? y < ringSplitRow : y >= ringSplitRow;
    let row = '';
    for (let x = 0; x < width; x += 1) {
      if (!wanted) {
        row += CLEAR;
        continue;
      }
      const point = locate(recipe, x, y, spin);
      if (!point.inRing) {
        // Outside the outer edge stays clear; inside the hole, a ring may put
        // something there (the wheel's spokes).
        const r = Math.hypot(point.u, point.v);
        row += r < 1 && recipe.hole !== undefined ? recipe.hole(point) : CLEAR;
        continue;
      }
      // The dark rim: any ring pixel with a neighbour off the ring. Whether
      // the edge round the hole counts is up to the ring.
      let edge = false;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inHoleOrOutside(nx, ny)) continue;
        const outer =
          Math.hypot(locate(recipe, nx, ny, spin).u, locate(recipe, nx, ny, spin).v) >= 1;
        const offGrid = nx < 0 || ny < 0 || nx >= width || ny >= height;
        if (outer || offGrid || recipe.innerOutline !== false) {
          edge = true;
          break;
        }
      }
      row += edge ? 'o' : recipe.paint(point);
    }
    rows.push(row);
  }
  return rows;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
