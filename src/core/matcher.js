/**
 * matcher.js — URL hostname matching (pure function, zero browser.* dependency)
 *
 * Two modes:
 *   glob:     "example.com"       -> exact (no wildcard)
 *             "*.example.com"     -> subdomains
 *             "amazon.*"          -> any TLD
 *             "*.google.*"        -> any subdomain + any TLD
 *   fragment: "@google"           -> hostname.includes("google")
 *
 * Glob: * = any string (zero or more chars). No regex, pure string matching.
 *
 * Schema: Rule.schema.json x-matching-rules
 */

import { extract } from './url-ast.js';

/**
 * Sort rules by specificity (most specific first).
 * Specificity = number of non-wildcard domain segments.
 *
 * @param {Array<{host: string}>} rules
 * @returns {Array<{host: string}>}
 */
export function sortBySpecificity(rules) {
  return [...rules].sort((a, b) => {
    const segA = countSpecificity(a.host);
    const segB = countSpecificity(b.host);
    return segB - segA;
  });
}

function countSpecificity(host) {
  // strip @ prefix for fragment rules
  const h = host[0] === '@' ? host.slice(1) : host;
  // count non-wildcard segments
  return h.split('.').filter(s => s !== '*').length;
}

/**
 * Glob match: * = zero or more characters.
 *
 * Split pattern by *, anchor first/last segments, find middle in order.
 * The dot structure in the pattern naturally prevents over-matching:
 *   *.example.com  won't match  example.com  (no leading dot)
 *   amazon.*       won't match  www.amazon.com  (no "amazon." at start)
 *
 * @param {string} hostname
 * @param {string} pattern
 * @returns {boolean}
 */
function globMatch(hostname, pattern) {
  const host = hostname.toLowerCase();
  const pat = pattern.toLowerCase();

  // no wildcard = exact match
  if (!pat.includes('*')) {
    return host === pat;
  }

  const segments = pat.split('*');

  // first segment anchored at start
  let pos = 0;
  if (segments[0] !== '') {
    if (!host.startsWith(segments[0])) return false;
    pos = segments[0].length;
  }

  // last segment anchored at end
  const last = segments[segments.length - 1];
  let ceiling = host.length;
  if (last !== '') {
    if (!host.endsWith(last)) return false;
    ceiling = host.length - last.length;
    if (ceiling < pos) return false;
  }

  // middle segments: find in order between pos and ceiling
  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === '') continue;
    const idx = host.indexOf(seg, pos);
    if (idx < 0 || idx + seg.length > ceiling) return false;
    pos = idx + seg.length;
  }

  return true;
}

/**
 * Test if a single rule matches a hostname.
 *
 * @param {string} hostname - bare hostname (no protocol, no path)
 * @param {{host: string, enabled?: boolean}} rule
 * @returns {boolean}
 */
export function ruleMatchesHost(hostname, rule) {
  if (rule.enabled === false) return false;

  const pattern = rule.host;
  if (pattern == null) return false; // eslint-disable-line eqeqeq -- idiomatic null+undefined check

  // fragment mode: @text — plain string includes()
  if (pattern[0] === '@') {
    const fragment = pattern.slice(1).toLowerCase();
    return hostname.toLowerCase().includes(fragment);
  }

  // glob mode: * = any string
  return globMatch(hostname, pattern);
}

/**
 * Match a URL against a list of rules. Returns first matching rule or null.
 *
 * @param {string} url - full URL string
 * @param {Array<{host: string, cookieStoreId: string, enabled?: boolean}>} rules
 * @returns {{host: string, cookieStoreId: string} | null}
 */
/**
 * Find the target container identity for a matched rule.
 *
 * @param {{cookieStoreId: string}} rule
 * @param {Array<{cookieStoreId: string, name: string}>} identities
 * @returns {{cookieStoreId: string, name: string} | undefined}
 */
export function targetContainer(rule, identities) {
  return identities.find(id => id.cookieStoreId === rule.cookieStoreId);
}

/**
 * Check if any rule points to a given container.
 *
 * @param {string} cookieStoreId
 * @param {Array<{cookieStoreId: string}>} rules
 * @returns {boolean}
 */
export function hasRules(cookieStoreId, rules) {
  return rules.some(r => r.cookieStoreId === cookieStoreId);
}

/**
 * Match a URL against a list of rules. Returns first matching rule or null.
 *
 * @param {string} url - full URL string
 * @param {Array<{host: string, cookieStoreId: string, enabled?: boolean}>} rules
 * @returns {{host: string, cookieStoreId: string} | null}
 */
export function match(url, rules) {
  const hostname = extract(url, 'hostname');
  if (!hostname) {
    console.error('matcher: cannot extract hostname from', url);
    return null;
  }

  const sorted = sortBySpecificity(rules.filter(r => r.enabled !== false));

  for (const rule of sorted) {
    if (ruleMatchesHost(hostname, rule)) {
      return rule;
    }
  }
  return null;
}
