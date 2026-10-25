/**
 * Every pixel texture in the game, painted in code (CLAUDE.md rule 8).
 *
 * Nothing here is downloaded: each texture is drawn onto a small canvas once,
 * at startup, and handed to Three.js with nearest-neighbour filtering and no
 * mipmaps, so it stays as crisp as the pixel grid it was drawn on
 * (docs/ART-AND-SHOP.md §1).
 *
 * Sprites are defined the way the spec asks for: small pixel maps plus palette
 * indexes, with the shapes that are easier described than drawn — a coin
 * spinning through eight frames, a dithered sky — worked out in code instead.
 */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { LANES, PALETTE, RETRO, TRACK } from '../config';
import type { PowerUpType } from '../game/powerups';
import { ATLAS_SIZE, atlasEntries, COIN_ICON, SPRITE_LEGEND } from './sprites';

/** A palette colour as CSS, for the 2D canvas. */
export function colorToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** A canvas of exactly this many pixels, with smoothing off. */
function pixelCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('pixelCanvas: no 2D canvas support');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * The little coin that goes beside a price, as a data URL for the CSS
 * (docs/ART-AND-SHOP.md section 3).
 *
 * Painted from the pixel map in src/render/sprites/icons.ts, so the shop has
 * no image file to fetch and the coin is drawn in code like everything else
 * (CLAUDE.md rule 8). Called once, when the shop is built.
 */
export function coinIconDataUrl(): string {
  const width = COIN_ICON[0]?.length ?? 0;
  const ctx = pixelCanvas(width, COIN_ICON.length);
  drawPixelMap(ctx, COIN_ICON, SPRITE_LEGEND);
  return ctx.canvas.toDataURL('image/png');
}

/** Turns a finished canvas into a texture that is never smoothed or mipmapped. */
function toTexture(ctx: CanvasRenderingContext2D): CanvasTexture {
  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

/** One pixel. */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, css: string): void {
  ctx.fillStyle = css;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Draws a pixel map: one string per row, one character per pixel, looked up in
 * `legend`. A space, or a character the legend does not know, is left clear.
 *
 * @param ox where to put the map's left edge, in pixels
 * @param oy where to put the map's top edge, in pixels
 */
export function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  legend: Readonly<Record<string, number>>,
  ox = 0,
  oy = 0,
): void {
  const width = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`drawPixelMap: rows must be the same length (${row.length} vs ${width})`);
    }
  }
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y] as string;
    for (let x = 0; x < row.length; x += 1) {
      const colour = legend[row[x] as string];
      if (colour === undefined) continue;
      px(ctx, ox + x, oy + y, colorToCss(colour));
    }
  }
}

/**
 * Fills the pixels a shape covers and rims the ones on its edge, which is how
 * a pixel sprite gets the chunky dark outline the look is built on.
 *
 * `inside` is asked about every pixel in the box; a pixel inside the shape
 * with a neighbour outside it becomes outline.
 */
function fillMask(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  inside: (x: number, y: number) => boolean,
  body: number,
  outline: number = PALETTE.outline,
): void {
  const { x: ox, y: oy, width, height } = box;
  const mask: boolean[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) mask[y * width + x] = inside(x, y);
  }
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === true;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      px(ctx, ox + x, oy + y, colorToCss(edge ? outline : body));
    }
  }
}

/**
 * The 4x4 ordered dither matrix. A two-colour gradient made with this reads as
 * pixel art; a smooth blend would read as a photograph of one (§1).
 */
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

function bayer(x: number, y: number): number {
  const row = BAYER_4[y % 4] as readonly number[];
  return ((row[x % 4] as number) + 0.5) / 16;
}

/**
 * The sunset sky: two colours dithered into each other, a big pixel sun and a
 * glow ring around it. Used as the scene's background, so it costs one
 * full-screen draw of a 64x112 texture.
 */
