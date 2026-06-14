/* global exportFunction */
/**
 * canvas.js — Deterministic canvas + text + clientRect noise.
 *
 * Canvas fingerprinting reads pixel data from drawn text or shapes.
 * measureText returns sub-pixel widths that differ across machines.
 * getBoundingClientRect returns layout dimensions that leak font metrics.
 *
 * We perturb all three with a noiseSeed-derived offset so that:
 *   - same container + same input → same output (consistency)
 *   - different containers → different outputs (privacy)
 *
 * Noise magnitude is tiny (< 1 px) to avoid breaking layouts.
 */

import { markNative } from '../stealth.js';
import { createPRNG } from '../../fingerprint/prng.js';

/**
 * Derive a deterministic noise function from the noiseSeed.
 * Returns a function that maps (string_key) → float in [-magnitude, magnitude].
 */
export function createNoiseFn(noiseSeed, magnitude) {
  return function noise(key) {
    // Fold key into a per-call seed
    let h = noiseSeed | 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    const rng = createPRNG(h >>> 0);
    return (rng.nextFloat() * 2 - 1) * magnitude;
  };
}

/**
 * Install canvas / text / rect noise spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config (uses config.noiseSeed)
 */
export function installCanvasSpoofer(pageWindow, config) {
  const noiseSeed = config.noiseSeed;
  const textNoise = createNoiseFn(noiseSeed ^ 0xA1B2C3D4, 0.3);
  const rectNoise = createNoiseFn(noiseSeed ^ 0xE5F60708, 0.1);

  // --- CanvasRenderingContext2D.measureText ---
  const CRC2D = pageWindow.CanvasRenderingContext2D;
  if (CRC2D && CRC2D.prototype.measureText) {
    const origMeasureText = CRC2D.prototype.measureText;
    const patched = exportFunction(function (text) {
      const metrics = origMeasureText.call(this, text);
      const delta = textNoise(String(text));
      // Wrap metrics in a proxy-like object — but we can't proxy across
      // compartments. Instead, patch the width property directly.
      try {
        Object.defineProperty(metrics, 'width', {
          value: metrics.width + delta,
          configurable: true,
          enumerable: true,
        });
      } catch (_err) {
        // Some Firefox builds lock TextMetrics; silently fall through
      }
      return metrics;
    }, pageWindow);
    markNative(patched, 'measureText');
    Object.defineProperty(CRC2D.prototype, 'measureText', {
      value: patched,
      configurable: true,
      writable: true,
    });
  }

  // --- Element.getBoundingClientRect ---
  const ElementProto = pageWindow.Element.prototype;
  const origGetRect = ElementProto.getBoundingClientRect;
  const patchedGetRect = exportFunction(function () {
    const rect = origGetRect.call(this);
    const key = (this.tagName || '') + ':' + (this.id || '') + ':' + (this.className || '');
    const d = rectNoise(key);
    try {
      Object.defineProperty(rect, 'width', { value: rect.width + d, configurable: true });
      Object.defineProperty(rect, 'height', { value: rect.height + d, configurable: true });
    } catch (_err) {
      // fall through
    }
    return rect;
  }, pageWindow);
  markNative(patchedGetRect, 'getBoundingClientRect');
  Object.defineProperty(ElementProto, 'getBoundingClientRect', {
    value: patchedGetRect,
    configurable: true,
    writable: true,
  });

  // --- HTMLCanvasElement.toDataURL / toBlob — inject pixel noise ---
  const HCE = pageWindow.HTMLCanvasElement;
  if (HCE && HCE.prototype.toDataURL) {
    const origToDataURL = HCE.prototype.toDataURL;
    const patchedToDataURL = exportFunction(function (...args) {
      // Add a single noise pixel at a deterministic position before reading.
      // Skip on WebGL/other contexts — getContext('2d') on a canvas already
      // bound to 'webgl' returns null, and we must not disrupt WebGL state.
      try {
        const ctx = this.getContext && this.getContext('2d');
        if (ctx && typeof ctx.fillRect === 'function') {
          const w = this.width | 0;
          const h = this.height | 0;
          if (w > 0 && h > 0) {
            const px = (noiseSeed >>> 0) % w;
            const py = ((noiseSeed >>> 8) >>> 0) % h;
            const r = (noiseSeed & 0xFF);
            const g = ((noiseSeed >> 8) & 0xFF);
            const b = ((noiseSeed >> 16) & 0xFF);
            const prevFill = ctx.fillStyle;
            ctx.fillStyle = `rgba(${r},${g},${b},0.003)`;
            ctx.fillRect(px, py, 1, 1);
            ctx.fillStyle = prevFill;
          }
        }
      } catch (_err) { void _err; }
      return origToDataURL.apply(this, args);
    }, pageWindow);
    markNative(patchedToDataURL, 'toDataURL');
    Object.defineProperty(HCE.prototype, 'toDataURL', {
      value: patchedToDataURL,
      configurable: true,
      writable: true,
    });
  }
}
