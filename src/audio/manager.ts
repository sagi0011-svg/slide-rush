/**
 * The sound manager (SPEC 12): everything the game says about sound goes
 * through here.
 *
 * It decides *whether* and *when* a sound happens — is the player still
 * waiting to touch the page, is sound muted, has this effect just played, is a
 * screen up — and hands the actual noise-making to src/audio/engine.ts. That
 * split is on purpose: the engine needs a browser, this does not, so all the
 * rules below are unit-tested.
 *
 * Two browser facts shape it:
 *  - **Nothing may play before the first touch.** Browsers block it and log an
 *    error for every attempt, so no audio context is even built until then —
 *    the same pattern as `unlock()` in src/ui/feedback.ts.
 *  - **Muted means muted.** The setting is saved (SPEC 10), and while it is on
 *    no context is started at all, so a muted game costs the battery nothing.
 */

import { AUDIO } from '../config';
import type { AppPhase } from '../game/flow';
import type { RunState } from '../game/state';
import { createWebAudioEngine, type SoundEngine } from './engine';
import { createRunSoundWatcher } from './events';
import { SFX_NAMES, type SfxName } from './sounds';

export interface AudioManager {
  /** True once the player has touched the page, so sound is allowed. */
  readonly unlocked: boolean;
  /** Builds the sounds in the background, unless sound is off. Call once at boot. */
  prepare(): void;
  /** True while sound is switched off. Comes from the save (SPEC 10). */
  readonly muted: boolean;
  /** Called by the first tap or key press. */
  unlock(): void;
  /** The sound button. */
  setMuted(muted: boolean): void;
  /** Plays one effect, unless it played a moment ago. */
  play(name: SfxName): void;
  /** Which screen the game is on, which decides what the loops do. */
  setPhase(phase: AppPhase): void;
  /** Whether the tab is away: audio stops dead rather than playing to nobody. */
  setHidden(hidden: boolean): void;
  /** Plays whatever the run has earned a sound for since the last frame. */
  observe(state: RunState): void;
  /** A fresh run, whose counters start again at zero. */
  resetRun(state: RunState): void;
}

export interface AudioManagerOptions {
  /** What actually makes the sound. Tests hand in a fake one. */
  engine?: SoundEngine;
  /** A clock in seconds. Defaults to the browser's own. */
  now?: () => number;
}

function browserClock(): number {
  const ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return ms / 1000;
}

/** The shortest gap allowed between two plays of the same effect. */
function minGapOf(name: SfxName): number {
  return AUDIO.minGap[name];
}

export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  const engine = options.engine ?? createWebAudioEngine();
  const now = options.now ?? browserClock;
  const watcher = createRunSoundWatcher();

  let unlocked = false;
  let muted = false;
  let phase: AppPhase = 'start';

  // When each effect last played, so nothing can machine-gun.
  const lastPlayed = {} as Record<SfxName, number>;
  for (const name of SFX_NAMES) lastPlayed[name] = Number.NEGATIVE_INFINITY;

  // The climbing pitch of a coin run (SPEC 8 says the coins should feel good).
  let coinSteps = 0;
  let lastCoinAt = Number.NEGATIVE_INFINITY;

  // Reused every frame rather than rebuilt (CLAUDE.md rule 7).
  const pending: SfxName[] = [];

  /** True while sound is both allowed and wanted. */
  const live = (): boolean => unlocked && !muted;

  const applyBeds = (): void => {
    if (!live()) {
      engine.setBeds(0, 0);
      return;
    }
    // Music carries on behind a screen, quieter; the water only runs while the
    // player is actually on the slide.
    const playing = phase === 'playing';
    engine.setBeds(playing ? 1 : AUDIO.menuMusicLevel, playing ? 1 : 0);
  };

  /** How far a coin should be pitched up, for a run of coins collected together. */
  const coinPitch = (at: number): number => {
    if (at - lastCoinAt > AUDIO.coin.streakWindow) coinSteps = 0;
    else coinSteps = Math.min(coinSteps + 1, AUDIO.coin.maxSteps);
    lastCoinAt = at;
    return Math.pow(AUDIO.coin.pitchStep, coinSteps);
  };

  /** Plays an effect, unless it played a moment ago. */
  const playSound = (name: SfxName): void => {
    if (!live()) return;
    const at = now();
    if (at - lastPlayed[name] < minGapOf(name)) return;
    lastPlayed[name] = at;
    engine.playSfx(name, name === 'coin' ? coinPitch(at) : 1);
  };

  return {
    get unlocked() {
      return unlocked;
    },

    get muted() {
      return muted;
    },

    prepare() {
      // A muted player may never turn sound on; no point spending the memory.
      if (!muted) engine.prepare();
    },

    unlock() {
      if (unlocked) return;
      unlocked = true;
      // A muted game never builds an audio context in the first place.
      if (!muted) engine.start();
      applyBeds();
    },

    setMuted(next) {
      if (next === muted) return;
      muted = next;
      engine.setMuted(next);
      // Un-muting is itself a tap, so sound is allowed to start right here.
      if (!muted && unlocked) engine.start();
      applyBeds();
    },

    play: playSound,

    setPhase(next) {
      if (next === phase) return;
      phase = next;
      applyBeds();
    },

    setHidden(hidden) {
      engine.setSuspended(hidden);
    },

    observe(state) {
      // Even while muted the counters have to be kept up to date, or every
      // sound of the silent stretch would fire the moment sound came back.
      pending.length = 0;
      watcher.drain(state, pending);
      if (!live()) return;
      for (const name of pending) playSound(name);
    },

    resetRun(state) {
      watcher.reset(state);
      coinSteps = 0;
      lastCoinAt = Number.NEGATIVE_INFINITY;
    },
  };
}
