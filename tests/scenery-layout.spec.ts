import { describe, expect, it } from 'vitest';
import {
  SCENERY_KINDS,
  sceneryAt,
  sceneryWindowSlots,
  sceneryWindowStart,
  type SceneryKind,
} from '../src/render/scenery-layout';
import { RETRO } from '../src/config';

/**
 * Where the roadside scenery stands (docs/ART-AND-SHOP.md section 1).
 *
 * The placement has to be worked out from the slot's own number and nothing
 * else: that is what lets the props be recycled with the player and still have
 * the same stretch of slide look the same every time it comes round.
 */
describe('scenery placement', () => {
  it('gives the same answer for the same slot every time', () => {
    for (const slot of [-7, 0, 1, 42, 1000]) {
      for (const side of [-1, 1]) {
        expect(sceneryAt(slot, side)).toEqual(sceneryAt(slot, side));
      }
    }
  });

  it('puts different things on the two sides of the same slot', () => {
    // Not guaranteed for any one slot, but a run of them must differ, or the
    // slide would be flanked by mirror images of itself.
    let differences = 0;
    for (let slot = 0; slot < 60; slot += 1) {
      const left = sceneryAt(slot, -1);
      const right = sceneryAt(slot, 1);
      if (left.kind !== right.kind || left.offset !== right.offset) differences += 1;
    }
    expect(differences).toBeGreaterThan(40);
  });

  it('only ever names a prop it knows, or nothing', () => {
    const known = new Set<SceneryKind>(SCENERY_KINDS);
    for (let slot = -50; slot < 200; slot += 1) {
      for (const side of [-1, 1]) {
        const prop = sceneryAt(slot, side);
        if (prop.kind !== null) expect(known.has(prop.kind)).toBe(true);
      }
    }
  });

  it('keeps every prop clear of the slide and inside its limits', () => {
    for (let slot = -50; slot < 200; slot += 1) {
      for (const side of [-1, 1]) {
        const prop = sceneryAt(slot, side);
        expect(prop.offset).toBeGreaterThanOrEqual(RETRO.scenery.offsetMin);
        expect(prop.offset).toBeLessThanOrEqual(RETRO.scenery.offsetMax);
        expect(prop.scale).toBeGreaterThanOrEqual(RETRO.scenery.scaleMin);
        expect(prop.scale).toBeLessThanOrEqual(RETRO.scenery.scaleMax);
      }
    }
  });

  it('leaves roughly the share of slots empty that the config asks for', () => {
    let empty = 0;
    let total = 0;
    for (let slot = 0; slot < 2000; slot += 1) {
      for (const side of [-1, 1]) {
        total += 1;
        if (sceneryAt(slot, side).kind === null) empty += 1;
      }
    }
    // Within a few points of the target: the sides must look planted, not
    // fenced, and not bare either.
    expect(empty / total).toBeCloseTo(RETRO.scenery.emptyShare, 1);
  });

  it('uses every kind of prop, with the towers as the rare landmark', () => {
    const counts = new Map<SceneryKind, number>();
    for (let slot = 0; slot < 4000; slot += 1) {
      for (const side of [-1, 1]) {
        const { kind } = sceneryAt(slot, side);
        if (kind !== null) counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    for (const kind of SCENERY_KINDS) {
      expect(counts.get(kind) ?? 0, kind).toBeGreaterThan(0);
    }
    const trees = counts.get('tree') ?? 0;
    const towers = (counts.get('towerWarm') ?? 0) + (counts.get('towerCool') ?? 0);
    expect(towers).toBeLessThan(trees);
  });
});

describe('the scenery window', () => {
  it('starts behind the player and moves forward with them', () => {
    const start = sceneryWindowStart(500);
    expect(start * RETRO.scenery.spacing).toBeLessThanOrEqual(500 - RETRO.scenery.recycleBehind);
    expect(sceneryWindowStart(600)).toBeGreaterThan(start);
  });

  it('holds enough slots to cover everything that can be seen', () => {
    const slots = sceneryWindowSlots();
    const covered = slots * RETRO.scenery.spacing;
    expect(covered).toBeGreaterThanOrEqual(RETRO.scenery.buildAhead + RETRO.scenery.recycleBehind);
  });

  it('never leaves a gap at the far end as the player moves', () => {
    // Walk forward in small steps; at every point the window must reach at
    // least as far ahead as the props are meant to be built.
    const slots = sceneryWindowSlots();
    for (let playerS = 0; playerS < 400; playerS += 3.7) {
      const first = sceneryWindowStart(playerS);
      const lastSlotS = (first + slots - 1) * RETRO.scenery.spacing;
      expect(lastSlotS - playerS).toBeGreaterThanOrEqual(RETRO.scenery.buildAhead);
    }
  });
});
