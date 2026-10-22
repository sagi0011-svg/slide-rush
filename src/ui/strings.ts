/**
 * Every piece of UI text (CLAUDE.md rule 9). English for the MVP; a Hebrew
 * locale can be added later by swapping this object.
 */

export const STRINGS = {
  title: 'Slide Rush',
  loading: 'Loading…',
  webglUnsupported: 'This browser cannot run 3D graphics (WebGL). Try Chrome, Safari or Firefox.',
  m1Badge: 'M1 — slide & controls',
  paused: 'Paused',
  distanceUnit: ' m',
} as const;

export type StringKey = keyof typeof STRINGS;
