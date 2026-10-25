# CLAUDE.md — Slide Rush

Read this first in every session. Then read `docs/SPEC.md` (the source of truth for rules and numbers, M0–M8), `docs/ART-AND-SHOP.md` (the same for the art pass, riders and shop, M9–M12), `docs/VISUAL-STYLES.md` (the three visual styles, M13) and `docs/MILESTONES.md` (what to build next).

## The project
Endless water-slide runner for the browser. Mobile-first, portrait. Three.js + TypeScript (strict) + Vite. Tests with Vitest. Deployed to GitHub Pages via GitHub Actions.

## The owner
Sagi is not a professional developer. When you report back:
- Explain what changed in plain, jargon-free language (he reads Hebrew best; short English is fine).
- Give exact copy-paste commands for anything he must run, and say what he should see.
- End every milestone with a short "how to test it yourself" checklist (on phone and desktop).

## Working rules
1. **One milestone at a time.** Do only the milestone you were asked for. Do not start the next one.
2. **Spec is the source of truth.** If something in the spec is unclear or seems wrong, stop and ask instead of guessing. If you must change a rule or a number, update `docs/SPEC.md` in the same commit and say so.
3. **All tunable numbers live in `src/config.ts`.** No magic numbers in game code.
4. **Logic is separate from rendering.** Game rules (lanes, physics, collisions, scoring, power-ups, spawning, difficulty) are plain TypeScript in `src/game/` with no Three.js imports, so they can be unit-tested. Rendering in `src/render/` reads game state and draws it. Never put rules in render code.
5. **Fixed-timestep simulation** (60 Hz) with interpolated rendering. Gameplay must behave the same at 30, 60 or 120 fps.
6. **Seeded RNG** for all gameplay randomness (`src/game/rng.ts`), so runs are reproducible in tests and debug.
7. **Object pooling** for track segments, obstacles, coins and pickups. No per-frame allocations in the hot loop.
8. **Visuals built in code.** Every visual still goes through the `src/render/` factories; no downloaded models and no image files. Pixel sprites are defined in code as small pixel maps plus palette indexes. Since M13 there are three visual styles (Sunset Pixel, Classic 3D, Retro Pixel); everything that differs by style goes through the theme system, never through `if` checks in game code.
9. **UI text in English**, all strings in `src/ui/strings.ts` (ready for Hebrew later).
10. **Tests:** every rule in `src/game/` gets unit tests. `npm test`, `npm run build` and `npm run lint` must pass before you say a milestone is done.
11. **Commits:** small, descriptive, conventional style (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Push to `main` at the end of each milestone; the Pages deploy runs automatically.
12. **Shop and cosmetics are in scope** (v0.2). Still out of scope (do not build): upgrades that change gameplay, online leaderboard, revive/continue, ads, accounts, Hebrew UI.
13. **Cosmetics are visual only.** Hitboxes, physics, speed and scoring must not change no matter which animal or ring is equipped, and a test must prove it.

## Folder layout (target)
```
src/
  main.ts            entry: boot, loop
  config.ts          every tunable number + palette
  game/              pure logic, no three.js (tested)
    rng.ts state.ts player.ts input-actions.ts collisions.ts
    obstacles.ts coins.ts powerups.ts scoring.ts difficulty.ts
    chunks/          chunk definitions + spawner
  render/            three.js scene, camera, factories, interpolation
  input/             touch swipe + keyboard -> input actions
  ui/                HTML/CSS overlay screens + HUD, strings.ts
  audio/             sound manager
  debug/             debug overlay (enabled with ?debug=1)
tests/               vitest specs mirroring src/game
```

## Theme system (M13, `docs/VISUAL-STYLES.md`)
The player picks one of three looks in Settings: `sunset` (Sunset Pixel, the v0.2 look and the default), `classic` (Classic 3D) and `pixel` (Retro Pixel).
- **One saved field**, `visualStyle` in `src/game/save.ts`. Unknown values fall back to `sunset`. Nothing else in `src/game/` may read it; `tests/cosmetics.spec.ts` checks both that and that a seeded run is identical in every look.
- **All per-look values live in `THEMES` in `src/config.ts`**: the palette (every key of `PALETTE`), `pixelated`, pixel sizes, `shading` (`toon` / `lit` / `flat`), `outlines`, `smoothTextures`, `antialias`, `skyDither`, `mine` (`buoy` / `bomb`) and `spriteRecolor`. A new look is a new entry there plus its CSS, not new `if`s.
- **`src/render/theme.ts` is the only render code that knows which look is on.** Render code asks it for `palette()` or `theme()` *when it builds something* (materials, textures, geometry), never per frame and never by comparing style names. Use `surfaceMaterial()` for solid surfaces and `addOutline()` / `createOutlinedInstances()` for rims; they follow the theme.
- **Switching rebuilds the renderer** (`applyVisualStyle` in `src/main.ts`): dispose, `setVisualStyle`, `createRenderer` on the same canvas. That is safe because Settings only opens from the title (`src/game/flow.ts`), so no run is ever drawn across a switch. Antialiasing is multisampling on the render target, so the canvas never needs replacing.
- **The UI follows `<html data-style="…">`.** `src/ui/styles.css` is the v0.2 UI, used by `sunset` and `classic` unchanged. `src/ui/style-pixel.css` overrides it only under `[data-style='pixel']`. CSS cannot import TypeScript, so each stylesheet repeats its palette, and `tests/config.spec.ts` keeps the copies in step with `THEMES`.
- **Sunset Pixel must stay pixel-identical to v0.2.** Check any change to shared render code by comparing frames against the `before-visual-styles` tag with the clock taken over (step `requestAnimationFrame` by hand, hide the HTML, compare the canvas).

## Commands
- `npm run dev` — dev server (use `--host` to test on a phone on the same Wi-Fi)
- `npm test` — unit tests
- `npm run lint` — lint + typecheck
- `npm run build` — production build into `dist/`
