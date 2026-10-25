/**
 * The screens the player reads: title, pause and game over (SPEC 11). The
 * shop and Settings have modules of their own (src/ui/shop.ts, settings.ts).
 *
 * Every piece of text comes from src/ui/strings.ts, and every button reports
 * back as a flow event rather than doing anything itself, so the rules of
 * what follows what stay in src/game/flow.ts where they can be tested.
 */

import type { AppPhase, FlowEvent } from '../game/flow';
import type { NextGoal } from '../game/shop';
import type { TutorialStepId } from '../game/tutorial';
import { fill, itemName, STRINGS } from './strings';

export interface GameOverFacts {
  score: number;
  /** Coins picked up in this run. */
  coins: number;
  /** Coins in hand now, this run included (docs/ART-AND-SHOP.md section 3). */
  totalCoins: number;
  bestScore: number;
  /** True when this run beat the best score, for the badge. */
  isNewBest: boolean;
  /** The next thing to play for, or null once everything is bought. */
  goal: NextGoal | null;
}

export interface Screens {
  /** Shows whichever screen belongs to this phase, and hides the rest. */
  show(phase: AppPhase): void;
  /** Fills in the numbers on the game over screen. */
  setGameOver(facts: GameOverFacts): void;
  /** Keeps the best score on the title screen up to date. */
  setBestScore(best: number): void;
  /** Updates the pause screen's sound button to match the settings. */
  setMuted(muted: boolean): void;
  /** Updates the pause screen's shake-and-flash button to match the setting. */
  setEffectsOff(off: boolean): void;
  /** Shows a tutorial prompt, or nothing when `step` is null (SPEC 11). */
  setTutorialPrompt(step: TutorialStepId | null, usingKeyboard: boolean): void;
}

/** Every button, and the flow event it stands for. */
const BUTTONS: ReadonlyArray<[string, FlowEvent]> = [
  ['start-play', 'play'],
  ['start-shop', 'shop'],
  ['start-settings', 'settings'],
  ['paused-resume', 'resume'],
  ['paused-restart', 'restart'],
  ['paused-home', 'home'],
  ['over-again', 'restart'],
  ['over-shop', 'shop'],
  ['over-home', 'home'],
  ['pause-button', 'pause'],
];

const SCREEN_FOR_PHASE: Readonly<Record<AppPhase, string | null>> = {
  start: 'screen-start',
  playing: null,
  paused: 'screen-paused',
  gameOver: 'screen-over',
  shop: 'screen-shop',
  settings: 'screen-settings',
};

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setText(id: string, text: string): void {
  const element = byId(id);
  if (element !== null) element.textContent = text;
}

function formatNumber(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

export interface ScreensHandlers {
  /** Called when a button asks the game to do something. */
  onEvent(event: FlowEvent): void;
  /** Called by the pause screen's sound button: everything off, or back on. */
  onToggleSound(): void;
  /** Called by the shake-and-flash button. */
  onToggleEffects(): void;
  /** Called by Skip on the tutorial. */
  onSkipTutorial(): void;
  /** Called by every button, so a tap can be heard (SPEC 12). */
  onTap(): void;
}

export function createScreens(handlers: ScreensHandlers): Screens {
  // Fixed text, written once.
  setText('start-title', STRINGS.title);
  setText('start-tagline', STRINGS.tagline);
  setText('start-credit', STRINGS.credit);
  setText('start-play', STRINGS.play);
  setText('start-settings', STRINGS.settings.open);
  setText('paused-title', STRINGS.paused);
  setText('paused-resume', STRINGS.resume);
  setText('paused-restart', STRINGS.restart);
  setText('paused-home', STRINGS.home);
  setText('over-title', STRINGS.gameOver);
  setText('over-newbest', STRINGS.newBest);
  setText('over-score-label', STRINGS.score);
  setText('over-coins-label', STRINGS.coins);
  setText('over-best-label', STRINGS.best);
  setText('over-again', STRINGS.playAgain);
  setText('over-home', STRINGS.home);
  setText('tutorial-skip', STRINGS.skip);
  setText('rotate-text', STRINGS.rotate);

  for (const [id, event] of BUTTONS) {
    byId(id)?.addEventListener('click', () => {
      handlers.onTap();
      handlers.onEvent(event);
    });
  }
  // The sound button says so itself, by turning the sound on.
  // The title's switches live on the Settings screen now; the pause screen
  // keeps a quick pair, so a run never has to end to silence it.
  byId('paused-sound')?.addEventListener('click', () => handlers.onToggleSound());
  byId('paused-effects')?.addEventListener('click', () => {
    handlers.onTap();
    handlers.onToggleEffects();
  });
  byId('tutorial-skip')?.addEventListener('click', () => {
    handlers.onTap();
    handlers.onSkipTutorial();
  });

  const tutorial = byId('tutorial');
  const pauseButton = byId('pause-button');
  let shownStep: TutorialStepId | null | undefined;

  return {
    show(phase) {
      for (const id of Object.values(SCREEN_FOR_PHASE)) {
        if (id !== null) {
          const element = byId(id);
          if (element !== null) element.hidden = true;
        }
      }
      const wanted = SCREEN_FOR_PHASE[phase];
      if (wanted !== null) {
        const element = byId(wanted);
        if (element !== null) element.hidden = false;
      }
      // Nothing to pause unless a run is actually going.
      if (pauseButton !== null) pauseButton.hidden = phase !== 'playing';
    },

    setGameOver({ score, coins, totalCoins, bestScore, isNewBest, goal }) {
      setText('over-score', formatNumber(score));
      setText('over-coins', formatNumber(coins));
      setText('over-total', formatNumber(totalCoins));
      setText('over-best', formatNumber(bestScore));
      const badge = byId('over-newbest');
      if (badge !== null) badge.hidden = !isNewBest;

      const line = byId('over-goal');
      if (line !== null) {
        line.hidden = goal === null;
        if (goal !== null) {
          const name = itemName(goal.item.kind, goal.item.id);
          const ready = goal.missing === 0;
          line.textContent = ready
            ? fill(STRINGS.goal.ready, { name })
            : fill(STRINGS.goal.missing, {
                coins: `${STRINGS.coinSymbol} ${formatNumber(goal.missing)}`,
                name,
              });
          line.classList.toggle('ready', ready);
        }
      }
    },

    setBestScore(best) {
      setText('start-best', best > 0 ? `${STRINGS.best} ${formatNumber(best)}` : '');
    },

    setMuted(muted) {
      setText('paused-sound', muted ? STRINGS.soundOff : STRINGS.soundOn);
    },

    setEffectsOff(off) {
      setText('paused-effects', off ? STRINGS.effectsOff : STRINGS.effectsOn);
    },

    setTutorialPrompt(step, usingKeyboard) {
      if (tutorial === null) return;
      if (step === shownStep) return;
      shownStep = step;

      tutorial.hidden = step === null;
      if (step === null) return;
      const words = usingKeyboard ? STRINGS.tutorialKeys[step] : STRINGS.tutorial[step];
      setText('tutorial-text', words);
    },
  };
}
