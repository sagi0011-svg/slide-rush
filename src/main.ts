/**
 * Entry point: boot the renderer, listen for input, run the fixed-timestep
 * loop, and move between the screens (SPEC 11).
 *
 * The loop runs game logic at a fixed 60 Hz and renders with interpolation,
 * so the game behaves the same at any display refresh rate (CLAUDE.md rule 5).
 */

import './ui/styles.css';
import { SIM } from './config';
import { createFixedStepper } from './game/loop';
import {
  applyAction,
  createRunState,
  deathBeatOver,
  grantPowerUp,
  stepRun,
  type RunState,
} from './game/state';
import { randomSeed } from './game/rng';
import { isSliding } from './game/player';
import { isActive, POWERUP_TYPES, remainingFraction, type PowerUpType } from './game/powerups';
import {
  applyFlowEvent,
  createFlow,
  isSimulating,
  needsFreshRun,
  type FlowEvent,
} from './game/flow';
import { currentStep, skipTutorial } from './game/tutorial';
import { browserStorage, createSaveStore } from './game/save';
import { displayScore } from './game/scoring';
import { createInputSource } from './input';
import { createRenderer, type Frame, type Renderer } from './render/scene';
import { frameAlpha, lerp } from './render/interpolate';
import { createDebugOverlay, isDebugEnabled } from './debug/overlay';
import { createFeedback } from './ui/feedback';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';
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
  const fixedSeed = Number.isFinite(parsedSeed) ? parsedSeed : null;

  const save = createSaveStore(browserStorage());
  const flow = createFlow();
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

  const newRun = (): RunState =>
    createRunState(fixedSeed ?? randomSeed(), { tutorial: !save.data.tutorialSeen });

  let state = newRun();
  let lastStumbles = state.stumbles;
  let wasDead = false;

  const input = createInputSource(canvas);
  const feedback = createFeedback(document.getElementById('flash'));
  // Browsers refuse to vibrate until the player has touched the page, and
  // complain loudly about every attempt before then.
  const unlockFeedback = (): void => feedback.unlock();
  window.addEventListener('pointerdown', unlockFeedback, { once: true });
  window.addEventListener('keydown', unlockFeedback, { once: true });

  // Whether the player is on a keyboard, so the prompts name the right thing.
  let usingKeyboard = false;
  window.addEventListener('keydown', () => {
    usingKeyboard = true;
  });

  const hud = createHud(requireElement('frame'));

  // One frame object, reused every frame: no allocations in the hot loop.
  const frame: Frame = {
    distance: 0,
    laneOffset: 0,
    height: 0,
    sliding: false,
    bump: 0,
    obstacles: state.spawner.obstacles,
    coins: state.spawner.coins,
    pickup: state.spawner.pickup,
    shielded: false,
    boosting: false,
    elapsed: 0,
    shakeTrigger: 0,
    dead: false,
    frameSeconds: 0,
  };

  const handleEvent = (event: FlowEvent): void => {
    if (!applyFlowEvent(flow, event)) return;

    if (needsFreshRun(event)) {
      state = newRun();
      frame.obstacles = state.spawner.obstacles;
      frame.coins = state.spawner.coins;
      frame.pickup = state.spawner.pickup;
      lastStumbles = 0;
      wasDead = false;
      stepper.reset();
    }
    // Keeping the run's own pause in step means its clock never runs on
    // behind a screen.
    state.paused = flow.phase !== 'playing';
    screens.show(flow.phase);
    screens.setBestScore(save.data.bestScore);
  };

  const screens = createScreens({
    onEvent: handleEvent,
    onToggleSound() {
      const muted = !save.data.muted;
      save.update({ muted });
      screens.setMuted(muted);
      // There is nothing to silence until the sound manager arrives in M7.
    },
    onSkipTutorial() {
      skipTutorial(state.tutorial);
      save.update({ tutorialSeen: true });
    },
  });

  screens.show(flow.phase);
  screens.setBestScore(save.data.bestScore);
  screens.setMuted(save.data.muted);
  state.paused = true;

  const onResize = (): void => renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Pause when the tab or app goes away, and never try to catch up the lost
  // time when it comes back (SPEC 11).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleEvent('lostFocus');
    } else {
      stepper.reset();
      lastFrameMs = performance.now();
    }
  });

  // Debug keys: 1, 2 and 3 grant the three power-ups, so they can be tried
  // without waiting for a pickup (SPEC 13).
  if (debug.enabled) {
    const debugGrants: Record<string, PowerUpType> = {
      Digit1: 'shield',
      Digit2: 'magnet',
      Digit3: 'boost',
    };
    window.addEventListener('keydown', (event) => {
      const type = debugGrants[event.code];
      if (type !== undefined) grantPowerUp(state, type);
    });
  }

  // Reused every frame rather than rebuilt, like the frame object (rule 7).
  const powerUpBars: Record<PowerUpType, number> = { shield: 0, magnet: 0, boost: 0 };

  let lastFrameMs = performance.now();

  const tick = (nowMs: number): void => {
    const frameSeconds = (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;

    for (const action of input.drain()) {
      if (action === 'pause') {
        handleEvent(flow.phase === 'paused' ? 'resume' : 'pause');
        continue;
      }
      applyAction(state, action);
    }

    const plan = stepper.advance(frameSeconds);
    if (isSimulating(flow.phase)) {
      for (let i = 0; i < plan.ticks; i += 1) stepRun(state);
    }

    if (state.phase === 'dead' && !wasDead) {
      feedback.play('death');
      save.finishRun(displayScore(state.score), state.score.coins);
    }
    wasDead = state.phase === 'dead';

    if (state.stumbles > lastStumbles) feedback.play('stumble');
    lastStumbles = state.stumbles;

    // Death: once the beat has played out, show the score (SPEC 11).
    if (flow.phase === 'playing' && deathBeatOver(state)) {
      const score = displayScore(state.score);
      screens.setGameOver({
        score,
        coins: state.score.coins,
        bestScore: save.data.bestScore,
        isNewBest: score > 0 && score >= save.data.bestScore,
      });
      handleEvent('died');
    }

    // The tutorial is remembered the moment it is finished (SPEC 10).
    if (state.tutorial.done && !save.data.tutorialSeen) {
      save.update({ tutorialSeen: true });
    }

    // Interpolate between the last two ticks so motion is smooth at any fps —
    // but hold still whenever the simulation itself is stopped.
    const alpha = frameAlpha(plan.alpha, !isSimulating(flow.phase));
    const { player } = state;
    frame.distance = lerp(state.prevDistance, state.distance, alpha);
    frame.laneOffset = lerp(player.prevLaneOffset, player.laneOffset, alpha);
    frame.height = lerp(player.prevHeight, player.height, alpha);
    frame.sliding = isSliding(player);
    frame.bump = player.bump;
    frame.elapsed = state.elapsed;
    frame.shielded = isActive(state.powerUps, 'shield');
    frame.boosting = isActive(state.powerUps, 'boost');
    frame.shakeTrigger = state.shakeTrigger;
    frame.dead = state.phase === 'dead';
    frame.frameSeconds = frameSeconds;
    renderer.draw(frame);

    for (const type of POWERUP_TYPES) {
      powerUpBars[type] = remainingFraction(state.powerUps, type);
    }
    hud.update({
      score: displayScore(state.score),
      coins: state.score.coins,
      multiplier: state.score.multiplier,
      bestScore: save.data.bestScore,
      powerUps: powerUpBars,
      visible: flow.phase === 'playing',
    });

    // A prompt only shows while a lesson is actually waiting (SPEC 11).
    const step = state.tutorial.waiting ? currentStep(state.tutorial) : null;
    screens.setTutorialPrompt(
      flow.phase === 'playing' && step !== null ? step.id : null,
      usingKeyboard,
    );

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
      phase: `${flow.phase}/${state.phase}`,
      chunk: state.spawner.lastChunkId,
      powerUps: POWERUP_TYPES.filter((type) => isActive(state.powerUps, type)).join(' '),
      pickup: state.spawner.pickup.active
        ? `${state.spawner.pickup.type} in ${Math.round(state.spawner.pickup.s - state.distance)}`
        : state.spawner.pickupPending
          ? 'waiting'
          : `due ${Math.round(state.nextPickupAt - state.elapsed)}s`,
    });

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

boot();
