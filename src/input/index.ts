/**
 * Raw browser input -> game actions (SPEC 4).
 *
 * This layer only listens and translates; the decision of what an action means
 * lives in src/game/input-actions.ts, where it can be unit-tested.
 * Actions collect in a small fixed queue that the game loop drains each frame.
 */

import { INPUT } from '../config';
import {
  actionFromKey,
  actionFromSwipe,
  keyShouldPreventDefault,
  type GameAction,
} from '../game/input-actions';

export interface InputSource {
  /** Hands over everything pressed or swiped since the last call. */
  drain(): readonly GameAction[];
  /** Removes every listener. */
  dispose(): void;
}

/** More than this many actions in one frame means something is stuck; drop the rest. */
const MAX_QUEUED = 8;

export function createInputSource(canvas: HTMLCanvasElement): InputSource {
  // Pre-allocated so draining the queue never allocates in the hot loop (rule 7).
  const queue: GameAction[] = [];
  const drained: GameAction[] = [];

  const push = (action: GameAction): void => {
    if (queue.length < MAX_QUEUED) queue.push(action);
  };

  // --- Keyboard -----------------------------------------------------------
  const onKeyDown = (event: KeyboardEvent): void => {
    // Ignore auto-repeat: holding a key must not fire the action over and over.
    if (event.repeat) return;
    const action = actionFromKey(event.code);
    if (action === null) return;
    // Stop the page from scrolling on the arrows and space (SPEC 4).
    if (keyShouldPreventDefault(event.code)) event.preventDefault();
    push(action);
  };

  // --- Touch / mouse ------------------------------------------------------
  // Pointer events cover both a finger and a mouse drag, so swipes can also be
  // tested on a desktop without a touchscreen.
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let firedForThisPointer = false;

  const onPointerDown = (event: PointerEvent): void => {
    // One action per touch (SPEC 4), so a second finger is ignored.
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    firedForThisPointer = false;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId || firedForThisPointer) return;
    // Fire as soon as the finger passes the threshold, without waiting
    // for it to lift (SPEC 4).
    const action = actionFromSwipe(
      event.clientX - startX,
      event.clientY - startY,
      INPUT.swipeThresholdPx,
    );
    if (action === null) return;
    firedForThisPointer = true;
    push(action);
  };

  const endPointer = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    firedForThisPointer = false;
  };

  // --- Page gestures ------------------------------------------------------
  // Belt and braces alongside `touch-action: none` in the CSS: keep the canvas
  // from scrolling, zooming or pulling to refresh (SPEC 4).
  const swallow = (event: Event): void => event.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('touchmove', swallow, { passive: false });
  canvas.addEventListener('gesturestart', swallow);
  canvas.addEventListener('contextmenu', swallow);

  return {
    drain() {
      drained.length = 0;
      for (const action of queue) drained.push(action);
      queue.length = 0;
      return drained;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('touchmove', swallow);
      canvas.removeEventListener('gesturestart', swallow);
      canvas.removeEventListener('contextmenu', swallow);
    },
  };
}
