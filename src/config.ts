/**
 * Every tunable number in Slide Rush lives here.
 *
 * Game code must never contain magic numbers — import from this file instead.
 * The values mirror docs/SPEC.md; if a number changes here, update the spec too.
 * Units: 1 unit ~= 1 metre, all times in seconds.
 */

/** Fixed-timestep simulation (SPEC 13 / CLAUDE.md rule 5). */
/** Simulation ticks per second; `SIM.hz` and `SIM.dt` both come from it. */
const SIM_HZ = 60;

export const SIM = {
  /** Simulation ticks per second. Gameplay must behave identically at any frame rate. */
  hz: SIM_HZ,
  /**
   * Seconds per simulation tick. A plain number rather than a getter, which
   * would make a little garbage on every read, every tick.
   */
  dt: 1 / SIM_HZ,
  /** Never simulate more than this many ticks in one frame (after a tab stall). */
  maxTicksPerFrame: 5,
} as const;

/** Lanes and player movement (SPEC 3). */
export const LANES = {
  /** Lane indices, left to right. */
  indices: [-1, 0, 1] as const,
  /** Distance between lane centres, in units. */
  width: 2.5,
  /** Lane the player starts in. */
  start: 0,
} as const;

export const PLAYER = {
  /** Seconds for an eased lane change. */
  laneChangeTime: 0.15,
  /** Total airtime of a jump, in seconds. */
  jumpTime: 0.65,
  /** Apex height of a jump, in units. */
  jumpHeight: 2.2,
  /** Seconds the low slide hitbox lasts. */
  slideTime: 0.7,
  /** How long an input stays queued waiting to become valid, in seconds. */
  inputBufferTime: 0.15,
  /** Downward speed of the mid-air drop (slide pressed while jumping), in units/second. */
  fastDropSpeed: 14,
  /** Seconds for the edge-bump feedback to fade out. */
  bumpDecayTime: 0.18,
  /** Placeholder body size, in units. Real hitboxes arrive with the obstacles in M2. */
  radius: 0.45,
  standHeight: 1.6,
  slideHeight: 0.8,
} as const;

/** Forward speed ramp (SPEC 5). */
export const SPEED = {
  /** Speed at the start of a run, in units per second. */
  start: 14,
  /** Speed the ramp reaches at `rampTime`, in units per second. */
  max: 32,
  /** Seconds taken to go from `start` to `max`; speed is flat afterwards. */
  rampTime: 180,
  /** Hard ceiling on forward speed, including Speed Boost, in units per second. */
  cap: 48,
} as const;

/** Difficulty tiers, as elapsed-run-time boundaries in seconds (SPEC 5). */
export const DIFFICULTY = {
  /** Tier n starts at tierStartTimes[n] seconds of run time. */
  tierStartTimes: [0, 30, 90, 180] as const,
  /** Minimum travel time between two consecutive required actions, in seconds. */
  minReactionTime: 0.45,
} as const;

/** Track and chunk geometry (SPEC 2 / 6). */
export const TRACK = {
  /** Length of one authored chunk, in units. */
  chunkLength: 40,
  /** How far ahead of the player the track is built, in units. */
  buildAhead: 150,
  /** How far behind the camera a segment is recycled, in units. */
  recycleBehind: 20,
  /** Length of one recycled visual segment, in units. */
  segmentLength: 20,
  /** Width of the slide floor, in units: three lanes plus a margin. */
  width: 9,
  /** Height of the walls along the sides of the slide, in units. */
  wallHeight: 1.1,
  /** Width of the painted lane divider lines, in units. */
  markerWidth: 0.12,
  /**
   * Empty "breather" gap after a chunk, in units, one entry per difficulty
   * tier (SPEC 6). Lower tiers get more room to think.
   */
  breatherByTier: [22, 14, 7, 0],
  /** How far behind the player an obstacle is forgotten, in units. */
  despawnBehind: 12,
  /**
   * Every run that does not open with the tutorial opens with this many units
   * of coins and nothing to dodge, so the player can find their feet (SPEC 6).
   */
  openingLength: 100,
  /** How many obstacles can be alive at once; the pool never grows (rule 7). */
  obstaclePoolSize: 96,
} as const;

/**
 * Visual-only bend of the slide (SPEC 2). The same offset is applied to the
 * track, the player mesh and the camera, so the gameplay lanes stay perfectly
 * straight along Z and nothing here can affect the rules.
 */
