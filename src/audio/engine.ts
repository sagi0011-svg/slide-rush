/**
 * The only part of the game that talks to the speakers.
 *
 * It owns one Web Audio context, four gain nodes and the rendered buffers, and
 * it does exactly what it is told: play this effect, fade these loops, go
 * quiet, stop. Every decision about *when* to do any of that lives in
 * src/audio/manager.ts, which is where it can be tested.
 *
 * Nothing in here may ever throw into the game. A browser with no Web Audio, a
 * context the browser refuses to start, a device with no output: all of them
 * end up as silence, never as a crash (the same promise as src/ui/feedback.ts).
 */

import { AUDIO } from '../config';
import { renderMusicLoop, renderWaterLoop } from './beds';
import { renderSfx } from './sfx';
import { SFX_NAMES, type SfxName } from './sounds';
import type { Samples } from './synth';

export interface SoundEngine {
  /** True once there is a context with its buffers in place. */
  readonly ready: boolean;
  /**
   * True while the browser is actually letting it play. A context can exist
   * and still be held back, until a gesture the browser accepts comes along.
   */
  readonly running: boolean;
  /**
   * Builds the sounds ahead of time, a piece at a time, while the title screen
   * is up. Building them needs no permission from the browser — only playing
   * them does — so the first tap is left with almost nothing to do.
   */
  prepare(): void;
  /**
   * Builds the context and the sounds, or resumes one that is already there.
   * Must be called from a user gesture: browsers refuse to start audio before
   * the player has touched the page (SPEC 12).
   */
  start(): void;
  /** Plays one effect. `pitch` is a playback-rate multiplier; 1 is as rendered. */
  playSfx(name: SfxName, pitch: number): void;
  /** Fades the two loops to these levels, 0..1 of their configured volume. */
  setBeds(music: number, ambience: number): void;
  /** Fades everything to silence, or back up. */
  setMuted(muted: boolean): void;
  /** Stops the clock entirely, for a tab the player has left. */
  setSuspended(suspended: boolean): void;
}

/** Old Safari only has the prefixed constructor. */
interface AudioContextCarrier {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function audioContextClass(): typeof AudioContext | null {
  if (typeof globalThis === 'undefined') return null;
  const carrier = globalThis as unknown as AudioContextCarrier;
  return carrier.AudioContext ?? carrier.webkitAudioContext ?? null;
}

/**
 * True while the page has a fresh user gesture, or when the browser cannot
 * say (older Safari), in which case it is simply tried.
 */
function gestureIsActive(): boolean {
  if (typeof navigator === 'undefined') return true;
  const activation = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
  return activation === undefined ? true : activation.isActive;
}

export function createWebAudioEngine(): SoundEngine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let ambienceBus: GainNode | null = null;
  const sfx = new Map<SfxName, AudioBuffer>();

  // The raw samples, built by `prepare` ahead of time or by `start` if the
  // player got there first. Each is built once and then kept.
  const sfxSamples = new Map<SfxName, Samples>();
  let musicSamples: Samples | null = null;
  let waterSamples: Samples | null = null;
  let preparing = false;

  const renderEffects = (): void => {
    for (const name of SFX_NAMES) {
      if (!sfxSamples.has(name)) sfxSamples.set(name, renderSfx(name, AUDIO.renderSampleRate));
    }
  };
  const renderMusic = (): Samples => (musicSamples ??= renderMusicLoop(AUDIO.renderSampleRate));
  const renderWater = (): Samples => (waterSamples ??= renderWaterLoop(AUDIO.renderSampleRate));

  // Remembered while there is no context, and applied the moment there is one.
  let muted = false;
  let musicLevel = 0;
  let ambienceLevel = 0;

  const fade = (node: GainNode | null, target: number, seconds: number): void => {
    if (context === null || node === null) return;
    const now = context.currentTime;
    try {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(target, now + seconds);
    } catch {
      // A browser that refuses the ramp still takes the plain value.
      node.gain.value = target;
    }
  };

  const applyLevels = (): void => {
    fade(master, muted ? 0 : AUDIO.masterGain, AUDIO.muteFadeTime);
    fade(musicBus, AUDIO.musicGain * musicLevel, AUDIO.bedFadeTime);
    fade(ambienceBus, AUDIO.ambienceGain * ambienceLevel, AUDIO.bedFadeTime);
  };

