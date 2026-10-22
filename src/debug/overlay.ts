/**
 * Minimal debug overlay, shown with `?debug=1`.
 *
 * It reports frame rate, the run clock, speed and what the player is doing.
 * The full overlay from SPEC 13 (hitboxes, sliders, power-up keys) arrives in M8.
 */

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
}

export interface DebugOverlay {
  readonly enabled: boolean;
  /** Called once per rendered frame. */
  update(frameSeconds: number, info: DebugInfo): void;
}

export function isDebugEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

export function createDebugOverlay(element: HTMLElement, enabled: boolean): DebugOverlay {
  if (!enabled) {
    return { enabled: false, update() {} };
  }

  element.classList.add('visible');

  // Smoothed fps, so the number is readable instead of flickering.
  let fps = 60;
  let sinceRefresh = 0;

  return {
    enabled: true,
    update(frameSeconds, info) {
      if (frameSeconds > 0) {
        fps += (1 / frameSeconds - fps) * 0.1;
      }
      sinceRefresh += frameSeconds;
      if (sinceRefresh < 0.1) return;
      sinceRefresh = 0;
      element.textContent = [
        `fps   ${fps.toFixed(0)}`,
        `time  ${info.elapsed.toFixed(1)}s`,
        `speed ${info.speed.toFixed(1)} u/s`,
        `lane  ${info.lane}`,
        `state ${info.phase === 'dead' ? 'dead' : info.paused ? 'paused' : info.vertical}`,
        `tier  ${info.tier}`,
        `trips ${info.stumbles}`,
        `chunk ${info.chunk ?? '-'}`,
        `power ${info.powerUps === '' ? '-' : info.powerUps}`,
        `pick  ${info.pickup}`,
        `ticks ${info.ticks}`,
        `seed  ${info.seed}`,
      ].join('\n');
    },
  };
}
