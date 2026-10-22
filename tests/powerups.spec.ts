import { describe, expect, it } from 'vitest';
import { COINS, POWERUPS, SIM, SPEED } from '../src/config';
import {
  absorbWithShield,
  createPowerUps,
  durationOf,
  grant,
  isActive,
  isInvulnerable,
  isMagnetic,
  POWERUP_TYPES,
  remainingFraction,
  speedWithPowerUps,
  stepPowerUps,
  wantsEasyTrack,
  type PowerUpState,
} from '../src/game/powerups';
import { nextPickupDelay, pickupCollected, randomPickupType } from '../src/game/pickups';
import { pullCoin, withinMagnetReach, type Coin } from '../src/game/coins';
import { createRng } from '../src/game/rng';

const DT = SIM.dt;

/** Runs the power-up timers for a while at a steady base speed. */
function run(state: PowerUpState, seconds: number, baseSpeed = 20): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i += 1) stepPowerUps(state, DT, baseSpeed);
}

describe('granting power-ups (SPEC 9)', () => {
  it('starts with nothing running', () => {
    const state = createPowerUps();
    for (const type of POWERUP_TYPES) {
      expect(isActive(state, type), type).toBe(false);
    }
    expect(isInvulnerable(state)).toBe(false);
    expect(isMagnetic(state)).toBe(false);
  });

  it('runs each one for the time the spec says', () => {
    expect(durationOf('shield')).toBe(POWERUPS.shield.duration);
    expect(durationOf('magnet')).toBe(POWERUPS.magnet.duration);
    expect(durationOf('boost')).toBe(POWERUPS.boost.duration);
  });

  it('runs down and stops', () => {
    const state = createPowerUps();
    grant(state, 'magnet');
    expect(isActive(state, 'magnet')).toBe(true);

    run(state, POWERUPS.magnet.duration - 0.1);
    expect(isActive(state, 'magnet')).toBe(true);

    run(state, 0.2);
    expect(isActive(state, 'magnet')).toBe(false);
    expect(state.magnet).toBe(0);
  });

  it('lets all three run at once (SPEC 9)', () => {
    const state = createPowerUps();
    for (const type of POWERUP_TYPES) grant(state, type);
    for (const type of POWERUP_TYPES) {
      expect(isActive(state, type), type).toBe(true);
    }
  });

  it('resets the timer rather than stacking (SPEC 9)', () => {
    const state = createPowerUps();
    grant(state, 'magnet');
    run(state, 7);
    expect(state.magnet).toBeCloseTo(POWERUPS.magnet.duration - 7, 4);

    grant(state, 'magnet');
    expect(state.magnet).toBe(POWERUPS.magnet.duration);
  });

  it('reports how much is left, for the bar on the HUD', () => {
    const state = createPowerUps();
    expect(remainingFraction(state, 'shield')).toBe(0);

    grant(state, 'shield');
    expect(remainingFraction(state, 'shield')).toBe(1);

    run(state, POWERUPS.shield.duration / 2);
    expect(remainingFraction(state, 'shield')).toBeCloseTo(0.5, 2);
  });

  it('picks a type at random, all three equally likely (SPEC 9)', () => {
    const rng = createRng(1);
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const type = randomPickupType(rng);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    expect(counts.size).toBe(3);
    for (const type of POWERUP_TYPES) {
      const share = (counts.get(type) ?? 0) / 3000;
      expect(share, type).toBeGreaterThan(0.28);
      expect(share, type).toBeLessThan(0.39);
    }
  });

  it('waits 20 to 30 seconds between pickups (SPEC 9)', () => {
    const rng = createRng(2);
    for (let i = 0; i < 500; i += 1) {
      const delay = nextPickupDelay(rng);
      expect(delay).toBeGreaterThanOrEqual(POWERUPS.spawnIntervalMin);
      expect(delay).toBeLessThan(POWERUPS.spawnIntervalMax);
    }
  });
});

describe('the shield (SPEC 9)', () => {
  it('takes one hit and is gone', () => {
    const state = createPowerUps();
    grant(state, 'shield');

    expect(absorbWithShield(state)).toBe(true);
    expect(isActive(state, 'shield')).toBe(false);
    // A second hit has nothing left to take it.
    expect(absorbWithShield(state)).toBe(false);
  });

  it('does nothing when there is no shield', () => {
    expect(absorbWithShield(createPowerUps())).toBe(false);
  });

  it('leaves a second of invulnerability behind it', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    absorbWithShield(state);

    expect(isInvulnerable(state)).toBe(true);
    run(state, POWERUPS.shield.graceAfterHit - 0.1);
    expect(isInvulnerable(state)).toBe(true);
    run(state, 0.2);
    expect(isInvulnerable(state)).toBe(false);
  });

  it('runs out on its own if it is never hit', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    run(state, POWERUPS.shield.duration + 0.1);
    expect(isActive(state, 'shield')).toBe(false);
    // And having expired, it leaves no grace behind.
    expect(isInvulnerable(state)).toBe(false);
  });

  it('does not make the player invulnerable while simply held', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    // A shield absorbs a hit; it does not stop hits happening.
    expect(isInvulnerable(state)).toBe(false);
  });
});

