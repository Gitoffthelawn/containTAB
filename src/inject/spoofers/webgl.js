/* global exportFunction */
/**
 * webgl.js — WebGL UNMASKED_RENDERER/VENDOR spoofer.
 *
 * WebGL fingerprinting reads getParameter(UNMASKED_RENDERER_WEBGL) and
 * getParameter(UNMASKED_VENDOR_WEBGL) to detect GPU model, exposing device identity.
 *
 * We override getContext('webgl') and getContext('webgl2') to return a proxy
 * context where getParameter() returns spoofed vendor/renderer from config.
 */

import { markNative } from '../stealth.js';

/**
 * Install WebGL spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config (uses config.webgl.vendor/renderer)
 */
export function installWebGLSpoofer(pageWindow, config) {
  const webglConfig = config.webgl;
  if (!webglConfig) {
    return;
  }

  const HCE = pageWindow.HTMLCanvasElement;
  if (!HCE || !HCE.prototype.getContext) {
    return;
  }

  const origGetContext = HCE.prototype.getContext;

  const patchedGetContext = exportFunction(function (contextType, ...args) {
    // Call original to get real context
    const ctx = origGetContext.call(this, contextType, ...args);
    if (!ctx) {
      return ctx;
    }

    // Only spoof webgl/webgl2
    if (contextType !== 'webgl' && contextType !== 'webgl2') {
      return ctx;
    }

    // Wrap getParameter to intercept WebGL constants
    const origGetParameter = ctx.getParameter;
    const patchedGetParameter = exportFunction(function (pname) {
      // WebGL Constants (same for webgl and webgl2)
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const UNMASKED_RENDERER_WEBGL = 0x9246;

      if (pname === UNMASKED_VENDOR_WEBGL) {
        return webglConfig.vendor;
      }
      if (pname === UNMASKED_RENDERER_WEBGL) {
        return webglConfig.renderer;
      }

      // Pass through all other parameters to original
      return origGetParameter.call(this, pname);
    }, pageWindow);

    markNative(patchedGetParameter, 'getParameter');

    // Return a proxy context with patched getParameter
    Object.defineProperty(ctx, 'getParameter', {
      value: patchedGetParameter,
      configurable: true,
      writable: true,
    });

    return ctx;
  }, pageWindow);

  markNative(patchedGetContext, 'getContext');

  Object.defineProperty(HCE.prototype, 'getContext', {
    value: patchedGetContext,
    configurable: true,
    writable: true,
  });
}
