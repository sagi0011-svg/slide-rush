import { describe, expect, it } from 'vitest';
import { AUDIO } from '../src/config';
import { musicLoopSeconds, renderMusicLoop, renderWaterLoop } from '../src/audio/beds';
import { renderSfx } from '../src/audio/sfx';
import { SFX_NAMES } from '../src/audio/sounds';
import {
  arch,
  clamp01,
  createNoise,
  fadeEdges,
  midiToHz,
  normalize,
  peakOf,
  pluck,
  sweep,
} from '../src/audio/synth';

/**
 * Every sound in the game is generated rather than recorded (SPEC 12 and
 * ASSETS.md), which means the sounds themselves can be checked like any other
 * rule. What matters here is what ears notice: no silence where there should
 * be a sound, nothing louder than the speakers can take, no click at the
 * start, the end, or the join of a loop, and the same result every time.
 */

const RATE = AUDIO.renderSampleRate;

/** The largest step between two samples: a click shows up as a big one. */
function largestStep(data: Float32Array): number {
  let largest = 0;
  for (let i = 1; i < data.length; i += 1) {
    const step = Math.abs((data[i] ?? 0) - (data[i - 1] ?? 0));
    if (step > largest) largest = step;
  }
  return largest;
}

describe('synth building blocks', () => {
  it('keeps noise inside -1..1 and repeats it exactly from a seed', () => {
    const a = createNoise(AUDIO.noiseSeed);
    const b = createNoise(AUDIO.noiseSeed);
    for (let i = 0; i < 1000; i += 1) {
      const sample = a();
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
      expect(b()).toBe(sample);
    }
  });

  it('turns MIDI notes into the right frequencies', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(midiToHz(57)).toBeCloseTo(220, 6);
    // C3, the note the music is built on.
    expect(midiToHz(48)).toBeCloseTo(130.81, 2);
  });

  it('sweeps by ratio, so the middle is the geometric mean', () => {
    expect(sweep(100, 400, 0)).toBeCloseTo(100, 6);
    expect(sweep(100, 400, 0.5)).toBeCloseTo(200, 6);
    expect(sweep(100, 400, 1)).toBeCloseTo(400, 6);
    // Anything outside 0..1 is held at the ends.
    expect(sweep(100, 400, 2)).toBeCloseTo(400, 6);
    expect(clamp01(-3)).toBe(0);
  });

  it('starts and ends both envelopes at silence', () => {
    expect(pluck(0, 1, 0.01)).toBe(0);
    expect(pluck(1, 1, 0.01)).toBe(0);
    expect(pluck(0.01, 1, 0.01)).toBeCloseTo(1, 6);
    expect(arch(0, 1)).toBe(0);
    expect(arch(1, 1)).toBe(0);
    expect(arch(0.5, 1)).toBeCloseTo(1, 6);
  });

  it('normalises to an exact peak and leaves silence alone', () => {
    const data = new Float32Array([0.1, -0.2, 0.05]);
    normalize(data, 0.8);
    expect(peakOf(data)).toBeCloseTo(0.8, 6);

    const silence = new Float32Array(16);
    normalize(silence, 0.8);
    expect(peakOf(silence)).toBe(0);
  });

  it('fades the edges of a buffer to zero', () => {
    const data = new Float32Array(100).fill(1);
    fadeEdges(data, 100, 0.1);
    expect(data[0]).toBe(0);
    expect(data[data.length - 1]).toBe(0);
    expect(data[50]).toBe(1);
  });
});

describe('the ten effects (SPEC 12)', () => {
  it('renders every one of them', () => {
    expect(SFX_NAMES).toHaveLength(10);
    expect([...SFX_NAMES].sort()).toEqual(
      [
        'coin',
        'death',
        'jump',
        'lane',
        'powerUp',
        'powerUpEnd',
        'shieldPop',
        'slide',
        'stumble',
        'uiTap',
      ].sort(),
    );
  });

  for (const name of SFX_NAMES) {
    it(`${name}: audible, in range, and the same every time`, () => {
      const data = renderSfx(name, RATE);
      const recipe = AUDIO.sfx[name];

      expect(data.length).toBe(Math.round(recipe.duration * RATE));
      for (const sample of data) expect(Number.isFinite(sample)).toBe(true);
      // Loud enough to hear, and never louder than the speakers can take.
      expect(peakOf(data)).toBeCloseTo(recipe.gain, 5);
      expect(peakOf(data)).toBeLessThanOrEqual(1);
      // Starts and ends on silence, so there is never a click.
      expect(Math.abs(data[0] ?? 1)).toBeLessThan(0.02);
      expect(Math.abs(data[data.length - 1] ?? 1)).toBeLessThan(0.02);

      expect([...renderSfx(name, RATE)]).toEqual([...data]);
    });
  }

  it('falls back to a usable sample rate when there is no device to ask', () => {
    const data = renderSfx('coin', 0);
    expect(data.length).toBe(Math.round(AUDIO.sfx.coin.duration * AUDIO.renderSampleRate));
  });
});

describe('the music loop (SPEC 12)', () => {
  const data = renderMusicLoop(RATE);

  it('is as long as the tempo says', () => {
    const { bpm, beatsPerChord, chords } = AUDIO.music;
    expect(musicLoopSeconds()).toBeCloseTo((chords.length * beatsPerChord * 60) / bpm, 9);
    expect(data.length).toBe(Math.round(musicLoopSeconds() * RATE));
  });

  it('is audible and stays in range', () => {
    expect(peakOf(data)).toBeCloseTo(AUDIO.music.peak, 5);
    for (const sample of data) expect(Number.isFinite(sample)).toBe(true);
  });

  it('joins back to its own start on silence, so it never clicks', () => {
    expect(Math.abs(data[0] ?? 1)).toBeLessThan(0.001);
    expect(Math.abs(data[data.length - 1] ?? 1)).toBeLessThan(0.001);
    expect(largestStep(data)).toBeLessThan(0.2);
  });

  it('sounds the same in every build', () => {
    expect([...renderMusicLoop(RATE)]).toEqual([...data]);
  });
});

describe('the water ambience loop (SPEC 12)', () => {
  const data = renderWaterLoop(RATE);

  it('is as long as the config says', () => {
    expect(data.length).toBe(Math.round(AUDIO.water.loopSeconds * RATE));
  });

  it('is audible and stays in range', () => {
    expect(peakOf(data)).toBeCloseTo(AUDIO.water.peak, 5);
    for (const sample of data) expect(Number.isFinite(sample)).toBe(true);
  });

  it('has no seam: the end runs straight into the start', () => {
    // Noise cannot be faded at the ends — that would leave a gap every time
    // round — so the tail is crossfaded onto the head instead. The join has to
    // be no bigger a step than the noise takes anywhere else.
    const join = Math.abs((data[0] ?? 0) - (data[data.length - 1] ?? 0));
    expect(join).toBeLessThanOrEqual(largestStep(data));
  });

  it('sounds the same in every build', () => {
    expect([...renderWaterLoop(RATE)]).toEqual([...data]);
  });
});