export const CURVE = {
  /**
   * Sideways sway: how far, in units, and over what wavelength, in units.
   * Kept gentle on purpose — a sharper sway swings the track out of the narrow
   * portrait view, which would hide obstacles before the player could react.
   */
  lateralAmplitude: 4.5,
  lateralWavelength: 260,
  /**
   * Drop sections: how far the slide descends over one cycle, in units, and how
   * long that cycle is, in units. The descent is never shared out evenly — it
   * alternates near-flat stretches with steeper drops.
   */
  dropPerWavelength: 13,
  verticalWavelength: 150,
} as const;

/** Touch and keyboard input (SPEC 4). */
export const INPUT = {
  /** Finger travel, in CSS pixels, that turns a touch into a swipe. */
  swipeThresholdPx: 30,
} as const;

/**
 * Rendering cost (SPEC 13). A phone that cannot hold the frame rate drops its
 * resolution a notch at a time, and never climbs back (src/render/quality.ts).
 */
export const RENDER = {
  /** A 3x screen does not need 3x the pixels; this is the most ever drawn. */
  maxPixelRatio: 2,
  /** The resolution never drops below this. */
  minPixelRatio: 1,
  /** How much one step down takes off. */
  pixelRatioStep: 0.5,
  /** A frame slower than this (under 50 fps) counts as slow. */
  slowFrameSeconds: 1 / 50,
  /** How long a stretch is judged at a time, in seconds of play. */
  sampleSeconds: 2,
  /** Step down when more than this share of the stretch was slow frames. */
  slowShare: 0.5,
  /** A frame longer than this is a stall or the tab returning: ignored. */
  ignoreFrameSeconds: 0.25,
  /**
   * A step down is kept only if the average frame got at least this much
   * shorter (0.85 = 15% faster). Otherwise the pixels were not the problem —
   * a battery-saver 30 fps cap, say — and the resolution goes back.
   */
  trialSpeedup: 0.85,
} as const;

/**
 * The game is portrait only (SPEC 1). A phone turned on its side squeezes the
 * 9:16 frame into a thin strip down the middle, too short for the title and
 * the shop, so it gets a "turn it upright" notice instead, and a run pauses.
 */
export const LAYOUT = {
  /**
   * A touch screen held sideways and no taller than this, in CSS pixels, is a
   * phone on its side. A tablet held sideways is taller, and has room to play.
   */
  sidewaysMaxHeight: 500,
} as const;

/** Camera and presentation (SPEC 2). */
export const CAMERA = {
  /** Portrait aspect ratio the playfield is letterboxed to (width / height). */
  aspect: 9 / 16,
  /** Vertical field of view, in degrees. */
  fov: 60,
  /** Near and far clipping planes, in units. */
  near: 0.5,
  far: 220,
  /** Camera offset behind and above the player, in units. */
  offset: { x: 0, y: 4.4, z: 7.2 },
  /** How far down the track the camera looks, in units ahead of the player. */
  lookAhead: 9,
  /** Height of that look-at point above the slide, in units. Lower = less sky. */
  lookHeight: -0.4,
  /** How much of the player's sideways move the camera copies, 0..1. */
  lateralFollow: 0.6,
  /** How much of it the look-at point copies, 0..1. */
  lookLateralFollow: 0.25,
  /** How quickly the camera catches up sideways; higher is snappier. */
  laneDamping: 9,
  /** How far the camera drops while the player slides, in units. */
  slideDip: 0.55,
  /** How far the camera rises at the top of a jump, in units. */
  jumpRise: 0.8,
  /** How quickly the camera catches up vertically; higher is snappier. */
  heightDamping: 6,
  /** Extra degrees of field of view per unit of downhill slope. */
  fovKickPerSlope: 32,
  /** Extra degrees of field of view while a speed boost is running (SPEC 9). */
  boostFovKick: 10,
  /** How quickly the field of view eases toward its target. */
  fovDamping: 3,
  /** How far the camera shakes after a stumble, in units, and for how long. */
  shakeAmount: 0.35,
  shakeTime: 0.4,
  /**
   * Where the fog starts and finishes, in units ahead of the player. `fogFar`
   * must stay below TRACK.buildAhead, or the end of the built track shows as a
   * hard edge against the sky (SPEC 2).
   */
  fogNear: 45,
  fogFar: 140,
} as const;

/** Scoring (SPEC 8 / 10). */
export const SCORING = {
  /** Points per unit travelled, before the multiplier. */
  pointsPerUnit: 1,
  /** Points per coin, before the multiplier. */
  pointsPerCoin: 10,
  /** Multiplier at the start of a run. */
  multiplierStart: 1,
  /** Highest multiplier reachable. */
  multiplierMax: 5,
  /** Seconds without a stumble needed to gain +1 multiplier. */
  multiplierStepTime: 30,
} as const;

