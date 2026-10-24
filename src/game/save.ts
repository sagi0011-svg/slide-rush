/**
 * What survives between runs (SPEC 10).
 *
 * Best score, every coin ever collected (for the shop, later), whether the
 * tutorial has been seen, whether sound is muted, whether the shake and
 * flash of a hit are turned off, and which animal and ring the player rides
 * (docs/ART-AND-SHOP.md §2).
 *
 * The storage itself is handed in rather than reached for, so the rules can be
 * tested without a browser. Nothing here may ever throw: private browsing,
 * a full disk or a blocked cookie setting all make localStorage fail, and a
 * game that cannot remember your best score should still be playable.
 */

import { SAVE } from '../config';

export interface SaveData {
  /** Highest score ever reached. */
  bestScore: number;
  /** Every coin collected across every run, for a future shop. */
  totalCoins: number;
  /** Whether the first-run tutorial has been completed (M6). */
  tutorialSeen: boolean;
  /** Whether sound is off (M7). */
  muted: boolean;
  /** Whether vibration, the screen flash and the camera shake are off. */
  effectsOff: boolean;
  /**
   * The rider: which animal, in which ring (docs/ART-AND-SHOP.md §2). Kept
   * as plain ids. The rules never look at them — they are only a picture
   * (CLAUDE.md rule 13) — and whether an id is one the game can draw is
   * settled by the render layer, which falls back to the starter for any it
   * does not know.
   */
  equippedAnimal: string;
  equippedRing: string;
}

/** The little bit of localStorage this needs; easy to stand in for in a test. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSave(): SaveData {
  return {
    bestScore: 0,
    totalCoins: 0,
    tutorialSeen: false,
    muted: false,
    effectsOff: false,
    equippedAnimal: SAVE.starterAnimal,
    equippedRing: SAVE.starterRing,
  };
}

function wholeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** An id: any short, non-empty string. Anything else is replaced. */
function id(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 && value.length <= SAVE.maxIdLength
    ? value
    : fallback;
}

/**
 * Reads a saved game out of a string, keeping whatever makes sense and
 * falling back to a fresh save for anything that does not. A save written by
 * a future version, or by something else entirely, can never break the game.
 */
export function parseSave(raw: string | null): SaveData {
  const fresh = defaultSave();
  if (raw === null || raw === '') return fresh;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fresh;

  const data = parsed as Record<string, unknown>;
  return {
    bestScore: wholeNumber(data['bestScore'], fresh.bestScore),
    totalCoins: wholeNumber(data['totalCoins'], fresh.totalCoins),
    tutorialSeen: flag(data['tutorialSeen'], fresh.tutorialSeen),
    muted: flag(data['muted'], fresh.muted),
    effectsOff: flag(data['effectsOff'], fresh.effectsOff),
    equippedAnimal: id(data['equippedAnimal'], fresh.equippedAnimal),
    equippedRing: id(data['equippedRing'], fresh.equippedRing),
  };
}

export interface SaveStore {
  /** The save as it stands. Always a usable object, never null. */
  readonly data: SaveData;
  /** True if what is in memory actually reached the storage. */
  readonly persisted: boolean;
  /** Changes the save and writes it out. */
  update(changes: Partial<SaveData>): SaveData;
  /**
   * Records the end of a run: a new best score if it beats the old one, and
   * the coins added to the running total.
   */
  finishRun(score: number, coins: number): SaveData;
}

/** The browser's localStorage, or null where it cannot be reached at all. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    // Some browsers only throw on use, so prove it works before trusting it.
    const probe = `${SAVE.key}/probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function createSaveStore(storage: StorageLike | null, key: string = SAVE.key): SaveStore {
  let data: SaveData;
  try {
    data = parseSave(storage?.getItem(key) ?? null);
  } catch {
    // Reading can throw too, not just writing.
    data = defaultSave();
  }

  let persisted = storage !== null;

  const write = (): void => {
    if (storage === null) return;
    try {
      storage.setItem(key, JSON.stringify(data));
      persisted = true;
    } catch {
      // Out of space, or private browsing. The run carries on either way;
      // the score simply will not be there next time.
      persisted = false;
    }
  };

  return {
    get data() {
      return data;
    },
    get persisted() {
      return persisted;
    },
    update(changes: Partial<SaveData>) {
      data = { ...data, ...changes };
      write();
      return data;
    },
    finishRun(score: number, coins: number) {
      const best = Math.max(data.bestScore, wholeNumber(score, 0));
      const total = data.totalCoins + wholeNumber(coins, 0);
      data = { ...data, bestScore: best, totalCoins: total };
      write();
      return data;
    },
  };
}
