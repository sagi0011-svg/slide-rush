import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Game logic in src/game/ is plain TypeScript, so a node environment is enough.
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    /**
     * Vitest replaces stylesheet imports with an empty string unless this is
     * on, which would quietly make the palette-drift check in
     * tests/config.spec.ts pass without reading anything at all.
     */
    css: true,
  },
});
