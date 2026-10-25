import { describe, expect, it } from 'vitest';
import { AUDIO } from '../src/config';
import { createAudioManager } from '../src/audio/manager';
import type { SoundEngine } from '../src/audio/engine';
import type { SfxName } from '../src/audio/sounds';
import { applyAction, createRunState } from '../src/game/state';

/**
 * The sound manager decides whether and when anything is heard (SPEC 12). It
 * is tested against a fake engine and a fake clock, so these are the rules
 * themselves: nothing before the first touch, nothing while muted, nothing
 * twice in a row, and the right loops for the screen the player is on.
 */

interface FakeEngine extends SoundEngine {
  readonly prepares: number;
  readonly starts: number;
  readonly played: Array<{ name: SfxName; pitch: number }>;
  readonly beds: Array<[number, number]>;
  readonly mutes: boolean[];
  readonly suspends: boolean[];
  /** Pretends the browser is (or is no longer) holding the sound back. */
  holdBack(held: boolean): void;
}

function fakeEngine(): FakeEngine {
  let prepares = 0;
  let starts = 0;
  const played: Array<{ name: SfxName; pitch: number }> = [];
  const beds: Array<[number, number]> = [];
  const mutes: boolean[] = [];
  const suspends: boolean[] = [];
  // A browser that has not accepted a gesture yet.
  let heldBack = false;

  return {
    get ready() {
      return starts > 0;
    },
    get running() {
      return starts > 0 && !heldBack;
    },
    holdBack(held: boolean) {
      heldBack = held;
    },
    get prepares() {
      return prepares;
    },
    get starts() {
      return starts;
    },
    prepare() {
      prepares += 1;
    },
    played,
    beds,
    mutes,
    suspends,
    start() {
      starts += 1;
    },
    playSfx(name, pitch) {
      played.push({ name, pitch });
    },
    setBeds(music, ambience) {
      beds.push([music, ambience]);
    },
    setMuted(muted) {
      mutes.push(muted);
    },
    setSuspended(suspended) {
      suspends.push(suspended);
    },
  };
}

/** A manager with a clock the test moves by hand. */
function setup(): {
  engine: FakeEngine;
  audio: ReturnType<typeof createAudioManager>;
  advance: (seconds: number) => void;
} {
  const engine = fakeEngine();
  let clock = 1000;
  const audio = createAudioManager({ engine, now: () => clock });
  return {
    engine,
    audio,
    advance(seconds) {
      clock += seconds;
    },
  };
}

/** The last pair of loop levels the manager asked for. */
function lastBeds(engine: FakeEngine): [number, number] {
  return engine.beds[engine.beds.length - 1] ?? [-1, -1];
}

describe('before the player has touched the page (SPEC 12)', () => {
  it('builds the sounds in the background, so the first tap has little to do', () => {
    const { engine, audio } = setup();
    audio.prepare();
    expect(engine.prepares).toBe(1);
    // Building is not playing: nothing is started or heard yet.
    expect(engine.starts).toBe(0);
    expect(engine.played).toEqual([]);
  });

  it('builds nothing ahead of time for a player who keeps sound off', () => {
    const { engine, audio } = setup();
    audio.setMuted(true);
    audio.prepare();
    expect(engine.prepares).toBe(0);
  });

  it('makes no sound and does not even build the audio', () => {
    const { engine, audio } = setup();
    audio.play('uiTap');
    audio.play('coin');
    expect(audio.unlocked).toBe(false);
    expect(engine.starts).toBe(0);
    expect(engine.played).toEqual([]);
  });

  it('starts the audio on the first touch, and only once', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.unlock();
    expect(audio.unlocked).toBe(true);
    expect(engine.starts).toBe(1);
  });

  it('asks again on the next touch while the browser holds the sound back', () => {
    // On a phone, putting a finger down does not count; lifting it does.
    const { engine, audio } = setup();
    engine.holdBack(true);
    audio.unlock();
    expect(audio.running).toBe(false);
    audio.unlock();
    expect(engine.starts).toBe(2);

    // Once it plays, a touch has nothing left to do.
    engine.holdBack(false);
    expect(audio.running).toBe(true);
    audio.unlock();
    expect(engine.starts).toBe(2);
  });

  it('does not ask while the tab is away', () => {
    const { engine, audio } = setup();
    engine.holdBack(true);
    audio.unlock();
    audio.setHidden(true);
    audio.unlock();
    expect(engine.starts).toBe(1);
  });
});

describe('the mute setting (SPEC 10)', () => {
  it('builds nothing at all while sound is off', () => {
    const { engine, audio } = setup();
    audio.setMuted(true);
    audio.unlock();
    audio.play('coin');

    expect(audio.muted).toBe(true);
    expect(engine.starts).toBe(0);
    expect(engine.played).toEqual([]);
    expect(lastBeds(engine)).toEqual([0, 0]);
  });

  it('starts the audio the moment sound is turned back on', () => {
    const { engine, audio } = setup();
    audio.setMuted(true);
    audio.unlock();
    audio.setMuted(false);

    expect(engine.starts).toBe(1);
    expect(engine.mutes).toEqual([true, false]);
    audio.play('coin');
    expect(engine.played).toHaveLength(1);
  });

  it('goes quiet again when sound is turned off mid-game', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setPhase('playing');
    audio.setMuted(true);

    expect(lastBeds(engine)).toEqual([0, 0]);
    audio.play('coin');
    expect(engine.played).toEqual([]);
  });
});

