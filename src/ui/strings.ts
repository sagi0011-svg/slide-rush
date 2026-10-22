/**
 * Every piece of UI text (CLAUDE.md rule 9). English for the MVP; a Hebrew
 * locale can be added later by swapping this object.
 */

export const STRINGS = {
  title: 'Slide Rush',
  loading: 'Loading…',
  webglUnsupported: 'This browser cannot run 3D graphics (WebGL). Try Chrome, Safari or Firefox.',
  paused: 'Paused',
  crashed: 'Crashed!',
  best: 'BEST',
  coinSymbol: '●',
  /** Short labels for the power-up timers on the HUD (SPEC 9). */
  powerUps: {
    shield: 'SHIELD',
    magnet: 'MAGNET',
    boost: 'BOOST',
  },
} as const;

export type StringKey = keyof typeof STRINGS;
