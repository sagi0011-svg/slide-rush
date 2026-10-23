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

/** Camera and presentation (SPEC 2). */
export const CAMERA = {
  /** Portrait aspect ratio the playfield is letterboxed to (width / height). */
  aspect: 9 / 16,
  /** Vertical field of view, in degrees. */
  fov: 60,
  /** Near and far clipping planes, in units. */
  near: 0.1,
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
  spawnIntervalMin: 10,
  spawnIntervalMax: 15,
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
   * The ten placeholder effects (SPEC 12). `gain` is the peak of the rendered
   * sound, `from`/`to` are the ends of a sweep, `notes` are fixed pitches.
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
  /** How far ahead of the obstacle the slide starts holding, in units. */
  holdDistance: 14,
  /** How fast the slide creeps while a prompt waits, as a fraction of normal. */
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
 * Placeholder palette. Every colour used by the render layer comes from here,
 * so swapping in real art later never touches game logic (CLAUDE.md rule 8).
 */
export const PALETTE = {
  sky: 0x7fd4ff,
  fog: 0x7fd4ff,
  water: 0x2aa9e0,
  slide: 0x3fc1f2,
  slideEdge: 0xffffff,
  player: 0xffe066,
  lowMine: 0xe03131,
  highObstacle: 0x1971c2,
  fullBlocker: 0x868e96,
  softObstacle: 0xfcc419,
  coin: 0xffd43b,
  shield: 0x22d3ee,
  magnet: 0x9775fa,
  boost: 0xff922b,
  letterbox: 0x0b1726,
  /** Debug hitboxes: the player, things that kill, things that trip. */
  debugPlayer: 0x40c057,
  debugDeadly: 0xff2d55,
  debugStumble: 0xffd60a,
} as const;
