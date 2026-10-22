/**
 * The first-run tutorial (SPEC 11).
 *
 * Three prompts, each in front of the obstacle it is about. The slide holds
 * still until the player makes the move, so a first-time player cannot crash
 * into the thing they are being taught to get past. It is skippable, and once
 * it is finished it never comes back.
 *
 * Pure logic, no DOM. The prompts themselves are words in src/ui/strings.ts.
 */

import { TUTORIAL } from '../config';
import type { MoveAction } from './input-actions';
import { TUTORIAL_STEP_POSITIONS } from './chunks/tutorial';

export type TutorialStepId = 'move' | 'jump' | 'slide';

export interface TutorialStep {
  id: TutorialStepId;
  /** How far along the slide the obstacle for this step sits, in units. */
  atS: number;
}

/** The three steps, in the order they are met, each on its own chunk. */
const STEP_IDS: readonly TutorialStepId[] = ['move', 'jump', 'slide'];

export const TUTORIAL_STEPS: readonly TutorialStep[] = STEP_IDS.map((id, index) => ({
  id,
  atS: TUTORIAL_STEP_POSITIONS[index] ?? 0,
}));

export interface TutorialState {
  /** Which step is next. Equal to the number of steps once it is finished. */
  step: number;
  /** True once every step is done, or the player skipped it. */
  done: boolean;
  /** True while the slide is held, waiting for the player to make the move. */
  waiting: boolean;
}

export function createTutorial(enabled: boolean): TutorialState {
  return { step: 0, done: !enabled, waiting: false };
}

/** The step the player is on, or null once the tutorial is over. */
export function currentStep(state: TutorialState): TutorialStep | null {
  if (state.done) return null;
  return TUTORIAL_STEPS[state.step] ?? null;
}

/** Whether a move is the one this step is asking for. */
export function stepAccepts(step: TutorialStepId, action: MoveAction): boolean {
  switch (step) {
    case 'move':
      return action === 'left' || action === 'right';
    case 'jump':
      return action === 'jump';
    case 'slide':
      return action === 'slide';
  }
}

/**
 * Brings the tutorial up to date for where the player is.
 *
 * @param distance how far the player has travelled, in units
 */
export function updateTutorial(state: TutorialState, distance: number): void {
  const step = currentStep(state);
  if (step === null) {
    state.waiting = false;
    return;
  }
  // Hold once the obstacle is close enough to see what the prompt means.
  state.waiting = distance >= step.atS - TUTORIAL.holdDistance;
}

/**
 * Offers a move to the tutorial.
 *
 * @returns true if it was the move being asked for, which releases the hold
 */
export function tutorialTakesAction(state: TutorialState, action: MoveAction): boolean {
  const step = currentStep(state);
  if (step === null || !state.waiting) return false;
  if (!stepAccepts(step.id, action)) return false;

  state.step += 1;
  state.waiting = false;
  if (state.step >= TUTORIAL_STEPS.length) state.done = true;
  return true;
}

/** Gives up on the tutorial. It never comes back. */
export function skipTutorial(state: TutorialState): void {
  state.step = TUTORIAL_STEPS.length;
  state.done = true;
  state.waiting = false;
}

/**
 * How fast the slide should move, as a fraction of normal.
 *
 * While a prompt is waiting the slide creeps rather than stopping dead, so
 * the game still looks alive and the obstacle keeps drifting closer.
 */
export function tutorialSpeedFactor(state: TutorialState): number {
  return state.waiting ? TUTORIAL.holdSpeedFactor : 1;
}
