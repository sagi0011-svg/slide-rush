import { describe, expect, it } from 'vitest';
import { DEATH, SIM, TUTORIAL } from '../src/config';
import {
  applyFlowEvent,
  createFlow,
  isScreenUp,
  isSimulating,
  needsFreshRun,
  nextPhase,
  type AppPhase,
  type FlowEvent,
} from '../src/game/flow';
import {
  createTutorial,
  currentStep,
  skipTutorial,
  stepAccepts,
  tutorialSpeedFactor,
  tutorialTakesAction,
  TUTORIAL_STEPS,
  updateTutorial,
} from '../src/game/tutorial';
import { applyAction, createRunState, deathBeatOver, stepRun } from '../src/game/state';
import { TUTORIAL_CHUNKS } from '../src/game/chunks/tutorial';

const DT = SIM.dt;

describe('moving between screens (SPEC 11)', () => {
  it('opens on the title', () => {
    const flow = createFlow();
    expect(flow.phase).toBe('start');
    expect(flow.started).toBe(false);
  });

  it('plays, pauses, resumes and ends', () => {
    const flow = createFlow();
    applyFlowEvent(flow, 'play');
    expect(flow.phase).toBe('playing');
    expect(flow.started).toBe(true);

    applyFlowEvent(flow, 'pause');
    expect(flow.phase).toBe('paused');

    applyFlowEvent(flow, 'resume');
    expect(flow.phase).toBe('playing');

    applyFlowEvent(flow, 'died');
    expect(flow.phase).toBe('gameOver');
  });

  it('starts again from the game over screen', () => {
    const flow = createFlow();
    applyFlowEvent(flow, 'play');
    applyFlowEvent(flow, 'died');
    applyFlowEvent(flow, 'restart');
    expect(flow.phase).toBe('playing');
  });

  it('goes home from pause and from game over', () => {
    for (const from of ['pause', 'died'] as const) {
      const flow = createFlow();
      applyFlowEvent(flow, 'play');
      applyFlowEvent(flow, from);
      applyFlowEvent(flow, 'home');
      expect(flow.phase).toBe('start');
    }
  });

  it('pauses itself when the tab goes away (SPEC 11)', () => {
    const flow = createFlow();
    applyFlowEvent(flow, 'play');
    applyFlowEvent(flow, 'lostFocus');
    expect(flow.phase).toBe('paused');
  });

  it('does not disturb a screen that is already waiting', () => {
    for (const phase of ['start', 'paused', 'gameOver'] as const) {
      expect(nextPhase(phase, 'lostFocus')).toBe(phase);
    }
  });

  it('ignores anything that makes no sense from where it is', () => {
    const nonsense: Array<[AppPhase, FlowEvent]> = [
      ['start', 'resume'],
      ['start', 'pause'],
      ['start', 'died'],
      ['start', 'home'],
      ['playing', 'play'],
      ['playing', 'resume'],
      ['gameOver', 'pause'],
      ['gameOver', 'died'],
      ['paused', 'play'],
    ];
    for (const [phase, event] of nonsense) {
      expect(nextPhase(phase, event), `${phase} + ${event}`).toBe(phase);
    }
  });

  it('says whether anything changed', () => {
    const flow = createFlow();
    expect(applyFlowEvent(flow, 'resume')).toBe(false);
    expect(applyFlowEvent(flow, 'play')).toBe(true);
    expect(applyFlowEvent(flow, 'play')).toBe(false);
  });

  it('only simulates while playing', () => {
    expect(isSimulating('playing')).toBe(true);
    for (const phase of ['start', 'paused', 'gameOver'] as const) {
      expect(isSimulating(phase), phase).toBe(false);
      expect(isScreenUp(phase), phase).toBe(true);
    }
    expect(isScreenUp('playing')).toBe(false);
  });

  it('knows which events need a fresh run', () => {
    expect(needsFreshRun('play')).toBe(true);
    expect(needsFreshRun('restart')).toBe(true);
    for (const event of ['pause', 'resume', 'died', 'home', 'lostFocus'] as const) {
      expect(needsFreshRun(event), event).toBe(false);
    }
  });
});

