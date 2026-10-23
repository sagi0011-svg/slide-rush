/**
 * Debug overrides (SPEC 13): the speed and difficulty sliders and the
 * invincibility switch from `?debug=1`.
 *
 * They live in the game layer rather than the debug overlay because they
 * change the rules themselves, and rules are tested here (CLAUDE.md rule 4).
 * A normal game never touches them, so every run starts with the defaults:
 * normal speed, the tier the clock says, and obstacles that hurt.
 */

import { DEBUG } from '../config';
import { MAX_TIER } from './difficulty';

export interface DebugTweaks {
  /** Multiplies the normal forward speed. 1 is the game as designed. */
  speedScale: number;
  /** A difficulty tier to hold the run at, or null to follow the clock. */
  tier: number | null;
  /** When true, obstacles are passed straight through. */
  invincible: boolean;
}

/** The game as designed: nothing overridden. */
export function createDebugTweaks(): DebugTweaks {
  return { speedScale: 1, tier: null, invincible: false };
}

/** Sets the speed multiplier, kept inside the slider's range. */
export function setSpeedScale(tweaks: DebugTweaks, value: number): void {
  if (!Number.isFinite(value)) return;
  tweaks.speedScale = Math.min(Math.max(value, DEBUG.speedScaleMin), DEBUG.speedScaleMax);
}

/** Holds the run at a tier, or hands it back to the clock with null. */
export function setTierOverride(tweaks: DebugTweaks, tier: number | null): void {
  if (tier === null || !Number.isFinite(tier)) {
    tweaks.tier = null;
    return;
  }
  tweaks.tier = Math.min(Math.max(Math.round(tier), 0), MAX_TIER);
}

/** The tier a run should use: the override if there is one, else the clock's. */
export function debugTier(tweaks: DebugTweaks, clockTier: number): number {
  return tweaks.tier ?? clockTier;
}
