/**
 * header-spoofer.js — HTTP header spoofing via webRequest.
 *
 * Intercepts outgoing requests, looks up the container's fingerprint
 * (by details.cookieStoreId), and rewrites User-Agent + Accept-Language
 * to match the per-container identity.
 *
 * Firefox does NOT send sec-ch-ua* headers (Chrome-only), so no
 * Client Hints handling needed.
 *
 * Uses Firefox's async webRequest listener support (returning a Promise).
 */

import { getFingerprint } from './index.js';
import { isFingerprintEnabled } from './gate.js';

/**
 * Format Accept-Language header value from a language list.
 * Example: ['en-US','en'] → 'en-US,en;q=0.5' (Firefox) or
 *                           'en-US,en;q=0.9' (Chrome)
 *
 * @param {string[]} languages
 * @param {string} browser - 'firefox' | 'chrome'
 * @returns {string}
 */
export function formatAcceptLanguage(languages, browser) {
  if (!languages || languages.length === 0) return 'en-US,en;q=0.5';
  const qStep = browser === 'chrome' ? 0.1 : 0.1;
  const qBase = browser === 'chrome' ? 0.9 : 0.5;
  const parts = [languages[0]];
  for (let i = 1; i < languages.length; i++) {
    const q = Math.max(0.1, qBase - (i - 1) * qStep).toFixed(1);
    parts.push(`${languages[i]};q=${q}`);
  }
  return parts.join(',');
}

/**
 * Modify request headers according to the container's fingerprint.
 *
 * @param {object[]} headers - details.requestHeaders (array of {name, value})
 * @param {object} config - fingerprint config
 * @returns {object[]} modified headers
 */
export function modifyHeaders(headers, config) {
  if (!headers) return [];
  const ua = config.navigator.userAgent;
  const acceptLang = formatAcceptLanguage(config.languages, config.navigator.browser);

  for (const h of headers) {
    if (!h || typeof h.name !== 'string') continue;
    const name = h.name.toLowerCase();
    if (name === 'user-agent') {
      h.value = ua;
    } else if (name === 'accept-language') {
      h.value = acceptLang;
    }
  }
  return headers;
}

/**
 * webRequest.onBeforeSendHeaders listener. Async — returns Promise.
 *
 * CRITICAL: any exception OR Promise rejection from a blocking listener
 * cancels the request (browser treats it as a fatal block). We MUST
 * swallow every error and return {} so the request proceeds unmodified.
 * Silently returning the original headers is always safer than cancelling.
 *
 * @param {object} details - webRequest details
 * @returns {Promise<{requestHeaders: object[]}>|object}
 */
export async function headerListener(details) {
  try {
    const cookieStoreId = details.cookieStoreId;
    if (!cookieStoreId || cookieStoreId === 'firefox-default') {
      return {};
    }
    if (!await isFingerprintEnabled()) return {};

    const fp = await getFingerprint(cookieStoreId);
    if (!fp || !fp.config) return {};
    if (fp.preferences?.enabled === false) return {};

    const requestHeaders = modifyHeaders(details.requestHeaders, fp.config);
    return { requestHeaders };
  } catch (err) {
    console.warn('[containTAB] header-spoofer listener error (passing through):', err);
    return {};
  }
}

/**
 * Install header spoofer — attach webRequest listener.
 */
export function installHeaderSpoofer() {
  browser.webRequest.onBeforeSendHeaders.addListener(
    headerListener,
    { urls: ['<all_urls>'] },
    ['blocking', 'requestHeaders']
  );
  console.debug('header-spoofer: installed');
}
