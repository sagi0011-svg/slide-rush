/**
 * The in-game HUD (SPEC 11).
 *
 * Score, coins and the multiplier, plus the best score so the player can see
 * what they are chasing. Kept simple for M3; M6 gives it the pause button and
 * the full polish, and M4 adds the power-up timers.
 *
 * Every string comes from src/ui/strings.ts (CLAUDE.md rule 9).
 */

import { STRINGS } from './strings';

export interface HudValues {
  score: number;
  coins: number;
  multiplier: number;
  bestScore: number;
  /** Shown instead of the score when the run is over or paused. */
  status: 'running' | 'paused' | 'dead';
}

export interface Hud {
  update(values: HudValues): void;
}

/** Groups digits so a long score stays readable: 12345 -> 12,345. */
function formatNumber(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

export function createHud(root: HTMLElement): Hud {
  const score = root.querySelector<HTMLElement>('[data-hud="score"]');
  const best = root.querySelector<HTMLElement>('[data-hud="best"]');
  const coins = root.querySelector<HTMLElement>('[data-hud="coins"]');
  const multiplier = root.querySelector<HTMLElement>('[data-hud="multiplier"]');
  const status = root.querySelector<HTMLElement>('[data-hud="status"]');

  // Only touch the DOM when something actually changed: writing text every
  // frame forces the browser to lay the page out again (SPEC 13).
  let lastScore = -1;
  let lastCoins = -1;
  let lastMultiplier = -1;
  let lastBest = -1;
  let lastStatus = '';

  return {
    update(values) {
      if (score !== null && values.score !== lastScore) {
        score.textContent = formatNumber(values.score);
        lastScore = values.score;
      }

      if (best !== null && values.bestScore !== lastBest) {
        best.textContent =
          values.bestScore > 0 ? `${STRINGS.best} ${formatNumber(values.bestScore)}` : '';
        lastBest = values.bestScore;
      }

      if (coins !== null && values.coins !== lastCoins) {
        coins.textContent = `${STRINGS.coinSymbol} ${formatNumber(values.coins)}`;
        lastCoins = values.coins;
      }

      if (multiplier !== null && values.multiplier !== lastMultiplier) {
        // x1 is the normal state, so it is not worth saying.
        multiplier.textContent = values.multiplier > 1 ? `x${values.multiplier}` : '';
        lastMultiplier = values.multiplier;
      }

      if (status !== null && values.status !== lastStatus) {
        status.textContent =
          values.status === 'dead'
            ? STRINGS.crashed
            : values.status === 'paused'
              ? STRINGS.paused
              : '';
        lastStatus = values.status;
      }
    },
  };
}
