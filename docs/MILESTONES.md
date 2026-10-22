# Milestones

Build in this order. One milestone per Claude Code session (or more if needed). After each one: Sagi plays it on phone + desktop, then we continue.

Each milestone has a **prompt** to paste into Claude Code as-is.

---

## M0 — Project setup & auto-deploy
Vite + TypeScript (strict) + Three.js, Vitest, ESLint + Prettier, folder layout from CLAUDE.md, `src/config.ts`, seeded RNG with tests. GitHub Actions: run lint + tests + build on every push, deploy `dist/` to GitHub Pages from `main` (Vite `base: '/slide-rush/'`). A spinning placeholder cube on a portrait-letterboxed canvas proves the pipeline.

**Done when:** the live Pages URL shows the cube on phone and desktop, CI is green.

> Prompt: `Read CLAUDE.md and docs/SPEC.md. Do Milestone M0 from docs/MILESTONES.md. At the end, give me the exact steps to enable GitHub Pages in the repo settings (if needed), the live URL, and how to run it locally and on my phone.`

---

## M1 — Slide, player and controls
Fixed-timestep loop with interpolation. Recycled straight track segments with 3 lanes, visual-only curves. Chase camera. Player capsule: lane change, jump, slide, input buffering, mid-air drop. Touch swipe (30 px, recognised on move) + keyboard. Speed ramp from SPEC §5. Unit tests for player movement and input mapping.

**Done when:** you can slide endlessly and move/jump/duck smoothly with swipes and keys.

> Prompt: `Do Milestone M1 from docs/MILESTONES.md, following docs/SPEC.md sections 2–5. Explain how to test the controls on my phone.`

---

## M2 — Obstacles, collisions and death
The 4 obstacle types with placeholder meshes, AABB collisions with forgiving hitboxes, side-hit bounce, stumble + second-stumble death. Chunk data format + spawner + first ~8 warm-up chunks. Fairness validator test. Basic death → instant restart (temporary, no UI yet).

**Done when:** you can die, stumble, and every chunk passes the fairness test.

> Prompt: `Do Milestone M2 from docs/MILESTONES.md (SPEC sections 6–7). Include the chunk fairness validator test.`

---

## M3 — Coins, scoring and saving
Instanced spinning coins placed by chunks, pickup, scoring + multiplier rules, simple HUD (score, coins, multiplier), localStorage save (best score, total coins, versioned key, safe fallback).

**Done when:** score and coins count correctly and best score survives a page reload.

> Prompt: `Do Milestone M3 from docs/MILESTONES.md (SPEC sections 8 and 10).`

---

## M4 — Power-ups
Pickup spawning (20–30 s, chunk slots), Shield, Magnet, Speed Boost exactly as SPEC §9, stacking + timer reset, post-boost grace, HUD timers. Unit tests for every power-up rule.

**Done when:** all three work, can be active together, and tests cover the edge cases (shield vs. stumble, boost ending near an obstacle).

> Prompt: `Do Milestone M4 from docs/MILESTONES.md (SPEC section 9). Add debug keys to grant each power-up so I can test them.`

---

## M5 — Difficulty and chunk library
Difficulty tiers from SPEC §5, tier-filtered spawner, breathers, no-repeat rule, post-boost safe window. Grow the library to 25+ chunks across tiers with coin trails. Fairness test covers chunk pairs at max tier speed.

**Done when:** a 4-minute run feels like a smooth ramp from easy to hard, never unfair.

> Prompt: `Do Milestone M5 from docs/MILESTONES.md (SPEC sections 5–6). Afterwards, describe each tier in a few plain words so I know what to look for when playtesting.`

---

## M6 — Screens, tutorial and game flow
Start, first-run tutorial, HUD polish (safe areas), pause (+ auto-pause on blur), game over with slow-mo beat and "New best!", instant Play Again. All strings in `src/ui/strings.ts`.

**Done when:** a new player can open the link and understand how to play without being told.

> Prompt: `Do Milestone M6 from docs/MILESTONES.md (SPEC section 11).`

---

## M7 — Audio
Sound manager, all SFX and music from SPEC §12, mute persisted, unlock on first interaction, `ASSETS.md` with sources/licenses.

> Prompt: `Do Milestone M7 from docs/MILESTONES.md (SPEC section 12). Only use CC0/royalty-free sounds and list them in ASSETS.md.`

---

## M8 — Debug, performance and release v0.1
Full debug mode (`?debug=1`) from SPEC §13, performance pass on mobile (instancing, pooling, no GC spikes), bundle check, cross-browser check, bug-fix pass, tag `v0.1.0`.

**Done when:** steady 60 fps on a mid-range phone and the MVP checklist in SPEC is met.

> Prompt: `Do Milestone M8 from docs/MILESTONES.md (SPEC section 13). Give me a QA checklist to run on my phone before we tag v0.1.0.`

---

## After MVP (not now)
Design & art pass → shop/upgrades → missions → Hebrew UI → leaderboard → app wrapping.
