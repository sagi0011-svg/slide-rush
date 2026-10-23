/**
 * Turning what the run did into what the player hears (SPEC 12).
 *
 * The run itself knows nothing about sound. It only counts things that
 * happened — coins, jumps, slides, lane changes, stumbles, shield pops,
 * power-ups granted and power-ups run out — and all of those counters only
 * ever climb. Comparing them with the last frame says exactly what to play,
 * which keeps every rule in src/game/ free of the audio layer (CLAUDE.md
 * rule 4) and makes this testable without a browser.
 */

import { AUDIO } from '../config';
import type { RunState } from '../game/state';
import type { SfxName } from './sounds';

interface Counters {
  coins: number;
  jumps: number;
  slides: number;
  laneChanges: number;
  stumbles: number;
  shieldPops: number;
  grants: number;
  expiries: number;
  dead: boolean;
}

function read(state: RunState): Counters {
  return {
    coins: state.score.coins,
    jumps: state.player.jumps,
    slides: state.player.slides,
    laneChanges: state.player.laneChanges,
    stumbles: state.stumbles,
    shieldPops: state.shieldPops,
    grants: state.powerUps.grants,
    expiries: state.powerUps.expiries,
    dead: state.phase === 'dead',
  };
}

/**
 * True when the run being watched is not the one that was watched before — a
 * restart, whose counters all begin again at zero. A fresh run must start in
 * silence, not with every sound of the old one at once.
 */
function isFreshRun(now: Counters, last: Counters): boolean {
  return (
    now.coins < last.coins ||
    now.jumps < last.jumps ||
    now.slides < last.slides ||
    now.laneChanges < last.laneChanges ||
    now.stumbles < last.stumbles ||
    now.shieldPops < last.shieldPops ||
    now.grants < last.grants ||
    now.expiries < last.expiries ||
    (last.dead && !now.dead)
  );
}

export interface RunSoundWatcher {
  /** Takes the run as it stands now as the baseline, without making a sound. */
  reset(state: RunState): void;
  /**
   * Appends every sound the run has earned since the last call to `out`.
   *
   * `out` is handed in and reused rather than returned fresh, so watching a
   * run costs no allocations per frame (CLAUDE.md rule 7).
   */
  drain(state: RunState, out: SfxName[]): void;
}

export function createRunSoundWatcher(state?: RunState): RunSoundWatcher {
  let last: Counters | null = state === undefined ? null : read(state);

  return {
    reset(next) {
      last = read(next);
    },

    drain(next, out) {
      const now = read(next);
      if (last === null || isFreshRun(now, last)) {
        last = now;
        return;
      }

      // One sound per kind of thing, however many times it happened: two lane
      // changes inside a single frame are still one swish.
      if (now.laneChanges > last.laneChanges) out.push('lane');
      if (now.jumps > last.jumps) out.push('jump');
      if (now.slides > last.slides) out.push('slide');

      // Coins are the exception: a magnet can sweep up a whole trail at once,
      // and hearing a few of them is what makes it feel good. Only a few,
      // though — all of them at once is a noise, not a sound.
      const coins = Math.min(now.coins - last.coins, AUDIO.maxCoinsPerFrame);
      for (let i = 0; i < coins; i += 1) out.push('coin');

      if (now.grants > last.grants) out.push('powerUp');
      if (now.expiries > last.expiries) out.push('powerUpEnd');
      if (now.shieldPops > last.shieldPops) out.push('shieldPop');
      if (now.stumbles > last.stumbles) out.push('stumble');
      // Death last, so it lands on top of whatever the player was doing.
      if (now.dead && !last.dead) out.push('death');

      last = now;
    },
  };
}
