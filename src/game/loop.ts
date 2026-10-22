/**
 * Fixed-timestep accumulator (CLAUDE.md rule 5).
 *
 * Pure logic: given how long the last frame took, it says how many simulation
 * ticks to run and how far between ticks the renderer should interpolate.
 * This is what makes the game behave the same at 30, 60 or 120 fps.
 */

export interface StepPlan {
  /** How many fixed simulation ticks to run this frame. */
  ticks: number;
  /** How far we are into the next tick, 0..1, for interpolated rendering. */
  alpha: number;
  /** Ticks dropped because the frame was far too long (tab was asleep). */
  droppedTicks: number;
}

export interface FixedStepper {
  /** Seconds per tick. */
  readonly dt: number;
  /** Time carried over into the next frame, in seconds. */
  readonly pending: number;
  /** Plans the simulation work for a frame of `frameSeconds`. */
  advance(frameSeconds: number): StepPlan;
  /** Clears carried-over time (after a pause, or on restart). */
  reset(): void;
}

/**
 * @param dt seconds per simulation tick (e.g. 1/60)
 * @param maxTicksPerFrame cap so a long stall cannot freeze the page catching up
 */
export function createFixedStepper(dt: number, maxTicksPerFrame: number): FixedStepper {
  if (dt <= 0) throw new Error('createFixedStepper: dt must be greater than 0');
  if (maxTicksPerFrame < 1) throw new Error('createFixedStepper: maxTicksPerFrame must be >= 1');

  let accumulator = 0;

  return {
    dt,
    get pending() {
      return accumulator;
    },
    advance(frameSeconds: number): StepPlan {
      // Ignore negative or non-finite frame times rather than corrupting the clock.
      if (Number.isFinite(frameSeconds) && frameSeconds > 0) {
        accumulator += frameSeconds;
      }

      let ticks = Math.floor(accumulator / dt);
      let droppedTicks = 0;

      if (ticks > maxTicksPerFrame) {
        droppedTicks = ticks - maxTicksPerFrame;
        ticks = maxTicksPerFrame;
        // Throw away the backlog; keep only the sub-tick remainder.
        accumulator -= droppedTicks * dt;
      }

      accumulator -= ticks * dt;
      // Floating-point subtraction can leave a tiny negative remainder; keep it in [0, dt).
      if (accumulator < 0) accumulator = 0;

      return { ticks, alpha: accumulator / dt, droppedTicks };
    },
    reset() {
      accumulator = 0;
    },
  };
}
