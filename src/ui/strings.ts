/**
 * Every piece of UI text (CLAUDE.md rule 9). English for the MVP; a Hebrew
 * locale can be added later by swapping this object.
 */

export const STRINGS = {
  title: 'Slide Rush',
  tagline: 'How far can you get?',
  loading: 'Loading…',
  webglUnsupported: 'This browser cannot run 3D graphics (WebGL). Try Chrome, Safari or Firefox.',

  play: 'Play',
  playAgain: 'Play Again',
  resume: 'Resume',
  restart: 'Restart',
  home: 'Home',
  skip: 'Skip',

  paused: 'Paused',
  gameOver: 'Game Over',
  newBest: 'New best!',

  best: 'BEST',
  score: 'SCORE',
  coins: 'COINS',
  coinSymbol: '●',

  soundOn: 'Sound on',
  soundOff: 'Sound off',

  /** Short labels for the power-up timers on the HUD (SPEC 9). */
  powerUps: {
    shield: 'SHIELD',
    magnet: 'MAGNET',
    boost: 'BOOST',
  },

  /** The three first-run prompts (SPEC 11). */
  tutorial: {
    move: 'Swipe left or right to change lane',
    jump: 'Swipe up to jump',
    slide: 'Swipe down to duck',
  },

  /** The same three, for someone playing on a keyboard. */
  tutorialKeys: {
    move: 'Press ← or →',
    jump: 'Press ↑ or Space',
    slide: 'Press ↓',
  },
} as const;

export type StringKey = keyof typeof STRINGS;
