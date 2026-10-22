/**
 * The chunk fairness validator (SPEC 6).
 *
 * "Every chunk, and every pair of consecutive chunks, has at least one
 * survivable path given lane-change time, jump/slide durations and the max
 * speed of its tiers."
 *
 * The check is a breadth-first search over the *real* player simulation from
 * src/game/player.ts, so it can never drift away from how the game actually
 * behaves. At each step the search may carry on doing nothing, or take one of
 * the four moves — but only if at least DIFFICULTY.minReactionTime has passed
 * since the last one, which is what makes a path "humanly possible" (SPEC 5).
 *
 * Three deliberate choices make the check stricter than the rule it enforces,
 * so a chunk that passes is comfortably fair:
 *  - it wants a path that takes no hits at all, even ones that would only be
 *    a stumble;
 *  - it wants every starting lane to work, because the previous chunk decides
 *    which lane the player arrives in;
 *  - it only lets the player act on a coarse grid (ACTION_GRID_TICKS), rather
 *    than on any single frame, which no human could manage anyway.
 */

import { DIFFICULTY, LANES, PLAYER, SIM } from '../config';
import { createPlayer, queueAction, stepPlayer, type PlayerState } from './player';
import type { MoveAction } from './input-actions';
import { checkObstacle } from './collisions';
import type { Obstacle } from './obstacles';

const ACTIONS: readonly MoveAction[] = ['left', 'right', 'jump', 'slide'];

/** The player may only act every this many ticks: 3 ticks is 1/20 of a second. */
const ACTION_GRID_TICKS = 3;

/** Obstacles further than this from the player cannot be touching them. */
const NEAR = 4;

export interface FairnessOptions {
  /** How fast the player is moving, in units per second. */
  speed: number;
  /** Where the run starts, in units. */
  startS: number;
  /** Where it ends, in units. */
  endS: number;
  /** Which lane the player arrives in. */
  startLane: number;
  /** Safety valve: give up after this many states rather than hang. */
  maxStates?: number;
}

export interface Move {
  action: MoveAction;
  /** How far along the slide the move was made, in units. */
  atS: number;
}

export interface FairnessResult {
  survivable: boolean;
  /** The moves that got through, for a readable test failure. */
  path: readonly Move[];
  /** How many states the search looked at. */
  statesExplored: number;
  /** Set if the search hit its budget instead of finishing. */
  exhausted: boolean;
}

interface SearchNode {
  player: PlayerState;
  /** Seconds since the last move, capped so the search space stays small. */
  sinceAction: number;
  /** Where this node came from, so a path can be read back without copying. */
  parent: SearchNode | null;
  move: MoveAction | null;
  /** Units travelled when `move` was made. */
  moveAtS: number;
}

const VERTICAL_CODE = { running: 0, jumping: 1, sliding: 2 } as const;
const BUFFER_CODE = { left: 1, right: 2, jump: 3, slide: 4 } as const;

/**
 * A compact, exact description of a state, so the search never looks at the
 * same situation twice. Every value advances in fixed steps, so rounding to a
 * thousandth of a unit cannot merge two states that behave differently.
 */
function stateKey(node: SearchNode): number {
  const p = node.player;
  const laneOffsetQ = Math.round((p.laneOffset + 1) * 1000); // 0..2000
  const laneTQ = Math.round(Math.min(p.laneT, 1) * 100); // 0..100
  const verticalTicks = Math.min(Math.round(p.verticalTimer / SIM.dt), 47);
  const sinceTicks = Math.min(Math.round(node.sinceAction / SIM.dt), 28);

  let key = laneOffsetQ;
  key = key * 101 + laneTQ;
  key = key * 3 + VERTICAL_CODE[p.vertical];
  key = key * 48 + verticalTicks;
  key = key * 2 + (p.fastDropping ? 1 : 0);
  key = key * 5 + (p.buffered === null ? 0 : BUFFER_CODE[p.buffered]);
  key = key * 29 + sinceTicks;
  key = key * 3 + (p.laneTarget + 1);
  return key;
}

function readPath(node: SearchNode): Move[] {
  const moves: Move[] = [];
  let current: SearchNode | null = node;
  while (current !== null) {
    if (current.move !== null) moves.push({ action: current.move, atS: current.moveAtS });
    current = current.parent;
  }
  return moves.reverse();
}

