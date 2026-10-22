/**
 * Minimal debug overlay, shown with `?debug=1`.
 *
 * M0 only reports frame rate, simulated time and the run seed. The full
 * overlay from SPEC 13 (hitboxes, sliders, power-up keys) arrives in M8.
 */

export interface DebugOverlay {
  readonly enabled: boolean;
  /** Called once per rendered frame. */
  update(frameSeconds: number, info: { elapsed: number; seed: number; ticks: number }): void;
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
        `ticks ${info.ticks}`,
        `seed  ${info.seed}`,
      ].join('\n');
    },
  };
}