describe('the first-run tutorial (SPEC 11)', () => {
  it('has a step for each of the three moves', () => {
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual(['move', 'jump', 'slide']);
  });

  it('lines each step up with its own chunk', () => {
    expect(TUTORIAL_STEPS).toHaveLength(TUTORIAL_CHUNKS.length);
    // In order, and far enough apart to be separate lessons.
    for (let i = 1; i < TUTORIAL_STEPS.length; i += 1) {
      const gap = (TUTORIAL_STEPS[i]?.atS ?? 0) - (TUTORIAL_STEPS[i - 1]?.atS ?? 0);
      expect(gap).toBeGreaterThan(TUTORIAL.holdDistance * 2);
    }
  });

  it('is off from the start for someone who has seen it', () => {
    const state = createTutorial(false);
    expect(state.done).toBe(true);
    expect(currentStep(state)).toBeNull();
    expect(tutorialSpeedFactor(state)).toBe(1);
  });

  it('only accepts the move it is asking for', () => {
    expect(stepAccepts('move', 'left')).toBe(true);
    expect(stepAccepts('move', 'right')).toBe(true);
    expect(stepAccepts('move', 'jump')).toBe(false);

    expect(stepAccepts('jump', 'jump')).toBe(true);
    expect(stepAccepts('jump', 'slide')).toBe(false);

    expect(stepAccepts('slide', 'slide')).toBe(true);
    expect(stepAccepts('slide', 'left')).toBe(false);
  });

  it('holds the slide once the obstacle is close, and lets go when told', () => {
    const state = createTutorial(true);
    const first = TUTORIAL_STEPS[0]?.atS ?? 0;

    updateTutorial(state, first - TUTORIAL.holdDistance - 5);
    expect(state.waiting).toBe(false);
    expect(tutorialSpeedFactor(state)).toBe(1);

    updateTutorial(state, first - TUTORIAL.holdDistance + 1);
    expect(state.waiting).toBe(true);
    expect(tutorialSpeedFactor(state)).toBeLessThan(1);
    expect(tutorialSpeedFactor(state)).toBeGreaterThan(0);

    expect(tutorialTakesAction(state, 'left')).toBe(true);
    expect(state.waiting).toBe(false);
    expect(currentStep(state)?.id).toBe('jump');
  });

  it('ignores the wrong move and keeps waiting', () => {
    const state = createTutorial(true);
    updateTutorial(state, (TUTORIAL_STEPS[0]?.atS ?? 0) - 1);
    expect(tutorialTakesAction(state, 'jump')).toBe(false);
    expect(state.waiting).toBe(true);
    expect(currentStep(state)?.id).toBe('move');
  });

  it('ignores a move made before the prompt is up', () => {
    const state = createTutorial(true);
    updateTutorial(state, 0);
    expect(tutorialTakesAction(state, 'left')).toBe(false);
    expect(state.step).toBe(0);
  });

  it('finishes after all three', () => {
    const state = createTutorial(true);
    for (const [index, action] of (['left', 'jump', 'slide'] as const).entries()) {
      updateTutorial(state, (TUTORIAL_STEPS[index]?.atS ?? 0) - 1);
      expect(tutorialTakesAction(state, action)).toBe(true);
    }
    expect(state.done).toBe(true);
    expect(currentStep(state)).toBeNull();
    expect(tutorialSpeedFactor(state)).toBe(1);
  });

  it('can be skipped', () => {
    const state = createTutorial(true);
    updateTutorial(state, (TUTORIAL_STEPS[0]?.atS ?? 0) - 1);
    expect(state.waiting).toBe(true);

    skipTutorial(state);
    expect(state.done).toBe(true);
    expect(state.waiting).toBe(false);
    expect(tutorialSpeedFactor(state)).toBe(1);
  });
});

describe('the tutorial in a real run', () => {
  it('cannot kill a first-time player who does nothing', () => {
    // The slide holds in front of each lesson, so standing still is safe.
    const state = createRunState(1, { tutorial: true });
    for (let i = 0; i < 60 * 40; i += 1) stepRun(state, DT);
    expect(state.phase).toBe('running');
    expect(state.tutorial.waiting).toBe(true);
  });

  it('teaches the three moves, in order, and then gets out of the way', () => {
    const state = createRunState(1, { tutorial: true });
    const expected = ['move', 'jump', 'slide'] as const;
    const answers = { move: 'left', jump: 'jump', slide: 'slide' } as const;
    const seen: string[] = [];

    for (let i = 0; i < 60 * 200 && !state.tutorial.done; i += 1) {
      stepRun(state, DT);
      const step = currentStep(state.tutorial);
      if (step !== null && state.tutorial.waiting) {
        seen.push(step.id);
        // Answer it the way a player would, through the normal input path.
        applyAction(state, answers[step.id]);
      }
    }

    expect(state.tutorial.done).toBe(true);
    // Each lesson came up, in order, and only moved on once answered.
    expect([...new Set(seen)]).toEqual([...expected]);
    expect(state.phase).toBe('running');
  });

  it('runs normally for someone who has already seen it', () => {
    const state = createRunState(1, { tutorial: false });
    expect(state.tutorial.done).toBe(true);
    for (let i = 0; i < 60 * 10; i += 1) stepRun(state, DT);
    // Without the tutorial's protection, doing nothing ends badly.
    expect(state.phase).toBe('dead');
  });
});

describe('the death beat (SPEC 11)', () => {
  it('keeps the world moving, slowly, before the score appears', () => {
    const state = createRunState(2);
    while (state.phase === 'running') stepRun(state, DT);

    const atDeath = state.distance;
    expect(deathBeatOver(state)).toBe(false);

    for (let i = 0; i < Math.round(DEATH.beatTime / 2 / DT); i += 1) stepRun(state, DT);
    // It drifts on rather than stopping dead.
    expect(state.distance).toBeGreaterThan(atDeath);
    // But far slower than it was going.
    const drifted = state.distance - atDeath;
    expect(drifted).toBeLessThan(state.speed * (DEATH.beatTime / 2) * 0.5);
  });

  it('is over after the beat, and then everything stops', () => {
    const state = createRunState(2);
    while (state.phase === 'running') stepRun(state, DT);
    for (let i = 0; i < Math.round(DEATH.beatTime / DT) + 2; i += 1) stepRun(state, DT);

    expect(deathBeatOver(state)).toBe(true);
    const settled = state.distance;
    for (let i = 0; i < 120; i += 1) stepRun(state, DT);
    expect(state.distance).toBe(settled);
  });

  it('never scores anything during the beat', () => {
    const state = createRunState(2);
    while (state.phase === 'running') stepRun(state, DT);
    const score = state.score.points;
    for (let i = 0; i < 120; i += 1) stepRun(state, DT);
    expect(state.score.points).toBe(score);
  });
});
