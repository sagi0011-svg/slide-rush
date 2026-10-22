/**
 * Entry point: boot the renderer and run the fixed-timestep loop.
 *
 * The loop runs game logic at a fixed 60 Hz and renders with interpolation,
 * so the game behaves the same at any display refresh rate (CLAUDE.md rule 5).
 */

import './ui/styles.css';
import { SIM } from './config';
import { createFixedStepper } from './game/loop';
import { createRunState, stepRun } from './game/state';
import { randomSeed } from './game/rng';
import { createRenderer, type Renderer } from './render/scene';
import { createDebugOverlay, isDebugEnabled } from './debug/overlay';
import { STRINGS } from './ui/strings';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id} in index.html`);
  return element as T;
}

function showMessage(text: string): void {
  requireElement('message-text').textContent = text;
  requireElement('message').classList.add('visible');
}

function boot(): void {
  const canvas = requireElement<HTMLCanvasElement>('game-canvas');

  // A seed can be forced with ?seed=123 so a run can be reproduced exactly.
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const parsedSeed = seedParam === null ? Number.NaN : Number(seedParam);
  const seed = Number.isFinite(parsedSeed) ? parsedSeed : randomSeed();

  const state = createRunState(seed);
  const stepper = createFixedStepper(SIM.dt, SIM.maxTicksPerFrame);
  const debug = createDebugOverlay(requireElement('debug'), isDebugEnabled());

  let renderer: Renderer;
  try {
    renderer = createRenderer(canvas);
  } catch (error) {
    console.error('Slide Rush: could not start WebGL', error);
    showMessage(STRINGS.webglUnsupported);
    return;
  }

  requireElement('hud-right').textContent = STRINGS.m0Badge;

  const onResize = (): void => renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Reset the clock when the tab comes back, so we never try to catch up hours.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stepper.reset();
      lastFrameMs = performance.now();
    }
  });

  let lastFrameMs = performance.now();

  const frame = (nowMs: number): void => {
    const frameSeconds = (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;

    const plan = stepper.advance(frameSeconds);
    for (let i = 0; i < plan.ticks; i += 1) {
      stepRun(state);
    }

    // Interpolate between the last two ticks so motion is smooth at any fps.
    const spin = state.previousSpin + (state.spin - state.previousSpin) * plan.alpha;
    renderer.draw(spin);
    debug.update(frameSeconds, {
      elapsed: state.elapsed,
      seed: state.rng.seed,
      ticks: state.ticks,
    });

    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
}

boot();
