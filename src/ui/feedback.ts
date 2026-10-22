/**
 * Telling the player, in their hands and in their eyes, that they were hit.
 *
 * Two parts, because neither works everywhere:
 *
 *  - **Vibration** through the Vibration API. Android browsers support it;
 *    Safari on iOS never has, and every browser on an iPhone is Safari
 *    underneath, so on an iPhone this quietly does nothing.
 *  - **A flash** across the edges of the screen, which works everywhere and is
 *    what an iPhone player actually gets. The camera shake from SPEC 7 is the
 *    third part of the same feedback and lives in the render layer.
 *
 * Sound joins them in M7, and the mute setting from SPEC 10 will switch all of
 * this off together.
 */

import { FEEDBACK } from '../config';

export type FeedbackEvent = 'stumble' | 'death';

export interface Feedback {
  /** True if this device can actually vibrate. False on every iPhone. */
  readonly canVibrate: boolean;
  /** Plays the feedback for an event. */
  play(event: FeedbackEvent): void;
  /** Turns vibration and flashing off or on; the mute setting uses this. */
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;
}

/**
 * Asks the device to vibrate, if it can.
 *
 * Browsers also refuse to vibrate before the player has interacted with the
 * page, and some refuse while the tab is hidden. Both throw rather than
 * returning false in some browsers, so the call is wrapped.
 */
function vibrate(pattern: readonly number[]): void {
  try {
    navigator.vibrate?.([...pattern]);
  } catch {
    // A refused vibration is never worth interrupting the game for.
  }
}

export function createFeedback(flashElement: HTMLElement | null): Feedback {
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  let enabled = true;
  let flashTimer: number | undefined;

  const flash = (event: FeedbackEvent): void => {
    if (flashElement === null) return;
    // Restart the animation even if one is already running.
    flashElement.classList.remove('stumble', 'death');
    // Reading offsetWidth forces the browser to notice the class went away,
    // so re-adding it starts the animation from the beginning.
    void flashElement.offsetWidth;
    flashElement.classList.add(event);

    if (flashTimer !== undefined) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashElement.classList.remove('stumble', 'death');
      flashTimer = undefined;
    }, FEEDBACK.flashTime * 1000);
  };

  return {
    canVibrate,
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      enabled = next;
      if (!next) vibrate([0]);
    },
    play(event: FeedbackEvent) {
      if (!enabled) return;
      vibrate(FEEDBACK.vibration[event]);
      flash(event);
    },
  };
}
