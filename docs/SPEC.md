# Slide Rush — Game Spec (MVP)

Source of truth for rules and numbers. All numbers are starting values and live in `src/config.ts`; tune them by playtesting. Units: 1 unit ≈ 1 meter, time in seconds.

## 1. Product
- Endless runner on a water-park slide, Subway Surfers style.
- Goal of the MVP: a polished, portfolio-quality core loop. Built so a shop, more content and real art can be added later.
- Browser, mobile-first, **portrait**. On desktop the game renders as a portrait frame centered on screen (aspect ~9:16, letterboxed).
- A phone held sideways (touch screen, landscape, no taller than `LAYOUT.sidewaysMaxHeight`) gets a full-screen "turn your phone upright" notice instead, and a run in progress pauses. A tablet held sideways is tall enough to play as normal.
- UI language: English.

## 2. Camera and world
- 3D, third-person chase camera behind and above the player, looking down the slide.
- Camera follows lane changes smoothly (damped), dips slightly on slide, rises slightly on jump. Small FOV kick during Speed Boost.
- The slide is built from recycled straight track segments. **Curves and drops are visual only**: gameplay lanes are always straight along the Z axis; the visual bend is applied in the render layer (e.g. a curve offset on the world/camera). Occasional visual "drop" sections give a brief speed-feel boost (camera + FOV), with no gameplay effect.
- The visual slide only ever descends — it never climbs back up, and the sideways sway stays gentle enough to keep the track ahead inside the portrait view. Both rules exist so the slide can never hide what is coming.
- Fog/far plane hides segment spawning. Track is pre-built ~150 units ahead and recycled behind the camera.

## 3. Lanes and player movement
- 3 lanes: -1, 0, +1. Lane width: 2.5 units. Player starts in the center.
- **Lane change:** 0.15 s eased move. A new lane input during a move retargets immediately (fast double-swipe works). Swiping past the edge does nothing (small bump feedback).
- **Jump:** 0.65 s airtime, apex height 2.2 units. Clears low obstacles. Can change lanes mid-air.
- **Slide (duck):** 0.7 s low hitbox. Clears high obstacles. Swiping down mid-air cancels the jump into a fast drop, then slides on landing.
- **Input buffering:** one action queued for up to 0.15 s (e.g. jump pressed just before landing triggers on landing). A newer buffered action replaces an older one.
- **Jump while sliding** cancels the slide and jumps immediately. **Slide while already sliding** is buffered, so it extends the slide rather than restarting it. Lane changes are never buffered: they apply at once in any state, or are dropped at the edge.

## 4. Controls
- Touch: swipe left/right/up/down. A swipe is recognised as soon as the finger moves past **30 px** (do not wait for touch end; exactly 30 px counts). Direction = dominant axis; a perfectly diagonal swipe counts as a lane change. One action per touch.
- Keyboard: ←/→ or A/D, ↑/W/Space = jump, ↓/S = slide, Esc/P = pause.
- Prevent page scroll, zoom and pull-to-refresh on the game canvas.

## 5. Speed and difficulty
- Forward speed starts at **14 u/s** and rises smoothly to **32 u/s** at **180 s**, then stays flat.
- Difficulty tier is derived from elapsed run time (not distance):
  - **Tier 0 — Warm-up (0–30 s):** only low mines and full blockers, wide spacing, always at least 2 open lanes.
  - **Tier 1 (30–90 s):** add high obstacles and soft obstacles.
  - **Tier 2 (90–180 s):** denser chunks, combos (e.g. jump then change lane).
  - **Tier 3 (180 s+):** hardest chunk pool.
- Minimum reaction distance between consecutive required actions scales with speed so it is always humanly possible (≥ 0.45 s of travel).

