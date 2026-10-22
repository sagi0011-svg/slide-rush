/**
 * Turning raw input into game actions (SPEC 4).
 *
 * Pure logic with no DOM access, so the mapping can be unit-tested.
 * The listeners that produce the raw numbers live in src/input/.
 */

import { INPUT } from '../config';

/** Everything the player can ask for. */
export type GameAction = 'left' | 'right' | 'jump' | 'slide' | 'pause';

/** Actions that move the player; `pause` is handled by the run, not the player. */
export type MoveAction = Exclude<GameAction, 'pause'>;

export function isMoveAction(action: GameAction): action is MoveAction {
  return action !== 'pause';
}

/**
 * Maps a KeyboardEvent.code to an action (SPEC 4).
 * `code` is used rather than `key` so the keys are the same on any layout.
 */
export function actionFromKey(code: string): GameAction | null {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      return 'jump';
    case 'ArrowDown':
    case 'KeyS':
      return 'slide';
    case 'Escape':
    case 'KeyP':
      return 'pause';
    default:
      return null;
  }
}

/** True if a key should not also scroll or scrub the page. */
export function keyShouldPreventDefault(code: string): boolean {
  return actionFromKey(code) !== null;
}

/**
 * Maps a finger's travel so far to an action (SPEC 4).
 *
 * Returns null until the finger has moved at least `thresholdPx` along the
 * dominant axis — the caller watches every move event and fires the first
 * action that comes back, without waiting for the finger to lift.
 * A perfectly diagonal swipe counts as horizontal: lane changes are the
 * most common action, so they win the tie.
 *
 * @param dx pixels moved right (negative = left)
 * @param dy pixels moved down (negative = up)
 */
export function actionFromSwipe(
  dx: number,
  dy: number,
  thresholdPx: number = INPUT.swipeThresholdPx,
): MoveAction | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;

  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);

  if (horizontal >= vertical) {
    if (horizontal < thresholdPx) return null;
    return dx < 0 ? 'left' : 'right';
  }

  if (vertical < thresholdPx) return null;
  return dy < 0 ? 'jump' : 'slide';
}
