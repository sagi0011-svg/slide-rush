/**
 * Score and multiplier (SPEC 10).
 *
 * Distance earns a point per unit, coins earn ten each, and both are
 * multiplied. The multiplier climbs one step for every 30 seconds without a
 * stumble, up to x5, and a stumble knocks it back to x1.
 */

import { SCORING } from '../config';

export interface Score {
  /** Points so far, as a running total. */
  points: number;
  /** Coins picked up in this run. */
  coins: number;
  /** The multiplier right now, 1..5. */
  multiplier: number;
  /**
   * The moment the multiplier last started climbing from x1, in run seconds:
   * the start of the run, or the last stumble.
   */
  multiplierSince: number;
}

export function createScore(): Score {
  return {
    points: 0,
    coins: 0,
    multiplier: SCORING.multiplierStart,
    multiplierSince: 0,
  };
}

/**
 * The multiplier after this long without a stumble (SPEC 10).
 *
 * @param secondsClean seconds since the run started or since the last stumble
 */
export function multiplierFor(secondsClean: number): number {
  if (secondsClean <= 0) return SCORING.multiplierStart;
  const steps = Math.floor(secondsClean / SCORING.multiplierStepTime);
  return Math.min(SCORING.multiplierStart + steps, SCORING.multiplierMax);
}

/** Brings the multiplier up to date for the current run time. */
export function updateMultiplier(score: Score, elapsed: number): void {
  score.multiplier = multiplierFor(elapsed - score.multiplierSince);
}

/**
 * Adds the points for travelling a distance (SPEC 10).
 *
 * @param distance units travelled since the last call
 */
export function addDistance(score: Score, distance: number): void {
  if (distance <= 0) return;
  score.points += distance * SCORING.pointsPerUnit * score.multiplier;
}

/** Adds a collected coin: points, and one on the run's coin count (SPEC 8). */
export function addCoin(score: Score): void {
  score.points += SCORING.pointsPerCoin * score.multiplier;
  score.coins += 1;
}

/**
 * Knocks the multiplier back to x1 after a stumble (SPEC 10).
 *
 * A shield absorbing a hit must not call this (SPEC 9, M4).
 */
export function resetMultiplier(score: Score, elapsed: number): void {
  score.multiplier = SCORING.multiplierStart;
  score.multiplierSince = elapsed;
}

/** The score as it is shown to the player: a whole number. */
export function displayScore(score: Score): number {
  return Math.floor(score.points);
}