export function createSkyTexture(): CanvasTexture {
  const { width, height, ditherCentre, ditherHeight, sunRadius, sunX, sunY, sunGlowGrow } =
    RETRO.sky;
  const ctx = pixelCanvas(width, height);

  const top = colorToCss(PALETTE.skyTop);
  const bottom = colorToCss(PALETTE.skyBottom);
  const bandTop = (ditherCentre - ditherHeight / 2) * height;
  const bandBottom = (ditherCentre + ditherHeight / 2) * height;

  for (let y = 0; y < height; y += 1) {
    // How much of the lower colour this row wants, 0..1.
    const mix =
      bandBottom === bandTop ? 1 : Math.min(1, Math.max(0, (y - bandTop) / (bandBottom - bandTop)));
    for (let x = 0; x < width; x += 1) {
      px(ctx, x, y, mix > bayer(x, y) ? bottom : top);
    }
  }

  // The sun: a filled pixel circle with a ring of glow around it. Drawn after
  // the sky so it sits on top, and without an outline — it is light, not an
  // object.
  const cx = sunX * width;
  const cy = sunY * height;
  const glow = sunRadius + sunGlowGrow;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= sunRadius) {
        px(ctx, x, y, colorToCss(PALETTE.sun));
      } else if (distance <= glow && bayer(x, y) < 1 - (distance - sunRadius) / sunGlowGrow) {
        px(ctx, x, y, colorToCss(PALETTE.sunGlow));
      }
    }
  }

  return toTexture(ctx);
}

/**
 * One layer of hills: a row of humps in silhouette, clear above them, so it
 * can hang in front of the sky. The two layers differ in colour, height and
 * how many humps they have, which is what makes the parallax between them
 * read as distance.
 *
 * @param layer 0 for the far layer, 1 for the near one
 */
export function createHillTexture(layer: number): CanvasTexture {
  const width = RETRO.hills.pixels;
  const height = Math.round(width / 4);
  const ctx = pixelCanvas(width, height);
  const humps = RETRO.hills.humps[layer] ?? 5;
  const body = layer === 0 ? PALETTE.mountain : PALETTE.mountainDark;

  // A ridge line made of overlapping humps, highest in the middle of each.
  const ridge = (x: number): number => {
    const t = (x / width) * humps * Math.PI;
    // Two waves of different lengths, so the humps are not all the same size.
    const h = 0.62 + 0.3 * Math.sin(t) + 0.12 * Math.sin(t * 2.3 + 1.1);
    return Math.round(h * height);
  };

  fillMask(
    ctx,
    { x: 0, y: 0, width, height },
    (x, y) => y >= height - ridge(x),
    body,
    // The far layer gets no dark rim: at that distance an outline reads as a
    // line drawn on the sky rather than as the edge of a hill.
    layer === 0 ? body : PALETTE.outline,
  );

  const texture = toTexture(ctx);
  // Repeated sideways, so sliding it for the parallax never runs out of hills.
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

/**
 * The slide surface: pixel water, light stripes that scroll past, and a
 * sand-coloured rim with a dark outline down each side (§1).
 *
 * The stripes are the only thing that changes along the slide, so scrolling
 * the texture moves them while the rims stay exactly where they are.
 */
export function createSlideTexture(): CanvasTexture {
  const perUnit = RETRO.texturePixelsPerUnit;
  const pattern = RETRO.water.patternLength;
  const width = Math.round(TRACK.width * perUnit);
  const height = Math.round(pattern * perUnit);
  const ctx = pixelCanvas(width, height);

  ctx.fillStyle = colorToCss(PALETTE.water);
  ctx.fillRect(0, 0, width, height);

  // A little deeper water and a little sparkle, dithered in, so the surface is
  // not a flat slab of cyan. Both are kept sparse on purpose: at this pixel
  // size a dense pattern reads as noise rushing past rather than as water.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = bayer(x, y);
      if (value > 0.9) px(ctx, x, y, colorToCss(PALETTE.waterDeep));
      else if (value < 0.08) px(ctx, x, y, colorToCss(PALETTE.waterLight));
    }
  }

  // The light stripes that make the speed readable.
  const stripeHeight = Math.max(1, Math.round(RETRO.water.stripeThickness * height));
  for (let i = 0; i < RETRO.water.stripes; i += 1) {
    const top = Math.round((i / RETRO.water.stripes) * height);
    ctx.fillStyle = colorToCss(PALETTE.waterLight);
    ctx.fillRect(0, top, width, stripeHeight);
    // A dithered pixel edge under each stripe, so it is not a clean bar.
    for (let x = 0; x < width; x += 1) {
      if (bayer(x, top) > 0.5) px(ctx, x, top + stripeHeight, colorToCss(PALETTE.waterLight));
    }
  }

  // Lane dividers: faint, just enough to read the three lanes.
  const markerPx = Math.max(1, Math.round(TRACK.markerWidth * perUnit));
  for (const boundary of [-0.5, 0.5]) {
    const x = Math.round(width / 2 + boundary * LANES.width * perUnit - markerPx / 2);
    ctx.fillStyle = colorToCss(PALETTE.waterLight);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, 0, markerPx, height);
    ctx.globalAlpha = 1;
  }

  // The rims: sand, with the dark outline on their outer edge.
  const rimPx = Math.max(2, Math.round(RETRO.water.rimWidth * perUnit));
  const outlinePx = Math.max(1, Math.round(RETRO.water.rimOutline * perUnit));
  for (const side of [0, 1]) {
    const rimX = side === 0 ? 0 : width - rimPx;
    ctx.fillStyle = colorToCss(PALETTE.slideEdge);
    ctx.fillRect(rimX, 0, rimPx, height);
    // A darker sand step on the inner side, which gives the rim some depth.
    ctx.fillStyle = colorToCss(PALETTE.sand);
    ctx.fillRect(side === 0 ? rimPx - 1 : width - rimPx, 0, 1, height);
    ctx.fillStyle = colorToCss(PALETTE.outline);
    ctx.fillRect(side === 0 ? 0 : width - outlinePx, 0, outlinePx, height);
  }

  const texture = toTexture(ctx);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // A whole number of patterns per segment, so segment joins never show.
  texture.repeat.set(1, TRACK.segmentLength / pattern);
  return texture;
}

