/**
 * Every tunable number in Slide Rush lives here.
 *
 * Game code must never contain magic numbers — import from this file instead.
 * The values mirror docs/SPEC.md; if a number changes here, update the spec too.
 * Units: 1 unit ~= 1 metre, all times in seconds.
 */

/** Fixed-timestep simulation (SPEC 13 / CLAUDE.md rule 5). */
export const SIM = {
  /** Simulation ticks per second. Gameplay must behave identically at any frame rate. */
  hz: 60,
  /** Seconds per simulation tick. */
  get dt(): number {
    return 1 / this.hz;
  },
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
  spawnIntervalMin: 20,
  spawnIntervalMax: 30,
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

/** Local save (SPEC 10). */
export const SAVE = {
  /** Versioned localStorage key, so an old save shape can never break a new build. */
  key: 'slide-rush/save/v1',
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
} as const;