/** Obstacles and stumbles (SPEC 7). */
export const OBSTACLES = {
  /** Hitboxes are this fraction of the visual size (forgiving collisions). */
  hitboxScale: 0.85,
  /** Fraction of speed lost by a stumble. */
  stumbleSpeedLoss: 0.3,
  /** Seconds a stumble's slow-down lasts before easing back. */
  stumbleDuration: 1.5,
  /** A second stumble inside this window, in seconds, is death. */
  secondStumbleWindow: 6,
  /** Seconds the death beat lasts before the run restarts (temporary until M6). */
  restartDelay: 0.6,
  /**
   * Visual size of each obstacle, in units: `w` across the slide, `h` tall,
   * `d` along the slide, and `y` for how high off the floor the box starts.
   * Hitboxes are these shrunk by `hitboxScale` (SPEC 7).
   */
  size: {
    /** Red spiky sphere, low: jump over it or change lane. */
    lowMine: { w: 1.7, h: 1.0, d: 1.7, y: 0 },
    /**
     * Blue arch across one lane: slide under it or change lane. It hangs low
     * enough to clearly catch someone standing, and high enough to leave real
     * room for a slide.
     */
    highObstacle: { w: 2.4, h: 2.3, d: 0.9, y: 0.95 },
    /** Grey wall filling the lane: only a lane change gets past it. */
    fullBlocker: { w: 2.3, h: 3.2, d: 1.1, y: 0 },
    /** Yellow ring, low: jump over it or change lane. Only ever a stumble. */
    softObstacle: { w: 1.9, h: 0.8, d: 1.9, y: 0 },
  },
} as const;

/** Coins (SPEC 8). */
export const COINS = {
  /** Distance at which a coin is collected, in units. */
  pickupRadius: 0.8,
  /** How high a coin floats above the slide when a chunk does not say, in units. */
  restHeight: 1,
  /** Placeholder size, in units. */
  radius: 0.38,
  thickness: 0.1,
  /** How fast a coin spins, in turns per second. */
  spinRate: 0.9,
  /** How many coins can be on the track at once; the pool never grows (rule 7). */
  poolSize: 160,
} as const;

/** Power-ups (SPEC 9). */
export const POWERUPS = {
  /** Random gap between pickups, in seconds. */
  spawnIntervalMin: 13,
  spawnIntervalMax: 18,
  shield: {
    /** Seconds the shield lasts if it is never hit. */
    duration: 10,
    /** Seconds of invulnerability after the shield absorbs a hit. */
    graceAfterHit: 1,
  },
  magnet: {
    duration: 10,
    /** Coins within this distance ahead are pulled in, in units. */
    radius: 8,
    /** How fast a pulled coin flies to the player, in units per second. */
    pullSpeed: 26,
  },
  boost: {
    duration: 5,
    /** Forward speed multiplier while boosting. */
    speedMultiplier: 2,
    /** Seconds of invulnerability after the boost ends. */
    graceAfterEnd: 1,
    /** Seconds taken to ease speed back down after the boost. */
    easeOutTime: 0.5,
    /** Seconds after a boost in which no hard chunk may be spawned. */
    safeWindowAfterEnd: 1.5,
  },
  /** A chunk counts as easy, and so is safe to meet after a boost, up to this
   * many obstacles. */
  easyChunkObstacles: 1,
  /** Placeholder size of a floating pickup, in units. */
  pickupSize: 0.9,
  /** How high a pickup floats above the slide, in units. */
  pickupHeight: 1.3,
  /** How fast a pickup bobs and spins, in turns per second. */
  pickupSpinRate: 0.5,
} as const;

/**
 * Hit feedback: vibration and the screen flash (src/ui/feedback.ts).
 *
 * Vibration patterns are milliseconds, alternating buzz and pause.
 */
export const FEEDBACK = {
  vibration: {
    /** A single short buzz for a trip. */
    stumble: [35],
    /** A heavier double buzz for the end of a run. */
    death: [70, 50, 110],
  },
  /** How long the screen flash lasts, in seconds. */
  flashTime: 0.35,
} as const;

/**
 * Sound (SPEC 12).
 *
 * Every effect and both loops are built out of these numbers while the game
 * runs — nothing is downloaded and no recording is anyone else's work, so the
 * whole soundtrack is ours to give away (see ASSETS.md). Gains are 0..1,
 * times are in seconds and frequencies in hertz.
 */