## 6. Track generation — chunks
- The track is filled with **hand-authored chunks**: short (40 unit) patterns of obstacles, coins and optional pickup slot, defined as data in `src/game/chunks/`.
- Each chunk has: id, tier range, length, list of placements `{type, lane, z}`.
- The spawner picks chunks at random (seeded) from the pool allowed by the current tier, avoiding the same chunk twice in a row. Short empty "breather" gaps between chunks at lower tiers.
- **Opening stretch:** every run that does not start with the tutorial opens with **100 units of coins and no obstacles** before the first random chunk, so the player can find their feet.
- **Fairness rule (enforced by a test):** every chunk, and every pair of consecutive chunks, has at least one survivable path given lane-change time, jump/slide durations and the max speed of its tiers. A validator test checks all chunks.
- The validator searches the real player simulation, and is deliberately stricter than the rule above: the path it finds must take **no hits at all** (not even a stumble), must work from **every lane the player could arrive in**, and may only act on a coarse time grid. A chunk that passes is therefore comfortably fair.
- Coin trails in chunks guide the player along the good path (lines, arcs over jumps).
- **Coin safety (enforced by a test):** no coin may sit somewhere that can only be reached from a pose that hits an obstacle. Coins show the way through; one that led into a wall would do the opposite.
- MVP target: at least 25 chunks across tiers.
- **Chunk geometry (enforced by a test):** how much room a chunk must leave is worked out from the speed of the hardest tier it can appear in. Nothing may start so early, or finish so late, that a player arriving from the previous chunk cannot react; two things to deal with must be at least one reaction time apart; and a gate that shuts two lanes needs room for two lane changes. At the top tier, where the speed is flat out and there is no breather, this comes to: nothing before z 12, nothing after z 28, 16 units between obstacles, and no two-lane gate before z 26.

## 7. Obstacles
| Type | Placeholder look | How to pass | On hit |
|---|---|---|---|
| **Low mine** | red spiky sphere, low | Jump over, or change lane | **Death** |
| **High obstacle** (arch / water jet) | blue arch across one lane | Slide under, or change lane | **Death** |
| **Full blocker** (pipe / wall) | grey tall block filling the lane | Change lane only | **Death** (front hit) |
| **Soft obstacle** (inflatable ring / duck) | yellow torus, low | Jump over, or change lane | **Stumble** |

- **Side hit:** switching lanes into the side of any obstacle = stumble + bounce back to the original lane (not death).
- An obstacle that causes a stumble is removed on impact, so a single obstacle can never trip the player twice.
- **Stumble:** speed drops by 30% for 1.5 s (eases back), score multiplier resets to x1, camera shake. A **second stumble within 6 s = death**.
- Collisions use simple axis-aligned boxes per obstacle and a player box that shrinks when sliding and rises when jumping. Hitboxes are slightly forgiving (about 15% smaller than visuals).

