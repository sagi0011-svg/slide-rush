import { describe, expect, it } from 'vitest';
import { SAVE } from '../src/config';
import {
  createSaveStore,
  defaultSave,
  parseSave,
  type SaveData,
  type StorageLike,
} from '../src/game/save';

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
      muted: true,
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
      JSON.stringify({ bestScore: 'lots', totalCoins: 7, tutorialSeen: 'yes', muted: true }),
    );
    expect(parsed.bestScore).toBe(0);
    expect(parsed.totalCoins).toBe(7);
    expect(parsed.tutorialSeen).toBe(false);
    expect(parsed.muted).toBe(true);
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
    store.update({ muted: true, tutorialSeen: true });
    store.finishRun(400, 2);
    expect(store.data.muted).toBe(true);
    expect(store.data.tutorialSeen).toBe(true);
  });

  it('works with no storage at all', () => {
    const store = createSaveStore(null);
    expect(store.data).toEqual(defaultSave());
    expect(store.persisted).toBe(false);

    // The run still gets a best score, it just will not be there next time.
    store.finishRun(700, 4);
    expect(store.data.bestScore).toBe(700);
    expect(() => store.update({ muted: true })).not.toThrow();
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
