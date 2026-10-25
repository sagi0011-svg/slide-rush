import { describe, expect, it } from 'vitest';
import { SAVE, VISUAL_STYLES } from '../src/config';
import {
  createSaveStore,
  defaultSave,
  parseSave,
  shopChanges,
  shopStateOf,
  type SaveData,
  type StorageLike,
} from '../src/game/save';
import { buy, equip } from '../src/game/shop';

/** A stand-in for localStorage that keeps everything in memory. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  contents: Map<string, string>;
} {
  const contents = new Map(Object.entries(initial));
  return {
    contents,
    getItem: (key) => contents.get(key) ?? null,
    setItem: (key, value) => {
      contents.set(key, value);
    },
  };
}

/** A storage that refuses to write, like Safari in private browsing. */
function brokenStorage(mode: 'read' | 'write' | 'both'): StorageLike {
  return {
    getItem: () => {
      if (mode === 'read' || mode === 'both') throw new Error('reading blocked');
      return null;
    },
    setItem: () => {
      if (mode === 'write' || mode === 'both') throw new Error('storage is full');
    },
  };
}

describe('parseSave (SPEC 10)', () => {
  it('starts fresh when there is nothing saved', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('')).toEqual(defaultSave());
  });

  it('reads a save back', () => {
    const data: SaveData = {
      bestScore: 1234,
      totalCoins: 56,
      tutorialSeen: true,
      sfxOff: true,
      musicOff: false,
      effectsOff: true,
      equippedAnimal: 'bear',
      equippedRing: 'toilet',
      ownedAnimals: ['frog', 'bear'],
      ownedRings: ['tube', 'toilet'],
      visualStyle: 'pixel',
    };
    expect(parseSave(JSON.stringify(data))).toEqual(data);
  });

  it('starts fresh on nonsense rather than crashing', () => {
    for (const raw of ['not json', '[1,2,3]', 'null', '42', '"a string"', '{']) {
      expect(parseSave(raw), raw).toEqual(defaultSave());
    }
  });

  it('throws away values of the wrong shape, keeping the good ones', () => {
    const parsed = parseSave(
      JSON.stringify({
        bestScore: 'lots',
        totalCoins: 7,
        tutorialSeen: 'yes',
        sfxOff: true,
        musicOff: 1,
        effectsOff: 'off',
      }),
    );
    expect(parsed.bestScore).toBe(0);
    expect(parsed.totalCoins).toBe(7);
    expect(parsed.tutorialSeen).toBe(false);
    expect(parsed.sfxOff).toBe(true);
    expect(parsed.musicOff).toBe(false);
    expect(parsed.effectsOff).toBe(false);
  });

  it('refuses impossible numbers', () => {
    const parsed = parseSave(
      JSON.stringify({ bestScore: -50, totalCoins: Number.POSITIVE_INFINITY }),
    );
    expect(parsed.bestScore).toBe(0);
    expect(parsed.totalCoins).toBe(0);
  });

  it('rounds scores down to whole numbers', () => {
    expect(parseSave(JSON.stringify({ bestScore: 99.9 })).bestScore).toBe(99);
  });

  it('ignores anything extra a later version might add', () => {
    const parsed = parseSave(JSON.stringify({ bestScore: 10, somethingNew: { a: 1 } }));
    expect(parsed.bestScore).toBe(10);
    expect(parsed).toEqual({ ...defaultSave(), bestScore: 10 });
  });
});

