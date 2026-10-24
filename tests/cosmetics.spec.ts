import { describe, expect, it } from 'vitest';
import { createDebugTweaks } from '../src/game/debug-tweaks';
import { collectHitboxes, createHitboxList } from '../src/game/hitboxes';
import type { GameAction } from '../src/game/input-actions';
import { createSaveStore, type StorageLike } from '../src/game/save';
import { displayScore } from '../src/game/scoring';
import { applyAction, createRunState, stepRun } from '../src/game/state';
import { ANIMAL_IDS, resolveRider, RING_IDS } from '../src/render/sprites';

/**
 * Cosmetics are visual only (CLAUDE.md rule 13, docs/ART-AND-SHOP.md
 * section 0).
 *
 * Whichever animal and ring are on, the run must be the same run: the same
 * hitboxes on every tick, the same physics, the same speed, the same score,
 * ending on the same tick. This plays one scripted run per pair, built
 * exactly the way the game builds it from the save, and asks for every one of
 * the 66 records to be identical, byte for byte.
 */

function memoryStorage(): StorageLike {
  const contents = new Map<string, string>();
  return {
    getItem: (key) => contents.get(key) ?? null,
    setItem: (key, value) => {
      contents.set(key, value);
    },
  };
}

/** Something to do every so often, so the run jumps, ducks and changes lanes. */
const SCRIPT: readonly GameAction[] = ['left', 'jump', 'right', 'slide', 'right', 'jump', 'left'];
const SEED = 20261024;
const TICKS = 60 * 25;

/** Plays one run with this pair equipped and records everything that matters. */
function playWith(animal: string, ring: string): string {
  const save = createSaveStore(memoryStorage());
  save.update({ equippedAnimal: animal, equippedRing: ring, tutorialSeen: true });
  // The renderer would draw this pair; the run below must not care.
  const pair = resolveRider(save.data.equippedAnimal, save.data.equippedRing);
  expect(pair).toEqual({ animal, ring });

  // Built the way src/main.ts builds a run from the save.
  const state = createRunState(SEED, {
    tutorial: !save.data.tutorialSeen,
    debug: createDebugTweaks(),
  });
  state.paused = false;
  const hitboxes = createHitboxList();
  const record: unknown[] = [];

  for (let tick = 0; tick < TICKS; tick += 1) {
    if (tick % 45 === 20) {
      applyAction(state, SCRIPT[Math.floor(tick / 45) % SCRIPT.length] as GameAction);
    }
    stepRun(state);
    collectHitboxes(state, hitboxes);
    const { player } = hitboxes;
    record.push([
      state.distance,
      state.speed,
      state.player.laneOffset,
      state.player.height,
      state.player.vertical,
      state.phase,
      state.stumbles,
      displayScore(state.score),
      state.score.coins,
      [player.x, player.halfW, player.minY, player.maxY, player.z, player.halfD],
      hitboxes.obstacles
        .slice(0, hitboxes.count)
        .map((box) => [box.x, box.halfW, box.minY, box.maxY, box.z, box.halfD]),
    ]);
  }
  return JSON.stringify(record);
}

describe('cosmetics are visual only (rule 13)', () => {
  it('plays the very same run whichever animal and ring are equipped', () => {
    const reference = playWith('frog', 'tube');
    // A run long enough to have done something worth comparing.
    expect(reference.length).toBeGreaterThan(10_000);

    for (const animal of ANIMAL_IDS) {
      for (const ring of RING_IDS) {
        const run = playWith(animal, ring);
        // Compared as one string: any difference anywhere, in any tick, fails.
        expect(run === reference, `${animal} in a ${ring} played a different run`).toBe(true);
      }
    }
  });

  it('keeps the game rules from ever looking at the sprites or the equipped pair', () => {
    // The structural half of the proof: nothing in src/game/ imports the
    // render layer, and only the save itself knows the equipped fields exist.
    const sources = import.meta.glob('../src/game/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const files = Object.entries(sources);
    expect(files.length).toBeGreaterThan(10);
    for (const [path, source] of files) {
      const text = String(source);
      expect(text.includes('/render/'), `${path} imports from src/render`).toBe(false);
      if (path.endsWith('/save.ts')) continue;
      expect(/equipped(Animal|Ring)/.test(text), `${path} reads the equipped pair`).toBe(false);
    }
  });
});
