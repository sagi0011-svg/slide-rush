import { describe, expect, it } from 'vitest';
import { LANES, OBSTACLES, PLAYER, SIM } from '../src/config';
import { createPlayer, queueAction, stepPlayer, type PlayerState } from '../src/game/player';
import { checkObstacle, playerBox } from '../src/game/collisions';
import {
  clearedByJump,
  clearedBySlide,
  createBox,
  frontHitCost,
  laneChangeOnly,
  obstacleBox,
  OBSTACLE_TYPES,
  type Obstacle,
  type ObstacleType,
} from '../src/game/obstacles';

const DT = SIM.dt;

function run(player: PlayerState, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepPlayer(player, DT);
}

/** A player standing still in a lane, with no movement between ticks. */
function standing(lane: number): PlayerState {
  const player = createPlayer();
  player.laneTarget = lane;
  player.laneFrom = lane;
  player.laneOffset = lane;
  player.prevLaneOffset = lane;
  return player;
}

function obstacleAt(type: ObstacleType, lane: number, s: number): Obstacle {
  return { type, lane, s };
}

describe('obstacle rules (SPEC 7)', () => {
  it('only the soft obstacle is survivable head-on', () => {
    expect(frontHitCost('lowMine')).toBe('death');
    expect(frontHitCost('highObstacle')).toBe('death');
    expect(frontHitCost('fullBlocker')).toBe('death');
    expect(frontHitCost('softObstacle')).toBe('stumble');
  });

  it('says how each type is passed', () => {
    expect(clearedByJump('lowMine')).toBe(true);
    expect(clearedByJump('softObstacle')).toBe(true);
    expect(clearedByJump('highObstacle')).toBe(false);
    expect(clearedByJump('fullBlocker')).toBe(false);

    expect(clearedBySlide('highObstacle')).toBe(true);
    expect(clearedBySlide('lowMine')).toBe(false);

    expect(laneChangeOnly('fullBlocker')).toBe(true);
    expect(laneChangeOnly('lowMine')).toBe(false);
  });

  it('makes every hitbox smaller than the visual (SPEC 7)', () => {
    const box = createBox();
    for (const type of OBSTACLE_TYPES) {
      obstacleBox(obstacleAt(type, 0, 0), box);
      const size = OBSTACLES.size[type];
      expect(box.halfW * 2, type).toBeLessThan(size.w);
      expect(box.maxY - box.minY, type).toBeLessThan(size.h);
      expect(box.halfD * 2, type).toBeLessThan(size.d);
      expect(box.minY, type).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts each obstacle in the middle of its lane', () => {
    const box = createBox();
    obstacleBox(obstacleAt('lowMine', -1, 10), box);
    expect(box.x).toBe(-LANES.width);
    expect(box.z).toBe(10);
    obstacleBox(obstacleAt('lowMine', 1, 10), box);
    expect(box.x).toBe(LANES.width);
  });
});

describe('the player box', () => {
  it('shrinks when sliding and rises when jumping (SPEC 7)', () => {
    const box = createBox();
    const player = standing(0);

    playerBox(player, 0, box);
    const standingHeight = box.maxY - box.minY;
    expect(box.minY).toBe(0);

    queueAction(player, 'slide');
    stepPlayer(player, DT);
    playerBox(player, 0, box);
    expect(box.maxY - box.minY).toBeLessThan(standingHeight);
    expect(box.minY).toBe(0);

    const jumper = standing(0);
    queueAction(jumper, 'jump');
    run(jumper, PLAYER.jumpTime / 2);
    playerBox(jumper, 0, box);
    expect(box.minY).toBeGreaterThan(1.5);
  });
});

describe('head-on collisions (SPEC 7)', () => {
  /** Walks the player straight into an obstacle and reports what happened. */
  function runInto(player: PlayerState, obstacle: Obstacle, step = 0.3) {
    let distance = obstacle.s - 6;
    for (let i = 0; i < 60; i += 1) {
      const previous = distance;
      distance += step;
      stepPlayer(player, DT);
      const hit = checkObstacle(player, distance, previous, obstacle);
      if (hit !== null) return hit;
    }
    return null;
  }

  it('running into a low mine is death', () => {
    const hit = runInto(standing(0), obstacleAt('lowMine', 0, 20));
    expect(hit).toEqual({ kind: 'front', cost: 'death' });
  });

  it('running into a wall is death', () => {
    const hit = runInto(standing(0), obstacleAt('fullBlocker', 0, 20));
    expect(hit).toEqual({ kind: 'front', cost: 'death' });
  });

  it('running into an arch is death', () => {
    const hit = runInto(standing(0), obstacleAt('highObstacle', 0, 20));
    expect(hit).toEqual({ kind: 'front', cost: 'death' });
  });

  it('running into a soft ring is only a stumble', () => {
    const hit = runInto(standing(0), obstacleAt('softObstacle', 0, 20));
    expect(hit).toEqual({ kind: 'front', cost: 'stumble' });
  });

  it('misses anything in another lane', () => {
    for (const type of OBSTACLE_TYPES) {
      expect(runInto(standing(0), obstacleAt(type, 1, 20)), type).toBeNull();
      expect(runInto(standing(0), obstacleAt(type, -1, 20)), type).toBeNull();
    }
  });
});

describe('clearing obstacles (SPEC 7)', () => {
  /**
   * Approaches an obstacle and takes an action at the right moment, then
   * reports whether anything was hit.
   */
  function attempt(action: 'jump' | 'slide' | null, type: ObstacleType, speed = 18) {
    const player = standing(0);
    const obstacle = obstacleAt(type, 0, 20);
    let distance = 0;
    let acted = false;
    for (let i = 0; i < 400; i += 1) {
      const previous = distance;
      distance += speed * DT;
      // Act so the action is at its strongest as the obstacle goes past.
      if (!acted && action !== null && distance > 20 - speed * 0.33) {
        queueAction(player, action);
        acted = true;
      }
      stepPlayer(player, DT);
      if (checkObstacle(player, distance, previous, obstacle) !== null) return 'hit';
      if (distance > 26) break;
    }
    return 'clear';
  }

  it('a jump clears a low mine and a soft ring', () => {
    expect(attempt('jump', 'lowMine')).toBe('clear');
    expect(attempt('jump', 'softObstacle')).toBe('clear');
  });

  it('a jump does not clear an arch or a wall', () => {
    expect(attempt('jump', 'highObstacle')).toBe('hit');
    expect(attempt('jump', 'fullBlocker')).toBe('hit');
  });

  it('a slide gets under an arch', () => {
    expect(attempt('slide', 'highObstacle')).toBe('clear');
  });

  it('a slide does not get under a mine or a wall', () => {
    expect(attempt('slide', 'lowMine')).toBe('hit');
    expect(attempt('slide', 'fullBlocker')).toBe('hit');
  });

  it('doing nothing hits everything', () => {
    for (const type of OBSTACLE_TYPES) {
      expect(attempt(null, type), type).toBe('hit');
    }
  });
});

describe('side hits (SPEC 7)', () => {
  /** Draws level with an obstacle in the next lane, then moves into it. */
  function slideIntoSide(type: ObstacleType) {
    const player = standing(0);
    const obstacle = obstacleAt(type, 1, 20);
    let distance = 0;
    // Slow enough that the lane change finishes while still level with it.
    const speed = 8;
    let acted = false;
    for (let i = 0; i < 400; i += 1) {
      const previous = distance;
      distance += speed * DT;
      // Change lane only once already level with the obstacle.
      if (!acted && distance >= obstacle.s - 1) {
        queueAction(player, 'right');
        acted = true;
      }
      stepPlayer(player, DT);
      const hit = checkObstacle(player, distance, previous, obstacle);
      if (hit !== null) return hit;
      if (distance > 23) break;
    }
    return null;
  }

  it('moving into the side of anything is a stumble, never death', () => {
    for (const type of OBSTACLE_TYPES) {
      const hit = slideIntoSide(type);
      expect(hit, type).not.toBeNull();
      expect(hit?.kind, type).toBe('side');
      expect(hit?.cost, type).toBe('stumble');
    }
  });
});