describe('the equipped rider (docs/ART-AND-SHOP.md section 2)', () => {
  it('starts on the free starters: a frog in a tube', () => {
    expect(defaultSave().equippedAnimal).toBe('frog');
    expect(defaultSave().equippedRing).toBe('tube');
  });

  it('loads a save from before riders existed without losing anything', () => {
    const old = {
      bestScore: 900,
      totalCoins: 321,
      tutorialSeen: true,
      muted: true,
      effectsOff: false,
    };
    const parsed = parseSave(JSON.stringify(old));
    expect(parsed).toEqual({
      bestScore: 900,
      totalCoins: 321,
      tutorialSeen: true,
      effectsOff: false,
      sfxOff: true,
      musicOff: true,
      visualStyle: 'sunset',
      equippedAnimal: 'frog',
      equippedRing: 'tube',
      ownedAnimals: ['frog'],
      ownedRings: ['tube'],
    });
  });

  it('falls back to the starters for ids that are not strings, empty or absurd', () => {
    for (const bad of [42, null, true, '', 'x'.repeat(SAVE.maxIdLength + 1), ['frog'], {}]) {
      const parsed = parseSave(JSON.stringify({ equippedAnimal: bad, equippedRing: bad }));
      expect(parsed.equippedAnimal, JSON.stringify(bad)).toBe('frog');
      expect(parsed.equippedRing, JSON.stringify(bad)).toBe('tube');
    }
  });

  it('keeps an id it does not know: drawing the starter instead is up to the renderer', () => {
    // A save from a newer version may name a ring this build has never heard
    // of. Throwing it away here would lose it for good on the next write.
    const parsed = parseSave(JSON.stringify({ equippedAnimal: 'dragon', equippedRing: 'ufo' }));
    expect(parsed.equippedAnimal).toBe('dragon');
    expect(parsed.equippedRing).toBe('ufo');
  });

  it('remembers the pair across a reload', () => {
    const storage = fakeStorage();
    createSaveStore(storage).update({ equippedAnimal: 'duck', equippedRing: 'pizza' });
    const reloaded = createSaveStore(storage).data;
    expect(reloaded.equippedAnimal).toBe('duck');
    expect(reloaded.equippedRing).toBe('pizza');
  });

  it('keeps the pair when a run ends', () => {
    const store = createSaveStore(fakeStorage());
    store.update({ equippedAnimal: 'pig', equippedRing: 'record' });
    const after = store.finishRun(500, 20);
    expect(after.equippedAnimal).toBe('pig');
    expect(after.equippedRing).toBe('record');
  });
});

describe('what the shop has bought (docs/ART-AND-SHOP.md section 3)', () => {
  it('owns the free starters and nothing else on a fresh save', () => {
    expect(defaultSave().ownedAnimals).toEqual(['frog']);
    expect(defaultSave().ownedRings).toEqual(['tube']);
  });

  it('loads a save from before the shop without losing anything', () => {
    // Exactly what M10 wrote: the rider is there, but no owned lists at all.
    const old = {
      bestScore: 4200,
      totalCoins: 1234,
      tutorialSeen: true,
      muted: false,
      effectsOff: true,
      equippedAnimal: 'duck',
      equippedRing: 'pizza',
    };
    const parsed = parseSave(JSON.stringify(old));
    expect(parsed.bestScore).toBe(4200);
    expect(parsed.totalCoins).toBe(1234);
    expect(parsed.tutorialSeen).toBe(true);
    expect(parsed.effectsOff).toBe(true);
    // The equipped pair is kept as written; the owned lists start at the
    // starters, so the shop offers the duck and the pizza again.
    expect(parsed.equippedAnimal).toBe('duck');
    expect(parsed.equippedRing).toBe('pizza');
    expect(parsed.ownedAnimals).toEqual(['frog']);
    expect(parsed.ownedRings).toEqual(['tube']);
  });

  it('reads back what was bought, in catalog order', () => {
    const parsed = parseSave(
      JSON.stringify({ ownedAnimals: ['bear', 'frog', 'cat'], ownedRings: ['donut', 'tube'] }),
    );
    expect(parsed.ownedAnimals).toEqual(['frog', 'cat', 'bear']);
    expect(parsed.ownedRings).toEqual(['tube', 'donut']);
  });

  it('drops ids it does not know, and anything that is not an id', () => {
    const parsed = parseSave(
      JSON.stringify({
        ownedAnimals: ['bear', 'dragon', 42, null, ['frog'], 'bear'],
        ownedRings: 'toilet',
      }),
    );
    expect(parsed.ownedAnimals).toEqual(['frog', 'bear']);
    // A list that is not a list at all leaves just the starter.
    expect(parsed.ownedRings).toEqual(['tube']);
  });

  it('always owns the starters, however broken the save is', () => {
    for (const raw of ['{', 'null', JSON.stringify({ ownedAnimals: [], ownedRings: [] })]) {
      const parsed = parseSave(raw);
      expect(parsed.ownedAnimals, raw).toContain('frog');
      expect(parsed.ownedRings, raw).toContain('tube');
    }
  });

  it('remembers a purchase across a reload', () => {
    const storage = fakeStorage();
    const store = createSaveStore(storage);
    store.finishRun(0, 600);
    store.update(shopChanges(buy(shopStateOf(store.data), 'ring', 'donut')));

    const reloaded = createSaveStore(storage).data;
    expect(reloaded.ownedRings).toContain('donut');
    expect(reloaded.totalCoins).toBe(100);
  });

  it('spends the coins it was holding, and leaves the rest alone', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(900, 2000);
    store.update(shopChanges(buy(shopStateOf(store.data), 'animal', 'penguin')));
    expect(store.data.totalCoins).toBe(1500);
    expect(store.data.ownedAnimals).toEqual(['frog', 'penguin']);
    expect(store.data.bestScore).toBe(900);
  });

  it('keeps earning coins after a purchase', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(100, 600);
    store.update(shopChanges(buy(shopStateOf(store.data), 'ring', 'hoop')));
    store.finishRun(100, 50);
    expect(store.data.totalCoins).toBe(350);
    expect(store.data.ownedRings).toEqual(['tube', 'hoop']);
  });
});

