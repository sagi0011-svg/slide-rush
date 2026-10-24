/**
 * The power-up effects around the rider, redrawn in pixels (docs/ART-AND-SHOP.md
 * §2): a bubble for the shield, pulsing waves for the magnet and speed streaks
 * for the boost. Each plays a short loop of `RIDER.effectFrames` frames.
 *
 * The shield and the boost are drawn in front of the rider, so their middles
 * are left clear; the magnet's waves are drawn behind it. Like the rings these are worked
 * out in code rather than drawn by hand — they are circles and lines, which
 * code draws better than a list of strings would — and they come out as plain
 * pixel maps in SPRITE_LEGEND's characters, tested in node.
 */

import { RIDER } from '../../config';
import type { PowerUpType } from '../../game/powerups';
import { CLEAR } from './legend';

/** Which effects are drawn in front of the rider; the rest go behind it. */
export const EFFECT_IN_FRONT: Readonly<Record<PowerUpType, boolean>> = {
  shield: true,
  magnet: false,
  boost: true,
};

type Painter = (u: number, v: number, x: number, y: number, frame: number) => string;

/** Where a pixel is in the effect, -1..1 each way from its middle. */
function centred(x: number, y: number): { u: number; v: number } {
  return {
    u: (x + 0.5 - RIDER.effectWidth / 2) / (RIDER.effectWidth / 2),
    v: (y + 0.5 - RIDER.effectHeight / 2) / (RIDER.effectHeight / 2),
  };
}

const PAINTERS: Readonly<Record<PowerUpType, Painter>> = {
  // A bubble: a thin rim with a dark edge, and a shine that shifts between
  // frames so the bubble looks alive.
  shield: (u, v, _x, _y, frame) => {
    const r = Math.hypot(u, v * 1.04);
    if (r > 0.98) return CLEAR;
    if (r > 0.93) return 'W';
    if (r > 0.86) return 's';
    if (r > 0.8 && (u + v < -0.6 || u + v > 0.9)) return 'Q';
    // The shine: a short arc up on the left, nudged along a little each frame.
    const angle = Math.atan2(v, u);
    const shineAt = -2.3 + frame * 0.25;
    if (r > 0.72 && r < 0.8 && Math.abs(angle - shineAt) < 0.32) return 'c';
    return CLEAR;
  },
  // Waves either side of the rider, moving outwards from one frame to the next.
  magnet: (u, v, _x, _y, frame) => {
    if (Math.abs(u) < 0.62 || Math.abs(v) > 0.55) return CLEAR;
    const r = Math.hypot(u, v * 1.4);
    for (const wave of [0.72, 0.9]) {
      const at = wave + frame * 0.09;
      if (Math.abs(r - at) < 0.045) return frame === 0 ? 'U' : 'u';
    }
    return CLEAR;
  },
  // Speed streaks either side of the rider, racing down past it: every other
  // column carries one, each a little out of step with the next.
  boost: (u, v, x, y, frame) => {
    if (Math.abs(u) < 0.8 || v < -0.75 || v > 0.55 || x % 2 === 1) return CLEAR;
    const t = (y + ((x * 7 + frame * 9) % 16)) % 16;
    if (t >= 7) return CLEAR;
    if (t < 2) return 'c';
    return t < 5 ? 'y' : 'n';
  },
};

/** The pixel map for one frame of one effect. */
export function effectRows(type: PowerUpType, frame: number): string[] {
  const painter = PAINTERS[type];
  const loop = ((frame % RIDER.effectFrames) + RIDER.effectFrames) % RIDER.effectFrames;
  const rows: string[] = [];
  for (let y = 0; y < RIDER.effectHeight; y += 1) {
    let row = '';
    for (let x = 0; x < RIDER.effectWidth; x += 1) {
      const { u, v } = centred(x, y);
      row += painter(u, v, x, y, loop);
    }
    rows.push(row);
  }
  return rows;
}
