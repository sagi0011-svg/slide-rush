/**
 * The player: lanes, jumping, sliding and input buffering (SPEC 3).
 *
 * Pure logic, no Three.js. Every value the renderer needs is stored twice —
 * once for the previous tick and once for the current one — so rendering can
 * interpolate between them (CLAUDE.md rules 4 and 5).
 */

import { LANES, PLAYER } from '../config';
import type { MoveAction } from './input-actions';

export type VerticalState = 'running' | 'jumping' | 'sliding';

export interface PlayerState {
  /** Lane the player is heading for: -1, 0 or 1. */
  laneTarget: number;
  /** Lane offset the current lane change started from (a float, not a lane index). */
  laneFrom: number;
  /** Progress of the current lane change, 0..1. */
  laneT: number;
  /** Where the player is across the slide right now, in lane units. */
  laneOffset: number;
  /** Lane offset at the previous tick, for interpolation. */
  prevLaneOffset: number;
  vertical: VerticalState;
  /** Seconds spent in the current jump or slide. */
  verticalTimer: number;
  /** Height above the slide floor, in units. */
  height: number;
  /** Height at the previous tick, for interpolation. */
  prevHeight: number;
  /** True while a jump is being cut short by a mid-air slide. */
  fastDropping: boolean;
  /** The one action waiting for a moment when it becomes valid (SPEC 3). */
  buffered: MoveAction | null;
  /** How long the buffered action has been waiting, in seconds. */
  bufferedAge: number;
  /** Edge-bump feedback, 1 right after a refused lane change, fading to 0. */
  bump: number;
}

export function createPlayer(): PlayerState {
  return {
    laneTarget: LANES.start,
    laneFrom: LANES.start,
    laneT: 1,
    laneOffset: LANES.start,
    prevLaneOffset: LANES.start,
    vertical: 'running',
    verticalTimer: 0,
    height: 0,
    prevHeight: 0,
    fastDropping: false,
    buffered: null,
    bufferedAge: 0,
    bump: 0,
  };
}

export function isAirborne(player: PlayerState): boolean {
  return player.vertical === 'jumping';
}

export function isSliding(player: PlayerState): boolean {
  return player.vertical === 'sliding';
}

/** True while a lane change is still in progress. */
export function isChangingLane(player: PlayerState): boolean {
  return player.laneT < 1;
}

/** Smoothstep: starts and ends gently, so a lane change has no hard edges. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Outermost lanes, worked out once so the hot loop never allocates. */
const LANE_MIN = Math.min(...LANES.indices);
const LANE_MAX = Math.max(...LANES.indices);

function clampLane(lane: number): number {
  return Math.min(Math.max(lane, LANE_MIN), LANE_MAX);
}

/**
 * Tries to carry out an action right now.
 * @returns true if it was used (or deliberately refused), false if it should wait in the buffer.
 */
function tryApply(player: PlayerState, action: MoveAction): boolean {
  switch (action) {
    case 'left':
    case 'right': {
      // Retarget from the lane we are heading for, so a fast double-swipe
      // crosses two lanes instead of being swallowed (SPEC 3).
      const next = clampLane(player.laneTarget + (action === 'left' ? -1 : 1));
      if (next === player.laneTarget) {
        // Already against the outside wall: nothing happens, just a bump.
        player.bump = 1;
        return true;
      }
      // Start from where the player actually is, so there is never a snap.
      player.laneFrom = player.laneOffset;
      player.laneTarget = next;
      player.laneT = 0;
      return true;
    }

    case 'jump': {
      // One jump at a time; a jump pressed in mid-air waits in the buffer.
      if (player.vertical === 'jumping') return false;
      // Jumping out of a slide cuts the slide short (SPEC 3).
      player.vertical = 'jumping';
      player.verticalTimer = 0;
      player.fastDropping = false;
      return true;
    }

    case 'slide': {
      if (player.vertical === 'jumping') {
        // Mid-air slide: cancel the jump into a fast drop, then slide on landing.
        player.fastDropping = true;
        return true;
      }
      // Already sliding: wait, so the slide is extended rather than restarted.
      if (player.vertical === 'sliding') return false;
      player.vertical = 'sliding';
      player.verticalTimer = 0;
      return true;
    }
  }
}

/**
 * Takes an action from the player. If it cannot happen yet it waits in the
 * buffer for up to PLAYER.inputBufferTime seconds (SPEC 3). Only one action
 * is ever buffered; a newer one replaces an older one.
 */
export function queueAction(player: PlayerState, action: MoveAction): void {
  if (tryApply(player, action)) return;
  player.buffered = action;
  player.bufferedAge = 0;
}

function stepLane(player: PlayerState, dt: number): void {
  if (player.laneT >= 1) {
    player.laneOffset = player.laneTarget;
    return;
  }
  player.laneT = Math.min(1, player.laneT + dt / PLAYER.laneChangeTime);
  player.laneOffset = player.laneFrom + (player.laneTarget - player.laneFrom) * ease(player.laneT);
}

function stepVertical(player: PlayerState, dt: number): void {
  switch (player.vertical) {
    case 'running':
      player.height = 0;
      return;

    case 'jumping': {
      player.verticalTimer += dt;
      if (player.fastDropping) {
        player.height -= PLAYER.fastDropSpeed * dt;
        if (player.height <= 0) {
          // Landing out of a fast drop goes straight into a slide (SPEC 3).
          player.height = 0;
          player.fastDropping = false;
          player.vertical = 'sliding';
          player.verticalTimer = 0;
        }
        return;
      }
      const t = player.verticalTimer / PLAYER.jumpTime;
      if (t >= 1) {
        player.height = 0;
        player.vertical = 'running';
        player.verticalTimer = 0;
        return;
      }
      // Parabola: apex of exactly PLAYER.jumpHeight at half the airtime.
      player.height = 4 * PLAYER.jumpHeight * t * (1 - t);
      return;
    }

    case 'sliding': {
      player.verticalTimer += dt;
      player.height = 0;
      if (player.verticalTimer >= PLAYER.slideTime) {
        player.vertical = 'running';
        player.verticalTimer = 0;
      }
      return;
    }
  }
}

function stepBuffer(player: PlayerState, dt: number): void {
  if (player.buffered === null) return;
  player.bufferedAge += dt;
  if (player.bufferedAge > PLAYER.inputBufferTime) {
    player.buffered = null;
    player.bufferedAge = 0;
    return;
  }
  if (tryApply(player, player.buffered)) {
    player.buffered = null;
    player.bufferedAge = 0;
  }
}

/** Advances the player by exactly one fixed tick. */
export function stepPlayer(player: PlayerState, dt: number): void {
  player.prevLaneOffset = player.laneOffset;
  player.prevHeight = player.height;

  stepLane(player, dt);
  // Vertical state is advanced before the buffer is retried, so a jump pressed
  // just before landing fires on the very tick the player lands (SPEC 3).
  stepVertical(player, dt);
  stepBuffer(player, dt);

  if (player.bump > 0) {
    player.bump = Math.max(0, player.bump - dt / PLAYER.bumpDecayTime);
  }
}

/**
 * Bounces the player back to the lane they came from, after sliding into the
 * side of an obstacle (SPEC 7).
 */
export function bouncePlayer(player: PlayerState): void {
  const from = clampLane(Math.round(player.laneFrom));
  player.laneFrom = player.laneOffset;
  player.laneTarget = from;
  player.laneT = 0;
  player.bump = 1;
}
