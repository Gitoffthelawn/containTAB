import { describe, it, expect } from 'vitest';
import { createPRNG } from '../prng.js';

describe('createPRNG (Mulberry32)', () => {

  it('same seed produces same sequence', () => {
    const a = createPRNG(42);
    const b = createPRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.nextFloat()).toBe(b.nextFloat());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createPRNG(1);
    const b = createPRNG(2);
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(a.nextFloat() !== b.nextFloat());
    }
    expect(results.some(Boolean)).toBe(true);
  });

  it('nextFloat returns values in [0, 1)', () => {
    const rng = createPRNG(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt returns values in [min, max] inclusive', () => {
    const rng = createPRNG(123);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const v = rng.nextInt(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    // should hit all values 1-5 in 500 tries
    expect(seen.size).toBe(5);
  });

  it('pick returns element from array', () => {
    const rng = createPRNG(77);
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const v = rng.pick(arr);
      expect(arr).toContain(v);
      seen.add(v);
    }
    expect(seen.size).toBe(arr.length);
  });

  it('shuffle returns all elements in different order', () => {
    const rng = createPRNG(55);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(arr);
    // same elements
    expect([...shuffled].sort()).toEqual([...arr].sort());
    // original not mutated
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // at least one element moved (statistically certain with 8 elements)
    expect(shuffled).not.toEqual(arr);
  });

  it('shuffle is deterministic with same seed', () => {
    const a = createPRNG(200);
    const b = createPRNG(200);
    const arr = [10, 20, 30, 40, 50];
    expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
  });

  it('seed 0 works (edge case)', () => {
    const rng = createPRNG(0);
    const v = rng.nextFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

});