export const AUDIO = {
  /** Everything together, once the mute button has had its say. */
  masterGain: 0.85,
  /** The effects bus, relative to master. */
  sfxGain: 0.8,
  /** The music loop. It sits well under the effects on purpose. */
  musicGain: 0.26,
  /** The water ambience loop. */
  ambienceGain: 0.2,
  /** How far the music is turned down while a screen is up, 0..1. */
  menuMusicLevel: 0.55,
  /** Seconds a loop takes to fade in or out. */
  bedFadeTime: 0.9,
  /** Seconds the master volume takes to follow the mute button. */
  muteFadeTime: 0.15,
  /**
   * Sample rate every sound is built at, whatever the device runs at; the
   * browser converts on playback. Nothing in these sounds goes much above
   * 6 kHz, so 24 kHz loses nothing you can hear and halves the work done on
   * the first tap, which is also the moment a run starts.
   */
  renderSampleRate: 24000,
  /**
   * Seconds after the page loads before the sounds start being built in the
   * background, so the title screen is drawn first.
   */
  prepareDelay: 0.3,
  /** Seed for every bit of noise, so the same build always sounds the same. */
  noiseSeed: 20261023,
  /** Shortest gap between two plays of the same effect, in seconds. */
  minGap: {
    coin: 0.035,
    jump: 0.09,
    slide: 0.09,
    lane: 0.07,
    stumble: 0.12,
    death: 0.5,
    powerUp: 0.12,
    powerUpEnd: 0.12,
    shieldPop: 0.12,
    uiTap: 0.06,
    purchase: 0.2,
  },
  /**
   * At most this many coin sounds out of a single frame, however many coins a
   * magnet swept up at once.
   */
  maxCoinsPerFrame: 2,
  coin: {
    /** Coins collected within this many seconds of each other climb in pitch. */
    streakWindow: 0.7,
    /** Pitch multiplier per coin in the climb (about one semitone). */
    pitchStep: 1.06,
    /** How many steps the climb reaches before it stops rising. */
    maxSteps: 8,
  },
  /**
   * The eleven placeholder effects (SPEC 12). `gain` is the peak of the
   * rendered sound, `from`/`to` are the ends of a sweep, `notes` are fixed
   * pitches.
   */
  sfx: {
    coin: { duration: 0.16, gain: 0.45, from: 1174.66, to: 1760 },
    jump: { duration: 0.22, gain: 0.5, from: 220, to: 740 },
    slide: { duration: 0.3, gain: 0.5, from: 1600, to: 320 },
    lane: { duration: 0.16, gain: 0.38, from: 600, to: 2000 },
    stumble: { duration: 0.32, gain: 0.7, from: 200, to: 70 },
    death: { duration: 0.9, gain: 0.8, from: 330, to: 65 },
    powerUp: { duration: 0.36, gain: 0.55, notes: [523.25, 659.25, 783.99, 1046.5] },
    powerUpEnd: { duration: 0.28, gain: 0.42, notes: [783.99, 523.25] },
    shieldPop: { duration: 0.28, gain: 0.6, from: 2600, to: 700 },
    uiTap: { duration: 0.09, gain: 0.38, from: 820, to: 620 },
    /** A purchase in the shop: a cash-register chime (section 3). */
    purchase: { duration: 0.55, gain: 0.6, notes: [783.99, 1046.5, 1318.51] },
  },
  /** The looping background track: four chords, bass, and an arpeggio over them. */
  music: {
    bpm: 104,
    /** Beats each chord is held for. */
    beatsPerChord: 4,
    /** MIDI note the progression is built on (C3). */
    rootMidi: 48,
    /** Semitones above the root for the three notes of each chord. */
    chords: [
      [0, 4, 7],
      [7, 11, 14],
      [9, 12, 16],
      [5, 9, 12],
    ],
    /** Which chord note each eighth of a beat-pair plays. */
    arpPattern: [0, 1, 2, 1],
    /** Levels of the three parts, before musicGain. */
    padGain: 0.5,
    bassGain: 0.6,
    arpGain: 0.3,
    /** Seconds of quiet kept at the end so the join back to the start is clean. */
    tailSilence: 0.2,
    /** Peak the finished loop is normalised to. */
    peak: 0.9,
  },
  /** The water ambience loop: filtered noise with slow swells. */
  water: {
    loopSeconds: 6,
    /** Low-pass cutoff: how dark the rushing water is. */
    cutoff: 900,
    /** How much unfiltered hiss is mixed back in for air, 0..1. */
    air: 0.22,
    /** Seconds of the tail crossfaded onto the head to hide the join. */
    crossfade: 0.6,
    /** Slow swells: roughly this many per second, and how deep they go, 0..1. */
    swellRate: 0.12,
    swellDepth: 0.4,
    /** Peak the finished loop is normalised to. */
    peak: 0.8,
  },
} as const;

