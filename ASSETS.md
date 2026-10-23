# Assets — sources and licences

Every sound, image, model and font in Slide Rush is listed here with where it came from and the licence it is under (SPEC 12). **Only CC0 or royalty-free material may be added**, and nothing goes into the game without a row in this file.

## Short version

The game ships with **no third-party assets at all.** Every sound is generated in the browser by code in this repository, and every visual is a primitive shape in a flat colour. Nothing was downloaded, so there is nothing to credit and no licence that could be broken.

The generated sounds are original work for this project and are dedicated to the public domain under **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)** — anyone may use them for anything, no credit needed.

## Sound (M7)

All of these are built from the numbers in `AUDIO` in `src/config.ts` when the player first touches the page. No audio files are shipped or downloaded.

| Sound | What it is | Source | Licence |
|---|---|---|---|
| Coin | Bright two-tone blip rising 1175→1760 Hz; climbs a semitone per coin in a streak | Generated — `renderCoin` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Jump | Sine sweep up 220→740 Hz | Generated — `renderJump` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Slide (duck) | Filtered noise sweeping down | Generated — `renderSlide` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Lane swish | Short high-passed noise swish | Generated — `renderLane` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Stumble | Low thud 200→70 Hz with a burst of grit | Generated — `renderStumble` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Death | Long falling tone 330→65 Hz over dark noise | Generated — `renderDeath` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Power-up pickup | Four rising notes, C5 E5 G5 C6 | Generated — `renderNotes` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Power-up end | Two falling notes, G5 C5 | Generated — `renderNotes` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Shield pop | Bright noise burst with a 1200 Hz ping | Generated — `renderShieldPop` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| UI tap | Soft click 820→620 Hz | Generated — `renderUiTap` in `src/audio/sfx.ts` | CC0 1.0 (original) |
| Background music | ~9 s loop at 104 BPM: chords C – G – Am – F with bass and arpeggio | Generated — `renderMusicLoop` in `src/audio/beds.ts` | CC0 1.0 (original) |
| Water ambience | 6 s loop of filtered noise with slow swells, crossfaded so it has no seam | Generated — `renderWaterLoop` in `src/audio/beds.ts` | CC0 1.0 (original) |

The chord progression C – G – Am – F is one of the most common in popular music. Chord progressions are not protected by copyright, and the loop itself (melody, voicing, arrangement and sound) is written from scratch here.

## Visuals

| Asset | Source | Licence |
|---|---|---|
| Every 3D object (slide, player, obstacles, coins, pickups) | Three.js primitive shapes in flat colours from `PALETTE` in `src/config.ts`, built in `src/render/factories.ts` | Original, CC0 1.0 |
| Icons (pause button) | Plain HTML and CSS | Original, CC0 1.0 |

## Fonts

None are shipped. The UI uses the device's own system font (`system-ui`, San Francisco on Apple, Segoe UI on Windows, Roboto on Android).

## Code libraries

These are code, not assets, but they ship to players, so for completeness:

| Library | Licence |
|---|---|
| [three.js](https://github.com/mrdoob/three.js) | MIT |

## Adding a real asset later

When placeholder sounds or shapes are swapped for real ones:

1. **CC0 or royalty-free only.** Good sources: [Kenney](https://kenney.nl/assets) (CC0), [OpenGameArt](https://opengameart.org) filtered to CC0, [Freesound](https://freesound.org) filtered to CC0. Avoid anything marked "non-commercial", "attribution-share-alike" or "editorial use".
2. **Add a row to the right table above** with: the file name in the repo, the exact page it came from (URL), the author, the licence, and the date it was downloaded.
3. **Keep a copy of the licence** if the source provides one, next to the file (e.g. `public/audio/LICENSE-kenney.txt`).
4. If a licence asks for credit, add it to the credits — never assume it is optional.
