import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK } from '../src/config';
import { createFeedback } from '../src/ui/feedback';

/**
 * The feedback layer touches the browser, so these tests stand in fake
 * versions of the few things it uses. What matters is that it asks for the
 * right buzz, never throws when the device refuses, and still flashes on a
 * device that cannot vibrate at all — an iPhone, for instance.
 */

interface FakeElement {
  classList: {
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
    current: Set<string>;
  };
  offsetWidth: number;
}

function fakeElement(): FakeElement {
  const current = new Set<string>();
  return {
    classList: {
      current,
      add: (...names: string[]) => names.forEach((name) => current.add(name)),
      remove: (...names: string[]) => names.forEach((name) => current.delete(name)),
    },
    offsetWidth: 0,
  };
}

const originalNavigator = globalThis.navigator;
const originalWindow = globalThis.window;

function setVibrate(vibrate: ((pattern: number | number[]) => boolean) | undefined): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: { ...originalNavigator, vibrate },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  });
});

describe('createFeedback', () => {
  it('asks for a short buzz on a stumble and a heavier one on death', () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const feedback = createFeedback(null);

    feedback.play('stumble');
    expect(vibrate).toHaveBeenCalledWith([...FEEDBACK.vibration.stumble]);

    feedback.play('death');
    expect(vibrate).toHaveBeenCalledWith([...FEEDBACK.vibration.death]);
  });

  it('makes death a stronger buzz than a stumble', () => {
    const total = (pattern: readonly number[]): number => pattern.reduce((sum, n) => sum + n, 0);
    expect(total(FEEDBACK.vibration.death)).toBeGreaterThan(total(FEEDBACK.vibration.stumble));
  });

  it('knows when the device cannot vibrate at all (every iPhone)', () => {
    setVibrate(undefined);
    expect(createFeedback(null).canVibrate).toBe(false);

    setVibrate(vi.fn(() => true));
    expect(createFeedback(null).canVibrate).toBe(true);
  });

  it('still flashes on a device that cannot vibrate', () => {
    setVibrate(undefined);
    const element = fakeElement();
    const feedback = createFeedback(element as unknown as HTMLElement);

    feedback.play('death');
    expect(element.classList.current.has('death')).toBe(true);
  });

  it('flashes with the class that matches the event', () => {
    setVibrate(vi.fn(() => true));
    const element = fakeElement();
    const feedback = createFeedback(element as unknown as HTMLElement);

    feedback.play('stumble');
    expect(element.classList.current.has('stumble')).toBe(true);
    expect(element.classList.current.has('death')).toBe(false);

    feedback.play('death');
    expect(element.classList.current.has('death')).toBe(true);
    expect(element.classList.current.has('stumble')).toBe(false);
  });

  it('does nothing at all once switched off', () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const element = fakeElement();
    const feedback = createFeedback(element as unknown as HTMLElement);

    feedback.setEnabled(false);
    vibrate.mockClear();

    feedback.play('stumble');
    expect(vibrate).not.toHaveBeenCalled();
    expect(element.classList.current.size).toBe(0);
    expect(feedback.enabled).toBe(false);

    feedback.setEnabled(true);
    feedback.play('stumble');
    expect(vibrate).toHaveBeenCalled();
  });

  it('stops any buzz that is already running when switched off', () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    createFeedback(null).setEnabled(false);
    expect(vibrate).toHaveBeenCalledWith([0]);
  });

  it('carries on when the browser refuses to vibrate', () => {
    setVibrate(() => {
      throw new Error('vibration blocked until the user interacts');
    });
    const element = fakeElement();
    const feedback = createFeedback(element as unknown as HTMLElement);

    expect(() => feedback.play('death')).not.toThrow();
    // The flash still happens, so the player is told something either way.
    expect(element.classList.current.has('death')).toBe(true);
  });

  it('works with no flash element at all', () => {
    setVibrate(vi.fn(() => true));
    const feedback = createFeedback(null);
    expect(() => feedback.play('stumble')).not.toThrow();
  });
});
