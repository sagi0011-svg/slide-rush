/**
 * The two loops that run underneath everything: the music and the water
 * (SPEC 12).
 *
 * Both are generated from the numbers in `AUDIO.music` and `AUDIO.water`, so
 * the game ships with a soundtrack nobody has to license (ASSETS.md) and
 * nothing has to download before the first run.
 *
 * Pure maths, no Web Audio, so the loops are unit-tested — above all that they
 * join back to their own start without a click, which is the one mistake a
 * loop cannot hide.
 *
 * They are built on the player's first tap, which is also when a run starts,
 * so they have to be quick: a few hundred thousand samples in a few
 * milliseconds, even on a phone. That is why the waves below are stepped
 * forward with a couple of multiplications per sample rather than a call to
 * Math.sin or Math.exp.
 */

import { AUDIO } from '../config';
import {
  TAU,
  createNoise,
  fadeEdges,
  lowPassCoefficient,
  midiToHz,
  normalize,
  type Samples,
} from './synth';

/** How long one turn of the music is, in seconds, worked out from the tempo. */
export function musicLoopSeconds(): number {
  const { bpm, beatsPerChord, chords } = AUDIO.music;
  return (chords.length * beatsPerChord * 60) / bpm;
}

/**
 * How a note swells and fades:
 *  - `arch` rises and falls like half a sine wave, silent at both ends — for
 *    held chords, where any hard edge would click;
 *  - `pluck` snaps up over `attack` seconds, then falls away to exactly zero,
 *    steeper for a higher `fall` — the same shape as `pluck` in synth.ts.
 */
type Envelope = { kind: 'arch' } | { kind: 'pluck'; attack: number; fall: number };

const ARCH: Envelope = { kind: 'arch' };

/**
 * Adds one note into the buffer, from `start` seconds, for `length` seconds.
 *
 * @param harmonic how much of the octave above is mixed in, for warmth
 */
function addNote(
  data: Samples,
  sampleRate: number,
  frequency: number,
  start: number,
  length: number,
  gain: number,
  envelope: Envelope,
  harmonic: number,
): void {
  const first = Math.max(0, Math.round(start * sampleRate));
  const total = Math.max(1, Math.round(length * sampleRate));
  const last = Math.min(data.length, first + total);

  // The wave: the sine and cosine of its phase, turned through a fixed angle
  // every sample. sin(2x) = 2·sin(x)·cos(x) gives the octave for free.
  const turn = (TAU * frequency) / sampleRate;
  const turnCos = Math.cos(turn);
  const turnSin = Math.sin(turn);
  let sin = 0;
  let cos = 1;

  // The arch is half a sine wave across the note, stepped the same way.
  const archTurn = Math.PI / total;
  const archCos = Math.cos(archTurn);
  const archSin = Math.sin(archTurn);
  let archValue = 0;
  let archPartner = 1;

  // The pluck: a straight ramp up, then exp(-fall·u)·(1 − u) as u runs 0 → 1.
  const attack =
    envelope.kind === 'pluck' ? Math.max(1, Math.round(envelope.attack * sampleRate)) : 0;
  const decaySamples = Math.max(1, total - attack);
  const du = 1 / decaySamples;
  const decayStep = envelope.kind === 'pluck' ? Math.exp(-envelope.fall * du) : 1;
  let decay = 1;
  let u = 0;

  for (let i = first, n = 0; i < last; i += 1, n += 1) {
    let level: number;
    if (envelope.kind === 'arch') {
      level = archValue;
      const nextArch = archValue * archCos + archPartner * archSin;
      archPartner = archPartner * archCos - archValue * archSin;
      archValue = nextArch;
    } else if (n < attack) {
      level = n / attack;
    } else {
      level = decay * (1 - u);
      decay *= decayStep;
      u += du;
    }

    const wave = sin + harmonic * 2 * sin * cos;
    data[i] = (data[i] ?? 0) + wave * level * gain;

    const nextSin = sin * turnCos + cos * turnSin;
    cos = cos * turnCos - sin * turnSin;
    sin = nextSin;
  }
}

/**
 * The looping background track: four chords held under a bass note and a
 * light arpeggio. Bright and simple on purpose — it has to stand being heard
 * for a long time without getting in the way of the effects.
 */
