/**
 * Seeded random number generator.
 *
 * All gameplay randomness must go through this so a run can be reproduced
 * exactly from its seed (CLAUDE.md rule 6). Never call Math.random() in src/game/.
 *
 * Algorithm: mulberry32 — small, fast, and good enough for a game.
 */

/** A deterministic random source. */
export interface Rng {
  /** The seed this generator was created with. */
  readonly seed: number;
  /** Next float in [0, 1). */
  next(): number;
  /** Next float in [min, max). */
  range(min: number, max: number): number;
  /** Next integer in [min, max] (both ends included). */
  int(min: number, max: number): number;
  /** True with the given probability (0 = never, 1 = always). */
  chance(probability: number): boolean;
  /** A random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** A copy of the array in random order (Fisher-Yates, does not mutate the input). */
  shuffle<T>(items: readonly T[]): T[];
  /** How many numbers have been drawn so far — lets a run be saved and resumed. */
  readonly calls: number;
}

/** Forces a seed into an unsigned 32-bit integer, so any number is usable. */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return Math.trunc(seed) >>> 0;
}

/** Creates a seeded generator. The same seed always produces the same sequence. */
export function createRng(seed: number): Rng {
  let state = normalizeSeed(seed);
  const initialSeed = state;
  let calls = 0;

  const next = (): number => {
    calls += 1;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    get seed() {
      return initialSeed;
    },
    get calls() {
      return calls;
    },
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      if (hi < lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(probability) {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('rng.pick: cannot pick from an empty array');
      }
      // Safe: index is within bounds, so the element exists.
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const a = out[i] as T;
        const b = out[j] as T;
        out[i] = b;
        out[j] = a;
      }
      return out;
    },
  };
}

/** A fresh seed for a new run, from the clock. Only for starting a run, never in logic. */
export function randomSeed(): number {
  return normalizeSeed(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
}
