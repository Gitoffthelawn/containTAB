/**
 * inject/index.js — containTAB fingerprint injection bootstrap.
 *
 * Executes in content script context at document_start, with MAIN world
 * access via Firefox's `window.wrappedJSObject`.
 *
 * Runtime contract:
 *   - `window.__ctFingerprint` is pre-populated by content-script-registry
 *     via a synchronous config script injected BEFORE this file.
 *   - Per-container scoping is enforced by the Registry at register time
 *     (contentScripts.register({cookieStoreId})), so this file assumes
 *     the config it reads is the right one for the current container.
 *
 * Core principle: one container = one random fingerprint set, shared by
 * all documents/frames/workers within that container.
 */

import { installStealth } from './stealth.js';
import { installNavigatorSpoofer } from './spoofers/navigator.js';
import { installScreenSpoofer } from './spoofers/screen.js';
import { installTimezoneSpoofer } from './spoofers/timezone.js';
import { installConnectionSpoofer } from './spoofers/connection.js';
import { installWebRTCSpoofer } from './spoofers/webrtc.js';
import { installWebGLSpoofer } from './spoofers/webgl.js';
import { installCanvasSpoofer } from './spoofers/canvas.js';
import { installWorkerSpoofer } from './spoofers/worker.js';
import { installIframeSpoofer } from './spoofers/iframe.js';

(function containTABInjectBootstrap() {
  'use strict';

  // Step 1: read config (set by registry's configCode script)
  const config = window.__ctFingerprint;
  delete window.wrappedJSObject.__ctFingerprint;
  if (!config) {
    return;
  }

  // Step 2: get page world window via Firefox Xray wrapper
  const pageWindow = window.wrappedJSObject;
  if (!pageWindow) {
    console.warn('[containTAB] wrappedJSObject unavailable, injection aborted');
    return;
  }

  // Step 3: install stealth FIRST (covers all subsequent overrides)
  const steps = [
    ['stealth', () => installStealth(pageWindow)],
    ['navigator', () => installNavigatorSpoofer(pageWindow, config)],
    ['screen', () => installScreenSpoofer(pageWindow, config)],
    ['timezone', () => installTimezoneSpoofer(pageWindow, config)],
    ['connection', () => installConnectionSpoofer(pageWindow)],
    ['webrtc', () => installWebRTCSpoofer(pageWindow)],
    ['webgl', () => installWebGLSpoofer(pageWindow, config)],
    ['canvas', () => installCanvasSpoofer(pageWindow, config)],
    ['worker', () => installWorkerSpoofer(pageWindow, config)],
    ['iframe', () => installIframeSpoofer(pageWindow, config)],
  ];

  for (const [name, fn] of steps) {
    try {
      fn();
    } catch (err) {
      console.warn(`[containTAB] ${name} spoofer failed:`, err);
    }
  }

  // Step 4: confirm injection in console
  console.debug('[containTAB] fingerprint injected:', {
    ua: config.navigator.userAgent.slice(0, 50) + '...',
    platform: config.navigator.platform,
    screen: `${config.screen.width}x${config.screen.height}`,
    dpr: config.screen.devicePixelRatio,
    cores: config.hardwareConcurrency,
    memory: config.deviceMemory,
    tz: config.timezoneOffset,
    lang: config.languages[0],
  });
})();