export function renderMusicLoop(sampleRate: number): Samples {
  const rate = sampleRate > 0 ? sampleRate : AUDIO.renderSampleRate;
  const { bpm, beatsPerChord, chords, rootMidi, arpPattern } = AUDIO.music;
  const { padGain, bassGain, arpGain, tailSilence, peak } = AUDIO.music;

  const beat = 60 / bpm;
  const chordSeconds = beat * beatsPerChord;
  const total = musicLoopSeconds();
  const data = new Float32Array(Math.max(1, Math.round(total * rate)));
  // Nothing may start inside the quiet tail, or it would ring over the join.
  const lastStart = total - tailSilence;
  const bass: Envelope = { kind: 'pluck', attack: 0.006, fall: 3 };
  const arp: Envelope = { kind: 'pluck', attack: 0.004, fall: 5 };

  for (let c = 0; c < chords.length; c += 1) {
    const chord = chords[c] ?? [];
    const chordStart = c * chordSeconds;

    // The pad: the three chord notes held for the whole bar.
    for (const semitone of chord) {
      const frequency = midiToHz(rootMidi + 12 + semitone);
      addNote(data, rate, frequency, chordStart, chordSeconds, padGain / chord.length, ARCH, 0.3);
    }

    // The bass: the root of the chord, on the first and third beat.
    const root = chord[0] ?? 0;
    for (const offset of [0, 2]) {
      const start = chordStart + offset * beat;
      if (start >= lastStart) continue;
      addNote(data, rate, midiToHz(rootMidi + root - 12), start, beat * 1.1, bassGain, bass, 0.15);
    }

    // The arpeggio: eighth notes walking up and down the chord, two octaves up.
    const eighths = beatsPerChord * 2;
    for (let k = 0; k < eighths; k += 1) {
      const start = chordStart + (k * beat) / 2;
      if (start >= lastStart) continue;
      const step = arpPattern[k % arpPattern.length] ?? 0;
      const semitone = chord[step % chord.length] ?? 0;
      addNote(
        data,
        rate,
        midiToHz(rootMidi + 24 + semitone),
        start,
        beat * 0.9,
        arpGain,
        arp,
        0.25,
      );
    }
  }

  // Fade whatever is still ringing down into the quiet tail, so the loop joins
  // its own start on silence.
  const tailSamples = Math.min(data.length, Math.round(tailSilence * rate));
  for (let i = 0; i < tailSamples; i += 1) {
    const index = data.length - tailSamples + i;
    data[index] = (data[index] ?? 0) * (1 - i / tailSamples);
  }

  normalize(data, peak);
  fadeEdges(data, rate, 0.005);
  return data;
}

/**
 * The water ambience: filtered noise with slow swells, as if the slide were
 * running under the player the whole time.
 *
 * Noise cannot simply be cut into a loop — the join would tick every time
 * round. The tail is generated past the end of the loop and crossfaded onto
 * the head instead, which leaves no seam at all.
 */
export function renderWaterLoop(sampleRate: number): Samples {
  const rate = sampleRate > 0 ? sampleRate : AUDIO.renderSampleRate;
  const { loopSeconds, cutoff, air, crossfade, swellRate, swellDepth, peak } = AUDIO.water;

  const length = Math.max(1, Math.round(loopSeconds * rate));
  const overlap = Math.min(length - 1, Math.max(1, Math.round(crossfade * rate)));
  const raw = new Float32Array(length + overlap);
  const noise = createNoise(AUDIO.noiseSeed);
  const k = lowPassCoefficient(cutoff, rate);

  // Whole numbers of swells per loop, so the swelling itself also lines up
  // with the join.
  const slowCycles = Math.max(1, Math.round(swellRate * loopSeconds));
  const fastCycles = Math.max(1, Math.round(swellRate * 2.5 * loopSeconds));
  const slowTurn = (TAU * slowCycles) / length;
  const fastTurn = (TAU * fastCycles) / length;

  let filtered = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const sample = noise();
    filtered += k * (sample - filtered);
    // Some of the unfiltered noise mixed back in keeps a little air in it.
    const water = filtered + air * (sample - filtered);
    const slow = 0.5 + 0.5 * Math.sin(slowTurn * i);
    const fast = 0.5 + 0.5 * Math.sin(fastTurn * i + 1.3);
    const swell = 1 - swellDepth + swellDepth * (0.65 * slow + 0.35 * fast);
    raw[i] = water * swell;
  }

  const data = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    if (i < overlap) {
      const fade = i / overlap;
      data[i] = (raw[i] ?? 0) * fade + (raw[length + i] ?? 0) * (1 - fade);
    } else {
      data[i] = raw[i] ?? 0;
    }
  }

  normalize(data, peak);
  return data;
}
