/**
 * core/index.js — Public API for containTAB core logic.
 * All exports are pure functions with zero browser.* dependency.
 */

export { match, ruleMatchesHost, sortBySpecificity } from './matcher.js';
export { isLocked, isDefault, needsRedirect, NO_CONTAINER_ID } from './lock.js';
export { formatName, nextSequentialName } from './naming.js';
export { extractHostname, extractDomain, extractTld } from './url.js';
