import { describe, expect, it } from 'vitest';
import { INPUT } from '../src/config';
import {
  actionFromKey,
  actionFromSwipe,
  isMoveAction,
  keyShouldPreventDefault,
  type GameAction,
} from '../src/game/input-actions';

describe('actionFromKey (SPEC 4)', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
    ['ArrowUp', 'jump'],
    ['KeyW', 'jump'],
    ['Space', 'jump'],
    ['ArrowDown', 'slide'],
    ['KeyS', 'slide'],
    ['Escape', 'pause'],
    ['KeyP', 'pause'],
  ])('%s maps to %s', (code, expected) => {
    expect(actionFromKey(code)).toBe(expected);
  });

  it('ignores keys the game does not use', () => {
    for (const code of ['KeyQ', 'Enter', 'ShiftLeft', 'Tab', '']) {
      expect(actionFromKey(code)).toBeNull();
    }
  });

  it('only swallows the keys it actually uses', () => {
    expect(keyShouldPreventDefault('Space')).toBe(true);
    expect(keyShouldPreventDefault('ArrowDown')).toBe(true);
    expect(keyShouldPreventDefault('F5')).toBe(false);
    expect(keyShouldPreventDefault('KeyR')).toBe(false);
  });
});

describe('isMoveAction', () => {
  it('separates player moves from pause', () => {
    const moves: GameAction[] = ['left', 'right', 'jump', 'slide'];
    for (const action of moves) expect(isMoveAction(action)).toBe(true);
    expect(isMoveAction('pause')).toBe(false);
  });
});

describe('actionFromSwipe (SPEC 4)', () => {
  const threshold = INPUT.swipeThresholdPx;

  it('does nothing until the finger passes the threshold', () => {
    expect(actionFromSwipe(0, 0)).toBeNull();
    expect(actionFromSwipe(threshold - 1, 0)).toBeNull();
    expect(actionFromSwipe(0, threshold - 1)).toBeNull();
    expect(actionFromSwipe(-(threshold - 1), 0)).toBeNull();
  });

  it('fires exactly at the threshold', () => {
    expect(actionFromSwipe(threshold, 0)).toBe('right');
    expect(actionFromSwipe(-threshold, 0)).toBe('left');
    expect(actionFromSwipe(0, -threshold)).toBe('jump');
    expect(actionFromSwipe(0, threshold)).toBe('slide');
  });

  it('uses the dominant axis', () => {
    // Mostly sideways, a little bit down.
    expect(actionFromSwipe(80, 20)).toBe('right');
    expect(actionFromSwipe(-80, 20)).toBe('left');
    // Mostly up, a little bit sideways.
    expect(actionFromSwipe(20, -80)).toBe('jump');
    expect(actionFromSwipe(-20, 80)).toBe('slide');
  });

  it('treats a perfectly diagonal swipe as a lane change', () => {
    expect(actionFromSwipe(50, 50)).toBe('right');
    expect(actionFromSwipe(-50, -50)).toBe('left');
  });

  it('ignores the smaller axis even when it is past the threshold', () => {
    // Dominant axis is vertical, so this is a jump, never a lane change.
    expect(actionFromSwipe(threshold + 1, -(threshold + 40))).toBe('jump');
  });

  it('respects a custom threshold', () => {
    expect(actionFromSwipe(10, 0, 5)).toBe('right');
    expect(actionFromSwipe(10, 0, 50)).toBeNull();
  });

  it('ignores nonsense input instead of crashing', () => {
    expect(actionFromSwipe(Number.NaN, 0)).toBeNull();
    expect(actionFromSwipe(0, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