## 8. Coins
- Gold spinning coins in lines/arcs defined by chunks. Collect by touching (pickup radius 0.8 units, measured from the middle of the player's body).
- The pickup test sweeps along the slide between one tick and the next, so a coin can never be passed straight through at high speed.
- Each coin = 10 points × current multiplier. Also adds 1 to the run coin count.

## 9. Power-ups
Collected by touching a floating pickup on the track. A pickup spawns roughly every **13–18 s** (only in chunk pickup slots, never two on screen). Type is random, equal weights.
- At least half the chunks of every tier carry a pickup slot, and a slot never sits on an obstacle in its lane, so a pickup that is due appears within a few seconds rather than waiting for a rare slot.

| Power-up | Color | Duration | Effect |
|---|---|---|---|
| **Shield** | cyan bubble | 10 s **or** first hit, whichever comes first | Absorbs one hit of any kind (death or stumble). The obstacle is destroyed with a pop. Then 1 s of invulnerability. |
| **Magnet** | purple | 10 s | Pulls every coin within 8 units ahead, across all 3 lanes, to the player. |
| **Speed Boost** | orange | 5 s | Forward speed ×2 (capped at 48 u/s), full invulnerability (obstacles are smashed or passed through), auto-collect coins like Magnet. After it ends: 1 s invulnerable "landing" and speed eases back over 0.5 s. |

- Different power-ups can be active at the same time. Picking up one that is already active **resets its timer**.
- During Speed Boost the spawner should avoid placing a hard chunk in the first 1.5 s after it ends.
- HUD shows an icon + shrinking bar for each active power-up.

## 10. Scoring
- Distance score: +1 point per unit travelled × multiplier.
- Coins: 10 points × multiplier.
- **Multiplier:** starts at x1, +1 every 30 s without a stumble, max x5. A stumble resets it to x1. (Shield absorbing a hit does **not** reset it.)
- Saved locally (localStorage, versioned key, safe if storage is unavailable): **best score**, **total coins ever** (for the future shop), **tutorial seen**, **mute setting**, **shake & flash setting**.

## 11. Screens and flow
1. **Start screen:** title, Play, best score, mute toggle, shake & flash toggle.
2. **First-run tutorial:** the first run starts with 3 gentle guided prompts (swipe to move, swipe up to jump, swipe down to slide), each waiting for the correct action in front of a matching easy obstacle. Skippable. Never shown again once completed.
   - "Waiting" means the slide slows down about 6.5 units before the obstacle and eases to a stop about 4.5 units before it, until the right move is made. That is close enough that the move, made at any moment of the wait, carries the player cleanly over, under or past the obstacle at the starting speed.
   - Nothing can hurt the player anywhere on the tutorial's track, including just after the last lesson and after skipping it. A first-time player cannot be killed by the thing they are being taught to get past.
   - The prompts name keys instead of swipes once the player has touched the keyboard.
3. **In-game HUD:** score, coin count, multiplier, active power-up timers, pause button. Top of screen, safe-area aware (notches).
4. **Pause:** Resume, Restart, mute, shake & flash. Game auto-pauses when the tab/app loses focus.
   - **Shake & flash** turns off the hit vibration, the screen flash and the camera shake together, separately from sound. It is saved like the mute setting. Turning it back on gives one small buzz and flash, so the player can feel what they turned on.
5. **Game over:** short slow-mo death beat (~0.6 s), then score, coins this run, best score with a "New best!" badge, big Play Again (instant restart, no loading), Home.
   - During the beat the world keeps moving, far slower, so the crash reads as a moment rather than a freeze. Nothing is scored and nothing else can be hit.
- No revive/continue in the MVP.

## 12. Audio
- Placeholder SFX: coin, jump, slide, lane swish, stumble, death, power-up pickup, power-up end, shield pop, UI tap.
- One looping background music track (CC0 or generated). Water/slide ambience loop.
- Mute toggle persists. Audio starts only after first user interaction (browser rule).
- Sources must be CC0/royalty-free; list them in `ASSETS.md`.
- MVP: every sound is generated in the browser from `AUDIO` in `src/config.ts`; no audio files ship. Coins in quick succession climb in pitch.
- Music plays on every screen, quieter behind the start, pause and game over screens. The water loop only runs while playing. Leaving the tab stops all sound.
- While muted no audio is started at all. Nothing that happened while muted is played when sound comes back.

## 13. Quality bar
- 60 fps on a mid-range phone (≈ 3-year-old Android / iPhone). Keep draw calls low (instancing for coins), no shadows beyond a simple blob shadow under the player.
- First load under ~3 s on 4G; JS bundle as small as reasonable.
- Unit tests for all game rules; chunk fairness validator; tests run in CI on every push.
- **Debug mode** (`?debug=1`): draws hitboxes, shows fps, tier, speed, seed; sliders to tweak speed/difficulty live; keys to grant any power-up and to toggle invincibility.
- Works on latest Chrome, Safari (iOS) and Firefox.
- A phone that cannot hold 50 fps steps its resolution down (2x, 1.5x, 1x) during play. Each step is a trial and is undone if frames did not get faster, so a battery-saver 30 fps cap never costs picture quality (`RENDER` in `src/config.ts`).
- Three.js ships as its own file, so it stays cached between updates.

## 14. Out of scope (MVP)
Shop/upgrades, online leaderboards, revive, missions, characters/skins, final art and animation, Hebrew UI, ads, accounts, native app wrapping. The code should leave room for: a shop that spends `totalCoins`, swapping placeholder meshes for models, and adding locales.
