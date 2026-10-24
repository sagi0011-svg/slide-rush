import { describe, expect, it } from 'vitest';
import { OBSTACLES, RIDER, SAVE } from '../src/config';
import { POWERUP_TYPES } from '../src/game/powerups';
import {
  ANIMAL_FRAMES,
  ANIMAL_IDS,
  ANIMAL_SPRITES,
  animalRows,
  ATLAS_SIZE,
  atlasEntries,
  CLEAR,
  DRAWN_POSES,
  EFFECT_IN_FRONT,
  effectRows,
  leanRows,
  resolveRider,
  RING_IDS,
  ringRows,
  SPRITE_CHARACTERS,
  STARTER_ANIMAL,
  STARTER_RING,
} from '../src/render/sprites';
import {
  bobOffset,
  choosePose,
  effectFrame,
  poseLayout,
  RIDER_LAYOUT,
  RIDER_POSES,
  ringSpinFrame,
  type PoseInput,
} from '../src/render/rider-pose';

/**
 * The riders (docs/ART-AND-SHOP.md section 2).
 *
 * The sprites are pixel maps in code, so what can be checked without looking
 * is that they are well formed — rectangular, in the legend's colours, with an
 * actual body to show — and that the atlas they are packed into holds every
 * one of them without overlap. How they look is for the gallery,
 * ?debug=1&gallery=1.
 */

/** Pixels that are neither clear nor outline: the colour a sprite has to show. */
function bodyPixels(rows: readonly string[]): number {
  return rows
    .join('')
    .split('')
    .filter((c) => c !== CLEAR && c !== 'o').length;
}

function expectShape(rows: readonly string[], width: number, height: number, name: string) {
  expect(rows, name).toHaveLength(height);
  for (const row of rows) expect(row.length, `${name}: "${row}"`).toBe(width);
}

function expectKnownCharacters(rows: readonly string[], name: string) {
  for (const row of rows) {
    for (const character of row) {
      expect(SPRITE_CHARACTERS.has(character), `${name}: unknown "${character}"`).toBe(true);
    }
  }
}

describe('the cast', () => {
  it('has the six animals and eleven rings from the spec', () => {
    expect([...ANIMAL_IDS]).toEqual(['frog', 'penguin', 'cat', 'bear', 'duck', 'pig']);
    expect(RING_IDS).toHaveLength(11);
    for (const ring of ['tube', 'tractor', 'hoop', 'donut', 'pizza', 'toilet']) {
      expect(RING_IDS).toContain(ring);
    }
  });

  it('starts everyone as a frog in a tube, the same pair a fresh save names', () => {
    expect(STARTER_ANIMAL).toBe('frog');
    expect(STARTER_RING).toBe('tube');
    expect(SAVE.starterAnimal).toBe(STARTER_ANIMAL);
    expect(SAVE.starterRing).toBe(STARTER_RING);
  });
});

describe('the animals', () => {
  it('draws every pose of every animal as a square block of the right size', () => {
    for (const id of ANIMAL_IDS) {
      for (const frame of ANIMAL_FRAMES) {
        expectShape(
          animalRows(id, frame),
          RIDER.animalPixels,
          RIDER.animalPixels,
          `${id}/${frame}`,
        );
      }
    }
  });

  it('uses only colours the legend knows', () => {
    for (const id of ANIMAL_IDS) {
      for (const frame of ANIMAL_FRAMES)
        expectKnownCharacters(animalRows(id, frame), `${id}/${frame}`);
    }
  });

  it('gives every pose an actual body, not just an outline', () => {
    for (const id of ANIMAL_IDS) {
      for (const frame of ANIMAL_FRAMES) {
        expect(bodyPixels(animalRows(id, frame)), `${id}/${frame}`).toBeGreaterThan(150);
      }
    }
  });

  it('draws every animal differently, and every pose of it differently', () => {
    const idles = ANIMAL_IDS.map((id) => ANIMAL_SPRITES[id].idle.join('\n'));
    expect(new Set(idles).size).toBe(ANIMAL_IDS.length);
    for (const id of ANIMAL_IDS) {
      const poses = DRAWN_POSES.map((pose) => ANIMAL_SPRITES[id][pose].join('\n'));
      expect(new Set(poses).size, id).toBe(DRAWN_POSES.length);
    }
  });

  it('keeps the bottom row of the animal clear of the edges, so it fits in the ring', () => {
    for (const id of ANIMAL_IDS) {
      const bottom = ANIMAL_SPRITES[id].idle.at(-1) ?? '';
      expect(bottom.startsWith(CLEAR), id).toBe(true);
      expect(bottom.endsWith(CLEAR), id).toBe(true);
    }
  });

  it('leans by shearing the idle frame: the top slides over, the bottom stays put', () => {
    const idle = ANIMAL_SPRITES.frog.idle;
    const lean = leanRows(idle, 3);
    expect(lean.at(-1)).toBe(idle.at(-1));
    expect(lean[0]).toBe(CLEAR.repeat(3) + (idle[0] ?? '').slice(0, -3));
    expect(animalRows('frog', 'lean')).toEqual(leanRows(idle));
  });
});

