/**
 * content-script-registry.js — per-container content script lifecycle.
 *
 * Uses Firefox MV2 `browser.contentScripts.register({cookieStoreId})` to
 * bind one content script instance per container. Each instance gets its
 * own synchronous config preamble embedding the fingerprint values, so the
 * injected script reads them before any page script runs.
 *
 * Key flow:
 *   - bootstrap() reads the inject bundle source once at startup.
 *   - registerForContainer(cookieStoreId) composes [configCode, injectSource]
 *     and calls contentScripts.register, storing the unregister handle.
 *   - unregisterForContainer(cookieStoreId) tears down the handle.
 *   - registerAll() walks existing containers at startup.
 *
 * Per-container scoping is enforced by Firefox at register time — the
 * content script literally only runs in tabs of that container, so inject
 * code does not need to know cookieStoreId.
 */

import { getFingerprint } from './index.js';
import { isFingerprintEnabled } from './gate.js';

const INJECT_BUNDLE_URL = 'inject/index.js';

/** Cached inject script source (read once at bootstrap). */
let injectSource = null;

/** Active registration handles: cookieStoreId → handle. */
const handles = new Map();

/** Bootstrap promise (idempotent). */
let bootstrapPromise = null;

/**
 * Load inject bundle source once. Idempotent.
 * @returns {Promise<string>}
 */
function bootstrap() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = fetch(browser.runtime.getURL(INJECT_BUNDLE_URL))
    .then((res) => {
      if (!res.ok) throw new Error(`inject bundle fetch failed: ${res.status}`);
      return res.text();
    })
    .then((src) => {
      injectSource = src;
      console.debug('content-script-registry: loaded inject bundle,', src.length, 'bytes');
      return src;
    });
  return bootstrapPromise;
}

/**
 * Build the synchronous config preamble that sets window.__ctFingerprint
 * in the content script isolated world before inject/index.js runs.
 *
 * @param {object} config
 * @returns {string}
 */
function buildConfigCode(config) {
  return `window.__ctFingerprint = ${JSON.stringify(config)};`;
}

/**
 * Register content script for one container.
 * Idempotent: if already registered, unregisters the old handle first.
 *
 * @param {string} cookieStoreId
 * @returns {Promise<void>}
 */
export async function registerForContainer(cookieStoreId) {
  // firefox-default is not a real container and has no fingerprint
  if (cookieStoreId === 'firefox-default') return;
  if (!await isFingerprintEnabled()) return;

  await bootstrap();

  // Clean up old handle if re-registering
  if (handles.has(cookieStoreId)) {
    await unregisterForContainer(cookieStoreId);
  }

  const { config, preferences } = await getFingerprint(cookieStoreId);
  if (preferences?.enabled === false) return;
  const configCode = buildConfigCode(config);

  const handle = await browser.contentScripts.register({
    matches: ['<all_urls>'],
    js: [
      { code: configCode },
      { code: injectSource },
    ],
    runAt: 'document_start',
    allFrames: true,
    cookieStoreId,
  });

  handles.set(cookieStoreId, handle);
  console.debug('content-script-registry: registered for', cookieStoreId);
}

/**
 * Unregister content script for one container.
 *
 * @param {string} cookieStoreId
 * @returns {Promise<void>}
 */
export async function unregisterForContainer(cookieStoreId) {
  const handle = handles.get(cookieStoreId);
  if (!handle) return;
  try {
    await handle.unregister();
  } catch (err) {
    console.warn('content-script-registry: unregister failed for', cookieStoreId, err);
  }
  handles.delete(cookieStoreId);
  console.debug('content-script-registry: unregistered for', cookieStoreId);
}

/**
 * Walk all existing containers and register a content script for each.
 * Called at extension startup so pre-existing containers get injection.
 *
 * @returns {Promise<void>}
 */
export async function registerAll() {
  if (!await isFingerprintEnabled()) return;
  await bootstrap();
  const containers = await browser.contextualIdentities.query({});
  await Promise.all(
    containers.map((c) => registerForContainer(c.cookieStoreId))
  );
  console.debug('content-script-registry: registered', containers.length, 'existing containers');
}

/**
 * Reset all state (for testing).
 */
export function _resetRegistry() {
  handles.clear();
  injectSource = null;
  bootstrapPromise = null;
}
