/**
 * The debug overlay, shown with `?debug=1` (SPEC 13).
 *
 * It reports frame rate, the run clock, speed, tier, seed and what the player
 * is doing, and carries the controls: a speed slider, a difficulty slider and
 * switches for invincibility and hitboxes. The controls only report what was
 * asked for; what that does to a run lives in src/game/debug-tweaks.ts.
 *
 * The control labels come from src/ui/strings.ts like every other piece of
 * UI text (CLAUDE.md rule 9). The readout's short labels are part of its
 * column layout and stay here.
 */

import { DEBUG } from '../config';
import { MAX_TIER } from '../game/difficulty';
import { STRINGS } from '../ui/strings';

export interface DebugInfo {
  elapsed: number;
  seed: number;
  ticks: number;
  speed: number;
  lane: number;
  vertical: string;
  paused: boolean;
  tier: number;
  stumbles: number;
  phase: string;
  chunk: string | null;
  powerUps: string;
  /** What the one power-up pickup is doing right now (SPEC 9). */
  pickup: string;
  /** Draw calls and triangles in the last frame, and the resolution used. */
  drawCalls: number;
  pixelRatio: number;
  triangles: number;
  /**
   * How many pixels the 3D scene was actually drawn at, and how many screen
   * pixels wide one of them is (docs/ART-AND-SHOP.md section 1). This is the
   * number the retro pass exists to bring down, so it is worth seeing.
   */
  gamePixels: number;
  pixelScale: number;
}

/** What the controls are set to. */
export interface DebugSettings {
  speedScale: number;
  /** A tier to hold, or null to follow the clock. */
  tier: number | null;
  invincible: boolean;
  hitboxes: boolean;
}

export interface DebugControls {
  onSpeedScale(value: number): void;
  onTier(tier: number | null): void;
  onInvincible(on: boolean): void;
  onHitboxes(on: boolean): void;
}

export interface DebugOverlay {
  readonly enabled: boolean;
  /**
   * Called once per rendered frame. `fill` is only asked for the numbers when
   * the panel is about to show them, a few times a second, so the strings it
   * builds are not made sixty times a second (CLAUDE.md rule 7).
   */
  update(frameSeconds: number, fill: (info: DebugInfo) => void): void;
  /** Moves the controls to match, after a key changed something. */
  sync(settings: DebugSettings): void;
}

export function isDebugEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** The difficulty slider runs from -1, meaning "follow the clock", to the top tier. */
const AUTO_TIER = -1;

function tierLabel(tier: number | null): string {
  return tier === null ? STRINGS.debug.auto : String(tier);
}