/**
 * The grass under the slide and the scenery (§1): light green with a few broad
 * tufts of darker green, so it reads as ground rather than a flat green wall.
 *
 * Every mark is many texels wide on purpose. Single-pixel detail on a surface
 * rushing at the camera flickers from frame to frame, which is exactly what
 * the slide water's fine dither was found to do; broad, calm shapes do not.
 */
export function createGroundTexture(): CanvasTexture {
  const size = Math.round(RETRO.ground.patternLength * RETRO.texturePixelsPerUnit);
  const ctx = pixelCanvas(size, size);
  ctx.fillStyle = colorToCss(PALETTE.forestLight);
  ctx.fillRect(0, 0, size, size);
  // Two tufts per pattern, staggered, each a whole unit across.
  const tuft = RETRO.texturePixelsPerUnit;
  ctx.fillStyle = colorToCss(PALETTE.forest);
  for (const [x, y] of [
    [0.15, 0.2],
    [0.6, 0.65],
  ] as const) {
    ctx.fillRect(Math.round(x * size), Math.round(y * size), tuft, Math.round(tuft * 0.75));
  }
  const texture = toTexture(ctx);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/**
 * The spinning coin, as one strip of frames (§1).
 *
 * Every coin on the track shows the same frame at the same moment — they
 * already span in step — so one strip and one shared offset animate the whole
 * trail without a per-coin attribute.
 */
export function createCoinStripTexture(): CanvasTexture {
  const size = RETRO.coin.framePixels;
  const frames = RETRO.coin.frames;
  const ctx = pixelCanvas(size * frames, size);
  const radius = size / 2 - 1;
  const centre = size / 2;

  for (let frame = 0; frame < frames; frame += 1) {
    // Half a turn across the strip: the second half is the first mirrored, and
    // a coin looks the same from either side.
    const angle = (frame / frames) * Math.PI;
    const halfWidth = Math.max(0.7, Math.abs(Math.cos(angle)) * radius);
    const box = { x: frame * size, y: 0, width: size, height: size };

    const inside = (x: number, y: number): boolean => {
      const dx = (x + 0.5 - centre) / halfWidth;
      const dy = (y + 0.5 - centre) / radius;
      return dx * dx + dy * dy <= 1;
    };
    fillMask(ctx, box, inside, PALETTE.yellow);

    // A highlight up the left of the face, so the spin reads as a solid disc.
    // Skipped on the edge-on frames, where there is no face to catch light.
    if (halfWidth > radius * 0.45) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (!inside(x, y)) continue;
          const dx = (x + 0.5 - centre) / halfWidth;
          const dy = (y + 0.5 - centre) / radius;
          if (dx * dx + dy * dy > 0.42) continue;
          if (dx < -0.1 || dy < -0.1) px(ctx, box.x + x, y, colorToCss(PALETTE.sun));
        }
      }
    }
  }

  const texture = toTexture(ctx);
  texture.wrapS = RepeatWrapping;
  // One frame of the strip at a time; the offset picks which.
  texture.repeat.set(1 / frames, 1);
  return texture;
}

