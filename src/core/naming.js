/**
 * naming.js — Container name generation (pure function, zero browser.* dependency)
 *
 * One-tab-one-world naming: generates "domain-NNN" names.
 * NNN is a 3-digit sequence number (001, 002, 003...).
 *
 * Schema: Container.schema.json x-naming
 */

import { extract } from './url-ast.js';

/**
 * Format a container name template with URL context.
 *
 * Supported variables: {domain}, {fqdn}, {host}, {tld}, {ms}
 *
 * @param {string} template - name template (e.g. "{fqdn}")
 * @param {string} url - full URL string
 * @returns {string}
 */
export function formatName(template, url) {
  const { hostname, domain, tld } = extract(url, ['hostname', 'domain', 'tld']);
  if (!hostname) return template;

  const context = {
    domain: domain || hostname,
    fqdn: hostname,
    host: hostname,
    tld: tld || hostname,
    ms: String(Date.now()),
  };

  return template.replace(/\{([\w_-]+)\}/g, (match, key) => {
    const val = context[key];
    if (val === undefined) {
      console.error('naming: unknown template variable', key);
      return match;
    }
    return val;
  });
}

/**
 * Generate the next sequential container name.
 *
 * Given existing container names, finds the next sequence number
 * for the base name and returns "baseName-NNN".
 *
 * @param {string} baseName - resolved base name (e.g. "github.com")
 * @param {string[]} existingNames - all current container names
 * @returns {string}
 */
export function nextSequentialName(baseName, existingNames) {
  // find existing containers with same base
  const seqPattern = new RegExp(`^${escapeRegex(baseName)}-(\\d{3,})$`);
  let maxSeq = 0;

  for (const name of existingNames) {
    if (name === baseName) {
      // baseName itself exists (without sequence), count as 0
      maxSeq = Math.max(maxSeq, 0);
    }
    const m = name.match(seqPattern);
    if (m) {
      maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
  }

  const next = maxSeq + 1;
  return `${baseName}-${String(next).padStart(3, '0')}`;
}

/**
 * Escape string for use in RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
