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
 *    the same pattern as `unlock()` in src/ui/feedback.ts. And not every touch
 *    counts: on a touch screen the browser only accepts lifting the finger,
 *    not putting it down, and a phone can hold audio back again after the
 *    app was switched away. So every gesture asks again, until it plays.
 *  - **Muted means muted.** The sound effects and the music each have a saved
 *    switch (SPEC 10, docs/VISUAL-STYLES.md §3). The water running under the
 *    slide counts as an effect. With both off no context is started at all,
 *    so a silent game costs the battery nothing.
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
  /** True while both the effects and the music are off. Comes from the save. */
  readonly muted: boolean;
  /**
   * Called by every tap, click and key press. The first one allows sound; the
   * rest start it again if the browser is still holding it back.
   */
  unlock(): void;
  /** True while sound is actually coming out, as far as the browser says. */
  readonly running: boolean;
  /** Turns the effects and the music off, or back on, together. */
  setMuted(muted: boolean): void;
  /** The sound effects switch: every effect, and the water under the slide. */
  setSfxOff(off: boolean): void;
  /** The music switch. */
  setMusicOff(off: boolean): void;
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
  let sfxOff = false;
  let musicOff = false;
  let hidden = false;
  let phase: AppPhase = 'start';

  // When each effect last played, so nothing can machine-gun.
  const lastPlayed = {} as Record<SfxName, number>;
  for (const name of SFX_NAMES) lastPlayed[name] = Number.NEGATIVE_INFINITY;

  // The climbing pitch of a coin run (SPEC 8 says the coins should feel good).
  let coinSteps = 0;
  let lastCoinAt = Number.NEGATIVE_INFINITY;

  // Reused every frame rather than rebuilt (CLAUDE.md rule 7).
  const pending: SfxName[] = [];

  /** True while both switches are off: no sound may be made at all. */
  const muted = (): boolean => sfxOff && musicOff;
  /** True while sound is both allowed and wanted. */
  const live = (): boolean => unlocked && !muted();

  const applyBeds = (): void => {
    if (!live()) {
      engine.setBeds(0, 0);
      return;
    }
    // Music carries on behind a screen, quieter; the water only runs while the
    // player is actually on the slide.
    const playing = phase === 'playing';
    const music = musicOff ? 0 : playing ? 1 : AUDIO.menuMusicLevel;
    const water = sfxOff || !playing ? 0 : 1;
    engine.setBeds(music, water);
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
    if (!live() || sfxOff) return;
    const at = now();
    if (at - lastPlayed[name] < minGapOf(name)) return;
    lastPlayed[name] = at;
    engine.playSfx(name, name === 'coin' ? coinPitch(at) : 1);
  };

  /** Both switches at once, so the engine hears about silence only once. */
  const setSwitches = (nextSfxOff: boolean, nextMusicOff: boolean): void => {
    if (nextSfxOff === sfxOff && nextMusicOff === musicOff) return;
    const wasMuted = muted();
    sfxOff = nextSfxOff;
    musicOff = nextMusicOff;
    if (muted() !== wasMuted) engine.setMuted(muted());
    // Turning sound on is itself a tap, so it is allowed to start right here.
    if (!muted() && unlocked) engine.start();
    applyBeds();
  };

  return {
    get unlocked() {
      return unlocked;
    },

    get muted() {
      return muted();
    },

    prepare() {
      // A muted player may never turn sound on; no point spending the memory.
      if (!muted()) engine.prepare();
    },

    get running() {
      return engine.running;
    },

    unlock() {
      const first = !unlocked;
      unlocked = true;
      // A muted game never builds an audio context in the first place. A
      // context the browser is still holding back is asked again.
      if (!muted() && !hidden && !engine.running) engine.start();
      if (first) applyBeds();
    },

    setMuted(next) {
      setSwitches(next, next);
    },

    setSfxOff(next) {
      setSwitches(next, musicOff);
    },

    setMusicOff(next) {
      setSwitches(sfxOff, next);
    },

    play: playSound,

    setPhase(next) {
      if (next === phase) return;
      phase = next;
      applyBeds();
    },

    setHidden(next) {
      hidden = next;
      engine.setSuspended(next);
    },

    observe(state) {
      // Even while muted the counters have to be kept up to date, or every
      // sound of the silent stretch would fire the moment sound came back.
      pending.length = 0;
      watcher.drain(state, pending);
      if (!live() || sfxOff) return;
      for (const name of pending) playSound(name);
    },

    resetRun(state) {
      watcher.reset(state);
      coinSteps = 0;
      lastCoinAt = Number.NEGATIVE_INFINITY;
    },
  };
}
