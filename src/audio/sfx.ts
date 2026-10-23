/**
 * The ten placeholder effects (SPEC 12), generated rather than recorded.
 *
 * Each one is a few lines of arithmetic over the numbers in `AUDIO.sfx`, so
 * there is no download, no licence to worry about (ASSETS.md) and no loading
 * screen. Real recordings can replace them later by filling the same buffers,
 * exactly as placeholder meshes are meant to be replaced (CLAUDE.md rule 8).
 *
 * Pure maths: no Web Audio here, so all of it is unit-tested.
 */

import { AUDIO } from '../config';
import type { SfxName } from './sounds';
import {
  TAU,
  arch,
  createNoise,
  lowPassStep,
  normalize,
  pluck,
  sweep,
  type Samples,
} from './synth';

/** An empty buffer long enough to hold `duration` seconds. */
function buffer(duration: number, sampleRate: number): Samples {
  return new Float32Array(Math.max(1, Math.round(duration * sampleRate)));
}

/** A bright two-tone blip that climbs: the coin (SPEC 8). */
function renderCoin(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.coin;
  const data = buffer(duration, sampleRate);
  let phase = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    phase += sweep(from, to, t / duration) / sampleRate;
    const wave = Math.sin(TAU * phase) + 0.3 * Math.sin(TAU * 2 * phase);
    data[i] = wave * pluck(t, duration, 0.004, 5);
  }
  normalize(data, gain);
  return data;
}

/** A tone that lifts off: the jump (SPEC 3). */
function renderJump(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.jump;
  const data = buffer(duration, sampleRate);
  let phase = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    phase += sweep(from, to, t / duration) / sampleRate;
    // A touch of the third harmonic gives it body without sounding harsh.
    const wave = Math.sin(TAU * phase) + 0.22 * Math.sin(TAU * 3 * phase);
    data[i] = wave * pluck(t, duration, 0.01, 3);
  }
  normalize(data, gain);
  return data;
}

/** Noise sliding downwards: ducking under something (SPEC 3). */
function renderSlide(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.slide;
  const data = buffer(duration, sampleRate);
  const noise = createNoise(AUDIO.noiseSeed);
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    filtered = lowPassStep(filtered, noise(), sweep(from, to, t / duration), sampleRate);
    data[i] = filtered * arch(t, duration);
  }
  normalize(data, gain);
  return data;
}

/** A short swish across the lanes (SPEC 3). */
function renderLane(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.lane;
  const data = buffer(duration, sampleRate);
  const noise = createNoise(AUDIO.noiseSeed);
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    const raw = noise();
    filtered = lowPassStep(filtered, raw, sweep(from, to, t / duration), sampleRate);
    // Taking the low-passed part away leaves the top end: a swish, not a thud.
    data[i] = (raw - filtered) * arch(t, duration);
  }
  normalize(data, gain);
  return data;
}

/** A low thud with grit on the front: the stumble (SPEC 7). */
function renderStumble(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.stumble;
  const data = buffer(duration, sampleRate);
  const noise = createNoise(AUDIO.noiseSeed);
  const gritTime = duration * 0.3;
  let phase = 0;
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    phase += sweep(from, to, t / duration) / sampleRate;
    const thud = Math.sin(TAU * phase) * pluck(t, duration, 0.005, 3);
    filtered = lowPassStep(filtered, noise(), 1400, sampleRate);
    const grit = filtered * pluck(t, gritTime, 0.002, 6) * 0.6;
    data[i] = thud + grit;
  }
  normalize(data, gain);
  return data;
}

/** A long fall with the floor going out from under it: the end of a run. */
function renderDeath(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.death;
  const data = buffer(duration, sampleRate);
  const noise = createNoise(AUDIO.noiseSeed);
  let phase = 0;
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    phase += sweep(from, to, t / duration) / sampleRate;
    const wave =
      Math.sin(TAU * phase) + 0.4 * Math.sin(TAU * 2 * phase) + 0.2 * Math.sin(TAU * 3 * phase);
    filtered = lowPassStep(filtered, noise(), 600, sampleRate);
    data[i] = wave * pluck(t, duration, 0.008, 2.2) + filtered * arch(t, duration) * 0.25;
  }
  normalize(data, gain);
  return data;
}

/** A row of notes, used for both power-up sounds (SPEC 9). */
function renderNotes(
  notes: readonly number[],
  duration: number,
  gain: number,
  sampleRate: number,
): Samples {
  const data = buffer(duration, sampleRate);
  const slot = duration / notes.length;
  // Each note rings on past its slot, so the row reads as one sound.
  const ring = slot * 1.6;
  for (let n = 0; n < notes.length; n += 1) {
    const frequency = notes[n] ?? 0;
    const start = Math.round(n * slot * sampleRate);
    const end = Math.min(data.length, Math.round((n * slot + ring) * sampleRate));
    for (let i = start; i < end; i += 1) {
      const t = (i - start) / sampleRate;
      const phase = frequency * t;
      const wave = Math.sin(TAU * phase) + 0.25 * Math.sin(TAU * 2 * phase);
      data[i] = (data[i] ?? 0) + wave * pluck(t, ring, 0.006, 4);
    }
  }
  normalize(data, gain);
  return data;
}

/** A bright burst with a ping in it: the shield taking a hit (SPEC 9). */
function renderShieldPop(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.shieldPop;
  const data = buffer(duration, sampleRate);
  const noise = createNoise(AUDIO.noiseSeed);
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    filtered = lowPassStep(filtered, noise(), sweep(from, to, t / duration), sampleRate);
    const ping = Math.sin(TAU * 1200 * t) * pluck(t, duration, 0.003, 6);
    data[i] = filtered * pluck(t, duration, 0.002, 4) + ping * 0.5;
  }
  normalize(data, gain);
  return data;
}

/** A soft click under a finger: every button (SPEC 11). */
function renderUiTap(sampleRate: number): Samples {
  const { duration, gain, from, to } = AUDIO.sfx.uiTap;
  const data = buffer(duration, sampleRate);
  let phase = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    phase += sweep(from, to, t / duration) / sampleRate;
    data[i] = Math.sin(TAU * phase) * pluck(t, duration, 0.003, 6);
  }
  normalize(data, gain);
  return data;
}

/**
 * Renders one effect into a buffer of mono samples in -1..1.
 *
 * Called once per effect when the sound starts up, and never while playing.
 */
export function renderSfx(name: SfxName, sampleRate: number): Samples {
  const rate = sampleRate > 0 ? sampleRate : AUDIO.renderSampleRate;
  switch (name) {
    case 'coin':
      return renderCoin(rate);
    case 'jump':
      return renderJump(rate);
    case 'slide':
      return renderSlide(rate);
    case 'lane':
      return renderLane(rate);
    case 'stumble':
      return renderStumble(rate);
    case 'death':
      return renderDeath(rate);
    case 'powerUp': {
      const { notes, duration, gain } = AUDIO.sfx.powerUp;
      return renderNotes(notes, duration, gain, rate);
    }
    case 'powerUpEnd': {
      const { notes, duration, gain } = AUDIO.sfx.powerUpEnd;
      return renderNotes(notes, duration, gain, rate);
    }
    case 'shieldPop':
      return renderShieldPop(rate);
    case 'uiTap':
      return renderUiTap(rate);
  }
}
