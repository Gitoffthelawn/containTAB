/**
 * url.js — URL parsing utilities (pure function, zero browser.* dependency)
 *
 * Extracts hostname, domain, tld from URL strings.
 * Uses URL constructor (available in both browser and Node).
 */

/**
 * Extract bare hostname from a URL string.
 * Returns null for unparseable URLs.
 *
 * @param {string} url
 * @returns {string | null}
 */
export function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Extract domain (second-level) from hostname.
 * "www.example.co.uk" -> "co" (simplified, no PSL)
 * "example.com" -> "example"
 *
 * @param {string} hostname
 * @returns {string}
 */
export function extractDomain(hostname) {
  const parts = hostname.split('.');
  return parts.length > 1 ? parts[parts.length - 2] : parts[0];
}

/**
 * Extract TLD from hostname.
 *
 * @param {string} hostname
 * @returns {string}
 */
export function extractTld(hostname) {
  const parts = hostname.split('.');
  return parts[parts.length - 1];
}
