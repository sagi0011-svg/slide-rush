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
  offset: { x: 0, y: 4.2, z: 7.5 },
  /** How far down the track the camera looks, in units ahead of the player. */
  lookAhead: 10,
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
} as const;

/** Coins (SPEC 8). */
export const COINS = {
  /** Distance at which a coin is collected, in units. */
  pickupRadius: 0.8,
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