/** The first-run tutorial (SPEC 11). */
export const TUTORIAL = {
  /**
   * How far ahead of the obstacle the slow-down starts, in units. Close
   * enough that a jump or slide made the moment it starts still carries the
   * player past: at the starting speed each covers about 9 units, and a jump
   * started more than about 7 units out comes down on the mine.
   */
  holdDistance: 6.5,
  /**
   * Where the slide comes to rest while a prompt waits, in units before the
   * obstacle: about the middle of a jump or a slide at the starting speed.
   */
  stopDistance: 4.5,
  /** How fast the slide creeps as the slow-down starts, as a fraction of normal. */
  holdSpeedFactor: 0.18,
} as const;

/** The death beat before the game over screen (SPEC 11). */
export const DEATH = {
  /** How long the beat lasts, in seconds. */
  beatTime: 0.6,
  /** How fast the world moves during it, as a fraction of normal. */
  slowMoFactor: 0.22,
} as const;

/** Local save (SPEC 10). */
export const SAVE = {
  /** Versioned localStorage key, so an old save shape can never break a new build. */
  key: 'slide-rush/save/v1',
  /**
   * The rider a fresh save starts with: the two free starters
   * (docs/ART-AND-SHOP.md §2). They must match the ids in src/render/sprites/,
   * which a test checks.
   */
  starterAnimal: 'frog',
  starterRing: 'tube',
  /** A saved id longer than this is junk, not an id. */
  maxIdLength: 32,
} as const;

/**
 * The shop (docs/ART-AND-SHOP.md section 3).
 *
 * Prices are in coins, and the order the ids are written in here is the order
 * the shop lays its cards out in — cheapest first, with the free starter at
 * the front. The ids must match the sprites in src/render/sprites/, which a
 * test checks, so a typo can never put a card in the shop for a rider the
 * game cannot draw.
 *
 * Coins are only ever spent here, and nothing bought changes the game: a
 * purchase is a picture and nothing else (CLAUDE.md rule 13).
 */
export const SHOP = {
  /** What each animal costs. The starter frog is free (section 3). */
  animalPrices: {
    frog: 0,
    penguin: 500,
    duck: 800,
    cat: 1200,
    pig: 1800,
    bear: 2500,
  },
  /** What each ring costs. The starter tube is free. */
  ringPrices: {
    tube: 0,
    hoop: 300,
    donut: 500,
    pineapple: 600,
    watermelon: 800,
    onion: 1000,
    pizza: 1500,
    record: 2000,
    wheel: 2500,
    tractor: 3500,
    toilet: 5000,
  },
  /**
   * How big the pixel pictures are drawn, in screen pixels per sprite pixel:
   * on a card, in the big preview, and on the title screen. Whole numbers
   * only, or the pixels stop being square.
   */
  cardZoom: 2,
  previewZoom: 4,
  titleZoom: 4,
  /** The coin burst a purchase plays: how many coins, and for how long. */
  burstCoins: 10,
  burstSeconds: 0.75,
  /** How far a burst coin flies: sideways either way, and up, in screen pixels. */
  burstSpread: 70,
  burstRise: 90,
} as const;

/** Debug mode, `?debug=1` (SPEC 13). Never reachable in a normal game. */
export const DEBUG = {
  /** The speed slider multiplies the normal forward speed by this much. */
  speedScaleMin: 0.25,
  speedScaleMax: 2,
  speedScaleStep: 0.05,
  /** How far ahead hitboxes are drawn, in units; past this the fog hides them. */
  hitboxRange: 60,
  /** And how far behind, for an obstacle just passed. */
  hitboxRangeBehind: 15,
} as const;

/**
/**
 * The retro pixel look (docs/ART-AND-SHOP.md section 1).
 *
 * The 3D scene is drawn into a small render target and blown back up with
 * nearest-neighbour filtering, so every game pixel lands as a crisp square
 * block of screen pixels. That is what gives the picture its chunky look, and
 * it is also why it is cheaper than before: at a pixel scale of 4 the GPU
 * fills one sixteenth of the pixels it used to.
 */
