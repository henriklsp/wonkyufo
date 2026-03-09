import { describe, it, expect, beforeEach } from 'vitest';
import {
  UFO,
  D_POS, D_VEL, D_ACCEL, D_JERK, D_SNAP, D_CRACKLE, D_POP,
} from './ufo';
import {
  CANVAS_HEIGHT,
  MAX_ENGINE_ACCEL, MIN_ENGINE_ACCEL,
  MAX_JERK, MIN_JERK,
  MAX_SNAP, MIN_SNAP,
  MAX_CRACKLE, MIN_CRACKLE,
  MAX_POP, MIN_POP,
  UFO_COLLISION_RADIUS,
} from './constants';

// constants.ts has EASY_MODE = false, so all tests run the full 6-level chain.

const DT = 1 / 60;  // typical frame delta (~16 ms)

describe('getMax / getMin', () => {
  let ufo: UFO;

  beforeEach(() => { ufo = new UFO(); });

  it('orders ≤ CHAIN_START always return the hard limit regardless of d values', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    expect(ufo.getMax(D_ACCEL)).toBe(MAX_ENGINE_ACCEL);
    expect(ufo.getMin(D_ACCEL)).toBe(MIN_ENGINE_ACCEL);

    ufo.d[D_ACCEL] = MIN_ENGINE_ACCEL;
    expect(ufo.getMax(D_ACCEL)).toBe(MAX_ENGINE_ACCEL);
    expect(ufo.getMin(D_ACCEL)).toBe(MIN_ENGINE_ACCEL);
  });

  it('getMax(D_JERK) = MAX_JERK when accel is below its max', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;
    expect(ufo.getMax(D_JERK)).toBe(MAX_JERK);
  });

  it('getMax(D_JERK) = 0 when accel is at its max', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    expect(ufo.getMax(D_JERK)).toBe(0);
  });

  it('getMax(D_SNAP) = 0 when cascade fires from accel at max', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    ufo.d[D_JERK] = 0;  // getMax(JERK) = 0, so d[JERK] is not < getMax(JERK)
    expect(ufo.getMax(D_SNAP)).toBe(0);
  });

  it('getMax(D_CRACKLE) = 0 when cascade fires from accel at max', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    ufo.d[D_JERK] = 0;
    ufo.d[D_SNAP] = 0;
    expect(ufo.getMax(D_CRACKLE)).toBe(0);
  });

  it('getMin(D_JERK) = MIN_JERK when accel is above its min', () => {
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;
    expect(ufo.getMin(D_JERK)).toBe(MIN_JERK);
  });

  it('getMin(D_JERK) = 0 when accel is at its min', () => {
    ufo.d[D_ACCEL] = MIN_ENGINE_ACCEL;
    expect(ufo.getMin(D_JERK)).toBe(0);
  });

  it('getMin(D_SNAP) = 0 when cascade fires from accel at min', () => {
    ufo.d[D_ACCEL] = MIN_ENGINE_ACCEL;
    ufo.d[D_JERK] = 0;
    expect(ufo.getMin(D_SNAP)).toBe(0);
  });

  it('getMin(D_CRACKLE) = 0 when cascade fires from accel at min', () => {
    ufo.d[D_ACCEL] = MIN_ENGINE_ACCEL;
    ufo.d[D_JERK] = 0;
    ufo.d[D_SNAP] = 0;
    expect(ufo.getMin(D_CRACKLE)).toBe(0);
  });
});

describe('single-frame update', () => {
  let ufo: UFO;

  beforeEach(() => { ufo = new UFO(); });

  it('space held: crackle increases by MAX_POP * dt (from zero)', () => {
    ufo.update(DT, true);
    // crackle starts at 0, pop = MAX_POP, so crackle += MAX_POP * dt
    const expected = Math.min(MAX_CRACKLE, MAX_POP * DT);
    expect(ufo.d[D_CRACKLE]).toBeCloseTo(expected, 5);
  });

  it('space released: crackle decreases from a mid value', () => {
    ufo.d[D_CRACKLE] = 100;
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;  // ensure full chain is active
    const before = ufo.d[D_CRACKLE];
    ufo.update(DT, false);
    expect(ufo.d[D_CRACKLE]).toBeLessThan(before);
  });

  it('space released: effective pop = MIN_POP when crackle can still decrease', () => {
    ufo.d[D_CRACKLE] = 100;
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;
    ufo.update(DT, false);
    expect(ufo.d[D_POP]).toBe(MIN_POP);
  });

  it('all values stay within their hard limits after an update', () => {
    for (let i = 0; i < 120; i++) {
      ufo.update(DT, i < 60);
    }
    expect(ufo.d[D_ACCEL]).toBeGreaterThanOrEqual(MIN_ENGINE_ACCEL);
    expect(ufo.d[D_ACCEL]).toBeLessThanOrEqual(MAX_ENGINE_ACCEL);
    expect(ufo.d[D_JERK]).toBeGreaterThanOrEqual(MIN_JERK);
    expect(ufo.d[D_JERK]).toBeLessThanOrEqual(MAX_JERK);
    expect(ufo.d[D_SNAP]).toBeGreaterThanOrEqual(MIN_SNAP);
    expect(ufo.d[D_SNAP]).toBeLessThanOrEqual(MAX_SNAP);
    expect(ufo.d[D_CRACKLE]).toBeGreaterThanOrEqual(MIN_CRACKLE);
    expect(ufo.d[D_CRACKLE]).toBeLessThanOrEqual(MAX_CRACKLE);
  });
});

