/**
 * The little pictures on the Settings screen's style cards
 * (docs/VISUAL-STYLES.md §3): a slide running into the hills under the sky,
 * with a coin on it, painted in one look's colours.
 *
 * Painted in code like everything else (CLAUDE.md rule 8), straight from the
 * look's own theme, so a card always shows what choosing it would give —
 * whichever look is on at the time.
 */

import type { Theme } from '../config';
import { colorToCss } from './textures';

/** The picture's size, in pixels. The card blows it up. */
export const STYLE_PREVIEW_SIZE = { width: 48, height: 36 } as const;

/** The 4×4 ordered dither, as fractions, for the pixel looks' sky. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * Paints one look's preview into a canvas, sizing it first.
 *
 * A smooth look is painted at four times the size with soft shapes; the pixel
 * looks are painted at their own size and shown with hard pixels (the card's
 * CSS says which).
 */
export function paintStylePreview(canvas: HTMLCanvasElement, look: Theme): void {
  const smooth = !look.pixelated;
  const zoom = smooth ? 4 : 1;
  const { width, height } = STYLE_PREVIEW_SIZE;
  canvas.width = width * zoom;
  canvas.height = height * zoom;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.imageSmoothingEnabled = smooth;
  ctx.save();
  ctx.scale(zoom, zoom);

  const colors = look.palette;
  const css = colorToCss;
  const horizon = 20;

  // The sky: a fade, or two colours dithered together.
  if (look.skyDither) {
    for (let y = 0; y < horizon; y += 1) {
      const mix = y / horizon;
      for (let x = 0; x < width; x += 1) {
        const threshold = BAYER[(y % 4) * 4 + (x % 4)] as number;
        ctx.fillStyle = css(mix > threshold ? colors.skyBottom : colors.skyTop);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else {
    const fade = ctx.createLinearGradient(0, 0, 0, horizon);
    fade.addColorStop(0, css(colors.skyTop));
    fade.addColorStop(1, css(colors.skyBottom));
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, horizon);
  }

  // The sun.
  ctx.fillStyle = css(colors.sun);
  disc(ctx, 34, 7, 4, smooth);

  // Two rows of hills, far then near.
  hills(ctx, colors.mountain, horizon, [6, 9, 5, 8], width, smooth);
  hills(ctx, colors.mountainDark, horizon, [3, 5, 2, 6, 4], width, smooth);

  // The ground, and the slide narrowing towards the horizon.
  ctx.fillStyle = css(colors.forestLight);
  ctx.fillRect(0, horizon, width, height - horizon);
  const centre = width / 2;
  const slide = (inset: number, color: number): void => {
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.moveTo(centre - 2 + inset * 0.15, horizon);
    ctx.lineTo(centre + 2 - inset * 0.15, horizon);
    ctx.lineTo(centre + 18 - inset, height);
    ctx.lineTo(centre - 18 + inset, height);
    ctx.closePath();
    ctx.fill();
  };
  if (look.outlines) slide(-1, colors.outline);
  slide(0, colors.slideEdge);
  slide(3, colors.water);
  // The light stripes that show the speed.
  ctx.fillStyle = css(colors.waterLight);
  for (const y of [24, 29, 34]) {
    const half = 2 + ((y - horizon) / (height - horizon)) * 13;
    ctx.fillRect(Math.round(centre - half), y, Math.round(half * 2), 1);
  }

  // A coin, to show how they are drawn.
  if (look.outlines) {
    ctx.fillStyle = css(colors.outline);
    disc(ctx, centre + 5, 27, 3, smooth);
  }
  ctx.fillStyle = css(colors.coin);
  disc(ctx, centre + 5, 27, look.outlines ? 2 : 2.5, smooth);

  ctx.restore();
}

/** A filled circle: a true one for a smooth look, whole pixels for a pixel one. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, smooth: boolean) {
  if (smooth) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
    for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A row of humps standing on the horizon, `peaks` pixels tall in turn. */
function hills(
  ctx: CanvasRenderingContext2D,
  color: number,
  horizon: number,
  peaks: readonly number[],
  width: number,
  smooth: boolean,
): void {
  ctx.fillStyle = colorToCss(color);
  const step = width / (peaks.length - 1);
  if (smooth) {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    peaks.forEach((peak, i) => ctx.lineTo(i * step, horizon - peak));
    ctx.lineTo(width, horizon);
    ctx.closePath();
    ctx.fill();
    return;
  }
  for (let x = 0; x < width; x += 1) {
    const i = Math.min(peaks.length - 2, Math.floor(x / step));
    const t = x / step - i;
    const peak = (peaks[i] as number) + ((peaks[i + 1] as number) - (peaks[i] as number)) * t;
    const top = Math.round(horizon - peak);
    ctx.fillRect(x, top, 1, horizon - top);
  }
}