export const RETRO = {
  /** How many screen pixels wide one game pixel is. 4 = chunky. */
  pixelScale: 4,
  /** Finer pixels on a big screen, where 4 would read as a mosaic. */
  largePixelScale: 3,
  /** A drawing buffer at least this wide, in screen pixels, counts as large. */
  largeScreenWidth: 900,
  /** The low-res target never shrinks below this many game pixels on a side. */
  minTargetSize: 64,
  /** Brightness steps in the toon ramp: shadow, mid, lit. */
  toonSteps: 3,
  /**
   * The dark outline is an inverted hull: the same shape drawn inside out in
   * the outline colour and pushed out a little, so its back faces show as a
   * rim around the front ones. It is this rather than a full-screen edge pass
   * because it needs no second render target and no depth read, which is what
   * makes an edge pass expensive on a phone.
   *
   * The push is measured on screen, in game pixels, not in the world: a rim
   * measured in the world thins with distance until it is less than a pixel
   * and flickers in and out. This many game pixels wide, at every distance.
   */
  outlinePixels: 1,
  /** How many pixels of texture one unit of the world gets. */
  texturePixelsPerUnit: 8,
  /**
   * Anisotropic filtering for surfaces seen at a grazing angle (the slide), so
   * they stay readable into the distance instead of sparkling or smearing.
   * Three.js clamps it to what the device supports.
   */
  distantAnisotropy: 8,
  /** The sunset sky, painted once into a texture (section 1). */
  sky: {
    /** Size of the painted sky, in pixels. Small on purpose: it is upscaled. */
    width: 64,
    height: 112,
    /**
     * Where the dither band between the two sky colours sits, 0..1 from the
     * top, and how tall it is. Both sit high up because the hills cover the
     * bottom half of the sky: a band in the middle of the texture would be
     * painted behind them and never seen.
     */
    ditherCentre: 0.33,
    ditherHeight: 0.4,
    /**
     * The sun: radius in sky pixels, and where its middle sits, 0..1. High
     * enough to clear the hills, and off to one side so it does not sit
     * directly behind the slide.
     */
    sunRadius: 10,
    sunX: 0.64,
    sunY: 0.1,
    /** How much wider the glow ring around the sun is, in sky pixels. */
    sunGlowGrow: 4,
  },
  /**
   * Two layers of hills behind the slide, drawn as a flat 2D pixel backdrop
   * rather than as surfaces in the 3D world (src/render/hill-layout.ts).
   *
   * One hill pixel is exactly one game pixel, and the layers only ever move by
   * whole pixels, so the ridge can shift but never crawl. They still follow the
   * camera — `distance` and `lift` say where in the world each layer's middle
   * would be, and that point is projected each frame to place it — and
   * `parallax` is how much of the camera's sideways move each layer copies,
   * which is what makes the near layer slide against the far one.
   */
  hills: {
    /** How far in front of the camera each layer's middle is, in units. */
    distance: [195, 170],
    /** How far above the camera's eye line each layer's middle is, in units. */
    lift: [9, 1],
    /** Share of the camera's sideways move each layer copies, 0..1. */
    parallax: [0.12, 0.26],
    /**
     * Each layer's height as a share of the game picture's height. Chosen to
     * match the size the hills had as 3D surfaces, so the scene looks the same.
     */
    heightShare: [0.337, 0.275],
    /** Width of one repeat of the ridge, as a multiple of the layer's height. */
    tileAspect: [2.1, 2.55],
    /** Humps per repeat. Whole numbers, so the repeat has no seam. */
    periods: [4, 3],
    /** No layer is ever drawn smaller than this, in game pixels. */
    minHeight: 8,
    /**
     * The shape of the ridge, as shares of the layer's height: a resting
     * level, a main wave for the humps, and a smaller detail wave at a
     * different rhythm so the humps are not all the same.
     */
    ridge: {
      base: 0.62,
      main: 0.3,
      detail: 0.12,
      /** Detail waves per main wave (rounded to a whole number per repeat). */
      detailRatio: 2.3,
      /** Where the detail wave starts, in radians. */
      detailPhase: 1.1,
    },
  },
  /** The slide surface: pixel water with stripes that scroll past (section 1). */
  water: {
    /**
     * How long the painted pattern is before it repeats, in units. It has to
     * divide TRACK.segmentLength exactly, or a segment ends mid-pattern and
     * every segment join shows as a seam down the slide (guarded by a test).
     */
    patternLength: 10,
    /** How fast the light stripes scroll, in pattern-lengths per second. */
    stripeScroll: 0.55,
    /** How many light stripes are painted across one pattern. */
    stripes: 3,
    /** Thickness of a stripe, as a share of the pattern length. */
    stripeThickness: 0.1,
    /** Width of the sand rim down each side of the slide, in units. */
    rimWidth: 0.55,
    /** Thickness of the dark outline along the rim, in units. */
    rimOutline: 0.14,
    /** How strong the deeper-water band under each stripe is, 0..1. */
    shadeStrength: 0.35,
  },
  /** The spinning pixel coin: a billboard that flips through its frames. */
  coin: {
    /** Frames in the spin, drawn into one strip. */
    frames: 8,
    /** Pixels per frame, square. */
    framePixels: 16,
    /** How fast the strip plays, in frames per second. */
    frameRate: 12,
  },
  /** The pixel icon on each power-up's floating ring. */
  pickup: {
    /** Pixels per icon, square. */
    iconPixels: 16,
  },
  /**
   * Scenery down both sides of the slide: slide towers, round trees, palms and
   * huts, pooled and recycled exactly like the track segments (rule 7).
   */
  scenery: {
    /** One scenery slot every this many units, on each side. */
    spacing: 13,
    /** How far from the middle of the slide a prop stands, in units. */
    offsetMin: 7.5,
    offsetMax: 16,
    /** How much a prop's size can vary, as a multiplier. */
    scaleMin: 0.8,
    scaleMax: 1.35,
    /** How far ahead props are placed, in units: just inside the fog. */
    buildAhead: 150,
    /** How far behind the player a prop is recycled, in units. */
    recycleBehind: 25,
    /** Share of slots left empty, so the sides never look like a fence, 0..1. */
    emptyShare: 0.26,
  },
  /**
   * The grass the slide and the scenery stand on. Without it the props stood
   * on the sky, which read as the slide floating in a pink haze. One strip,
   * one draw call, bent to follow the slide and moved with the player; the
   * fog fades its far edge into the bottom of the sky.
   */
  ground: {
    /** How wide the strip is, in units: wide enough to reach past both edges of the view. */
    width: 120,
    /**
     * How many rows the strip is cut into along its length. Enough that the
     * straight line between two rows never rises far from the slide's curve,
     * which `drop` has to cover (guarded by a test).
     */
    rows: 28,
    /** How far below the slide floor the grass sits, in units, so it never shows through. */
    drop: 0.1,
    /** How long the painted grass pattern is before it repeats, in units. */
    patternLength: 6,
  },
  /** Square pixel splashes thrown up when the player lands (section 1). */
  splash: {
    /** How many particles one landing throws. */
    perLanding: 14,
    /** How many can be alive at once; the pool never grows (rule 7). */
    poolSize: 64,
    /** How long one particle lives, in seconds. */
    life: 0.5,
    /** Size of one square, in units. */
    size: 0.16,
    /** How fast they fly out, in units per second. */
    speedMin: 2.2,
    speedMax: 5.5,
    /** Downward pull on a particle, in units per second squared. */
    gravity: 11,
  },
} as const;