describe('the view of the save the shop works on (section 3)', () => {
  it('hands the shop the coins, the owned lists and the equipped pair', () => {
    const data: SaveData = {
      ...defaultSave(),
      totalCoins: 777,
      ownedAnimals: ['frog', 'cat'],
      ownedRings: ['tube', 'record'],
      equippedAnimal: 'cat',
      equippedRing: 'record',
    };
    expect(shopStateOf(data)).toEqual({
      coins: 777,
      owned: { animal: ['frog', 'cat'], ring: ['tube', 'record'] },
      equipped: { animal: 'cat', ring: 'record' },
    });
  });

  it('falls back to the starter when what is equipped is not owned', () => {
    const data: SaveData = { ...defaultSave(), equippedAnimal: 'bear', equippedRing: 'toilet' };
    expect(shopStateOf(data).equipped).toEqual({ animal: 'frog', ring: 'tube' });
  });

  it('falls back to the starter for an id this build has never heard of', () => {
    const data: SaveData = { ...defaultSave(), equippedAnimal: 'dragon', equippedRing: 'ufo' };
    expect(shopStateOf(data).equipped).toEqual({ animal: 'frog', ring: 'tube' });
  });

  it('writes a changed shop state back into the save', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(0, 5000);
    let state = shopStateOf(store.data);
    state = buy(state, 'animal', 'bear');
    state = equip(state, 'animal', 'bear');
    store.update(shopChanges(state));

    expect(store.data.totalCoins).toBe(2500);
    expect(store.data.ownedAnimals).toEqual(['frog', 'bear']);
    expect(store.data.equippedAnimal).toBe('bear');
    // The ring side is untouched.
    expect(store.data.equippedRing).toBe('tube');
  });

  it('round-trips: through the shop and back changes nothing on its own', () => {
    const before = parseSave(JSON.stringify({ totalCoins: 50, ownedRings: ['tube', 'hoop'] }));
    const after = { ...before, ...shopChanges(shopStateOf(before)) };
    expect(after).toEqual(before);
  });

  it('never lets the coins go below zero', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(0, 100);
    // The bear costs 2500; a hundred coins cannot buy it.
    store.update(shopChanges(buy(shopStateOf(store.data), 'animal', 'bear')));
    expect(store.data.totalCoins).toBe(100);
    expect(store.data.ownedAnimals).toEqual(['frog']);
  });
});

