/**
 * Every piece of UI text (CLAUDE.md rule 9). English for the MVP; a Hebrew
 * locale can be added later by swapping this object.
 */

export const STRINGS = {
  title: 'Slide Rush',
  loading: 'Loading…',
  webglUnsupported: 'This browser cannot run 3D graphics (WebGL). Try Chrome, Safari or Firefox.',
  m2Badge: 'M2 — obstacles',
  paused: 'Paused',
  crashed: 'Crashed!',
  distanceUnit: ' m',
} as const;

export type StringKey = keyof typeof STRINGS;