export function createDebugOverlay(
  element: HTMLElement,
  enabled: boolean,
  controls?: DebugControls,
): DebugOverlay {
  if (!enabled) {
    return { enabled: false, update() {}, sync() {} };
  }

  element.classList.add('visible');
  element.textContent = '';

  const stats = document.createElement('pre');
  element.appendChild(stats);

  // --- Controls --------------------------------------------------------------
  // A native fold, so the controls can be put away on a small screen.
  const fold = document.createElement('details');
  fold.open = true;
  const summary = document.createElement('summary');
  summary.textContent = STRINGS.debug.controls;
  const panel = document.createElement('div');
  panel.className = 'controls';
  fold.append(summary, panel);
  element.appendChild(fold);

  // Arrow keys on a focused slider must move the slider, not the player.
  fold.addEventListener('keydown', (event) => event.stopPropagation());

  const slider = (min: number, max: number, step: number): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    return input;
  };
  const checkbox = (): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    return input;
  };
  const row = (text: string, input: HTMLInputElement, value?: HTMLElement): void => {
    const label = document.createElement('label');
    label.append(text, input);
    if (value !== undefined) label.append(value);
    panel.appendChild(label);
  };

  const speedInput = slider(DEBUG.speedScaleMin, DEBUG.speedScaleMax, DEBUG.speedScaleStep);
  const speedValue = document.createElement('span');
  row(STRINGS.debug.speed, speedInput, speedValue);

  const tierInput = slider(AUTO_TIER, MAX_TIER, 1);
  const tierValue = document.createElement('span');
  row(STRINGS.debug.tier, tierInput, tierValue);

  const invincibleInput = checkbox();
  row(STRINGS.debug.invincible, invincibleInput);

  const hitboxInput = checkbox();
  row(STRINGS.debug.hitboxes, hitboxInput);

  const keys = document.createElement('div');
  keys.className = 'keys';
  keys.textContent = STRINGS.debug.keys;
  panel.appendChild(keys);

  speedInput.addEventListener('input', () => {
    const value = Number(speedInput.value);
    speedValue.textContent = `×${value.toFixed(2)}`;
    controls?.onSpeedScale(value);
  });
  tierInput.addEventListener('input', () => {
    const value = Number(tierInput.value);
    const tier = value === AUTO_TIER ? null : value;
    tierValue.textContent = tierLabel(tier);
    controls?.onTier(tier);
  });
  invincibleInput.addEventListener('change', () => controls?.onInvincible(invincibleInput.checked));
  hitboxInput.addEventListener('change', () => controls?.onHitboxes(hitboxInput.checked));

  // --- Numbers ---------------------------------------------------------------
  // Smoothed fps, so the number is readable instead of flickering.
  let fps = 60;
  // The slowest frame since the last refresh: a hitch hides inside an average.
  let worstFrame = 0;
  let sinceRefresh = 0;
  const info: DebugInfo = {
    elapsed: 0,
    seed: 0,
    ticks: 0,
    speed: 0,
    lane: 0,
    vertical: '',
    paused: false,
    tier: 0,
    stumbles: 0,
    phase: '',
    chunk: null,
    powerUps: '',
    pickup: '',
    drawCalls: 0,
    pixelRatio: 1,
    triangles: 0,
    gamePixels: 0,
    pixelScale: 1,
  };

  return {
    enabled: true,

    sync(settings) {
      speedInput.value = String(settings.speedScale);
      speedValue.textContent = `×${settings.speedScale.toFixed(2)}`;
      tierInput.value = String(settings.tier ?? AUTO_TIER);
      tierValue.textContent = tierLabel(settings.tier);
      invincibleInput.checked = settings.invincible;
      hitboxInput.checked = settings.hitboxes;
    },

    update(frameSeconds, fill) {
      if (frameSeconds > 0) {
        fps += (1 / frameSeconds - fps) * 0.1;
      }
      // A frame longer than this is the tab coming back, not a hitch.
      if (frameSeconds < 0.5) worstFrame = Math.max(worstFrame, frameSeconds);
      sinceRefresh += frameSeconds;
      if (sinceRefresh < 0.25) return;
      sinceRefresh = 0;
      fill(info);
      stats.textContent = [
        `fps   ${fps.toFixed(0)} (worst ${(worstFrame * 1000).toFixed(0)}ms)`,
        `draw  ${info.drawCalls} calls, ${(info.triangles / 1000).toFixed(1)}k tris, ${info.pixelRatio}x`,
        `pix   ${(info.gamePixels / 1000).toFixed(0)}k game px @ ${info.pixelScale}:1`,
        `time  ${info.elapsed.toFixed(1)}s`,
        `speed ${info.speed.toFixed(1)} u/s`,
        `lane  ${info.lane}`,
        `state ${info.phase} ${info.paused ? 'paused' : info.vertical}`,
        `tier  ${info.tier}`,
        `trips ${info.stumbles}`,
        `chunk ${info.chunk ?? '-'}`,
        `power ${info.powerUps === '' ? '-' : info.powerUps}`,
        `pick  ${info.pickup}`,
        `ticks ${info.ticks}`,
        `seed  ${info.seed}`,
      ].join('\n');
      worstFrame = 0;
    },
  };
}
