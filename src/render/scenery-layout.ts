/**
 * Where the roadside scenery stands (docs/ART-AND-SHOP.md §1).
 *
 * The slide runs between slide towers, trees, palms and huts. Which prop
 * stands in which slot is worked out from the slot's own number, so the same
 * stretch of slide always looks the same however often it is recycled, and
 * nothing has to be remembered between frames.
 *
 * This deliberately does *not* use src/game/rng.ts: that stream belongs to
 * gameplay, and drawing must never pull a number out of it (CLAUDE.md rule 6).
 * No Three.js in here either, so the placement is unit-tested.
 */

import { RETRO } from '../config';

/**
 * The props that stand along the sides of the slide. The two towers are the
 * warm red/orange and cool blue/sky-blue pair from the reference art (§1).
 */
export const SCENERY_KINDS = ['towerWarm', 'towerCool', 'tree', 'palm', 'hut'] as const;

export type SceneryKind = (typeof SCENERY_KINDS)[number];

/** What stands in one slot, or nothing at all. */
export interface SceneryProp {
  /** Which prop, or null for an empty slot. */
  kind: SceneryKind | null;
  /** How far from the middle of the slide it stands, in units. Always positive. */
  offset: number;
  /** Size multiplier. */
  scale: number;
  /** How far it is turned about its own axis, in radians. */
  spin: number;
}

/**
 * How often each prop turns up among the slots that are not empty. Trees are
 * the filler; towers are the landmark, so they stay rare.
 */
const WEIGHTS: Readonly<Record<SceneryKind, number>> = {
  tree: 0.42,
  palm: 0.26,
  hut: 0.18,
  towerWarm: 0.07,
  towerCool: 0.07,
};

/**
 * A spread of values in 0..1 from one whole number, so one slot can be asked
 * several independent questions. Integer maths only, which keeps it identical
 * on every device.
 */
function hash01(key: number): number {
  let x = key | 0;
  x = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Four questions per slot per side, so the keys of two slots never collide. */
const QUESTIONS = 4;

function ask(slot: number, side: number, question: number): number {
  const sideBit = side < 0 ? 0 : 1;
  return hash01((slot * 2 + sideBit) * QUESTIONS + question);
}

/** Picks a prop from the weights above for a roll in 0..1. */
function pickKind(roll: number): SceneryKind {
  let total = 0;
  for (const kind of SCENERY_KINDS) total += WEIGHTS[kind];
  let target = roll * total;
  for (const kind of SCENERY_KINDS) {
    target -= WEIGHTS[kind];
    if (target <= 0) return kind;
  }
  return 'tree';
}

/**
 * What stands in one slot on one side of the slide.
 *
 * @param slot the slot's number, which can be negative behind the start
 * @param side -1 for the left of the slide, 1 for the right
 */
export function sceneryAt(slot: number, side: number): SceneryProp {
  const empty = ask(slot, side, 0);
  if (empty < RETRO.scenery.emptyShare) {
    return { kind: null, offset: RETRO.scenery.offsetMin, scale: 1, spin: 0 };
  }

  const { offsetMin, offsetMax, scaleMin, scaleMax } = RETRO.scenery;
  return {
    kind: pickKind(ask(slot, side, 1)),
    offset: offsetMin + ask(slot, side, 2) * (offsetMax - offsetMin),
    scale: scaleMin + ask(slot, side, 3) * (scaleMax - scaleMin),
    // Turned by whole eighths of a circle: a pixel prop seen at an odd angle
    // loses its clean vertical edges.
    spin: Math.round(ask(slot, side, 1) * 8) * (Math.PI / 4),
  };
}

/** The first slot number covered by the window that slides with the player. */
export function sceneryWindowStart(playerS: number): number {
  return Math.floor((playerS - RETRO.scenery.recycleBehind) / RETRO.scenery.spacing);
}

/**
 * How many slots per side are needed to cover the window.
 *
 * Two spare slots rather than one: the window's first slot is rounded down to
 * the slot grid, so its far end lands anywhere within one spacing of where the
 * player is. One spare leaves the far end short of `buildAhead` for part of
 * every spacing — only by a few units, and behind the fog, but a prop
 * appearing is a prop appearing. Two makes it reach every time (tested).
 */
export function sceneryWindowSlots(): number {
  const span = RETRO.scenery.recycleBehind + RETRO.scenery.buildAhead;
  return Math.ceil(span / RETRO.scenery.spacing) + 2;
}
