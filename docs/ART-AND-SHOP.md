# Slide Rush — Retro Art Pass + Riders + Shop (v0.2)

Owner: Sagi. Planned in chat, built in Claude Code. This file is the source of truth for milestones M9–M12, like `SPEC.md` is for M0–M8.

## 0. Rule changes (apply to CLAUDE.md in the first commit)
- Rule 8 becomes: **Retro pixel art, built in code.** Every visual still goes through `src/render/` factories; no downloaded models or image files. Pixel sprites are defined in code as small pixel maps + palette indexes.
- Rule 12: **shop and cosmetics are now in scope.** Still out of scope: upgrades that change gameplay, leaderboard, revive, ads, accounts, Hebrew UI.
- Cosmetics are **visual only**. Hitboxes, physics, speed and scoring must not change no matter which animal or ring is equipped. Add a test that proves it.

## 1. Look — "Splash" retro style
Reference: the owner's other game "ספלאש" (screenshot in chat). Pixel art, warm sunset, chunky dark outlines.

**Palette** (replace `PALETTE` in `src/config.ts`, keep the same keys + add new ones):
| Name | Hex | Use |
|---|---|---|
| outline | #2B2140 | all outlines, text shadow, button borders |
| skyTop / skyBottom | #F6C9A8 / #F8E3C4 | sky gradient (dithered, not smooth) |
| sun / sunGlow | #FFF1C9 / #F4A259 | sunset sun |
| mountain / mountainDark | #9C8BC4 / #6F5E9E | far hills |
| forest / forestLight / forestDark | #3E7A4A / #6DB36A / #2E5A3A | trees, ground |
| water / waterLight / waterDeep | #8FE0E8 / #C9F4F2 / #4AA7C8 | slide surface, stripes |
| slideEdge / sand | #F2E2B8 / #D9C08C | slide rims |
| red / orange / yellow / blue / sky-blue | #E9806A / #F2A65A / #F6C85F / #3E6FBF / #6CC6E0 | towers, obstacles, UI |
| cream | #FBF3E4 | text, highlights |

**Pixel rendering**
- Render the 3D scene to a low-resolution target (config `RETRO.pixelScale`, default 4 = each game pixel is 4×4 screen pixels; 3 on large screens) and upscale with nearest-neighbour filtering. Turn off antialias.
  - *Changed 2026-10-25 (pixel-shimmer fix, approved by Sagi):* every game pixel must be a **whole number of real device pixels**. The canvas is drawn at the screen's own resolution and the picture is placed at exactly target × scale, centred, with a border of under one game pixel in the frame colour. Stretching it to fill made a game pixel 5.25 screen pixels on a Pixel 7, so pixels changed width as they moved and the picture swam.
- All textures use nearest filtering, no mipmaps — **except surfaces that stretch away into the distance (the slide and the ground)**, which keep nearest magnification but get mipmaps, linear minification and anisotropic filtering (`RETRO.distantAnisotropy`). *Changed 2026-10-25, approved by Sagi:* with nearest minification the far stretch of slide picked a different texel every frame and sparkled. Sprites and the sky stay nearest with no mipmaps.
- No single-pixel dither on any surface that moves toward the camera. Dither on the sky, which stands still, is fine; on the water it read as flicker.
- Flat "toon" shading: 3 brightness steps max (gradient map), no smooth gradients anywhere.
- Dark outlines (`outline` colour) on obstacles, coins, pickups and scenery (inverted-hull or edge pass — pick the cheaper one on mobile and say which).
  - *Decided:* inverted hull for solid shapes (no second render target, no depth read), painted into the pixel art for flat sprites. The hull is pushed out by a fixed **`RETRO.outlinePixels` game pixels on screen**, not a distance in the world — a world-sized rim thinned below one pixel with distance and flickered in and out.
- Sky: dithered 2-colour gradient + big pixel sun + 2 layers of purple hills (parallax, never move closer).
- Scenery on both sides of the slide, pooled and recycled like track segments: slide towers with coloured spiral slides (red/orange and blue/sky-blue like the reference), round pixel trees, palms, small huts.
- Ground (M12): one strip of dithered pixel grass under the slide and the scenery, bent to follow the slide and faded into the sunset by the fog (`RETRO.ground`). Before it, the props stood on the sky.
- Slide surface: pixel water with light stripes that scroll, sand-coloured rims with outline.
- Obstacles keep their shapes and hitboxes, recoloured: mine = red buoy-mine with spikes, high obstacle = blue bar/flag, full blocker = stacked crates or a closed gate, soft obstacle = yellow inflatable.
- Coins: 8-frame spinning pixel coin. Power-ups: pixel icons on a floating ring.
- Splash particles: square pixels, 3 colours from the water palette.

**UI**
- Pixel font that has Latin now and can be swapped later (e.g. "Pixelify Sans" from Google Fonts, or a bitmap font in code). Big title with thick outline like "ספלאש".
- Buttons: flat colour rectangles, 3px `outline` border, 1-step darker bottom edge, press = move down 2px. Same style for HUD, pause, game over, shop.
- Performance budget stays: 60 fps on a mid-range phone. The low-res render should make it faster, not slower — measure with `?debug=1` and report before/after.