/** The three power-up icons, as pixel maps. `.` is clear, `o` is the outline. */
export const PICKUP_ICONS: Readonly<Record<PowerUpType, readonly string[]>> = {
  // A shield: broad shoulders, tapering to a point.
  shield: [
    '................',
    '.....oooooo.....',
    '....oobbbboo....',
    '...obbbccbbbo...',
    '...obbbccbbbo...',
    '...obbbccbbbo...',
    '...obbbccbbbo...',
    '...obbbccbbbo...',
    '...obbbccbbbo...',
    '....obbccbbo....',
    '....obbccbbo....',
    '.....obbbbo.....',
    '......obbo......',
    '.......oo.......',
    '................',
    '................',
  ],
  // A horseshoe magnet, tips down, poles picked out in red.
  magnet: [
    '................',
    '.....oooooo.....',
    '...oommmmmmoo...',
    '..ommmoooommmo..',
    '..ommoo....oomo.',
    '.ommo........omo',
    '.omo..........om',
    '.omo..........om',
    '.omo..........om',
    '.omo..........om',
    '.orro........orr',
    '.orro........orr',
    '.orro........orr',
    '.oooo........ooo',
    '................',
    '................',
  ],
  // A chevron pointing up the slide: speed.
  boost: [
    '................',
    '.......oo.......',
    '......obbo......',
    '.....obbbbo.....',
    '....obbccbbo....',
    '...obbccccbbo...',
    '..obbccccccbbo..',
    '.obbccccccccbbo.',
    '.oobbccccccbboo.',
    '...oobbccbboo...',
    '.....obbccbo....',
    '.....obbccbo....',
    '.....obbccbo....',
    '......oooooo....',
    '................',
    '................',
  ],
};

/** The pixel icon for one power-up, on a clear background (§1). */
export function createPickupIconTexture(type: PowerUpType): CanvasTexture {
  const size = RETRO.pickup.iconPixels;
  const ctx = pixelCanvas(size, size);
  const body =
    type === 'shield' ? PALETTE.shield : type === 'magnet' ? PALETTE.magnet : PALETTE.boost;
  drawPixelMap(ctx, PICKUP_ICONS[type], {
    o: PALETTE.outline,
    b: body,
    c: PALETTE.cream,
    m: PALETTE.magnet,
    r: PALETTE.red,
  });
  return toTexture(ctx);
}

/**
 * Paints every rider frame — six animals, eleven rings in every spin frame,
 * three power-up effects — into one canvas, laid out as sprites/atlas.ts says
 * (docs/ART-AND-SHOP.md §2). Done once, at startup.
 *
 * The sprites' dark rims are part of their pixel maps, like the coin's and
 * the pickup icons': a hull round a flat quad would only ever show on one side.
 */
export function paintRiderAtlas(): CanvasRenderingContext2D {
  const ctx = pixelCanvas(ATLAS_SIZE.width, ATLAS_SIZE.height);
  for (const entry of atlasEntries()) {
    drawPixelMap(ctx, entry.rows, SPRITE_LEGEND, entry.cell.x, entry.cell.y);
  }
  return ctx;
}

/** The rider atlas as a texture: nearest filtering, no mipmaps, like every other. */
export function createRiderAtlasTexture(): CanvasTexture {
  return toTexture(paintRiderAtlas());
}
