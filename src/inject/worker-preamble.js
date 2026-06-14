/**
 * worker-preamble.js — Generate the JS source string that runs inside Worker realm.
 *
 * Workers have their own global (WorkerGlobalScope) with WorkerNavigator instead
 * of Navigator. Content scripts cannot reach into a Worker's scope — we must
 * inject the spoofer code as a blob URL that the Worker imports at startup.
 *
 * Preamble runs in MAIN world (Worker realm), so no exportFunction/cloneInto —
 * we just defineProperty directly on self.WorkerNavigator.prototype.
 *
 * Coverage inside Worker realm:
 *   - WorkerNavigator.prototype.*       (userAgent, platform, cores, memory, etc)
 *   - Date.prototype.getTimezoneOffset
 *   - Intl.DateTimeFormat.prototype.resolvedOptions
 *   - Function.prototype.toString       (stealth — fake [native code])
 *   - OffscreenCanvas 2d measureText    (canvas noise)
 *   - importScripts() base URL fix      (preserve relative imports of original script)
 */

import { OFFSET_TO_TZ } from './spoofers/timezone.js';

/**
 * Build the Worker preamble source code.
 *
 * @param {object} config - fingerprint config (will be JSON-serialized)
 * @param {string} originalScriptUrl - absolute URL of the original Worker script
 *                                     (used to resolve relative importScripts calls)
 * @returns {string} JS source to prepend to the real Worker script
 */
export function buildWorkerPreamble(config, originalScriptUrl) {
  const configJson = JSON.stringify(config);
  const tzMapJson = JSON.stringify(OFFSET_TO_TZ);
  const originalUrlJson = JSON.stringify(originalScriptUrl || '');
  return `
(function ctWorkerInit() {
  'use strict';
  var config = ${configJson};
  var tzMap = ${tzMapJson};
  var originalScriptUrl = ${originalUrlJson};
  var nav = config.navigator;

  // --- Stealth: Function.prototype.toString patch ---
  var nativeMarks = new WeakMap();
  var origToString = Function.prototype.toString;
  function fakeToString() {
    var mark = nativeMarks.get(this);
    if (mark) return 'function ' + mark + '() { [native code] }';
    return origToString.call(this);
  }
  try {
    Object.defineProperty(Function.prototype, 'toString', {
      value: fakeToString,
      configurable: true,
      writable: true,
    });
    nativeMarks.set(fakeToString, 'toString');
  } catch (_e) {}

  function defGet(proto, prop, value) {
    try {
      var getter = function () { return value; };
      nativeMarks.set(getter, 'get ' + prop);
      Object.defineProperty(proto, prop, {
        get: getter,
        configurable: true,
        enumerable: true,
      });
    } catch (_e) {}
  }

  function defVal(proto, prop, fn, name) {
    try {
      nativeMarks.set(fn, name);
      Object.defineProperty(proto, prop, {
        value: fn,
        configurable: true,
        writable: true,
      });
    } catch (_e) {}
  }

  // --- WorkerNavigator.prototype ---
  if (typeof WorkerNavigator !== 'undefined') {
    var WNP = WorkerNavigator.prototype;
    defGet(WNP, 'userAgent', nav.userAgent);
    defGet(WNP, 'platform', nav.platform);
    defGet(WNP, 'appVersion', nav.appVersion);
    defGet(WNP, 'vendor', nav.vendor);
    defGet(WNP, 'hardwareConcurrency', config.hardwareConcurrency);
    defGet(WNP, 'deviceMemory', config.deviceMemory);
    defGet(WNP, 'languages', config.languages);
    defGet(WNP, 'language', config.languages[0]);
    defGet(WNP, 'onLine', true);
  }

  // --- Date.getTimezoneOffset ---
  try {
    var jsOffset = -config.timezoneOffset;
    defVal(Date.prototype, 'getTimezoneOffset', function () {
      return jsOffset;
    }, 'getTimezoneOffset');
  } catch (_e) {}

  // --- Intl.DateTimeFormat resolvedOptions ---
  try {
    var tzName = tzMap[String(config.timezoneOffset)] || 'UTC';
    var origRO = Intl.DateTimeFormat.prototype.resolvedOptions;
    defVal(Intl.DateTimeFormat.prototype, 'resolvedOptions', function () {
      var opts = origRO.call(this);
      return Object.assign({}, opts, { timeZone: tzName });
    }, 'resolvedOptions');
  } catch (_e) {}

  // --- OffscreenCanvas 2d measureText noise ---
  try {
    var noiseSeed = config.noiseSeed >>> 0;
    function textNoise(text) {
      var h = (noiseSeed ^ 0xA1B2C3D4) | 0;
      var s = String(text);
      for (var i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      }
      // Mulberry32 one step
      h = (h + 0x6D2B79F5) | 0;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      var f = (((t ^ (t >>> 14)) >>> 0) / 4294967296);
      return (f * 2 - 1) * 0.3;
    }
    if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
      var OCP = OffscreenCanvasRenderingContext2D.prototype;
      var origMT = OCP.measureText;
      defVal(OCP, 'measureText', function (text) {
        var metrics = origMT.call(this, text);
        try {
          Object.defineProperty(metrics, 'width', {
            value: metrics.width + textNoise(text),
            configurable: true,
            enumerable: true,
          });
        } catch (_e) {}
        return metrics;
      }, 'measureText');
    }
  } catch (_e) {}

  // --- importScripts base URL fix ---
  // Classic Workers use importScripts(url). When the Worker script was loaded
  // via blob: URL (our wrapping), relative imports resolve against the blob,
  // which breaks real sites. Rewrite relative paths against originalScriptUrl.
  try {
    if (typeof importScripts === 'function' && originalScriptUrl) {
      var origImportScripts = importScripts;
      var base = originalScriptUrl;
      defVal(self, 'importScripts', function () {
        var resolved = [];
        for (var i = 0; i < arguments.length; i++) {
          try {
            resolved.push(new URL(arguments[i], base).href);
          } catch (_e) {
            resolved.push(arguments[i]);
          }
        }
        return origImportScripts.apply(this, resolved);
      }, 'importScripts');
    }
  } catch (_e) {}
})();
`;
}
