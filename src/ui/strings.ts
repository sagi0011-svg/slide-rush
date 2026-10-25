/**
 * Every piece of UI text (CLAUDE.md rule 9). English for the MVP; a Hebrew
 * locale can be added later by swapping this object.
 */

export const STRINGS = {
  title: 'Slide Rush',
  tagline: 'How far can you get?',
  loading: 'Loading…',
  webglUnsupported: 'This browser cannot run 3D graphics (WebGL). Try Chrome, Safari or Firefox.',
  /** Shown over everything while a phone is held sideways. */
  rotate: 'Turn your phone upright to play',

  play: 'Play',
  playAgain: 'Play Again',
  resume: 'Resume',
  restart: 'Restart',
  home: 'Home',
  skip: 'Skip',

  paused: 'Paused',
  gameOver: 'Game Over',
  newBest: 'New best!',

  best: 'BEST',
  score: 'SCORE',
  coins: 'COINS',
  total: 'TOTAL',
  coinSymbol: '●',

  soundOn: 'Sound on',
  soundOff: 'Sound off',
  effectsOn: 'Shake & flash on',
  effectsOff: 'Shake & flash off',

  /** Short labels for the power-up timers on the HUD (SPEC 9). */
  powerUps: {
    shield: 'SHIELD',
    magnet: 'MAGNET',
    boost: 'BOOST',
  },

  /** The debug panel's controls, `?debug=1` (SPEC 13). */
  debug: {
    controls: 'controls',
    speed: 'speed',
    tier: 'tier',
    auto: 'auto',
    invincible: 'invincible',
    hitboxes: 'hitboxes',
    keys: 'keys: 1 2 3 power-ups, I invincible, H hitboxes',
  },

  /** The animals' names (docs/ART-AND-SHOP.md §2). */
  animals: {
    frog: 'Frog',
    penguin: 'Penguin',
    cat: 'Cat',
    bear: 'Bear',
    duck: 'Duck',
    pig: 'Pig',
  },

  /** The rings' names (§2). */
  rings: {
    tube: 'Classic Tube',
    tractor: 'Tractor Tyre',
    hoop: 'Hula Hoop',
    donut: 'Donut',
    pizza: 'Pizza',
    pineapple: 'Pineapple Ring',
    watermelon: 'Watermelon',
    record: 'Vinyl Record',
    onion: 'Onion Ring',
    wheel: 'Steering Wheel',
    toilet: 'Toilet Seat',
  },

  /** The shop (docs/ART-AND-SHOP.md §3). */
  shop: {
    /** The button that opens it, on the title and game over screens. */
    open: 'Shop',
    title: 'Shop',
    back: 'Back',
    /** The two tabs. */
    tabs: {
      animal: 'Animals',
      ring: 'Rings',
    },
    /** What a card says instead of a price. */
    free: 'Free',
    owned: 'Owned',
    equipped: 'Equipped',
    /** The button under the big preview. */
    buy: 'Buy',
    equip: 'Wear it',
    wearing: 'Wearing it',
    /** When it costs more than the coins in hand. */
    notEnough: 'Need {coins} more',
    /** The quick confirm before the coins are spent. */
    confirm: 'Buy {name} for {coins}?',
    confirmYes: 'Yes, buy it',
    confirmNo: 'Not yet',
    /** Said once, after a purchase. */
    bought: 'Bought! Now wearing it.',
    /** Under the tabs, when nothing has been tapped yet. */
    hint: 'Tap one to try it on',
  },

  /** The rider gallery, `?debug=1&gallery=1` (§2). */
  gallery: {
    title: 'Rider gallery',
    pose: 'pose',
    effect: 'effect',
    none: 'none',
    zoom: 'zoom',
    animate: 'animate',
    poses: {
      idle: 'idle',
      leanLeft: 'lean ←',
      leanRight: 'lean →',
      jump: 'jump',
      duck: 'duck',
      land: 'land',
      crash: 'crash',
    },
  },

  /** The three first-run prompts (SPEC 11). */
  tutorial: {
    move: 'Swipe left or right to change lane',
    jump: 'Swipe up to jump',
    slide: 'Swipe down to duck',
  },

  /** The same three, for someone playing on a keyboard. */
  tutorialKeys: {
    move: 'Press ← or →',
    jump: 'Press ↑ or Space',
    slide: 'Press ↓',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

/**
 * Fills the `{name}` slots in one of the strings above.
 *
 * Numbers and names are kept out of the strings themselves so a Hebrew
 * translation can put them wherever its own grammar needs them (rule 9).
 */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : String(value);
  });
}