/** True if the player is touching any obstacle at this instant. */
function isHit(
  player: PlayerState,
  s: number,
  previousS: number,
  obstacles: readonly Obstacle[],
): boolean {
  for (const obstacle of obstacles) {
    if (Math.abs(obstacle.s - s) > NEAR) continue;
    if (checkObstacle(player, s, previousS, obstacle) !== null) return true;
  }
  return false;
}

/**
 * Searches for a survivable path through a stretch of track.
 *
 * @param obstacles every obstacle in the stretch, in absolute slide units
 */
export function findSurvivablePath(
  obstacles: readonly Obstacle[],
  options: FairnessOptions,
): FairnessResult {
  const { speed, startS, endS, startLane } = options;
  const maxStates = options.maxStates ?? 2_000_000;
  const dt = SIM.dt;
  const step = speed * dt;

  const start = createPlayer();
  start.laneTarget = startLane;
  start.laneFrom = startLane;
  start.laneOffset = startLane;
  start.prevLaneOffset = startLane;

  let frontier: SearchNode[] = [
    {
      player: start,
      sinceAction: DIFFICULTY.minReactionTime,
      parent: null,
      move: null,
      moveAtS: 0,
    },
  ];

  const seen = new Set<number>();
  let statesExplored = 0;
  let tick = 0;
  // Every node in a frontier has travelled the same distance, so one running
  // total answers for all of them.
  let s = startS;

  while (frontier.length > 0 && s < endS) {
    const next: SearchNode[] = [];
    const previousS = s;
    s += step;
    tick += 1;
    seen.clear();

    const mayAct = tick % ACTION_GRID_TICKS === 0;

    for (const node of frontier) {
      statesExplored += 1;
      if (statesExplored > maxStates) {
        return { survivable: false, path: [], statesExplored, exhausted: true };
      }

      const canAct = mayAct && node.sinceAction >= DIFFICULTY.minReactionTime;

      // Doing nothing is always option 0; the moves need the reaction gap.
      const choiceCount = canAct ? ACTIONS.length + 1 : 1;
      for (let i = 0; i < choiceCount; i += 1) {
        const choice = i === 0 ? null : (ACTIONS[i - 1] as MoveAction);
        const player: PlayerState = { ...node.player };
        if (choice !== null) queueAction(player, choice);
        stepPlayer(player, dt);

        if (isHit(player, s, previousS, obstacles)) continue;

        const child: SearchNode = {
          player,
          sinceAction: choice === null ? node.sinceAction + dt : 0,
          parent: node,
          move: choice,
          moveAtS: previousS,
        };

        const key = stateKey(child);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(child);
      }
    }

    frontier = next;
  }

  const survivor = frontier[0];
  if (survivor !== undefined) {
    return { survivable: true, path: readPath(survivor), statesExplored, exhausted: false };
  }
  return { survivable: false, path: [], statesExplored, exhausted: false };
}

/** Every lane the player could arrive in. */
export const START_LANES: readonly number[] = LANES.indices;

/**
 * The gap, in seconds, after which a pair of chunks needs no search of its own.
 *
 * If the last obstacle of one chunk and the first of the next are at least this
 * far apart, a path through the pair can always be built by joining a path
 * through the first chunk, a stretch of doing nothing, and a path through the
 * second. The gap covers the longest action the player could still be finishing
 * (a jump or a slide), the reaction time before their next move, and one lane
 * change — after which they are standing, free to act, and the second chunk is
 * known to be survivable from whichever lane they are in.
 */
export const SAFE_GAP_SECONDS =
  Math.max(PLAYER.jumpTime, PLAYER.slideTime) + DIFFICULTY.minReactionTime + PLAYER.laneChangeTime;

/**
 * True if a pair of chunks has to be searched, rather than following from the
 * two chunks having been checked on their own.
 *
 * @param lastObstacleS the last obstacle of the first chunk, in absolute units
 * @param firstObstacleS the first obstacle of the second chunk, in absolute units
 */
export function pairNeedsSearch(
  lastObstacleS: number | null,
  firstObstacleS: number | null,
  speed: number,
): boolean {
  // An empty chunk on either side cannot create a new problem.
  if (lastObstacleS === null || firstObstacleS === null) return false;
  return firstObstacleS - lastObstacleS < SAFE_GAP_SECONDS * speed;
}
