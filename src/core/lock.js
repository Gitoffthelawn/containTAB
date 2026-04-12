/**
 * lock.js — Container lock decision (pure function, zero browser.* dependency)
 *
 * Core invariant: tab in a VALID existing container is LOCKED.
 * - cookieStoreId === 'firefox-default' → not locked
 * - cookieStoreId points to a deleted container (orphan) → not locked
 * - cookieStoreId points to an existing container → locked
 *
 * Orphan tabs (e.g. after startup cleanup deleted their container) fall through
 * to rule match / container rebuild, so reload naturally restores the binding.
 *
 * Schema: Tab.schema.json x-invariants, MatchResult.schema.json x-decision-tree step_3b
 */

const NO_CONTAINER_ID = 'firefox-default';

/**
 * Check if a tab is locked in a valid existing container.
 *
 * @param {string} cookieStoreId - tab's current cookieStoreId
 * @param {Set<string>} [existingContainerIds] - cookieStoreIds of currently-existing containers
 * @returns {boolean}
 */
export function isLocked(cookieStoreId, existingContainerIds) {
  if (cookieStoreId === NO_CONTAINER_ID) return false;
  if (existingContainerIds && !existingContainerIds.has(cookieStoreId)) return false;
  return true;
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

/**
 * Check if tab can be redirected (not incognito, not being created by us).
 *
 * @param {{incognito: boolean}} tab
 * @param {object} creatingTabs - { tabId: url } map
 * @param {string} url - current request URL
 * @returns {boolean}
 */
export function isRedirectable(tab, creatingTabs, url) {
  if (tab.incognito) return false;
  const creatingUrl = creatingTabs[tab.id];
  if (creatingUrl === url) return false;
  return true;
}

/**
 * Tab cannot navigate to a different container. Always false.
 * New tab required instead. Exists for schema completeness.
 *
 * @returns {boolean}
 */
export function canNavigateTo() {
  return false;
}

export { NO_CONTAINER_ID };
