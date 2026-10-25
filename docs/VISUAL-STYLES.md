# Slide Rush — Visual styles (M13)

Owner: Sagi. Planned in chat on 2026-10-25. This file is the source of truth
for M13, like `ART-AND-SHOP.md` is for M9–M12.

## 1. The three styles

The player picks one look in a new Settings screen. It changes only pictures,
never the game.

| id | Name on screen | What it is |
|---|---|---|
| `sunset` | Sunset Pixel | **The v0.2 look, unchanged.** The default, so nothing changes for anyone until they choose. |
| `classic` | Classic 3D | Smooth, lit 3D at the screen's own resolution: a bright daytime palette (the v0.1 colours), lit materials, a smooth sky, textures with linear filtering and mipmaps, no outlines. |
| `pixel` | Retro Pixel | A chunkier 8-bit look: the same low-resolution pixel render as Sunset, flat unlit colours from a 7-colour palette, a new pixel UI. |

Sagi chose three styles rather than two so that the v0.2 look is never lost.

**Retro Pixel palette**

| Name | Hex | Use |
|---|---|---|
| deep water | #0E3A63 | sky, far background, panels' backdrop |
| panel | #15558C | hills, UI panels |
| outline | #071E33 | every outline and border, hard shadows |
| aqua slide | #3FD0E0 | slide surface |
| slide walls | #FF6B4A | slide rims, the lifebuoy's red, danger accents |
| coins | #FFD23F | coins, the selected-card border |
| light foam | #BFF7FF | stripes, splash, text |

The riders keep their own colours (an animal needs more than 7). In Retro Pixel
the default ring is drawn as a red/white lifebuoy; the mine is a dark round
bomb with a red light; coins are chunky yellow pixel coins.

**The same in every style**
- The animals and rings are the pixel sprites from §2 of `ART-AND-SHOP.md`, on a
  billboard, in all three styles. Modelling 6 animals and 11 rings in 3D is a
  project of its own. In Classic 3D they are drawn at full resolution.
- Every shape, hitbox, speed, score, coin, power-up and price. A test proves
  that a run is identical in all three styles (as rule 13 does for cosmetics).

## 2. The theme system

- One save field, `visualStyle: 'sunset' | 'classic' | 'pixel'`, default
  `'sunset'`. An unknown value falls back to the default. Reads and writes go
  through the existing save store, which already wraps localStorage in
  try/catch.
- Every value that differs by style lives in `THEMES` in `src/config.ts`
  (colours, how the scene is rendered, filtering, materials, outlines, fonts).
  `src/render/theme.ts` holds the active theme and is the only render code that
  knows which style is on. The UI reads the style from one attribute,
  `data-style` on `<html>`, so CSS swaps fonts and borders without code.
- `src/game/` never sees the style.
- **Switching applies immediately.** The style is only ever changed on the
  Settings screen, never during a run, so the renderer is thrown away and built
  again on the spot, on a fresh canvas (antialias can only be chosen when a
  canvas's WebGL context is created).

## 3. Settings screen

- Opened from a Settings button on the title screen; Back (and the phone's back
  gesture) returns to the title.
- **Visual Style:** three option cards, each with a small preview drawn in code
  (no image files, rule 8). The selected card has a yellow border and a
  "SELECTED" tag.
- **Audio:** Sound effects ON/OFF and Music ON/OFF, each saved. They replace
  the single Sound button on the title screen; an old save's `muted: true`
  turns both off, so nobody's game starts making noise.
- **Shake & flash** moves here too, so the title screen keeps Play, Shop and
  Settings.
- Real `<button>`s, `aria-pressed` on the toggles, touch targets of at least
  44 px, works in portrait on a phone, respects safe areas.

## 4. UI per style

- Sunset Pixel and Classic 3D: the v0.2 UI exactly as it is.
- Retro Pixel: "Press Start 2P" for headings, numbers and buttons, "VT323" for
  body text (Google Fonts, like Pixelify Sans today). Square corners, 3–4 px
  solid #071E33 borders, a hard drop shadow (`0 4px 0 #071E33` to `0 6px 0`),
  no gradients.

## 5. Performance

- Retro Pixel renders at the same low resolution as Sunset Pixel and with
  cheaper (unlit) materials, so it must be at least as fast.
- Classic 3D draws every screen pixel. It uses the existing frame-rate governor
  (`src/render/quality.ts`), which lowers the resolution on a phone that cannot
  keep up. Desktop fps is capped at 60 and proves nothing, so this is checked
  on Sagi's phone.

## 6. Milestone

### M13 — Visual styles
Save field and audio split, theme module, Settings screen, Classic 3D renderer,
Retro Pixel renderer and UI, a test that the game is identical in every style,
CLAUDE.md section on the theme system, a phone check.

**Done when:** all three styles can be chosen and survive a reload, Sunset
Pixel looks exactly like v0.2, the game plays the same in each, and
tests/build/lint pass.

> Restore point: tag `before-visual-styles`. To undo M13, revert its commits;
> never reset.