/**
 * The rider: an animal sitting in a funny ring, drawn as a flat pixel sprite
 * that faces the camera (docs/ART-AND-SHOP.md section 2).
 *
 * Purely visual (CLAUDE.md rule 13). Nothing in here is read by src/game/:
 * the hitbox is still PLAYER.radius and PLAYER.standHeight / slideHeight,
 * whichever animal and ring are on.
 *
 * Sizes are in sprite pixels. `pixelsPerUnit` turns them into world units:
 * at 16 the rider stands close to PLAYER.standHeight tall, and on a phone one
 * sprite pixel lands on roughly two game pixels of the low-res pass, which
 * keeps it close to the grid the rest of the scene is drawn on.
 */
export const RIDER = {
  /** Sprite pixels per world unit. Lower = bigger rider on screen. */
  pixelsPerUnit: 16,
  /** One animal frame, square. */
  animalPixels: 24,
  /** One ring frame. Each half (back, front) gets a frame of this size. */
  ringWidth: 32,
  ringHeight: 20,
  /** Ring rows above this are the back half (behind the animal), the rest the front. */
  ringSplitRow: 10,
  /** Spin frames per ring, drawn into the atlas. */
  ringSpinFrames: 4,
  /** How fast the ring turns through its spin frames, in frames per second. */
  ringSpinRate: 5,
  /** How far below the slide surface the ring's bottom edge sits, so it floats. */
  ringSinkPixels: 2,
  /** Which ring row the animal's bottom edge lines up with: it sits in the hole. */
  animalBottomRow: 19,
  /** The idle bob: how far, in sprite pixels, and how many bobs per second. */
  bobPixels: 1,
  bobRate: 2.2,
  /** Lane-change lean: the top of the animal slides this many pixels sideways. */
  leanShearPixels: 3,
  /** Lane units per second of sideways motion before the rider leans. */
  leanThreshold: 1.5,
  /** A refused lane change leans the rider into the wall while the bump is above this. */
  bumpLean: 0.3,
  /** Duck: the animal sinks into the ring, and the whole rider drops a little. */
  duckSinkPixels: 6,
  duckDropPixels: 4,
  /** Land: a quick squash into the ring when coming down from a jump. */
  landTime: 0.14,
  landSinkPixels: 3,
  /** Height above the slide, in units, that counts as off the water. */
  airborneHeight: 0.05,
  /** Crash: the animal pops up out of the ring, this many pixels. */
  crashLiftPixels: 7,
  /** The power-up effects drawn around the rider (shield, magnet, boost). */
  effectWidth: 44,
  effectHeight: 40,
  /** Frames per effect, and how fast they play, in frames per second. */
  effectFrames: 2,
  effectFrameRate: 6,
  /** How far behind (-) or in front (+) of the rider each layer sits, in units. */
  layerGap: 0.02,
  /**
   * The debug gallery (`?debug=1&gallery=1`): the zoom levels on offer, in
   * screen pixels per sprite pixel, and the one it opens at: two pictures
   * side by side on a phone. In the game the rider is drawn at about 4.
   */
  galleryZooms: [2, 3, 4] as const,
  galleryZoom: 3,
} as const;

