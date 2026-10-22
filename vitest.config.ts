import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Game logic in src/game/ is plain TypeScript, so a node environment is enough.
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
