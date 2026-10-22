# Slide Rush

An endless runner set on a water-park slide, in the spirit of Subway Surfers. Slide down, switch between 3 lanes, jump over mines, duck under arches, grab coins and power-ups, and see how far you get.

**Status:** pre-production. Specs are written; code starts at Milestone 0.

- Platform: browser, mobile-first (portrait), keyboard supported on desktop
- Stack: Three.js + TypeScript + Vite, Vitest for tests
- Hosting: GitHub Pages (auto-deploy from `main`)

## Docs

- [Game spec](docs/SPEC.md) — what the game is, every rule and number
- [Milestones](docs/MILESTONES.md) — build order, with a ready prompt per milestone
- [CLAUDE.md](CLAUDE.md) — working rules for Claude Code in this repo

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
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build
```
