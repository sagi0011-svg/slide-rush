import { describe, expect, it } from 'vitest';
import { createRng, normalizeSeed, randomSeed } from '../src/game/rng';

describe('createRng', () => {
  it('is deterministic: the same seed gives the same sequence', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, (_, i) => createRng(i).next());
    expect(new Set(a).size).toBe(a.length);
  });

  it('keeps next() inside [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('reports its seed and how many numbers it has drawn', () => {
    const rng = createRng(99);
    expect(rng.seed).toBe(99);
    expect(rng.calls).toBe(0);
    rng.next();
    rng.next();
    expect(rng.calls).toBe(2);
    expect(rng.seed).toBe(99);
  });

  describe('range', () => {
    it('stays inside [min, max)', () => {
      const rng = createRng(1);
      for (let i = 0; i < 2000; i += 1) {
        const v = rng.range(-5, 12.5);
        expect(v).toBeGreaterThanOrEqual(-5);
        expect(v).toBeLessThan(12.5);
      }
    });

    it('returns min when min and max are equal', () => {
      expect(createRng(3).range(4, 4)).toBe(4);
    });
  });

  describe('int', () => {
    it('includes both ends and never goes outside them', () => {
      const rng = createRng(2024);
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i += 1) {
        const v = rng.int(1, 6);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
        seen.add(v);
      }
      expect([...seen].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('handles a single-value range', () => {
      expect(createRng(5).int(3, 3)).toBe(3);
    });

    it('handles a reversed range without crashing', () => {
      expect(createRng(5).int(9, 2)).toBe(9);
    });
  });

  describe('chance', () => {
    it('never fires at 0 and always fires at 1', () => {
      const rng = createRng(11);
      for (let i = 0; i < 100; i += 1) {
        expect(rng.chance(0)).toBe(false);
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('fires roughly as often as asked', () => {
      const rng = createRng(42);
      let hits = 0;
      const rolls = 20000;
      for (let i = 0; i < rolls; i += 1) {
        if (rng.chance(0.25)) hits += 1;
      }
      expect(hits / rolls).toBeGreaterThan(0.23);
      expect(hits / rolls).toBeLessThan(0.27);
    });
  });

  describe('pick', () => {
    it('only returns elements of the array', () => {
      const rng = createRng(8);
      const items = ['a', 'b', 'c'] as const;
      const seen = new Set<string>();
      for (let i = 0; i < 500; i += 1) {
        const v = rng.pick(items);
        expect(items).toContain(v);
        seen.add(v);
      }
      expect(seen.size).toBe(3);
    });

    it('throws on an empty array instead of returning undefined', () => {
      expect(() => createRng(1).pick([])).toThrow(/empty/);
    });
  });

  describe('shuffle', () => {
    it('keeps every element and does not mutate the input', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const rng = createRng(77);
      const out = rng.shuffle(input);
      expect(out).toHaveLength(input.length);
      expect([...out].sort((a, b) => a - b)).toEqual(input);
      expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('is deterministic for a given seed', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      expect(createRng(5).shuffle(input)).toEqual(createRng(5).shuffle(input));
    });

    it('actually reorders', () => {
      const input = Array.from({ length: 30 }, (_, i) => i);
      expect(createRng(123).shuffle(input)).not.toEqual(input);
    });
  });
});

describe('normalizeSeed', () => {
  it('turns any number into an unsigned 32-bit integer', () => {
    expect(normalizeSeed(0)).toBe(0);
    expect(normalizeSeed(7.9)).toBe(7);
    expect(normalizeSeed(-1)).toBe(0xffffffff);
    expect(normalizeSeed(Number.NaN)).toBe(0);
    expect(normalizeSeed(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('makes equivalent seeds produce the same sequence', () => {
    expect(createRng(7.9).next()).toBe(createRng(7).next());
  });
});

describe('randomSeed', () => {
  it('returns a usable unsigned 32-bit seed', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
    expect(createRng(seed).next()).toBe(createRng(seed).next());
  });
});
