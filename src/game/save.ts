/**
 * What survives between runs (SPEC 10).
 *
 * Best score, every coin ever collected and not yet spent, whether the
 * tutorial has been seen, whether sound is muted, whether the shake and
 * flash of a hit are turned off, which animals and rings have been bought in
 * the shop, and which pair the player rides (docs/ART-AND-SHOP.md §2 and §3).
 *
 * The storage itself is handed in rather than reached for, so the rules can be
 * tested without a browser. Nothing here may ever throw: private browsing,
 * a full disk or a blocked cookie setting all make localStorage fail, and a
 * game that cannot remember your best score should still be playable.
 */

import { SAVE } from '../config';
import { createShopState, ITEM_KINDS, ownedList, type ItemKind, type ShopState } from './shop';

export interface SaveData {
  /** Highest score ever reached. */
  bestScore: number;
  /**
   * The coins in hand: every coin collected across every run, less everything
   * spent in the shop (§3).
   */
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
  /**
   * What has been bought in the shop (§3). The free starters are always in
   * here, so a fresh save already owns a frog and a tube; ids this build does
   * not sell are dropped on the way in.
   */
  ownedAnimals: string[];
  ownedRings: string[];
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
    ownedAnimals: ownedList('animal', null),
    ownedRings: ownedList('ring', null),
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
    ownedAnimals: ownedList('animal', data['ownedAnimals']),
    ownedRings: ownedList('ring', data['ownedRings']),
  };
}

/** Which save field holds the owned list of each kind. */
const OWNED_FIELD: Readonly<Record<ItemKind, 'ownedAnimals' | 'ownedRings'>> = {
  animal: 'ownedAnimals',
  ring: 'ownedRings',
};

/**
 * The save as the shop sees it (src/game/shop.ts): coins, owned, equipped.
 *
 * This is also where the last of §3's save rules is kept: an equipped id that
 * is not owned — a save from a newer version naming a ring this build has
 * never heard of, or one edited by hand — falls back to the free starter, so
 * what the player sees is always something they actually own. The save itself
 * keeps the unknown id until something is bought or equipped, which costs
 * nothing and means a newer version finds its ring still there.
 */
export function shopStateOf(data: SaveData): ShopState {
  return createShopState({
    coins: data.totalCoins,
    owned: { animal: data.ownedAnimals, ring: data.ownedRings },
    equipped: { animal: data.equippedAnimal, ring: data.equippedRing },
  });
}

/** The save fields a shop state covers, ready for `update`. */
export function shopChanges(state: ShopState): Partial<SaveData> {
  const changes: Partial<SaveData> = { totalCoins: state.coins };
  for (const kind of ITEM_KINDS) {
    changes[OWNED_FIELD[kind]] = [...state.owned[kind]];
  }
  changes.equippedAnimal = state.equipped.animal;
  changes.equippedRing = state.equipped.ring;
  return changes;
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
