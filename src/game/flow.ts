/**
 * Which screen the game is on (SPEC 11).
 *
 * Pure logic, no DOM. The run itself only knows whether it is running or
 * over; this is the layer above it that decides whether the player is looking
 * at the title, playing, paused, or reading their score.
 */

export type AppPhase = 'start' | 'playing' | 'paused' | 'gameOver' | 'shop';

/** Everything that can move the game from one screen to another. */
export type FlowEvent =
  | 'play' // Play on the start screen
  | 'pause'
  | 'resume'
  | 'restart' // Restart from the pause screen, or Play Again
  | 'died' // the death beat has finished
  | 'shop' // the Shop button, from the title or the game over screen
  | 'home'
  | 'lostFocus'; // the tab or app went away

export interface FlowState {
  phase: AppPhase;
  /** True once the player has started a run, so the title is behind them. */
  started: boolean;
}

export function createFlow(): FlowState {
  return { phase: 'start', started: false };
}

/**
 * Works out the next screen. Anything that does not make sense from where the
 * game is — resuming while on the title, say — simply leaves it alone.
 */
export function nextPhase(phase: AppPhase, event: FlowEvent): AppPhase {
  switch (event) {
    case 'play':
      return phase === 'start' ? 'playing' : phase;
    case 'pause':
      return phase === 'playing' ? 'paused' : phase;
    case 'lostFocus':
      // Never interrupt a screen that is already waiting for the player.
      return phase === 'playing' ? 'paused' : phase;
    case 'resume':
      return phase === 'paused' ? 'playing' : phase;
    case 'restart':
      // Both the pause screen and the game over screen start a fresh run.
      return phase === 'paused' || phase === 'gameOver' ? 'playing' : phase;
    case 'died':
      return phase === 'playing' ? 'gameOver' : phase;
    case 'shop':
      // The shop opens from the title and from the game over screen
      // (docs/ART-AND-SHOP.md section 3), never in the middle of a run.
      return phase === 'start' || phase === 'gameOver' ? 'shop' : phase;
    case 'home':
      // Back out of the shop, as the phone's own back button does.
      return phase === 'gameOver' || phase === 'paused' || phase === 'shop' ? 'start' : phase;
  }
}

/** Applies an event, and says whether anything actually changed. */
export function applyFlowEvent(flow: FlowState, event: FlowEvent): boolean {
  const next = nextPhase(flow.phase, event);
  if (next === flow.phase) return false;
  flow.phase = next;
  if (next === 'playing') flow.started = true;
  return true;
}

/** True while the simulation should be running. */
export function isSimulating(phase: AppPhase): boolean {
  return phase === 'playing';
}

/** True while a screen is covering the game and waiting for the player. */
export function isScreenUp(phase: AppPhase): boolean {
  return phase !== 'playing';
}

/** The events a fresh run has to follow, used to start one cleanly. */
export function needsFreshRun(event: FlowEvent): boolean {
  return event === 'play' || event === 'restart';
}