describe('the magnet (SPEC 9)', () => {
  const coin = (x: number, y: number, s: number): Coin => ({ x, y, s });

  it('reaches 8 units ahead, across every lane', () => {
    expect(withinMagnetReach(100, coin(5, 1, 104))).toBe(true);
    expect(withinMagnetReach(100, coin(-5, 1, 107.9))).toBe(true);
    expect(withinMagnetReach(100, coin(0, 1, 108.5))).toBe(false);
  });

  it('never reaches backwards', () => {
    expect(withinMagnetReach(100, coin(0, 1, 99))).toBe(false);
  });

  it('drags a coin towards the player', () => {
    const c = coin(5, 1, 104);
    const before = Math.hypot(5 - 0, 1 - 0.8, 104 - 100);
    pullCoin(c, 0, 0.8, 100, DT);
    const after = Math.hypot(c.x - 0, c.y - 0.8, c.s - 100);
    expect(after).toBeLessThan(before);
  });

  it('brings a coin all the way in, given time', () => {
    const c = coin(5, 2, 106);
    for (let i = 0; i < 200; i += 1) pullCoin(c, 0, 0.8, 100, DT);
    expect(Math.hypot(c.x, c.y - 0.8, c.s - 100)).toBeLessThan(COINS.pickupRadius);
  });

  it('never overshoots the player', () => {
    const c = coin(0.01, 0.8, 100.01);
    pullCoin(c, 0, 0.8, 100, DT, 1000);
    expect(c.x).toBeCloseTo(0, 6);
    expect(c.s).toBeCloseTo(100, 6);
  });

  it('is on during a boost as well, which auto-collects coins (SPEC 9)', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    expect(isMagnetic(state)).toBe(true);
  });
});

describe('the speed boost (SPEC 9)', () => {
  it('doubles the speed', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    expect(speedWithPowerUps(state, 20)).toBe(40);
  });

  it('never goes past the hard cap', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    expect(speedWithPowerUps(state, SPEED.max)).toBe(SPEED.cap);
    expect(speedWithPowerUps(state, 40)).toBe(SPEED.cap);
  });

  it('makes the player invulnerable while it runs', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    expect(isInvulnerable(state)).toBe(true);
  });

  it('leaves a second of invulnerability to land in', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    run(state, POWERUPS.boost.duration + 0.05);
    expect(isActive(state, 'boost')).toBe(false);
    // The boost is over but nothing can hit the player yet.
    expect(isInvulnerable(state)).toBe(true);

    run(state, POWERUPS.boost.graceAfterEnd);
    expect(isInvulnerable(state)).toBe(false);
  });

  it('eases the speed back down instead of dropping it', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    run(state, POWERUPS.boost.duration + 0.02, 20);

    // Just after it ends the speed is still well above normal.
    const justAfter = speedWithPowerUps(state, 20);
    expect(justAfter).toBeGreaterThan(25);

    run(state, POWERUPS.boost.easeOutTime, 20);
    expect(speedWithPowerUps(state, 20)).toBeCloseTo(20, 1);
  });

  it('never speeds up again while easing down', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    run(state, POWERUPS.boost.duration + 0.02, 20);

    let previous = speedWithPowerUps(state, 20);
    for (let i = 0; i < 60; i += 1) {
      stepPowerUps(state, DT, 20);
      const now = speedWithPowerUps(state, 20);
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
  });

  it('keeps the track easy during the boost and just after (SPEC 9)', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    expect(wantsEasyTrack(state)).toBe(true);

    run(state, POWERUPS.boost.duration + 0.05);
    expect(isActive(state, 'boost')).toBe(false);
    expect(wantsEasyTrack(state)).toBe(true);

    run(state, POWERUPS.boost.safeWindowAfterEnd);
    expect(wantsEasyTrack(state)).toBe(false);
  });

  it('a fresh boost cancels the easing from the last one', () => {
    const state = createPowerUps();
    grant(state, 'boost');
    run(state, POWERUPS.boost.duration + 0.02, 20);
    expect(state.boostEaseOut).toBeGreaterThan(0);

    grant(state, 'boost');
    expect(state.boostEaseOut).toBe(0);
    expect(speedWithPowerUps(state, 20)).toBe(40);
  });
});

describe('power-ups together (SPEC 9)', () => {
  it('a shield taken during a boost is still there afterwards', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    grant(state, 'boost');

    // While boosting, nothing reaches the shield.
    expect(isInvulnerable(state)).toBe(true);
    run(state, POWERUPS.boost.duration + POWERUPS.boost.graceAfterEnd + 0.05);
    expect(isActive(state, 'shield')).toBe(true);
    expect(isInvulnerable(state)).toBe(false);
  });

  it('runs each timer at its own pace', () => {
    const state = createPowerUps();
    grant(state, 'shield');
    grant(state, 'magnet');
    grant(state, 'boost');

    run(state, POWERUPS.boost.duration + 0.05);
    expect(isActive(state, 'boost')).toBe(false);
    expect(isActive(state, 'magnet')).toBe(true);
    expect(isActive(state, 'shield')).toBe(true);
  });

  it('a shield hit during the post-boost grace is not spent', () => {
    // Grace comes first, so the shield is never wasted on a hit that could
    // not have hurt anyway.
    const state = createPowerUps();
    grant(state, 'shield');
    grant(state, 'boost');
    run(state, POWERUPS.boost.duration + 0.05);

    expect(isInvulnerable(state)).toBe(true);
    expect(isActive(state, 'shield')).toBe(true);
  });
});

describe('touching a pickup (SPEC 9)', () => {
  const pickup = { active: true, type: 'shield' as const, lane: 0, s: 50, y: 1.3 };

  it('is collected by running into it', () => {
    expect(pickupCollected(0, 1.3, 49.8, 50.1, pickup)).toBe(true);
  });

  it('is missed from another lane', () => {
    expect(pickupCollected(5, 1.3, 49.8, 50.1, pickup)).toBe(false);
  });

  it('cannot be passed through at full speed', () => {
    const perTick = SPEED.cap * DT;
    for (let offset = 0; offset < 1; offset += 0.05) {
      const from = 50 - offset;
      const to = from + perTick;
      if (from > 50 || to < 50) continue;
      expect(pickupCollected(0, 1.3, from, to, pickup), `${from} to ${to}`).toBe(true);
    }
  });
});
