/**
 * Entry point: boot the renderer, listen for input, run the fixed-timestep loop.
 *
 * The loop runs game logic at a fixed 60 Hz and renders with interpolation,
 * so the game behaves the same at any display refresh rate (CLAUDE.md rule 5).
 */

import './ui/styles.css';
import { SIM } from './config';
import { createFixedStepper } from './game/loop';
import { applyAction, createRunState, shouldRestart, stepRun } from './game/state';
import { randomSeed } from './game/rng';
import { isSliding } from './game/player';
import { createInputSource } from './input';
import { createRenderer, type Frame, type Renderer } from './render/scene';
import { createDebugOverlay, isDebugEnabled } from './debug/overlay';
import { createFeedback } from './ui/feedback';
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

  // `let` because death starts a whole new run (temporary until M6 adds a
  // proper game-over screen).
  let state = createRunState(seed);
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

  const input = createInputSource(canvas);
  // Vibration where the browser allows it, and a flash everywhere else.
  const feedback = createFeedback(document.getElementById('flash'));

  // Watched so a stumble or a death can be felt the moment it happens.
  let lastStumbles = state.stumbles;
  let wasDead = false;

  const hudLeft = requireElement('hud-left');
  const hudRight = requireElement('hud-right');
  hudRight.textContent = STRINGS.m2Badge;

  const onResize = (): void => renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Pause when the tab or app goes away, and never try to catch up the lost
  // time when it comes back (SPEC 11).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.paused = true;
    } else {
      stepper.reset();
      lastFrameMs = performance.now();
    }
  });

  let lastFrameMs = performance.now();

  // One frame object, reused every frame: no allocations in the hot loop (rule 7).
  const frame: Frame = {
    distance: 0,
    laneOffset: 0,
    height: 0,
    sliding: false,
    bump: 0,
    obstacles: state.spawner.obstacles,
    shakeTrigger: 0,
    dead: false,
    frameSeconds: 0,
  };

  const tick = (nowMs: number): void => {
    const frameSeconds = (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;

    for (const action of input.drain()) {
      applyAction(state, action);
    }

    const plan = stepper.advance(frameSeconds);
    for (let i = 0; i < plan.ticks; i += 1) {
      stepRun(state);
    }

    // Buzz and flash on a trip, and harder when the run ends (SPEC 7).
    if (state.stumbles > lastStumbles) feedback.play('stumble');
    lastStumbles = state.stumbles;
    if (state.phase === 'dead' && !wasDead) feedback.play('death');
    wasDead = state.phase === 'dead';

    // Death restarts the run after a short beat. M6 replaces this with a
    // proper game-over screen.
    if (shouldRestart(state)) {
      state = createRunState(seedParam === null ? randomSeed() : seed);
      frame.obstacles = state.spawner.obstacles;
      lastStumbles = 0;
      wasDead = false;
      stepper.reset();
    }

    // Interpolate between the last two ticks so motion is smooth at any fps.
    const alpha = state.paused ? 1 : plan.alpha;
    const { player } = state;
    frame.distance = state.prevDistance + (state.distance - state.prevDistance) * alpha;
    frame.laneOffset = player.prevLaneOffset + (player.laneOffset - player.prevLaneOffset) * alpha;
    frame.height = player.prevHeight + (player.height - player.prevHeight) * alpha;
    frame.sliding = isSliding(player);
    frame.bump = player.bump;
    frame.shakeTrigger = state.shakeTrigger;
    frame.dead = state.phase === 'dead';
    frame.frameSeconds = frameSeconds;
    renderer.draw(frame);

    if (state.phase === 'dead') {
      hudLeft.textContent = STRINGS.crashed;
    } else if (state.paused) {
      hudLeft.textContent = STRINGS.paused;
    } else {
      hudLeft.textContent = `${Math.floor(state.distance)}${STRINGS.distanceUnit}`;
    }

    debug.update(frameSeconds, {
      elapsed: state.elapsed,
      seed: state.rng.seed,
      ticks: state.ticks,
      speed: state.speed,
      lane: player.laneTarget,
      vertical: player.vertical,
      paused: state.paused,
      tier: state.tier,
      stumbles: state.stumbles,
      phase: state.phase,
      chunk: state.spawner.lastChunkId,
    });

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

boot();
