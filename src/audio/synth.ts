/**
 * The small bits of maths every sound in the game is built from.
 *
 * Numbers in, numbers out: no Web Audio and no DOM, so every effect and both
 * music loops can be rendered and checked in a unit test (CLAUDE.md rule 10).
 * The engine in src/audio/engine.ts is the only part that talks to the
 * browser, and all it does is hand these samples to the speakers.
 */

import { createRng } from '../game/rng';

/**
 * A block of mono samples in -1..1, backed by a plain array buffer — which is
 * what the Web Audio API will only take.
 */
export type Samples = Float32Array<ArrayBuffer>;

/** One full turn of a wave, in radians. */
export const TAU = Math.PI * 2;

/** Clamps anything into 0..1. */
export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * White noise in -1..1, drawn from a seed so a given build always sounds
 * exactly the same (the same reasoning as CLAUDE.md rule 6).
 */
export function createNoise(seed: number): () => number {
  const rng = createRng(seed);
  return () => rng.next() * 2 - 1;
}

/** The frequency of a MIDI note number: 69 is A4, 440 Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Sweeps between two frequencies the way an ear hears it — by ratio rather
 * than by step, so the slide down sounds even all the way.
 */
export function sweep(from: number, to: number, t: number): number {
  return from * Math.pow(to / from, clamp01(t));
}

/**
 * A struck sound: snaps up over `attack`, then falls away. It reaches exactly
 * zero at `duration`, so a one-shot can never end in a click.
 *
 * @param fall how steeply it drops; higher is shorter
 */
export function pluck(t: number, duration: number, attack: number, fall = 4): number {
  if (t <= 0 || t >= duration) return 0;
  if (t < attack) return t / attack;
  const u = (t - attack) / (duration - attack);
  return Math.exp(-fall * u) * (1 - u);
}

/**
 * An arch: silent at both ends, loudest in the middle. Used for whooshes and
 * for the held chords of the music, where any hard edge would click.
 */
export function arch(t: number, duration: number): number {
  if (t <= 0 || t >= duration) return 0;
  return Math.sin(Math.PI * (t / duration));
}

/**
 * How far a one-pole low-pass filter moves towards each new sample, for a
 * given cutoff. Worked out once for a fixed cutoff rather than every sample.
 */
export function lowPassCoefficient(cutoff: number, sampleRate: number): number {
  return 1 - Math.exp((-TAU * cutoff) / sampleRate);
}

/**
 * One step of a one-pole low-pass filter — the cheapest way to turn white
 * noise into rushing water. Used where the cutoff sweeps; a fixed cutoff
 * should use `lowPassCoefficient` once instead.
 *
 * @param previous the filter's last output
 * @returns the new output, which is also the next call's `previous`
 */
export function lowPassStep(
  previous: number,
  sample: number,
  cutoff: number,
  sampleRate: number,
): number {
  return previous + lowPassCoefficient(cutoff, sampleRate) * (sample - previous);
}

/** The loudest sample in a buffer, as a positive number. */
export function peakOf(data: Samples): number {
  let peak = 0;
  for (const sample of data) {
    const size = Math.abs(sample);
    if (size > peak) peak = size;
  }
  return peak;
}

/** Scales a whole buffer so its loudest sample sits exactly at `peak`. */
export function normalize(data: Samples, peak: number): void {
  const loudest = peakOf(data);
  if (loudest === 0) return;
  const scale = peak / loudest;
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (data[i] ?? 0) * scale;
  }
}

/**
 * Fades the first and last few milliseconds of a buffer. A sound that starts
 * or stops on a non-zero sample clicks, and a loop clicks once every time
 * round, which is the most tiring sound a game can make.
 */
export function fadeEdges(data: Samples, sampleRate: number, seconds: number): void {
  const count = Math.min(Math.floor(seconds * sampleRate), Math.floor(data.length / 2));
  for (let i = 0; i < count; i += 1) {
    const gain = i / count;
    data[i] = (data[i] ?? 0) * gain;
    const end = data.length - 1 - i;
    data[end] = (data[end] ?? 0) * gain;
  }
}
