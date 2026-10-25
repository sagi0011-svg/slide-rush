/**
 * Entry point: boot the renderer, listen for input, run the fixed-timestep
 * loop, and move between the screens (SPEC 11).
 *
 * The loop runs game logic at a fixed 60 Hz and renders with interpolation,
 * so the game behaves the same at any display refresh rate (CLAUDE.md rule 5).
 */

import './ui/styles.css';
import { LAYOUT, SIM } from './config';
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
import { browserStorage, createSaveStore, shopChanges, shopStateOf } from './game/save';
import { buy, equip, type ItemKind, type ShopState } from './game/shop';
import { displayScore } from './game/scoring';
import { createInputSource } from './input';
import { createRenderer, type Frame, type Renderer } from './render/scene';
import { frameAlpha, lerp } from './render/interpolate';
import { createAudioManager } from './audio/manager';
import { createDebugOverlay, isDebugEnabled, type DebugInfo } from './debug/overlay';
import { createGallery, isGalleryEnabled } from './debug/gallery';
import { resolveRider } from './render/sprites';
import { createDebugTweaks, setSpeedScale, setTierOverride } from './game/debug-tweaks';
import { collectHitboxes, createHitboxList } from './game/hitboxes';
import type { HudValues } from './ui/hud';
import { createFeedback } from './ui/feedback';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';
import { createShopScreen } from './ui/shop';
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
  // The rider gallery replaces the game entirely (docs/ART-AND-SHOP.md §2).
  if (isGalleryEnabled()) {
    createGallery(document.body);
    return;
  }

  const canvas = requireElement<HTMLCanvasElement>('game-canvas');

  // A seed can be forced with ?seed=123 so a run can be reproduced exactly.
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const parsedSeed = seedParam === null ? Number.NaN : Number(seedParam);
  const fixedSeed = Number.isFinite(parsedSeed) ? parsedSeed : null;

  const save = createSaveStore(browserStorage());
  /**
   * The shop's view of the save: coins, what is owned, what is worn (§3).
   * Everything bought or equipped changes this and is written straight back,
   * so a purchase survives a reload. It never touches the run (rule 13).
   */
  let shop: ShopState = shopStateOf(save.data);
  const flow = createFlow();
  const stepper = createFixedStepper(SIM.dt, SIM.maxTicksPerFrame);
  // Debug mode's overrides (SPEC 13). Shared by every run, so a slider holds
  // across restarts; in a normal game they are never touched.
  const tweaks = createDebugTweaks();
  let showHitboxes = true;
  const debug = createDebugOverlay(requireElement('debug'), isDebugEnabled(), {
    onSpeedScale: (value) => setSpeedScale(tweaks, value),
    onTier: (tier) => setTierOverride(tweaks, tier),
    onInvincible: (on) => {
      tweaks.invincible = on;
    },
    onHitboxes: (on) => {
      showHitboxes = on;
    },
  });
  const syncDebug = (): void =>
    debug.sync({
      speedScale: tweaks.speedScale,
      tier: tweaks.tier,
      invincible: tweaks.invincible,
      hitboxes: showHitboxes,
    });
  syncDebug();
  const hitboxList = createHitboxList();

  let renderer: Renderer;
  try {
    // The equipped animal and ring, falling back to the free starters for any
    // id this build does not know, or any that is not owned (§2, §3). Only
    // ever a picture (rule 13).
    renderer = createRenderer(canvas, resolveRider(shop.equipped.animal, shop.equipped.ring));
  } catch (error) {
    console.error('Slide Rush: could not start WebGL', error);
    showMessage(STRINGS.webglUnsupported);
    return;
  }

  const newRun = (): RunState =>
    createRunState(fixedSeed ?? randomSeed(), { tutorial: !save.data.tutorialSeen, debug: tweaks });

  let state = newRun();
  let lastStumbles = state.stumbles;
  let wasDead = false;

  const input = createInputSource(canvas);
  const feedback = createFeedback(document.getElementById('flash'));
  feedback.setEnabled(!save.data.effectsOff);
  const audio = createAudioManager();
  audio.setMuted(save.data.muted);
  audio.prepare();
  // Browsers refuse to vibrate or play sound until the player has touched the
  // page, and complain loudly about every attempt before then (SPEC 12).
  // Which events count differs: a mouse press does, but on a touch screen only
  // lifting the finger does. So all of them ask, every time, and the audio
  // manager only acts while sound is still held back.
  const unlockFeedback = (): void => {
    feedback.unlock();
    audio.unlock();
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, unlockFeedback, { capture: true, passive: true });
  }

  // Whether the player is on a keyboard, so the prompts name the right thing.
  let usingKeyboard = false;
  window.addEventListener('keydown', (event) => {
    usingKeyboard = true;
    // Escape backs out of the shop, like the phone's back gesture (§3).
    if (event.code === 'Escape' && flow.phase === 'shop') leaveShop();
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
    magnetised: false,
    boosting: false,
    elapsed: 0,
    shakeTrigger: 0,
    shakeEnabled: feedback.enabled,
    dead: false,
    frameSeconds: 0,
    hitboxes: null,
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
      // A fresh run starts in silence: its counters all begin again at zero.
      audio.resetRun(state);
    }
    // Keeping the run's own pause in step means its clock never runs on
    // behind a screen.
    state.paused = flow.phase !== 'playing';
    screens.show(flow.phase);
    screens.setBestScore(save.data.bestScore);
    audio.setPhase(flow.phase);
    if (flow.phase === 'shop') {
      shopScreen.open();
      pushShopHistory();
    }
  };

  /**
   * The phone's back button and the browser's back gesture both close the
   * shop rather than leaving the game (§3). Opening the shop pushes an entry
   * of its own, so going back pops it; leaving by the Back button goes back
   * through the same history, which keeps the two in step.
   */
  let shopInHistory = false;
  function pushShopHistory(): void {
    if (shopInHistory) return;
    try {
      window.history.pushState({ slideRushShop: true }, '');
      shopInHistory = true;
    } catch {
      // Some browsers refuse pushState on a file:// page. The Back button
      // still works; the gesture simply leaves the page, as it did before.
      shopInHistory = false;
    }
  }
  function leaveShop(): void {
    if (shopInHistory) {
      // The popstate below is what actually goes home.
      window.history.back();
      return;
    }
    handleEvent('home');
  }
  window.addEventListener('popstate', () => {
    shopInHistory = false;
    if (flow.phase === 'shop') handleEvent('home');
  });

  const screens = createScreens({
    onEvent: handleEvent,
    onToggleSound() {
      const muted = !save.data.muted;
      save.update({ muted });
      screens.setMuted(muted);
      audio.setMuted(muted);
      // Sound coming back on says so, out loud.
      if (!muted) audio.play('uiTap');
    },
    onToggleEffects() {
      const effectsOff = !save.data.effectsOff;
      save.update({ effectsOff });
      screens.setEffectsOff(effectsOff);
      feedback.setEnabled(!effectsOff);
      // Coming back on, it shows itself: one small buzz and flash.
      if (!effectsOff) feedback.play('stumble');
    },
    onSkipTutorial() {
      skipTutorial(state.tutorial);
      save.update({ tutorialSeen: true });
    },
    onTap() {
      audio.play('uiTap');
    },
  });

  /** Writes the shop's state into the save, and puts it on screen. */
  const applyShop = (next: ShopState): void => {
    shop = next;
    save.update(shopChanges(shop));
    renderer.rider.setPair(resolveRider(shop.equipped.animal, shop.equipped.ring));
    shopScreen.setState(shop);
  };

  const shopScreen = createShopScreen({
    onBuy(kind: ItemKind, id: string) {
      const next = buy(shop, kind, id);
      // Refused — too dear, already owned, or not a thing. Nothing changes.
      if (next === shop) return false;
      // What you just paid for goes straight on; nobody buys a bear to leave
      // it in the cupboard.
      applyShop(equip(next, kind, id));
      audio.play('purchase');
      return true;
    },
    onEquip(kind: ItemKind, id: string) {
      applyShop(equip(shop, kind, id));
    },
    onBack() {
      leaveShop();
    },
    onTap() {
      audio.play('uiTap');
    },
  });
  shopScreen.setState(shop);

  screens.show(flow.phase);
  screens.setBestScore(save.data.bestScore);
  screens.setMuted(save.data.muted);
  screens.setEffectsOff(save.data.effectsOff);
  audio.setPhase(flow.phase);
  state.paused = true;

  // A phone on its side gets the "turn it upright" notice, and a run pauses
  // rather than carrying on behind it (SPEC 1).
  const sideways = window.matchMedia(
    `(orientation: landscape) and (max-height: ${LAYOUT.sidewaysMaxHeight}px) and (pointer: coarse)`,
  );
  const rotateNotice = requireElement('rotate');
  const onSideways = (): void => {
    rotateNotice.hidden = !sideways.matches;
    if (sideways.matches) handleEvent('lostFocus');
  };
  sideways.addEventListener('change', onSideways);
  onSideways();

  const onResize = (): void => renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // Pause when the tab or app goes away, and never try to catch up the lost
  // time when it comes back (SPEC 11).
  document.addEventListener('visibilitychange', () => {
    // Sound stops dead rather than playing to an empty room.
    audio.setHidden(document.hidden);
    if (document.hidden) {
      handleEvent('lostFocus');
    } else {
      stepper.reset();
      lastFrameMs = performance.now();
    }
  });

  // Debug keys (SPEC 13): 1, 2 and 3 grant the three power-ups, so they can be
  // tried without waiting for a pickup; I toggles invincibility and H the
  // hitboxes.
  if (debug.enabled) {
    const debugGrants: Record<string, PowerUpType> = {
      Digit1: 'shield',
      Digit2: 'magnet',
      Digit3: 'boost',
    };
    window.addEventListener('keydown', (event) => {
      const type = debugGrants[event.code];
      if (type !== undefined) grantPowerUp(state, type);
      if (event.code === 'KeyI') tweaks.invincible = !tweaks.invincible;
      if (event.code === 'KeyH') showHitboxes = !showHitboxes;
      if (event.code === 'KeyI' || event.code === 'KeyH') syncDebug();
    });
  }

  // Reused every frame rather than rebuilt, like the frame object (rule 7).
  const powerUpBars: Record<PowerUpType, number> = { shield: 0, magnet: 0, boost: 0 };
  const hudValues: HudValues = {
    score: 0,
    coins: 0,
    multiplier: 1,
    bestScore: 0,
    powerUps: powerUpBars,
    visible: false,
  };
  // What the debug panel shows, read only when it is about to show it.
  const fillDebugInfo = (info: DebugInfo): void => {
    const { player, spawner } = state;
    info.elapsed = state.elapsed;
    info.seed = state.rng.seed;
    info.ticks = state.ticks;
    info.speed = state.speed;
    info.lane = player.laneTarget;
    info.vertical = player.vertical;
    info.paused = state.paused;
    info.tier = state.tier;
    info.stumbles = state.stumbles;
    info.phase = `${flow.phase}/${state.phase}${tweaks.invincible ? ' (invincible)' : ''}`;
    info.chunk = spawner.lastChunkId;
    info.powerUps = POWERUP_TYPES.filter((type) => isActive(state.powerUps, type)).join(' ');
    info.pickup = spawner.pickup.active
      ? `${spawner.pickup.type} in ${Math.round(spawner.pickup.s - state.distance)}`
      : spawner.pickupPending
        ? 'waiting'
        : `due ${Math.round(state.nextPickupAt - state.elapsed)}s`;
    info.drawCalls = renderer.drawCalls;
    info.pixelRatio = renderer.pixelRatio;
    info.triangles = renderer.triangles;
    info.gamePixels = renderer.gamePixels;
    info.pixelScale = renderer.pixelScale;
    const { rider } = renderer;
    info.rider = `${rider.pair.animal}/${rider.pair.ring} ${rider.pose}`;
  };

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
      // The run's coins are now in hand and can be spent (§3).
      shop = shopStateOf(save.data);
      shopScreen.setState(shop);
    }
    wasDead = state.phase === 'dead';

    if (state.stumbles > lastStumbles) feedback.play('stumble');
    lastStumbles = state.stumbles;

    // Everything the run earned a sound for this frame (SPEC 12).
    audio.observe(state);

    // Death: once the beat has played out, show the score (SPEC 11).
    if (flow.phase === 'playing' && deathBeatOver(state)) {
      const score = displayScore(state.score);
      screens.setGameOver({
        score,
        coins: state.score.coins,
        totalCoins: save.data.totalCoins,
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
    frame.magnetised = isActive(state.powerUps, 'magnet');
    frame.boosting = isActive(state.powerUps, 'boost');
    frame.shakeTrigger = state.shakeTrigger;
    frame.shakeEnabled = feedback.enabled;
    frame.dead = state.phase === 'dead';
    frame.frameSeconds = frameSeconds;
    if (debug.enabled && showHitboxes) {
      collectHitboxes(state, hitboxList, frame.laneOffset, frame.height);
      frame.hitboxes = hitboxList;
    } else {
      frame.hitboxes = null;
    }
    renderer.draw(frame);
    // Only frames of actual play say anything about whether the phone keeps up.
    if (flow.phase === 'playing') renderer.measure(frameSeconds);

    for (const type of POWERUP_TYPES) {
      powerUpBars[type] = remainingFraction(state.powerUps, type);
    }
    hudValues.score = displayScore(state.score);
    hudValues.coins = state.score.coins;
    hudValues.multiplier = state.score.multiplier;
    hudValues.bestScore = save.data.bestScore;
    hudValues.visible = flow.phase === 'playing';
    hud.update(hudValues);

    // A prompt only shows while a lesson is actually waiting (SPEC 11).
    const step = state.tutorial.waiting ? currentStep(state.tutorial) : null;
    screens.setTutorialPrompt(
      flow.phase === 'playing' && step !== null ? step.id : null,
      usingKeyboard,
    );

    // The rider idling on the title screen, and the shop's big preview (§3).
    // Both redraw only when a frame of the bob or the spin actually changes.
    if (flow.phase === 'start' || flow.phase === 'shop') shopScreen.tick(frameSeconds);

    debug.update(frameSeconds, fillDebugInfo);

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

boot();
