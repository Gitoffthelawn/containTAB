/**
 * lock.js — Container lock decision (pure function, zero browser.* dependency)
 *
 * Core invariant: tab already in a container (cookieStoreId !== 'firefox-default')
 * is LOCKED — skip all matching, no re-assignment possible.
 *
 * Schema: Tab.schema.json x-invariants, MatchResult.schema.json x-decision-tree step_3b
 */

const NO_CONTAINER_ID = 'firefox-default';

/**
 * Check if a tab is locked in a container.
 * Locked = already assigned to a non-default container.
 *
 * @param {string} cookieStoreId - tab's current cookieStoreId
 * @returns {boolean}
 */
export function isLocked(cookieStoreId) {
  return cookieStoreId !== NO_CONTAINER_ID;
}

/**
 * Check if a tab is in the default (no container) state.
 * Only default tabs are eligible for rule matching.
 *
 * @param {string} cookieStoreId
 * @returns {boolean}
 */
export function isDefault(cookieStoreId) {
  return cookieStoreId === NO_CONTAINER_ID;
}

/**
 * Check if tab needs redirect (target differs from current).
 *
 * @param {string} currentCookieStoreId
 * @param {string} targetCookieStoreId
 * @returns {boolean}
 */
export function needsRedirect(currentCookieStoreId, targetCookieStoreId) {
  return currentCookieStoreId !== targetCookieStoreId;
}

export { NO_CONTAINER_ID };