describe('the save store', () => {
  it('writes under a versioned key (SPEC 10)', () => {
    const storage = fakeStorage();
    createSaveStore(storage).update({ bestScore: 10 });
    expect(storage.contents.has(SAVE.key)).toBe(true);
    expect(SAVE.key).toMatch(/v\d+$/);
  });

  it('survives a reload', () => {
    const storage = fakeStorage();
    createSaveStore(storage).finishRun(500, 20);

    // A fresh store, as if the page had been reloaded.
    const reloaded = createSaveStore(storage);
    expect(reloaded.data.bestScore).toBe(500);
    expect(reloaded.data.totalCoins).toBe(20);
  });

  it('keeps the best score, not the latest one', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(800, 5);
    store.finishRun(300, 5);
    expect(store.data.bestScore).toBe(800);
  });

  it('adds up coins across runs, for the shop later', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(100, 7);
    store.finishRun(50, 3);
    store.finishRun(10, 10);
    expect(store.data.totalCoins).toBe(20);
  });

  it('rounds a fractional score down before saving it', () => {
    const store = createSaveStore(fakeStorage());
    store.finishRun(123.78, 0);
    expect(store.data.bestScore).toBe(123);
  });

  it('leaves the other settings alone when a run ends', () => {
    const store = createSaveStore(fakeStorage());
    store.update({ sfxOff: true, musicOff: true, tutorialSeen: true, effectsOff: true });
    store.update({ visualStyle: 'classic' });
    store.finishRun(400, 2);
    expect(store.data.sfxOff).toBe(true);
    expect(store.data.musicOff).toBe(true);
    expect(store.data.visualStyle).toBe('classic');
    expect(store.data.effectsOff).toBe(true);
    expect(store.data.tutorialSeen).toBe(true);
  });

  it('works with no storage at all', () => {
    const store = createSaveStore(null);
    expect(store.data).toEqual(defaultSave());
    expect(store.persisted).toBe(false);

    // The run still gets a best score, it just will not be there next time.
    store.finishRun(700, 4);
    expect(store.data.bestScore).toBe(700);
    expect(() => store.update({ sfxOff: true, visualStyle: 'pixel' })).not.toThrow();
  });

  it('carries on when writing fails, and says it did not save', () => {
    const store = createSaveStore(brokenStorage('write'));
    expect(() => store.finishRun(900, 1)).not.toThrow();
    expect(store.data.bestScore).toBe(900);
    expect(store.persisted).toBe(false);
  });

  it('carries on when reading fails', () => {
    const store = createSaveStore(brokenStorage('read'));
    expect(store.data).toEqual(defaultSave());
    expect(() => store.finishRun(100, 1)).not.toThrow();
  });

  it('never throws, whatever the storage does', () => {
    const store = createSaveStore(brokenStorage('both'));
    expect(() => {
      store.update({ bestScore: 1 });
      store.finishRun(2, 3);
    }).not.toThrow();
  });

  it('does not trip over a corrupted save', () => {
    const storage = fakeStorage({ [SAVE.key]: '{ this is not json' });
    const store = createSaveStore(storage);
    expect(store.data).toEqual(defaultSave());
    store.finishRun(42, 1);
    expect(createSaveStore(storage).data.bestScore).toBe(42);
  });
});

describe('sound and music switches (docs/VISUAL-STYLES.md section 3)', () => {
  it('start with both on', () => {
    expect(defaultSave().sfxOff).toBe(false);
    expect(defaultSave().musicOff).toBe(false);
  });

  it('turn both off for a save from when one switch covered both', () => {
    const parsed = parseSave(JSON.stringify({ muted: true }));
    expect(parsed.sfxOff).toBe(true);
    expect(parsed.musicOff).toBe(true);
    expect(parseSave(JSON.stringify({ muted: false })).sfxOff).toBe(false);
  });

  it('let the new switches win over the old one', () => {
    const parsed = parseSave(JSON.stringify({ muted: true, sfxOff: false, musicOff: true }));
    expect(parsed.sfxOff).toBe(false);
    expect(parsed.musicOff).toBe(true);
  });

  it('never write the old switch back', () => {
    const storage = fakeStorage({ [SAVE.key]: JSON.stringify({ muted: true }) });
    createSaveStore(storage).update({ sfxOff: false });
    const written = JSON.parse(storage.getItem(SAVE.key) ?? '{}') as Record<string, unknown>;
    expect(written).not.toHaveProperty('muted');
    expect(written['sfxOff']).toBe(false);
    expect(written['musicOff']).toBe(true);
  });
});

describe('the visual style (docs/VISUAL-STYLES.md section 2)', () => {
  it('starts on the v0.2 look', () => {
    expect(defaultSave().visualStyle).toBe('sunset');
  });

  it('reads back every style this build knows', () => {
    for (const style of VISUAL_STYLES) {
      expect(parseSave(JSON.stringify({ visualStyle: style })).visualStyle).toBe(style);
    }
  });

  it('falls back to the default for anything else', () => {
    for (const junk of ['neon', '', 'SUNSET', 3, null, ['pixel'], { style: 'pixel' }]) {
      expect(parseSave(JSON.stringify({ visualStyle: junk })).visualStyle).toBe('sunset');
    }
  });

  it('survives a reload', () => {
    const storage = fakeStorage();
    createSaveStore(storage).update({ visualStyle: 'classic' });
    expect(createSaveStore(storage).data.visualStyle).toBe('classic');
  });

  it('is still usable when the storage throws on every call', () => {
    const broken = {
      getItem(): string | null {
        throw new Error('blocked');
      },
      setItem(): void {
        throw new Error('blocked');
      },
    };
    const store = createSaveStore(broken);
    expect(store.data.visualStyle).toBe('sunset');
    store.update({ visualStyle: 'pixel' });
    expect(store.data.visualStyle).toBe('pixel');
    expect(store.persisted).toBe(false);
  });
});
