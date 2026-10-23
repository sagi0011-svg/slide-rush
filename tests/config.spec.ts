import { describe, expect, it } from 'vitest';
import {
  AUDIO,
  CAMERA,
  COINS,
  DIFFICULTY,
  INPUT,
  LANES,
  OBSTACLES,
  PLAYER,
  POWERUPS,
  SCORING,
  SIM,
  SPEED,
  TRACK,
} from '../src/config';

/**
 * Guards the numbers in docs/SPEC.md against accidental drift. If a value here
 * must change, change the spec in the same commit (CLAUDE.md rule 2).
 */
describe('config matches the spec', () => {
  it('simulates at 60 Hz (SPEC 13)', () => {
    expect(SIM.hz).toBe(60);
    expect(SIM.dt).toBeCloseTo(1 / 60, 12);
  });

  it('has 3 lanes 2.5 units apart, starting in the centre (SPEC 3)', () => {
    expect(LANES.indices).toEqual([-1, 0, 1]);
    expect(LANES.width).toBe(2.5);
    expect(LANES.start).toBe(0);
    expect(LANES.indices).toContain(LANES.start);
  });

  it('uses the player timings from SPEC 3', () => {
    expect(PLAYER.laneChangeTime).toBe(0.15);
    expect(PLAYER.jumpTime).toBe(0.65);
    expect(PLAYER.jumpHeight).toBe(2.2);
    expect(PLAYER.slideTime).toBe(0.7);
    expect(PLAYER.inputBufferTime).toBe(0.15);
  });

  it('ramps speed 14 -> 32 u/s over 180 s, capped at 48 (SPEC 5)', () => {
    expect(SPEED.start).toBe(14);
    expect(SPEED.max).toBe(32);
    expect(SPEED.rampTime).toBe(180);
    expect(SPEED.cap).toBe(48);
    expect(SPEED.start).toBeLessThan(SPEED.max);
    expect(SPEED.max * POWERUPS.boost.speedMultiplier).toBeGreaterThanOrEqual(SPEED.cap);
  });

  it('starts difficulty tiers at 0 / 30 / 90 / 180 s, rising (SPEC 5)', () => {
    expect(DIFFICULTY.tierStartTimes).toEqual([0, 30, 90, 180]);
    const times = [...DIFFICULTY.tierStartTimes];
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(DIFFICULTY.minReactionTime).toBe(0.45);
  });

  it('uses 40-unit chunks built ahead of the player (SPEC 6)', () => {
    expect(TRACK.chunkLength).toBe(40);
    expect(TRACK.buildAhead).toBeGreaterThanOrEqual(150);
    expect(TRACK.buildAhead).toBeLessThanOrEqual(CAMERA.far);
  });

  it('recognises a swipe at 30 px (SPEC 4)', () => {
    expect(INPUT.swipeThresholdPx).toBe(30);
  });

  it('renders a 9:16 portrait frame (SPEC 1)', () => {
    expect(CAMERA.aspect).toBeCloseTo(9 / 16, 12);
    expect(CAMERA.near).toBeLessThan(CAMERA.far);
  });

  it('uses the scoring rules from SPEC 10', () => {
    expect(SCORING.pointsPerUnit).toBe(1);
    expect(SCORING.pointsPerCoin).toBe(10);
    expect(SCORING.multiplierStart).toBe(1);
    expect(SCORING.multiplierMax).toBe(5);
    expect(SCORING.multiplierStepTime).toBe(30);
  });

  it('uses the obstacle and stumble rules from SPEC 7', () => {
    expect(OBSTACLES.stumbleSpeedLoss).toBeCloseTo(0.3, 12);
    expect(OBSTACLES.stumbleDuration).toBe(1.5);
    expect(OBSTACLES.secondStumbleWindow).toBe(6);
    expect(OBSTACLES.hitboxScale).toBeCloseTo(0.85, 12);
    expect(OBSTACLES.hitboxScale).toBeLessThan(1);
  });

  it('collects coins within 0.8 units (SPEC 8)', () => {
    expect(COINS.pickupRadius).toBe(0.8);
  });

  it('uses the power-up numbers from SPEC 9', () => {
    expect(POWERUPS.spawnIntervalMin).toBe(20);
    expect(POWERUPS.spawnIntervalMax).toBe(30);
    expect(POWERUPS.spawnIntervalMin).toBeLessThan(POWERUPS.spawnIntervalMax);
    expect(POWERUPS.shield.duration).toBe(10);
    expect(POWERUPS.shield.graceAfterHit).toBe(1);
    expect(POWERUPS.magnet.duration).toBe(10);
    expect(POWERUPS.magnet.radius).toBe(8);
    expect(POWERUPS.boost.duration).toBe(5);
    expect(POWERUPS.boost.speedMultiplier).toBe(2);
    expect(POWERUPS.boost.graceAfterEnd).toBe(1);
    expect(POWERUPS.boost.easeOutTime).toBe(0.5);
    expect(POWERUPS.boost.safeWindowAfterEnd).toBe(1.5);
  });
});

describe('render settings that affect fairness', () => {
  it('fogs the track out before its built end shows (SPEC 2)', () => {
    expect(CAMERA.fogFar).toBeLessThan(TRACK.buildAhead);
    expect(CAMERA.fogNear).toBeLessThan(CAMERA.fogFar);
  });

  it('builds the track further ahead than the camera can see', () => {
    expect(TRACK.buildAhead).toBeGreaterThan(CAMERA.fogFar);
  });
});

describe('sound settings (SPEC 12)', () => {
  it('keeps every volume inside 0..1, with the music under the effects', () => {
    for (const gain of [AUDIO.masterGain, AUDIO.sfxGain, AUDIO.musicGain, AUDIO.ambienceGain]) {
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
    expect(AUDIO.musicGain).toBeLessThan(AUDIO.sfxGain);
    expect(AUDIO.ambienceGain).toBeLessThan(AUDIO.sfxGain);
    expect(AUDIO.menuMusicLevel).toBeGreaterThan(0);
    expect(AUDIO.menuMusicLevel).toBeLessThan(1);
  });

  it('describes all ten effects, each audible and inside the range', () => {
    const names = Object.keys(AUDIO.sfx);
    expect(names).toHaveLength(10);
    for (const [name, recipe] of Object.entries(AUDIO.sfx)) {
      expect(recipe.duration, name).toBeGreaterThan(0);
      expect(recipe.gain, name).toBeGreaterThan(0);
      expect(recipe.gain, name).toBeLessThanOrEqual(1);
      expect(AUDIO.minGap[name as keyof typeof AUDIO.minGap], name).toBeGreaterThan(0);
    }
  });

  it('gives the music four chords of three notes over a sensible tempo', () => {
    expect(AUDIO.music.chords).toHaveLength(4);
    for (const chord of AUDIO.music.chords) expect(chord).toHaveLength(3);
    expect(AUDIO.music.bpm).toBeGreaterThan(60);
    expect(AUDIO.music.bpm).toBeLessThan(180);
    expect(AUDIO.music.tailSilence).toBeGreaterThan(0);
  });

  it('crossfades the water loop into itself over part of its length', () => {
    expect(AUDIO.water.crossfade).toBeGreaterThan(0);
    expect(AUDIO.water.crossfade).toBeLessThan(AUDIO.water.loopSeconds);
    expect(AUDIO.water.swellDepth).toBeGreaterThan(0);
    expect(AUDIO.water.swellDepth).toBeLessThanOrEqual(1);
  });
});
