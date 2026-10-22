/**
 * The visual-only bend of the slide (SPEC 2).
 *
 * Gameplay lanes are always dead straight along Z. This file bends what you
 * *see*: the track mesh, the player mesh and the camera are all offset by the
 * same amount for the same point on the slide, so nothing here can change a
 * collision, a lane or a jump. It lives in src/render/ for exactly that reason.
 *
 * `s` is the distance from the start of the slide, in units.
 */

import { CURVE } from '../config';

const TWO_PI = Math.PI * 2;

/** How far the slide has swung sideways at this point, in units. */
export function curveX(s: number): number {
  return CURVE.lateralAmplitude * Math.sin((s / CURVE.lateralWavelength) * TWO_PI);
}

/**
 * How far the slide has dropped at this point, in units.
 *
 * A water slide only ever goes down, and this curve never climbs: it alternates
 * between near-flat stretches and steeper drop sections. That matters for more
 * than looks — a slide that rose again would hide the track behind the crest of
 * the hill, and the player would be jumping blind.
 */
export function curveY(s: number): number {
  const theta = (s / CURVE.verticalWavelength) * TWO_PI;
  // The integral of (1 - cos): its slope is never positive and is zero on the flats.
  return (-CURVE.dropPerWavelength * (theta - Math.sin(theta))) / TWO_PI;
}

/** Distance used to measure the slope ahead, in units. */
const SLOPE_SAMPLE = 6;

/**
 * How steeply the slide is dropping just ahead: 0 on the flat, higher on a
 * drop. The camera uses this for a small speed-feel kick (SPEC 2).
 */
export function curveDownhill(s: number): number {
  const drop = curveY(s) - curveY(s + SLOPE_SAMPLE);
  return Math.max(0, drop / SLOPE_SAMPLE);
}
