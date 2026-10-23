# Slide Rush

An endless runner set on a water-park slide, in the spirit of Subway Surfers. Slide down, switch between 3 lanes, jump over mines, duck under arches, grab coins and power-ups, and see how far you get.

**Status:** `v0.1.0` — the MVP is complete and checked on phones (Chrome and Safari). Placeholder art throughout; the design & art pass comes next.

> Hit feedback: the phone vibrates on a trip or a crash where the browser
> allows it. Safari on iOS has never supported the Vibration API, and every
> browser on an iPhone is Safari underneath, so iPhones get the screen flash
> and the camera shake instead.

**Play it:** https://sagi0011-svg.github.io/slide-rush/

- Platform: browser, mobile-first (portrait), keyboard supported on desktop
- Stack: Three.js + TypeScript + Vite, Vitest for tests
- Hosting: GitHub Pages (auto-deploy from `main`)

## Docs

- [Game spec](docs/SPEC.md) — what the game is, every rule and number
- [Milestones](docs/MILESTONES.md) — build order, with a ready prompt per milestone
- [CLAUDE.md](CLAUDE.md) — working rules for Claude Code in this repo
- [Assets](ASSETS.md) — where every sound and visual comes from, and its licence

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Change lane | Swipe left / right | ← / → or A / D |
| Jump | Swipe up | ↑ / W / Space |
| Slide (duck) | Swipe down | ↓ / S |
| Pause | Pause button | Esc / P |

## Development

```bash
npm install
npm run dev              # local dev server at http://localhost:5173/slide-rush/
npm run dev -- --host    # same, but reachable from your phone on the same Wi-Fi
npm test                 # unit tests
npm run lint             # eslint + prettier + typecheck
npm run build            # production build into dist/
npm run preview          # serve the production build locally
```

### Debug flags

| Flag | What it does |
|---|---|
| `?debug=1` | Debug panel: fps and the slowest frame, draw calls, resolution, speed, tier, seed and more, plus sliders and switches |
| `?seed=123` | Forces the run seed, so a run can be reproduced exactly |
| `1` `2` `3` | With `?debug=1`: grants shield, magnet and speed boost |
| `I` | With `?debug=1`: invincibility on/off (obstacles are passed straight through) |
| `H` | With `?debug=1`: hitbox outlines on/off (green player, red deadly, yellow trips) |

The panel also has a **speed** slider (x0.25 to x2) and a **tier** slider (auto, or hold any difficulty tier). Both stay set across restarts until the page is reloaded. Tap **controls** to fold the panel away.

### Deployment

Every push to `main` runs lint, tests and build in GitHub Actions, then publishes
`dist/` to GitHub Pages. The Vite `base` is `/slide-rush/`, matching the Pages URL.