describe('cascade to zero (space held, accel at max steady state)', () => {
  it('jerk, snap, crackle all become 0 when accel is already at max', () => {
    const ufo = new UFO();
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    // Run one frame — cascade should immediately clamp higher orders to 0
    ufo.update(DT, true);
    expect(ufo.d[D_JERK]).toBe(0);
    expect(ufo.d[D_SNAP]).toBe(0);
    expect(ufo.d[D_CRACKLE]).toBe(0);
  });

  it('accel stays at MAX_ENGINE_ACCEL when already there and jerk cannot increase', () => {
    const ufo = new UFO();
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL;
    ufo.update(DT, true);
    expect(ufo.d[D_ACCEL]).toBe(MAX_ENGINE_ACCEL);
  });
});

describe('atEffMin / effective pop', () => {
  it('d[D_POP] = 0 when space released and crackle is at its effective minimum', () => {
    const ufo = new UFO();
    // Set accel mid-range so the chain is fully active, crackle already at floor
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;
    ufo.d[D_CRACKLE] = MIN_CRACKLE;
    ufo.update(DT, false);
    expect(ufo.d[D_POP]).toBe(0);
  });

  it('d[D_POP] = MIN_POP when space released but crackle is still winding down', () => {
    const ufo = new UFO();
    ufo.d[D_ACCEL] = MAX_ENGINE_ACCEL / 2;
    ufo.d[D_CRACKLE] = 0;  // crackle has room to wind down to MIN_CRACKLE
    ufo.update(DT, false);
    expect(ufo.d[D_POP]).toBe(MIN_POP);
  });
});

describe('reset()', () => {
  it('d[D_POS] = CANVAS_HEIGHT / 2 after reset', () => {
    const ufo = new UFO();
    ufo.d[D_POS] = 999;
    ufo.reset();
    expect(ufo.d[D_POS]).toBe(CANVAS_HEIGHT / 2);
  });

  it('velocity is 0 and derivatives are at their minimums after reset', () => {
    const ufo = new UFO();
    for (let i = 1; i <= 6; i++) ufo.d[i] = 999;
    ufo.reset();
    expect(ufo.d[D_VEL]).toBe(0);
    expect(ufo.d[D_ACCEL]).toBe(MIN_ENGINE_ACCEL);
    expect(ufo.d[D_JERK]).toBe(MIN_JERK);
    expect(ufo.d[D_SNAP]).toBe(MIN_SNAP);
    expect(ufo.d[D_CRACKLE]).toBe(MIN_CRACKLE);
    expect(ufo.d[D_POP]).toBe(MIN_POP);
  });
});

describe('isOutOfBounds()', () => {
  it('returns true when pos is too close to the top', () => {
    const ufo = new UFO();
    ufo.d[D_POS] = UFO_COLLISION_RADIUS - 1;  // edge crosses y=0
    expect(ufo.isOutOfBounds()).toBe(true);
  });

  it('returns true when pos is too close to the bottom', () => {
    const ufo = new UFO();
    ufo.d[D_POS] = CANVAS_HEIGHT - UFO_COLLISION_RADIUS + 1;  // edge crosses bottom
    expect(ufo.isOutOfBounds()).toBe(true);
  });

  it('returns false when pos is in the middle of the screen', () => {
    const ufo = new UFO();
    ufo.d[D_POS] = CANVAS_HEIGHT / 2;
    expect(ufo.isOutOfBounds()).toBe(false);
  });
});