  const toBuffer = (data: Samples): AudioBuffer | null => {
    if (context === null) return null;
    // Built at our own rate; the browser converts to the device's on playback.
    const buffer = context.createBuffer(1, data.length, AUDIO.renderSampleRate);
    buffer.copyToChannel(data, 0);
    return buffer;
  };

  /** A loop that runs for as long as the game does; its gain decides if it is heard. */
  const startLoop = (data: Samples, bus: GainNode): void => {
    if (context === null) return;
    const buffer = toBuffer(data);
    if (buffer === null) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(bus);
    source.start();
  };

  return {
    get ready() {
      return context !== null;
    },

    get running() {
      return context !== null && context.state === 'running';
    },

    prepare() {
      if (preparing || typeof setTimeout === 'undefined') return;
      preparing = true;
      // One piece per task, so a tap that lands in the middle is answered
      // straight away rather than after all of it.
      const steps = [renderEffects, renderMusic, renderWater];
      const next = (): void => {
        const step = steps.shift();
        if (step === undefined) return;
        try {
          step();
        } catch {
          // `start` will try again, and stay silent if it fails too.
        }
        setTimeout(next, 0);
      };
      setTimeout(next, AUDIO.prepareDelay * 1000);
    },

    start() {
      if (context !== null) {
        void context.resume().catch(() => undefined);
        return;
      }
      // Not until the browser counts this as a gesture: on a touch screen
      // putting a finger down does not, and a context made then is only held
      // back (with a console warning). Lifting the finger will ask again.
      if (!gestureIsActive()) return;
      const Context = audioContextClass();
      if (Context === null) return;

      try {
        context = new Context();

        master = context.createGain();
        master.gain.value = muted ? 0 : AUDIO.masterGain;
        master.connect(context.destination);

        sfxBus = context.createGain();
        sfxBus.gain.value = AUDIO.sfxGain;
        sfxBus.connect(master);

        musicBus = context.createGain();
        musicBus.gain.value = 0;
        musicBus.connect(master);

        ambienceBus = context.createGain();
        ambienceBus.gain.value = 0;
        ambienceBus.connect(master);

        // Usually already built by `prepare`; anything missing is built now.
        // Either way it happens once, and nothing is generated while the game
        // is running (CLAUDE.md rule 7).
        renderEffects();
        for (const [name, samples] of sfxSamples) {
          const buffer = toBuffer(samples);
          if (buffer !== null) sfx.set(name, buffer);
        }
        startLoop(renderMusic(), musicBus);
        startLoop(renderWater(), ambienceBus);

        applyLevels();
        void context.resume().catch(() => undefined);
      } catch (error) {
        console.warn('Slide Rush: no sound on this device', error);
        context = null;
        master = null;
        sfxBus = null;
        musicBus = null;
        ambienceBus = null;
        sfx.clear();
      }
    },

    playSfx(name, pitch) {
      if (context === null || sfxBus === null) return;
      const buffer = sfx.get(name);
      if (buffer === undefined) return;
      try {
        // One short-lived node per sound. This is the one place where objects
        // are made while playing, and it happens on events, never per frame.
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = pitch;
        source.connect(sfxBus);
        source.onended = () => source.disconnect();
        source.start();
      } catch {
        // A refused sound is never worth interrupting the game for.
      }
    },

    setBeds(music, ambience) {
      musicLevel = music;
      ambienceLevel = ambience;
      fade(musicBus, AUDIO.musicGain * musicLevel, AUDIO.bedFadeTime);
      fade(ambienceBus, AUDIO.ambienceGain * ambienceLevel, AUDIO.bedFadeTime);
    },

    setMuted(next) {
      muted = next;
      fade(master, muted ? 0 : AUDIO.masterGain, AUDIO.muteFadeTime);
    },

    setSuspended(suspended) {
      if (context === null) return;
      try {
        void (suspended ? context.suspend() : context.resume()).catch(() => undefined);
      } catch {
        // Some browsers throw instead of returning a rejected promise.
      }
    },
  };
}
