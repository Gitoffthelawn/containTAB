/**
 * temporaryContainers.js — Container lifecycle management.
 *
 * Auto-deletes temporary containers when last tab closes
 * (lifetime === 'untilLastTab').
 *
 * Uses browser.tabs.query for real-time tab count — no in-memory state.
 *
 * Schema: Container.schema.json x-lifecycle
 */

import ContextualIdentities from './ContextualIdentity';
import PreferenceStorage from './Storage/PreferenceStorage';

/**
 * Count tabs in a container via browser API (real-time, survives restart).
 * @param {string} cookieStoreId
 * @returns {Promise<number>}
 */
function countTabsInContext(cookieStoreId) {
  return browser.tabs.query({ cookieStoreId }).then(tabs => tabs.length);
}

/**
 * Register a new tab (no-op, kept for API compatibility).
 * @param {object} tab
 */
export function onTabCreated(tab) {
  // no-op: tab count is queried live via browser.tabs.query
  console.debug('containTAB: tab created:', tab.id, tab.cookieStoreId);
}

/**
 * Handle tab removal: check if container should auto-delete.
 * @param {number|string} tabId
 * @param {{windowId: number, isWindowClosing: boolean}} removeInfo
 */
export async function onTabRemoved() {
  // Get the tab's container before it's gone — use the removeInfo
  // Firefox doesn't give us the tab object in onRemoved, so we need
  // to query remaining tabs per container and check which ones are empty.
  // Instead, we scan all temporary containers for zero tabs.
  const [allPrefs, containers] = await Promise.all([
    PreferenceStorage.getAll(true),
    browser.contextualIdentities.query({}),
  ]);

  for (const container of containers) {
    const cid = container.cookieStoreId;
    if (allPrefs[`containers.${cid}.lifetime`] !== 'untilLastTab') continue;

    const count = await countTabsInContext(cid);
    if (count === 0) {
      console.info('containTAB: removing temporary container:', container.name);
      ContextualIdentities.remove(cid);
    }
  }
}

/**
 * Startup cleanup: remove orphaned temporary containers (no open tabs).
 */
export function cleanUpTemporaryContainers() {
  Promise.all([
    browser.contextualIdentities.query({}),
    browser.tabs.query({}),
    PreferenceStorage.getAll(true),
  ]).then(([containers, tabs, preferences]) => {
    const activeCookieStoreIds = {};
    for (const tab of tabs) {
      activeCookieStoreIds[tab.cookieStoreId] = true;
    }

    const knownCookieStoreIds = {};
    const removePromises = [];

    for (const container of containers) {
      const cid = container.cookieStoreId;
      knownCookieStoreIds[cid] = true;

      if (!activeCookieStoreIds[cid] &&
          preferences[`containers.${cid}.lifetime`] === 'untilLastTab') {
        console.warn('containTAB: removing leftover container:', container.name);
        removePromises.push(ContextualIdentities.remove(cid));
      }
    }

    const orphanedPrefs = Object.keys(preferences)
      .filter(key => key.startsWith('containers.'))
      .filter(key => {
        const cid = key.split('.')[1];
        return !knownCookieStoreIds[cid];
      });

    if (orphanedPrefs.length > 0) {
      console.warn('containTAB: removing orphaned preferences:', orphanedPrefs);
      removePromises.push(
        PreferenceStorage.remove(orphanedPrefs).catch(console.error)
      );
    }

    return Promise.all(removePromises);
  });
}