/**
 * The retro palette (docs/ART-AND-SHOP.md section 1).
 *
 * Every colour the render layer uses comes from here, so the look can be
 * retuned without touching game logic (CLAUDE.md rule 8). All the names from
 * the spec's table are here; the older keys stay too, pointing at their new
 * retro colour, so nothing that reads the palette had to change.
 */
export const PALETTE = {
  /** Every outline, text shadow and button border. */
  outline: 0x2b2140,
  /** The sunset sky, the two ends of the dithered gradient. */
  skyTop: 0xf6c9a8,
  skyBottom: 0xf8e3c4,
  /** The sunset sun, and the glow ring around it. */
  sun: 0xfff1c9,
  sunGlow: 0xf4a259,
  /** The far hills: the distant layer and the nearer, darker one. */
  mountain: 0x9c8bc4,
  mountainDark: 0x6f5e9e,
  /** Trees and ground. */
  forest: 0x3e7a4a,
  forestLight: 0x6db36a,
  forestDark: 0x2e5a3a,
  /** The slide surface and its stripes. */
  water: 0x8fe0e8,
  waterLight: 0xc9f4f2,
  waterDeep: 0x4aa7c8,
  /** The rims down the sides of the slide. */
  slideEdge: 0xf2e2b8,
  sand: 0xd9c08c,
  /** Towers, obstacles and UI. */
  red: 0xe9806a,
  orange: 0xf2a65a,
  yellow: 0xf6c85f,
  blue: 0x3e6fbf,
  skyBlue: 0x6cc6e0,
  /** Text and highlights. */
  cream: 0xfbf3e4,

  // --- Riders (section 2). Fur, food and rubber the base palette lacks. ---
  /** The pig, the donut's icing. */
  pink: 0xf2a0b5,
  pinkDark: 0xc9708c,
  /** The bear, pizza crust, the pineapple's edge. */
  brown: 0x9a6b43,
  brownDark: 0x6a4630,
  /** The cat, the steering wheel. */
  grey: 0xb3adc4,
  greyDark: 0x7d7690,
  /** Rubber and vinyl: the tractor tyre, the record, the penguin's back. */
  charcoal: 0x46405a,

  // --- The older names, kept so nothing that reads them had to change. ---
  /** The clear colour behind the painted sky. */
  sky: 0xf8e3c4,
  /** Fog matches the bottom of the sky, so the track fades into it. */
  fog: 0xf8e3c4,
  /** The slide floor. */
  slide: 0x8fe0e8,
  /** The placeholder rider, until the animals arrive in M10. */
  player: 0xf6c85f,
  /** The four obstacles (section 1). */
  lowMine: 0xe9806a,
  highObstacle: 0x3e6fbf,
  fullBlocker: 0xd9c08c,
  softObstacle: 0xf6c85f,
  coin: 0xf6c85f,
  /** The three power-ups. */
  shield: 0x6cc6e0,
  magnet: 0x6f5e9e,
  boost: 0xf2a65a,
  /** The frame around the portrait playfield. */
  letterbox: 0x2b2140,
  /**
   * Debug hitboxes: the player, things that kill, things that trip. These are
   * deliberately not retro — they are read, not admired (SPEC 13).
   */
  debugPlayer: 0x40c057,
  debugDeadly: 0xff2d55,
  debugStumble: 0xffd60a,
} as const;
