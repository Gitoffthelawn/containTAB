/* global exportFunction */
/**
 * stealth.js — Hide overridden functions from Function.prototype.toString checks.
 *
 * Pages detect spoofers by calling `navigator.userAgent.toString` or
 * `Navigator.prototype.hardwareConcurrency.get.toString()` and checking
 * for "[native code]". If the result contains our implementation body,
 * detection succeeds.
 *
 * Solution: patch page-world Function.prototype.toString to return
 * "function NAME() { [native code] }" for any function we register.
 *
 * Usage:
 *   installStealth(pageWindow);       // once, at bootstrap
 *   markNative(spoofer, 'userAgent'); // for each spoofed fn
 */

/** Map of functions that should report as native. */
const nativeMarks = new WeakMap();

/** Original toString implementation (preserved to not break unregistered fns). */
let origToString = null;

/**
 * Install the toString patch on the page-world Function.prototype.
 *
 * @param {Window} pageWindow - result of window.wrappedJSObject
 */
export function installStealth(pageWindow) {
  const PageFunction = pageWindow.Function;
  origToString = PageFunction.prototype.toString;

  // Our replacement toString — runs in content script world, then exported.
  function fakeToString() {
    const fn = this;
    const mark = nativeMarks.get(fn);
    if (mark) {
      return `function ${mark}() { [native code] }`;
    }
    // Fall through to the original
    return origToString.call(fn);
  }

  // Export into page world so page JS sees our function
  exportFunction(fakeToString, PageFunction.prototype, { defineAs: 'toString' });

  // Mark fakeToString itself as native (so `Function.prototype.toString.toString()` is clean)
  // We need to mark the page-world function, which we just exported.
  // Re-grab it via the prototype after export:
  nativeMarks.set(PageFunction.prototype.toString, 'toString');
}

/**
 * Register a function as "native" — its toString() will report as native code.
 *
 * @param {Function} fn - function in page world (exported via exportFunction)
 * @param {string} name - name to show in the fake native signature
 */
export function markNative(fn, name) {
  nativeMarks.set(fn, name);
}

/**
 * Reset (for testing).
 */
export function _resetStealth() {
  origToString = null;
}
