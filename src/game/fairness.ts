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

/** The player may only act every this many ticks: 5 ticks is 1/12 of a second. */
const ACTION_GRID_TICKS = 5;

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
function playerKey(p: PlayerState): number {
  const laneOffsetQ = Math.round((p.laneOffset + 1) * 1000); // 0..2000
  const laneTQ = Math.round(Math.min(p.laneT, 1) * 100); // 0..100
  const verticalTicks = Math.min(Math.round(p.verticalTimer / SIM.dt), 47);

  let key = laneOffsetQ;
  key = key * 101 + laneTQ;
  key = key * 3 + VERTICAL_CODE[p.vertical];
  key = key * 48 + verticalTicks;
  key = key * 2 + (p.fastDropping ? 1 : 0);
  key = key * 5 + (p.buffered === null ? 0 : BUFFER_CODE[p.buffered]);
  key = key * 3 + (p.laneTarget + 1);
  return key;
}

function stateKey(node: SearchNode): number {
  const sinceTicks = Math.min(Math.round(node.sinceAction / SIM.dt), 28);
  return playerKey(node.player) * 29 + sinceTicks;
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
 * Everything the player could be doing at one point on the slide: a set of
 * states rather than one, because the search keeps every path that is still
 * alive.
 *
 * Handing one of these back lets a pair of chunks carry on from where the
 * first chunk left off, instead of searching that chunk again for every pair
 * it takes part in.
 */
export interface Frontier {
  readonly nodes: readonly SearchNode[];
  /** How far along the slide these states are, in units. */
  readonly s: number;
  /** Ticks simulated to get here, which sets when a move is next allowed. */
  readonly tick: number;
}

/** A player standing in a lane at the start of a stretch, ready to act. */
export function startingFrontier(startLane: number, startS = 0): Frontier {
  const start = createPlayer();
  start.laneTarget = startLane;
  start.laneFrom = startLane;
  start.laneOffset = startLane;
  start.prevLaneOffset = startLane;

  return {
    nodes: [
      {
        player: start,
        sinceAction: DIFFICULTY.minReactionTime,
        parent: null,
        move: null,
        moveAtS: 0,
      },
    ],
    s: startS,
    tick: 0,
  };
}

export interface AdvanceResult extends FairnessResult {
  /** Everything still alive at the end, to carry on from. */
  frontier: Frontier;
}

/**
 * Carries a frontier forward along the slide, dropping any path that gets hit.
 *
 * @param obstacles every obstacle in the stretch, in absolute slide units
 */
export function advanceFrontier(
  from: Frontier,
  obstacles: readonly Obstacle[],
  endS: number,
  speed: number,
  maxStates = 2_000_000,
): AdvanceResult {
  const dt = SIM.dt;
  const step = speed * dt;

  let frontier: SearchNode[] = [...from.nodes];
  const seen = new Set<number>();
  let statesExplored = 0;
  let tick = from.tick;
  // Every node in a frontier has travelled the same distance, so one running
  // total answers for all of them.
  let s = from.s;

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
        return {
          survivable: false,
          path: [],
          statesExplored,
          exhausted: true,
          frontier: { nodes: [], s, tick },
        };
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

  const result: Frontier = { nodes: frontier, s, tick };
  const survivor = frontier[0];
  if (survivor !== undefined) {
    return {
      survivable: true,
      path: readPath(survivor),
      statesExplored,
      exhausted: false,
      frontier: result,
    };
  }
  return { survivable: false, path: [], statesExplored, exhausted: false, frontier: result };
}

/**
 * Searches for a survivable path through a stretch of track, starting from a
 * player standing in one lane.
 */
export function findSurvivablePath(
  obstacles: readonly Obstacle[],
  options: FairnessOptions,
): FairnessResult {
  return advanceFrontier(
    startingFrontier(options.startLane, options.startS),
    obstacles,
    options.endS,
    options.speed,
    options.maxStates,
  );
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

/**
 * Trims a frontier down to the states that actually matter.
 *
 * Two paths can arrive in exactly the same position and pose having last
 * acted at different moments. The one that acted longer ago can do everything
 * the other can and is free to act sooner, so the other adds nothing and is
 * dropped. Nothing survivable is lost; there is simply less to carry forward.
 *
 * At the handover between two chunks this typically turns a few hundred
 * states into a few dozen, which is what keeps the pair checks quick.
 */
export function collapseFrontier(frontier: Frontier): Frontier {
  const best = new Map<number, SearchNode>();
  for (const node of frontier.nodes) {
    const key = playerKey(node.player);
    const held = best.get(key);
    if (held === undefined || node.sinceAction > held.sinceAction) best.set(key, node);
  }
  return { nodes: [...best.values()], s: frontier.s, tick: frontier.tick };
}
