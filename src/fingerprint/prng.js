/**
 * prng.js — Mulberry32 PRNG with utility methods.
 * Pure function, zero browser dependency.
 *
 * Usage:
 *   const rng = createPRNG(12345);
 *   rng.nextFloat();          // [0, 1)
 *   rng.nextInt(1, 10);       // [1, 10] inclusive
 *   rng.pick([a, b, c]);      // random element
 *   rng.shuffle([a, b, c]);   // Fisher-Yates shuffled copy
 */

/**
 * Mulberry32 core — returns next float in [0, 1).
 * @param {number} seed - 32-bit unsigned integer
 * @returns {function(): number}
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG with utility methods.
 *
 * @param {number} seed - 32-bit unsigned integer
 * @returns {{ nextFloat: () => number, nextInt: (min: number, max: number) => number, pick: (arr: Array) => *, shuffle: (arr: Array) => Array }}
 */
export function createPRNG(seed) {
  const next = mulberry32(seed);

  function nextFloat() {
    return next();
  }

  function nextInt(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(next() * arr.length)];
  }

  function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { nextFloat, nextInt, pick, shuffle };
}
