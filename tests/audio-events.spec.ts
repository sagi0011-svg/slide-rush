import { describe, expect, it } from 'vitest';
import { POWERUPS, SIM } from '../src/config';
import { createRunSoundWatcher } from '../src/audio/events';
import type { SfxName } from '../src/audio/sounds';
import { applyAction, createRunState, grantPowerUp, type RunState } from '../src/game/state';
import { stepPowerUps } from '../src/game/powerups';
import { stepPlayer } from '../src/game/player';

/**
 * The run counts what happened; the watcher turns that into sounds (SPEC 12).
 * These tests drive the real game functions, so a rule that stops bumping its
 * counter is caught here rather than by a game that has quietly gone silent.
 */

const DT = SIM.dt;

/** A watcher already baselined on this run, and the sounds it has to report. */
function watch(state: RunState): { drain: () => SfxName[] } {
  const watcher = createRunSoundWatcher(state);
  const out: SfxName[] = [];
  return {
    drain() {
      out.length = 0;
      watcher.drain(state, out);
      return [...out];
    },
  };
}

/** Runs just the player for a while, one fixed tick at a time. */
function runPlayer(state: RunState, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepPlayer(state.player, DT);
}

describe('what the player hears from a run (SPEC 12)', () => {
  it('says nothing about a run that has not done anything', () => {
    const state = createRunState(1);
    expect(watch(state).drain()).toEqual([]);
  });

  it('plays a swish for a lane change, once however many lanes were crossed', () => {
    const state = createRunState(1);
    const watcher = watch(state);
    applyAction(state, 'left');
    expect(watcher.drain()).toEqual(['lane']);

    applyAction(state, 'right');
    applyAction(state, 'right');
    expect(watcher.drain()).toEqual(['lane']);
    expect(watcher.drain()).toEqual([]);
  });

  it('says nothing for a lane change refused by the outside wall', () => {
    const state = createRunState(1);
    const watcher = watch(state);
    applyAction(state, 'left');
    expect(watcher.drain()).toEqual(['lane']);
    // Already against the wall: a bump, but no new lane change.
    applyAction(state, 'left');
    expect(watcher.drain()).toEqual([]);
  });

  it('plays a jump, and a duck once the player is back on the floor', () => {
    const state = createRunState(1);
    const watcher = watch(state);

    applyAction(state, 'jump');
    expect(watcher.drain()).toEqual(['jump']);

    // Land first: a jump cannot be started in mid-air, and nor can a slide.
    runPlayer(state, 1);
    applyAction(state, 'slide');
    expect(watcher.drain()).toEqual(['slide']);
  });

  it('plays the duck on landing out of a mid-air drop (SPEC 3)', () => {
    const state = createRunState(1);
    const watcher = watch(state);
    applyAction(state, 'jump');
    expect(watcher.drain()).toEqual(['jump']);

    applyAction(state, 'slide');
    // The slide itself only starts on landing, which is when it is heard.
    expect(watcher.drain()).toEqual([]);
    runPlayer(state, 0.5);
    expect(state.player.vertical).toBe('sliding');
    expect(watcher.drain()).toEqual(['slide']);
  });

  it('plays at most a couple of coins out of one frame', () => {
    const state = createRunState(1);
    const watcher = watch(state);
    state.score.coins += 1;
    expect(watcher.drain()).toEqual(['coin']);

    // A magnet can sweep a whole trail in at once; only a few are heard.
    state.score.coins += 7;
    expect(watcher.drain()).toEqual(['coin', 'coin']);
  });

  it('plays a power-up being picked up and running out (SPEC 9)', () => {
    const state = createRunState(1);
    const watcher = watch(state);

    grantPowerUp(state, 'shield');
    expect(watcher.drain()).toEqual(['powerUp']);

    const ticks = Math.round((POWERUPS.shield.duration + 0.2) / DT);
    for (let i = 0; i < ticks; i += 1) stepPowerUps(state.powerUps, DT, 20);
    expect(watcher.drain()).toEqual(['powerUpEnd']);
    expect(watcher.drain()).toEqual([]);
  });

  it('plays the shield popping, the stumble, and the end of the run', () => {
    const state = createRunState(1);
    const watcher = watch(state);

    state.shieldPops += 1;
    expect(watcher.drain()).toEqual(['shieldPop']);

    state.stumbles += 1;
    expect(watcher.drain()).toEqual(['stumble']);

    state.phase = 'dead';
    expect(watcher.drain()).toEqual(['death']);
    // And only once, however long the game over screen stays up.
    expect(watcher.drain()).toEqual([]);
  });

  it('puts death last, on top of whatever the player was doing', () => {
    const state = createRunState(1);
    const watcher = watch(state);
    applyAction(state, 'jump');
    state.score.coins += 1;
    state.phase = 'dead';
    expect(watcher.drain()).toEqual(['jump', 'coin', 'death']);
  });

  it('starts a fresh run in silence, not with everything the last one did', () => {
    const state = createRunState(1);
    const watcher = createRunSoundWatcher(state);
    const out: SfxName[] = [];

    state.score.coins += 5;
    state.stumbles += 1;
    state.phase = 'dead';
    watcher.drain(state, out);
    expect(out.length).toBeGreaterThan(0);

    // A restart hands over a run whose counters all begin again at zero.
    out.length = 0;
    watcher.drain(createRunState(2), out);
    expect(out).toEqual([]);
  });

  it('forgets the run it was watching when it is told to', () => {
    const state = createRunState(1);
    const watcher = createRunSoundWatcher();
    const out: SfxName[] = [];

    state.score.coins += 3;
    watcher.reset(state);
    watcher.drain(state, out);
    expect(out).toEqual([]);
  });
});
