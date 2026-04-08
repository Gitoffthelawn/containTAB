/**
 * matcher.js — URL hostname matching (pure function, zero browser.* dependency)
 *
 * Three modes:
 *   exact:    "example.com"       -> matches only example.com
 *   wildcard: "*.example.com"     -> matches subdomains, not parent
 *   regex:    "@pattern"          -> matches hostname against regex with anchors
 *
 * Schema: Rule.schema.json x-matching-rules
 */

import { extractHostname } from './url.js';

const PREFIX_REGEX = '@';

/**
 * Sort rules by specificity (most specific first).
 * Specificity = number of domain segments (more segments = more specific).
 *
 * @param {Array<{host: string}>} rules
 * @returns {Array<{host: string}>}
 */
export function sortBySpecificity(rules) {
  return [...rules].sort((a, b) => {
    const segA = a.host.replace(/^\*\./, '').replace(/^@/, '').split('.').length;
    const segB = b.host.replace(/^\*\./, '').replace(/^@/, '').split('.').length;
    return segB - segA;
  });
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

  // regex mode: @pattern
  if (pattern[0] === PREFIX_REGEX) {
    const raw = pattern.slice(1);
    try {
      // anchor regex to prevent over-matching (bug #5 fix)
      const anchored = raw.startsWith('^') ? raw : `^${raw}`;
      const full = anchored.endsWith('$') ? anchored : `${anchored}$`;
      return new RegExp(full).test(hostname);
    } catch (e) {
      console.error('matcher: invalid regex', raw, e);
      return false;
    }
  }

  // wildcard mode: *.domain
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2).toLowerCase();
    const host = hostname.toLowerCase();
    // must end with .base and have at least one more segment
    return host.endsWith(`.${base}`) && host.length > base.length + 1;
  }

  // exact mode: domain
  return hostname.toLowerCase() === pattern.toLowerCase();
}

/**
 * Match a URL against a list of rules. Returns first matching rule or null.
 *
 * @param {string} url - full URL string
 * @param {Array<{host: string, cookieStoreId: string, enabled?: boolean}>} rules
 * @returns {{host: string, cookieStoreId: string} | null}
 */
export function match(url, rules) {
  const hostname = extractHostname(url);
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
