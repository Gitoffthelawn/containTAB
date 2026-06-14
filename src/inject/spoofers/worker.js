/* global exportFunction */
/**
 * worker.js — Intercept Worker constructor to inject preamble.
 *
 * Strategy: replace `new Worker(url, options)` with a wrapper that creates
 * a blob URL containing `preamble + importScripts(realUrl)` and uses that
 * as the Worker script. The Worker realm then sees spoofed navigator.
 *
 * Limitations:
 *   - Module Workers (`{ type: 'module' }`) don't support importScripts,
 *     so we inline-fetch the script and concat. Data URLs only.
 *   - Same-origin policy applies to blob + fetch.
 *   - ServiceWorker: cannot spoof — ServiceWorker scripts are cached by
 *     the browser before our hook runs. We let them through unchanged.
 */

import { markNative } from '../stealth.js';
import { buildWorkerPreamble } from '../worker-preamble.js';

/**
 * Install Worker constructor override.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config
 */
export function installWorkerSpoofer(pageWindow, config) {
  const OrigWorker = pageWindow.Worker;
  if (!OrigWorker) return;

  const FakeWorker = exportFunction(function (scriptURL, options) {
    try {
      const isModule = options && options.type === 'module';
      const absoluteUrl = new pageWindow.URL(scriptURL, pageWindow.location.href).href;
      // Build preamble that carries the ORIGINAL URL so relative importScripts
      // and module imports resolve against the real location, not the blob URL.
      const preamble = buildWorkerPreamble(config, absoluteUrl);
      let blobSource;
      if (isModule) {
        // Module Workers: dynamic import of the original URL. Browser resolves
        // the import specifier against the blob URL by default, so we pass an
        // absolute URL — the imported module's own relative imports will still
        // resolve against its own real URL (not the blob).
        blobSource = `${preamble}\nimport(${JSON.stringify(absoluteUrl)});`;
      } else {
        // Classic Workers: preamble installs an importScripts wrapper that
        // resolves relative paths against originalScriptUrl, then we kick off
        // the original script via that wrapped importScripts.
        blobSource = `${preamble}\nself.importScripts(${JSON.stringify(absoluteUrl)});`;
      }
      const blob = new pageWindow.Blob([blobSource], { type: 'application/javascript' });
      const blobUrl = pageWindow.URL.createObjectURL(blob);
      return new OrigWorker(blobUrl, options);
    } catch (_err) {
      // Fallback: construct unmodified Worker if wrapping fails
      return new OrigWorker(scriptURL, options);
    }
  }, pageWindow);

  markNative(FakeWorker, 'Worker');

  // Preserve prototype chain so `worker instanceof Worker` still works.
  // Assign via defineProperty on page-world FakeWorker (the exported copy).
  try {
    Object.defineProperty(pageWindow, 'Worker', {
      value: FakeWorker,
      configurable: true,
      writable: true,
    });
    // After placing FakeWorker on pageWindow, set its prototype to the original
    // so `instanceof` checks still match.
    pageWindow.Worker.prototype = OrigWorker.prototype;
  } catch (_err) { void _err; }
}
