/* global exportFunction */
/**
 * iframe.js — Patch same-origin iframe contentWindow with spoofers.
 *
 * When a page creates an iframe, its contentWindow.Navigator is a fresh
 * prototype not affected by our main-world patches. We watch for new
 * iframes via MutationObserver and re-apply the spoofers inside each
 * same-origin iframe.
 *
 * Cross-origin iframes are untouchable (SOP) — we silently skip them.
 */

import { installStealth } from '../stealth.js';
import { installNavigatorSpoofer } from './navigator.js';
import { installScreenSpoofer } from './screen.js';
import { installTimezoneSpoofer } from './timezone.js';
import { installConnectionSpoofer } from './connection.js';
import { installWebRTCSpoofer } from './webrtc.js';
import { installCanvasSpoofer } from './canvas.js';
import { installWebGLSpoofer } from './webgl.js';
import { installWorkerSpoofer } from './worker.js';

/**
 * Apply all main-thread spoofers to a given window-like target.
 * Used for both top-level page and same-origin iframes.
 *
 * IMPORTANT: stealth must run FIRST — each same-origin iframe has its own
 * Function.prototype, so its toString patch must be installed per-iframe.
 */
function applyAll(pageWindow, config) {
  const steps = [
    () => installStealth(pageWindow),
    () => installNavigatorSpoofer(pageWindow, config),
    () => installScreenSpoofer(pageWindow, config),
    () => installTimezoneSpoofer(pageWindow, config),
    () => installConnectionSpoofer(pageWindow),
    () => installWebRTCSpoofer(pageWindow),
    () => installCanvasSpoofer(pageWindow, config),
    () => installWebGLSpoofer(pageWindow, config),
    () => installWorkerSpoofer(pageWindow, config),
  ];
  for (const fn of steps) {
    try { fn(); } catch (err) { void err; }
  }
}

/**
 * Try to get the page-world contentWindow of an iframe element.
 * Returns null if cross-origin or not yet available.
 */
function getIframeWrappedWindow(iframeEl) {
  try {
    // Access via wrappedJSObject to reach page world
    // iframeEl already lives in page world (from pageWindow.querySelectorAll)
    const cw = iframeEl.contentWindow;
    if (!cw) return null;
    // Touching a cross-origin window throws SecurityError
    // eslint-disable-next-line no-unused-expressions
    cw.document;
    return cw;
  } catch (_err) {
    return null;
  }
}

/**
 * Install iframe spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config
 */
export function installIframeSpoofer(pageWindow, config) {
  function patchIframe(iframeEl) {
    const cw = getIframeWrappedWindow(iframeEl);
    if (!cw) return;
    try {
      applyAll(cw, config);
    } catch (_err) { /* ignore */ }
  }

  // Patch existing iframes at bootstrap time
  try {
    const existing = pageWindow.document.querySelectorAll('iframe');
    for (let i = 0; i < existing.length; i++) {
      patchIframe(existing[i]);
    }
  } catch (_err) { /* ignore */ }

  // Watch for new iframes
  try {
    const observer = new pageWindow.MutationObserver(exportFunction(function (mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node.tagName === 'IFRAME') {
            patchIframe(node);
            // iframe may not have contentWindow yet — also patch on load
            try {
              node.addEventListener('load', exportFunction(function () {
                patchIframe(node);
              }, pageWindow));
            } catch (_e) { /* ignore */ }
          } else if (node.querySelectorAll) {
            const nested = node.querySelectorAll('iframe');
            for (let k = 0; k < nested.length; k++) {
              patchIframe(nested[k]);
            }
          }
        }
      }
    }, pageWindow));
    observer.observe(pageWindow.document.documentElement || pageWindow.document, {
      childList: true,
      subtree: true,
    });
  } catch (_err) { /* ignore */ }
}