describe('the rings', () => {
  const halves = ['back', 'front'] as const;

  it('draws every half of every ring in every spin frame at the ring size', () => {
    for (const id of RING_IDS) {
      for (let spin = 0; spin < RIDER.ringSpinFrames; spin += 1) {
        for (const half of halves) {
          const rows = ringRows(id, spin, half);
          expectShape(rows, RIDER.ringWidth, RIDER.ringHeight, `${id}/${spin}/${half}`);
          expectKnownCharacters(rows, `${id}/${spin}/${half}`);
        }
      }
    }
  });

  it('splits each ring in two: the back half above the line, the front half below', () => {
    for (const id of RING_IDS) {
      const back = ringRows(id, 0, 'back');
      const front = ringRows(id, 0, 'front');
      for (let y = 0; y < RIDER.ringHeight; y += 1) {
        const clear = CLEAR.repeat(RIDER.ringWidth);
        if (y < RIDER.ringSplitRow) expect(front[y], `${id} front row ${y}`).toBe(clear);
        else expect(back[y], `${id} back row ${y}`).toBe(clear);
      }
      expect(bodyPixels(back), `${id} back`).toBeGreaterThan(30);
      expect(bodyPixels(front), `${id} front`).toBeGreaterThan(30);
    }
  });

  it('leaves a hole in the middle for the animal to sit in', () => {
    const middle = Math.floor(RIDER.ringWidth / 2);
    for (const id of RING_IDS) {
      // The near side of the hole: the front half's top row, in the middle.
      const row = ringRows(id, 0, 'front')[RIDER.ringSplitRow] ?? '';
      expect(row[middle], id).toBe(CLEAR);
    }
  });

  it('draws every ring differently', () => {
    const looks = RING_IDS.map((id) =>
      [...ringRows(id, 0, 'back'), ...ringRows(id, 0, 'front')].join('\n'),
    );
    expect(new Set(looks).size).toBe(RING_IDS.length);
  });

  it('turns the patterned rings between spin frames, and loops back to the start', () => {
    for (const id of RING_IDS) {
      const first = ringRows(id, 0, 'back').join('\n') + ringRows(id, 0, 'front').join('\n');
      const second = ringRows(id, 1, 'back').join('\n') + ringRows(id, 1, 'front').join('\n');
      const wrapped =
        ringRows(id, RIDER.ringSpinFrames, 'back').join('\n') +
        ringRows(id, RIDER.ringSpinFrames, 'front').join('\n');
      // The toilet seat is the one ring that does not turn: it has hinges.
      if (id === 'toilet') expect(second).toBe(first);
      else expect(second, id).not.toBe(first);
      expect(wrapped, id).toBe(first);
    }
  });
});

describe('the power-up effects', () => {
  it('draws every frame of every effect at the effect size, in known colours', () => {
    for (const type of POWERUP_TYPES) {
      for (let frame = 0; frame < RIDER.effectFrames; frame += 1) {
        const rows = effectRows(type, frame);
        expectShape(rows, RIDER.effectWidth, RIDER.effectHeight, `${type}/${frame}`);
        expectKnownCharacters(rows, `${type}/${frame}`);
        expect(bodyPixels(rows), `${type}/${frame}`).toBeGreaterThan(20);
      }
    }
  });

  it('leaves the middle clear on the effects drawn in front, so the rider still shows', () => {
    const { effectWidth: w, effectHeight: h } = RIDER;
    for (const type of POWERUP_TYPES) {
      if (!EFFECT_IN_FRONT[type]) continue;
      for (let frame = 0; frame < RIDER.effectFrames; frame += 1) {
        const rows = effectRows(type, frame);
        // The middle half of the picture, both ways, is where the rider is.
        for (let y = Math.floor(h / 4); y < Math.ceil((h * 3) / 4); y += 1) {
          const middle = (rows[y] ?? '').slice(Math.floor(w / 4), Math.ceil((w * 3) / 4));
          expect(middle.replaceAll(CLEAR, ''), `${type}/${frame} row ${y}`).toBe('');
        }
      }
    }
  });
});

