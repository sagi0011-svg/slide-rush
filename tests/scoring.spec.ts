import { describe, expect, it } from 'vitest';
import { COINS, LANES, SCORING, SIM } from '../src/config';
import {
  addCoin,
  addDistance,
  createScore,
  displayScore,
  multiplierFor,
  resetMultiplier,
  updateMultiplier,
} from '../src/game/scoring';
import { coinCollected, createCoinPool, placeCoin } from '../src/game/coins';
import type { Coin, PooledCoin } from '../src/game/coins';

const DT = SIM.dt;

describe('the multiplier (SPEC 10)', () => {
  it('starts at x1', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(createScore().multiplier).toBe(1);
  });

  it('climbs a step every 30 clean seconds', () => {
    expect(multiplierFor(29.9)).toBe(1);
    expect(multiplierFor(30)).toBe(2);
    expect(multiplierFor(60)).toBe(3);
    expect(multiplierFor(90)).toBe(4);
    expect(multiplierFor(120)).toBe(5);
  });

  it('stops at x5', () => {
    expect(multiplierFor(150)).toBe(SCORING.multiplierMax);
    expect(multiplierFor(10_000)).toBe(SCORING.multiplierMax);
  });

  it('never goes backwards as time passes', () => {
    let previous = multiplierFor(0);
    for (let t = 0; t < 300; t += 1) {
      const now = multiplierFor(t);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('counts from the run start', () => {
    const score = createScore();
    updateMultiplier(score, 45);
    expect(score.multiplier).toBe(2);
  });

  it('is knocked back to x1 by a stumble, and climbs again from there', () => {
    const score = createScore();
    updateMultiplier(score, 65);
    expect(score.multiplier).toBe(3);

    resetMultiplier(score, 65);
    expect(score.multiplier).toBe(1);

    // 20 seconds later is still not enough for the next step.
    updateMultiplier(score, 85);
    expect(score.multiplier).toBe(1);

    // 30 seconds after the stumble it does.
    updateMultiplier(score, 95);
    expect(score.multiplier).toBe(2);
  });
});

describe('earning points (SPEC 8 and 10)', () => {
  it('gives a point per unit travelled', () => {
    const score = createScore();
    addDistance(score, 100);
    expect(score.points).toBe(100 * SCORING.pointsPerUnit);
  });

  it('multiplies the distance points', () => {
    const score = createScore();
    score.multiplier = 3;
    addDistance(score, 100);
    expect(score.points).toBe(300);
  });

  it('ignores standing still or going backwards', () => {
    const score = createScore();
    addDistance(score, 0);
    addDistance(score, -50);
    expect(score.points).toBe(0);
  });

  it('gives 10 points and one coin per coin', () => {
    const score = createScore();
    addCoin(score);
    expect(score.points).toBe(SCORING.pointsPerCoin);
    expect(score.coins).toBe(1);
  });

  it('multiplies coin points but never the coin count', () => {
    const score = createScore();
    score.multiplier = 4;
    addCoin(score);
    addCoin(score);
    expect(score.points).toBe(SCORING.pointsPerCoin * 4 * 2);
    expect(score.coins).toBe(2);
  });

  it('shows a whole number', () => {
    const score = createScore();
    addDistance(score, 12.7);
    expect(displayScore(score)).toBe(12);
    expect(Number.isInteger(displayScore(score))).toBe(true);
  });
});

describe('collecting coins (SPEC 8)', () => {
  const coin = (lane: number, s: number, y: number = COINS.restHeight): Coin => ({
    x: lane * LANES.width,
    s,
    y,
  });

  it('picks up a coin the player runs through', () => {
    expect(coinCollected(0, COINS.restHeight, 19.8, 20.1, coin(0, 20))).toBe(true);
  });

  it('leaves a coin in another lane', () => {
    expect(coinCollected(0, COINS.restHeight, 19.8, 20.1, coin(1, 20))).toBe(false);
    expect(coinCollected(0, COINS.restHeight, 19.8, 20.1, coin(-1, 20))).toBe(false);
  });

  it('leaves a coin far above the player', () => {
    expect(coinCollected(0, 0.8, 19.8, 20.1, coin(0, 20, 4))).toBe(false);
  });

  it('picks up a high coin when the player jumps to it', () => {
    const high = coin(0, 20, 2.2);
    expect(coinCollected(0, 0.8, 19.8, 20.1, high)).toBe(false);
    // Mid-jump, with the body centre up near the coin.
    expect(coinCollected(0, 2.4, 19.8, 20.1, high)).toBe(true);
  });

  it('respects the pickup radius from the spec', () => {
    // Just inside, then just outside, measured sideways.
    const justInside = COINS.pickupRadius * 0.95;
    const justOutside = COINS.pickupRadius * 1.05;
    expect(coinCollected(justInside, COINS.restHeight, 20, 20, coin(0, 20))).toBe(true);
    expect(coinCollected(justOutside, COINS.restHeight, 20, 20, coin(0, 20))).toBe(false);
  });

  it('cannot be passed through at full speed', () => {
    // The worst case: the fastest the game ever goes, one tick of travel.
    const perTick = 48 * DT;
    for (let offset = 0; offset < 1; offset += 0.05) {
      const from = 20 - offset;
      const to = from + perTick;
      const passed = from <= 20 && to >= 20;
      if (!passed) continue;
      expect(
        coinCollected(0, COINS.restHeight, from, to, coin(0, 20)),
        `missed a coin while travelling ${from.toFixed(2)} to ${to.toFixed(2)}`,
      ).toBe(true);
    }
  });

  it('collects every coin in a line as the player runs down it', () => {
    const coins = [20, 22.5, 25, 27.5, 30].map((s) => coin(0, s));
    const collected = new Set<number>();
    let previous = 15;
    for (let i = 0; i < 300; i += 1) {
      const current = previous + 32 * DT;
      for (const c of coins) {
        if (coinCollected(0, COINS.restHeight, previous, current, c)) collected.add(c.s);
      }
      previous = current;
      if (previous > 35) break;
    }
    expect(collected.size).toBe(coins.length);
  });

  it('does not collect a coin the player is nowhere near', () => {
    expect(coinCollected(0, COINS.restHeight, 0, 0.5, coin(0, 200))).toBe(false);
  });
});

describe('the coin pool', () => {
  it('starts empty and never changes size (rule 7)', () => {
    const pool = createCoinPool(12);
    expect(pool).toHaveLength(12);
    expect(pool.every((coin) => !coin.active)).toBe(true);
  });

  it('places a coin in the middle of its lane', () => {
    const pool = createCoinPool(1);
    const slot = pool[0] as PooledCoin;
    placeCoin(slot, 1, 20, COINS.restHeight);

    expect(slot.active).toBe(true);
    expect(slot.x).toBe(LANES.width);
    expect(slot.s).toBe(20);
    expect(slot.attracted).toBe(false);
    expect(coinCollected(LANES.width, COINS.restHeight, 20, 20, slot)).toBe(true);
  });
});