## 2. Riders — animal in a funny ring
The player is a **2D pixel sprite billboard** that always faces the camera (camera is always behind). Built from 3 layers so any animal fits any ring:
1. **Ring back half** (drawn behind the animal)
2. **Animal** (sitting, seen from behind/slightly above: head, ears, arms on the ring)
3. **Ring front half** (drawn in front, so the animal looks like it sits *inside*)

All sprites are pixel maps in code (`src/render/sprites/`), drawn once into a `CanvasTexture` atlas at startup. Suggested size: ring 32×20 px, animal 24×24 px.

**Animations** (frames in the atlas, timing in config):
- idle: 2-frame bob + ring slowly rotating (rings with texture show it: record, tractor tyre, pizza)
- lane change: lean 1 frame left/right
- jump: arms up, ears/feathers fly
- slide/duck: animal ducks into the ring
- land: pixel splash
- crash: animal pops out of the ring, stars over head
- shield / magnet / boost: existing effects, redrawn in pixels

**Animals** (each needs its own personality frame):
| id | Name | Detail |
|---|---|---|
| frog | Frog | green, big eyes — **free starter** |
| penguin | Penguin | flaps wings on jump |
| cat | Cat | scared, fur stands up |
| bear | Bear | too big, squeezed into the ring |
| duck | Duck | wears swim goggles |
| pig | Pig | pink, red cheeks |

**Rings**:
| id | Name | Detail |
|---|---|---|
| tube | Classic Tube | blue/white tube — **free starter** |
| tractor | Tractor Tyre | huge black tyre with tread |
| hoop | Hula Hoop | very thin, animal barely holds on |
| donut | Donut | pink icing + sprinkles |
| pizza | Pizza | whole pizza with a hole in the middle |
| pineapple | Pineapple Ring | yellow ring, brown edge |
| watermelon | Watermelon | round slice, seeds |
| record | Vinyl Record | spins while sliding |
| onion | Onion Ring | golden, crispy |
| wheel | Steering Wheel | car wheel with spokes |
| toilet | Toilet Seat | the joke prize, most expensive |

The rider must read clearly at phone size: test every animal × ring pair in a debug gallery (`?debug=1&gallery=1`) that shows all combos in a grid.

## 3. Shop + choosing
**Coins:** `totalCoins` already exists in the save. Coins from each run are added at game over (already the case) and now can be spent.

**Prices** (all in `src/config.ts` → `SHOP`, tune after playtesting; goal = first purchase after ~3 normal runs):
- Animals: penguin 500, duck 800, cat 1200, pig 1800, bear 2500
- Rings: hoop 300, donut 500, pineapple 600, watermelon 800, onion 1000, pizza 1500, record 2000, wheel 2500, tractor 3500, toilet 5000

**Logic** (`src/game/shop.ts`, no Three.js, fully unit-tested):
- catalog (id, kind animal/ring, price, starter flag)
- `canBuy`, `buy` (subtract coins, add to owned), `equip` (only owned items)
- can't buy twice, can't go below 0 coins, can't equip what you don't own

**Save** (`SaveData` additions, old saves must load without losing anything):
`ownedAnimals: string[]`, `ownedRings: string[]`, `equippedAnimal: string`, `equippedRing: string`. Unknown ids from a broken save are dropped; starters are always owned; if the equipped item is missing, fall back to the starter. Add tests for all of this.

**Screens**
- Title screen: coin balance top-right, **Shop** button under Play, the equipped rider shown big in the middle, idling.
- **Shop screen**: two tabs — Animals / Rings. Grid of cards: pixel preview, name, price with coin icon or "Owned" / "Equipped". Tap card → big preview **of that item combined with the currently equipped other part** (so you see "bear in a toilet seat" before buying) → button Buy / Equip / Not enough coins (shows how many missing). Buy asks a quick confirm. Purchase = coin burst + sound. What you just bought goes on straight away (M11), so buying is never followed by a second tap to wear it; `buy` and `equip` stay separate in `shop.ts`.
- Game over: show coins earned this run + new total, and a "Shop" button.
- All strings in `src/ui/strings.ts`. Works in portrait, respects safe areas, back button / back gesture returns to title.

## 4. Milestones
### M9 — Retro look
Palette, low-res pixel rendering, toon shading, outlines, sky/hills/sun, scenery pool, recoloured obstacles/coins/pickups, pixel UI style on existing screens. Rider is still the placeholder.
**Done when:** the game looks like it belongs next to "ספלאש", runs 60 fps on a phone, tests/build/lint pass.
> Prompt: `Do Milestone M9 from docs/ART-AND-SHOP.md. Show me before/after fps from the debug overlay.`

### M10 — Riders
Sprite system (3 layers), atlas, all 6 animals and 11 rings, all animations, debug gallery. Player uses the equipped pair from the save (default frog + tube). Test that hitboxes are identical for every combo.
> Prompt: `Do Milestone M10 from docs/ART-AND-SHOP.md. When done, tell me how to open the gallery on my phone.`

### M11 — Shop
`shop.ts` + tests, save migration + tests, title screen changes, shop screen, game over changes, sounds.
> Prompt: `Do Milestone M11 from docs/ART-AND-SHOP.md.`

### M12 — Polish + release v0.2
Phone QA pass, price tuning, bug fixes, update README screenshots, tag `v0.2.0`.
> Prompt: `Do Milestone M12 from docs/ART-AND-SHOP.md. Give me a QA checklist to run on my phone before we tag v0.2.0.`