describe('the two loops follow the screen (SPEC 11 / 12)', () => {
  it('runs the music quietly behind a screen and the water only on the slide', () => {
    const { engine, audio } = setup();
    audio.unlock();
    expect(lastBeds(engine)).toEqual([AUDIO.menuMusicLevel, 0]);

    audio.setPhase('playing');
    expect(lastBeds(engine)).toEqual([1, 1]);

    audio.setPhase('paused');
    expect(lastBeds(engine)).toEqual([AUDIO.menuMusicLevel, 0]);

    audio.setPhase('gameOver');
    expect(lastBeds(engine)).toEqual([AUDIO.menuMusicLevel, 0]);
  });

  it('stops the clock while the tab is away', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setHidden(true);
    audio.setHidden(false);
    expect(engine.suspends).toEqual([true, false]);
  });
});

describe('not the same sound twice in a row', () => {
  it('refuses a repeat inside the effect its own gap', () => {
    const { engine, audio, advance } = setup();
    audio.unlock();

    audio.play('stumble');
    audio.play('stumble');
    expect(engine.played).toHaveLength(1);

    advance(AUDIO.minGap.stumble + 0.01);
    audio.play('stumble');
    expect(engine.played).toHaveLength(2);
  });

  it('keeps a gap per effect, so one never blocks another', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.play('jump');
    audio.play('lane');
    audio.play('coin');
    expect(engine.played.map((call) => call.name)).toEqual(['jump', 'lane', 'coin']);
  });
});

describe('a run of coins climbs in pitch (SPEC 8)', () => {
  it('rises coin by coin, then stops rising', () => {
    const { engine, audio, advance } = setup();
    audio.unlock();

    const pitches: number[] = [];
    for (let i = 0; i < AUDIO.coin.maxSteps + 4; i += 1) {
      audio.play('coin');
      advance(AUDIO.minGap.coin + 0.001);
    }
    for (const call of engine.played) pitches.push(call.pitch);

    expect(pitches[0]).toBeCloseTo(1, 6);
    expect(pitches[1]).toBeCloseTo(AUDIO.coin.pitchStep, 6);
    const highest = Math.pow(AUDIO.coin.pitchStep, AUDIO.coin.maxSteps);
    expect(Math.max(...pitches)).toBeCloseTo(highest, 6);
    expect(pitches[pitches.length - 1]).toBeCloseTo(highest, 6);
  });

  it('starts again from the bottom after a break', () => {
    const { engine, audio, advance } = setup();
    audio.unlock();
    audio.play('coin');
    advance(AUDIO.minGap.coin + 0.001);
    audio.play('coin');
    advance(AUDIO.coin.streakWindow + 0.1);
    audio.play('coin');

    expect(engine.played.map((call) => call.pitch)[2]).toBeCloseTo(1, 6);
  });

  it('is only the coins that move; everything else plays as rendered', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.play('death');
    expect(engine.played[0]?.pitch).toBe(1);
  });
});

describe('watching a run', () => {
  it('plays what the run did since the last frame', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setPhase('playing');

    const state = createRunState(1);
    audio.resetRun(state);

    applyAction(state, 'jump');
    state.score.coins += 1;
    audio.observe(state);

    expect(engine.played.map((call) => call.name)).toEqual(['jump', 'coin']);
  });

  it('keeps count while muted, so nothing piles up for later', () => {
    const { engine, audio } = setup();
    audio.setMuted(true);
    audio.unlock();

    const state = createRunState(1);
    audio.resetRun(state);
    applyAction(state, 'jump');
    state.score.coins += 3;
    audio.observe(state);
    expect(engine.played).toEqual([]);

    // Sound comes back on: the silent stretch stays silent.
    audio.setMuted(false);
    audio.observe(state);
    expect(engine.played).toEqual([]);
  });

  it('starts a fresh run without a sound', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setPhase('playing');

    const first = createRunState(1);
    audio.resetRun(first);
    applyAction(first, 'jump');
    audio.observe(first);
    expect(engine.played).toHaveLength(1);

    const second = createRunState(2);
    audio.resetRun(second);
    audio.observe(second);
    expect(engine.played).toHaveLength(1);
  });
});

describe('separate switches for effects and music (docs/VISUAL-STYLES.md section 3)', () => {
  it('keeps the music playing with the effects off, and drops the water', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setPhase('playing');
    audio.setSfxOff(true);
    audio.play('coin');
    expect(engine.played).toEqual([]);
    expect(lastBeds(engine)).toEqual([1, 0]);
    expect(audio.muted).toBe(false);
    expect(engine.mutes).toEqual([]);
  });

  it('keeps the effects with the music off', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setPhase('playing');
    audio.setMusicOff(true);
    audio.play('coin');
    expect(engine.played.map((p) => p.name)).toEqual(['coin']);
    expect(lastBeds(engine)).toEqual([0, 1]);
  });

  it('goes fully silent, and builds nothing, only with both off', () => {
    const { engine, audio } = setup();
    audio.setSfxOff(true);
    audio.setMusicOff(true);
    expect(audio.muted).toBe(true);
    expect(engine.mutes).toEqual([true]);
    audio.prepare();
    expect(engine.prepares).toBe(0);
    audio.unlock();
    expect(engine.starts).toBe(0);
  });

  it('starts sound again when one switch comes back on', () => {
    const { engine, audio } = setup();
    audio.unlock();
    audio.setMuted(true);
    const starts = engine.starts;
    audio.setMusicOff(false);
    expect(audio.muted).toBe(false);
    expect(engine.mutes).toEqual([true, false]);
    expect(engine.starts).toBe(starts + 1);
  });
});
