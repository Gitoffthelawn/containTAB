/* global exportFunction, cloneInto */
/**
 * screen.js — Spoof window.screen.* + window.devicePixelRatio + matchMedia.
 *
 * Overrides getters on Screen.prototype in page world to return the
 * container's screen fingerprint values. Also replaces window.devicePixelRatio
 * and patches window.matchMedia to answer resolution/dpr queries consistently.
 */

import { markNative } from '../stealth.js';

function defineGetter(proto, prop, value, pageWindow) {
  const getter = exportFunction(function () {
    return value;
  }, pageWindow);
  markNative(getter, `get ${prop}`);
  Object.defineProperty(proto, prop, {
    get: getter,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Install screen spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config (Phase 1 output)
 */
export function installScreenSpoofer(pageWindow, config) {
  const s = config.screen;
  const ScreenProto = pageWindow.Screen.prototype;

  defineGetter(ScreenProto, 'width', s.width, pageWindow);
  defineGetter(ScreenProto, 'height', s.height, pageWindow);
  defineGetter(ScreenProto, 'availWidth', s.availWidth, pageWindow);
  defineGetter(ScreenProto, 'availHeight', s.availHeight, pageWindow);
  defineGetter(ScreenProto, 'availLeft', 0, pageWindow);
  defineGetter(ScreenProto, 'availTop', 0, pageWindow);
  defineGetter(ScreenProto, 'colorDepth', s.colorDepth, pageWindow);
  defineGetter(ScreenProto, 'pixelDepth', s.pixelDepth, pageWindow);

  // window.devicePixelRatio — on Window.prototype (not Screen)
  const dprGetter = exportFunction(function () {
    return s.devicePixelRatio;
  }, pageWindow);
  markNative(dprGetter, 'get devicePixelRatio');
  Object.defineProperty(pageWindow, 'devicePixelRatio', {
    get: dprGetter,
    configurable: true,
    enumerable: true,
  });

  // window.innerWidth / innerHeight — report viewport as screen size
  // (naive: real viewport is smaller, but for fingerprint consistency
  // we report the spoofed screen size so ratios stay deterministic)
  // Skip these — too disruptive to layout detection. Keep real innerWidth.

  // matchMedia — intercept resolution and device-pixel-ratio queries
  const origMatchMedia = pageWindow.matchMedia;
  const patchedMatchMedia = exportFunction(function (query) {
    const q = String(query);
    // Match (resolution: Xdppx) / (min-resolution: Xdppx) / (max-resolution: Xdppx)
    // and (device-pixel-ratio: X) variants
    const resMatch = q.match(/\((min-|max-)?(resolution|device-pixel-ratio)\s*:\s*([\d.]+)(dppx|x)?\)/);
    if (resMatch) {
      const op = resMatch[1] || '';
      const target = parseFloat(resMatch[3]);
      const dpr = s.devicePixelRatio;
      let matches;
      if (op === 'min-') matches = dpr >= target;
      else if (op === 'max-') matches = dpr <= target;
      else matches = Math.abs(dpr - target) < 0.01;
      // Build a minimal MediaQueryList-like object in page world
      return cloneInto({
        matches,
        media: q,
        onchange: null,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () { return false; },
      }, pageWindow, { cloneFunctions: true });
    }
    // Fall through to original matchMedia for non-resolution queries.
    // Always call with pageWindow as `this` to avoid Illegal invocation
    // when the page stores a detached reference (`const mm = window.matchMedia`).
    return origMatchMedia.call(pageWindow, query);
  }, pageWindow);
  markNative(patchedMatchMedia, 'matchMedia');
  Object.defineProperty(pageWindow, 'matchMedia', {
    value: patchedMatchMedia,
    configurable: true,
    writable: true,
  });
}
