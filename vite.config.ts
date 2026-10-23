import { defineConfig } from 'vite';

// `base` must match the GitHub Pages sub-path: https://<user>.github.io/slide-rush/
export default defineConfig({
  base: '/slide-rush/',
  server: {
    // `npm run dev -- --host` exposes the server on the local network (phone testing).
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js gets a file of its own (SPEC 13). It is ~90% of the download and
    // only changes when the library is upgraded, so a returning player keeps
    // it cached and only fetches the game's own small file after an update.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
    // That one file is Three.js itself, minified (~540 kB, ~140 kB gzipped),
    // and there is no smaller build of the renderer to swap in. The limit sits
    // just above it, so the game's own file still warns if it ever balloons.
    chunkSizeWarningLimit: 600,
  },
});