describe('the atlas', () => {
  const entries = atlasEntries();

  it('holds every frame: animals, both halves of every ring spin, every effect', () => {
    const expected =
      ANIMAL_IDS.length * ANIMAL_FRAMES.length +
      RING_IDS.length * RIDER.ringSpinFrames * 2 +
      POWERUP_TYPES.length * RIDER.effectFrames;
    expect(entries).toHaveLength(expected);
  });

  it('puts every frame inside the atlas, at the size of its pixel map', () => {
    for (const { name, cell, rows } of entries) {
      expect(cell.x, name).toBeGreaterThanOrEqual(0);
      expect(cell.y, name).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width, name).toBeLessThanOrEqual(ATLAS_SIZE.width);
      expect(cell.y + cell.height, name).toBeLessThanOrEqual(ATLAS_SIZE.height);
      expectShape(rows, cell.width, cell.height, name);
    }
  });

  it('never lets two frames overlap', () => {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = (entries[i] as (typeof entries)[number]).cell;
        const b = (entries[j] as (typeof entries)[number]).cell;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${entries[i]?.name} vs ${entries[j]?.name}`).toBe(true);
      }
    }
  });
});

describe('choosing the rider from a save', () => {
  it('draws the pair the save names', () => {
    expect(resolveRider('bear', 'toilet')).toEqual({ animal: 'bear', ring: 'toilet' });
  });

  it('falls back to the starter for an id this build does not know', () => {
    expect(resolveRider('dragon', 'pizza')).toEqual({ animal: 'frog', ring: 'pizza' });
    expect(resolveRider('cat', 'ufo')).toEqual({ animal: 'cat', ring: 'tube' });
    expect(resolveRider(undefined, 42)).toEqual({ animal: 'frog', ring: 'tube' });
  });
});

describe('the rider pose', () => {
  const calm: PoseInput = { height: 0, sliding: false, dead: false, laneSpeed: 0, sinceLanding: 9 };

  it('sits idle when nothing is happening', () => {
    expect(choosePose(calm)).toBe('idle');
  });

  it('follows what the player is doing, a crash beating everything', () => {
    expect(choosePose({ ...calm, height: 1 })).toBe('jump');
    expect(choosePose({ ...calm, sliding: true })).toBe('duck');
    expect(choosePose({ ...calm, sinceLanding: 0 })).toBe('land');
    expect(choosePose({ ...calm, laneSpeed: 5 })).toBe('leanRight');
    expect(choosePose({ ...calm, laneSpeed: -5 })).toBe('leanLeft');
    expect(choosePose({ ...calm, dead: true, height: 1, sliding: true })).toBe('crash');
    // In the air, a slide pressed early is a fast drop: still a jump until it lands.
    expect(choosePose({ ...calm, height: 1, sliding: true })).toBe('jump');
  });

  it('does not lean on the tiny drift of a lane change settling', () => {
    expect(choosePose({ ...calm, laneSpeed: RIDER.leanThreshold * 0.5 })).toBe('idle');
  });

  it('moves the layers by whole sprite pixels only, so they stay on the grid', () => {
    for (const pose of RIDER_POSES) {
      for (const t of [0, 0.13, 0.5, 1.7]) {
        const layout = poseLayout(pose, t);
        expect(Number.isInteger(layout.animalDy), pose).toBe(true);
        expect(Number.isInteger(layout.riderDy), pose).toBe(true);
      }
    }
    expect(Number.isInteger(RIDER_LAYOUT.animalX)).toBe(true);
  });

  it('bobs one pixel down and back up while idle', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 2; t += 0.01) seen.add(bobOffset(t));
    expect([...seen].sort()).toEqual([0, RIDER.bobPixels]);
  });

  it('mirrors one lean frame for the other side', () => {
    const left = poseLayout('leanLeft', 0);
    const right = poseLayout('leanRight', 0);
    expect(left.frame).toBe('lean');
    expect(right.frame).toBe('lean');
    expect(left.mirror).not.toBe(right.mirror);
  });

  it('pops the animal up in a crash and sinks it into the ring in a duck', () => {
    expect(poseLayout('crash', 0).animalDy).toBeLessThan(0);
    expect(poseLayout('duck', 0).animalDy).toBeGreaterThan(0);
    expect(poseLayout('land', 0).animalDy).toBeGreaterThan(0);
  });

  it('turns the ring and loops the effects through their frames', () => {
    const spins = new Set<number>();
    const loops = new Set<number>();
    for (let t = 0; t < 5; t += 0.01) {
      spins.add(ringSpinFrame(t));
      loops.add(effectFrame(t));
    }
    expect(spins.size).toBe(RIDER.ringSpinFrames);
    expect(loops.size).toBe(RIDER.effectFrames);
  });
});

describe('the rider looks the size its hitbox is', () => {
  /** How high the top of the animal's frame reaches above the slide, in units. */
  function topOfRider(pose: 'idle' | 'duck'): number {
    const layout = poseLayout(pose, 0);
    const pixels = RIDER_LAYOUT.height - RIDER.ringSinkPixels - layout.animalDy - layout.riderDy;
    return pixels / RIDER.pixelsPerUnit;
  }

  it('stands tall enough to be seen hitting the high bar', () => {
    expect(topOfRider('idle')).toBeGreaterThan(OBSTACLES.size.highObstacle.y);
  });

  it('ducks low enough to be seen getting under it', () => {
    expect(topOfRider('duck')).toBeLessThan(OBSTACLES.size.highObstacle.y);
  });
});
