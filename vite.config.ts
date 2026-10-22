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
  },
});
