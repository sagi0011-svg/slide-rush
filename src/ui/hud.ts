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
import { POWERUP_TYPES, type PowerUpType } from '../game/powerups';

export interface HudValues {
  score: number;
  coins: number;
  multiplier: number;
  bestScore: number;
  /** How much is left of each power-up, 0..1. Zero means it is not running. */
  powerUps: Readonly<Record<PowerUpType, number>>;
  /** False while a screen is up, which hides the HUD behind it (SPEC 11). */
  visible: boolean;
}

export interface Hud {
  update(values: HudValues): void;
}

/** Groups digits so a long score stays readable: 12345 -> 12,345. */
function formatNumber(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

/**
 * Whether a power-up's row on the HUD has to be redrawn.
 *
 * A bar that is running down changes by a fraction of a percent each frame,
 * which nobody can see, so most frames are skipped. The one thing that must
 * never be skipped is the row appearing or disappearing: a timer reaches zero
 * in steps far smaller than that threshold, so without this a power-up that
 * simply ran out would be left on screen for the rest of the run, showing a
 * sliver of bar that never moves again.
 *
 * @param next how much is left now, 0..1
 * @param previous what the row was last drawn with, or -1 if never
 */
export function powerUpRowNeedsUpdate(next: number, previous: number): boolean {
  // Appearing or vanishing always counts, however small the change.
  if (next > 0 !== previous > 0) return true;
  // A hundredth of the bar is far below what anyone can see.
  return Math.abs(next - previous) >= 0.01;
}

/** One row of the power-up rail: a coloured dot, a label and a shrinking bar. */
interface PowerUpRow {
  row: HTMLElement;
  fill: HTMLElement;
}

function buildPowerUpRow(type: PowerUpType): PowerUpRow {
  const row = document.createElement('div');
  row.className = 'powerup';
  row.dataset['type'] = type;
  row.hidden = true;

  const dot = document.createElement('span');
  dot.className = 'dot';

  const label = document.createElement('span');
  label.textContent = STRINGS.powerUps[type];

  const bar = document.createElement('span');
  bar.className = 'bar';
  const fill = document.createElement('span');
  bar.appendChild(fill);

  row.append(dot, label, bar);
  return { row, fill };
}

export function createHud(root: HTMLElement): Hud {
  const score = root.querySelector<HTMLElement>('[data-hud="score"]');
  const best = root.querySelector<HTMLElement>('[data-hud="best"]');
  const coins = root.querySelector<HTMLElement>('[data-hud="coins"]');
  const multiplier = root.querySelector<HTMLElement>('[data-hud="multiplier"]');
  const hudBar = root.querySelector<HTMLElement>('#hud');

  // The power-up rail is built once, then only shown and hidden (rule 7).
  const powerUpRail = root.querySelector<HTMLElement>('[data-hud="powerups"]');
  const powerUpRows = new Map<PowerUpType, PowerUpRow>();
  if (powerUpRail !== null) {
    for (const type of POWERUP_TYPES) {
      const built = buildPowerUpRow(type);
      powerUpRail.appendChild(built.row);
      powerUpRows.set(type, built);
    }
  }
  const lastPowerUps = new Map<PowerUpType, number>();

  // Only touch the DOM when something actually changed: writing text every
  // frame forces the browser to lay the page out again (SPEC 13).
  let lastScore = -1;
  let lastCoins = -1;
  let lastMultiplier = -1;
  let lastBest = -1;
  let lastVisible: boolean | null = null;

  return {
    update(values) {
      if (values.visible !== lastVisible) {
        lastVisible = values.visible;
        if (hudBar !== null) hudBar.hidden = !values.visible;
        for (const row of powerUpRows.values()) {
          // Hidden rows stay hidden; the rest follow the HUD.
          if (!values.visible) row.row.hidden = true;
        }
        // Force the rows to be reconsidered next time the HUD comes back.
        if (!values.visible) lastPowerUps.clear();
      }
      if (!values.visible) return;

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

      for (const [type, row] of powerUpRows) {
        const left = values.powerUps[type];
        if (!powerUpRowNeedsUpdate(left, lastPowerUps.get(type) ?? -1)) continue;
        lastPowerUps.set(type, left);

        row.row.hidden = left <= 0;
        if (left > 0) row.fill.style.transform = `scaleX(${left})`;
      }
    },
  };
}
