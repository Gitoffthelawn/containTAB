/**
 * fingerprint/index.js — Public API for per-container fingerprint isolation.
 *
 * Usage:
 *   import { getFingerprint, onContainerCreated, onContainerRemoved } from './fingerprint';
 *   const fp = await getFingerprint('firefox-container-1');
 *   // fp = { seed, config, prng }
 */

import { generateFingerprint } from './fingerprint-generator.js';
import { createPRNG } from './prng.js';
import { registerForContainer, unregisterForContainer } from './content-script-registry.js';
import ContainerExtension from '../ContainerExtension';
import { isFingerprintEnabled } from './gate.js';

/** In-memory fingerprint cache: cookieStoreId → { seed, config, preferences, prng } */
const cache = new Map();

function generateSeed() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0];
}

function toCacheEntry(fingerprint) {
  return {
    seed: fingerprint.seed,
    config: fingerprint.values,
    preferences: fingerprint.preferences,
    prng: createPRNG(fingerprint.seed),
  };
}

/**
 * Get fingerprint for a container. Creates seed on first access.
 *
 * Lazy init: containers that existed before the extension loaded (browser
 * restart with existing containers) never fire `contextualIdentities.onCreated`,
 * so `onContainerCreated` hook is never run for them. Their seed is generated
 * here on first access. This means the invariant is:
 *   "container exists → seed exists by the time getFingerprint returns"
 * not
 *   "container created → seed immediately created".
 *
 * @param {string} cookieStoreId
 * @returns {Promise<{ seed: number, config: object, prng: object }>}
 */
export async function getFingerprint(cookieStoreId) {
  if (cache.has(cookieStoreId)) {
    return cache.get(cookieStoreId);
  }

  const fingerprint = await generate(cookieStoreId);
  const entry = toCacheEntry(fingerprint);

  cache.set(cookieStoreId, entry);
  console.debug('fingerprint: loaded for', cookieStoreId);
  return entry;
}

export async function generate(cookieStoreId) {
  const ext = await ContainerExtension.get(cookieStoreId);
  if (ext?.fingerprint) return ext.fingerprint;

  const seed = generateSeed();
  const fingerprint = {
    cookieStoreId,
    seed,
    values: generateFingerprint(seed),
    preferences: {
      enabled: true,
      cfSafe: false,
    },
  };

  await ContainerExtension.set(cookieStoreId, { fingerprint });
  cache.set(cookieStoreId, toCacheEntry(fingerprint));
  return fingerprint;
}

export async function destroy(cookieStoreId) {
  await unregisterForContainer(cookieStoreId);
  cache.delete(cookieStoreId);
  const ext = await ContainerExtension.get(cookieStoreId);
  if (ext?.fingerprint) {
    await ContainerExtension.set(cookieStoreId, { fingerprint: undefined });
  }
  console.debug('fingerprint: cleared for', cookieStoreId);
}

/**
 * Hook: call when a container is created.
 * Pre-generates fingerprint and registers per-container content script.
 *
 * @param {string} cookieStoreId
 * @returns {Promise<void>}
 */
export async function onContainerCreated(cookieStoreId) {
  if (!await isFingerprintEnabled()) return;
  await generate(cookieStoreId);
  await registerForContainer(cookieStoreId);
}

/**
 * Hook: call when a container is removed.
 * Unregisters content script, clears seed from storage and cache.
 *
 * @param {string} cookieStoreId
 * @returns {Promise<void>}
 */
export async function onContainerRemoved(cookieStoreId) {
  if (!await isFingerprintEnabled()) return;
  await destroy(cookieStoreId);
}

/**
 * Reset cache (for testing).
 */
export function _resetCache() {
  cache.clear();
}
