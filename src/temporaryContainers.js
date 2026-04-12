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
import { forgetNewTab } from './containers';

/**
 * Temporary container name pattern: "<baseName>-NNN" where NNN is 3+ digits.
 * Produced by core/naming.js#nextSequentialName for every Rule 2 container.
 * Any container matching this pattern is containTAB-managed and may be
 * reaped when empty, regardless of lifetime preference state.
 */
const TEMP_NAME_RE = /-\d{3,}$/;

function isTempContainer(name) {
  return typeof name === 'string' && TEMP_NAME_RE.test(name);
}

/**
 * Count tabs in a container via browser API (real-time, survives restart).
 * @param {string} cookieStoreId
 * @returns {Promise<number>}
 */
function countTabsInContext(cookieStoreId) {
  return browser.tabs.query({ cookieStoreId }).then(tabs => tabs.length);
}

/**
 * Handle tab removal: check if container should auto-delete.
 * @param {number|string} tabId
 * @param {{windowId: number, isWindowClosing: boolean}} removeInfo
 */
export async function onTabRemoved(tabId) {
  // Forget any pending new-tab marker so the set doesn't leak
  if (typeof tabId === 'number') forgetNewTab(tabId);

  // A container is removable when it has zero tabs AND
  // (lifetime === 'untilLastTab' OR name matches the temp container pattern).
  // The name branch catches orphans from earlier buggy paths where lifetime
  // persistence was skipped, and covers all Rule 2 containers uniformly.
  const [allPrefs, containers] = await Promise.all([
    PreferenceStorage.getAll(true),
    browser.contextualIdentities.query({}),
  ]);

  for (const container of containers) {
    const cid = container.cookieStoreId;
    const isUntilLast = allPrefs[`containers.${cid}.lifetime`] === 'untilLastTab';
    const isTemp = isTempContainer(container.name);
    if (!isUntilLast && !isTemp) continue;

    const count = await countTabsInContext(cid);
    if (count === 0) {
      console.info('containTAB: removing container:', container.name);
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

      if (activeCookieStoreIds[cid]) continue;

      // Remove when: untilLastTab preference set, OR name matches the temp
      // container pattern. The name branch catches orphans from earlier
      // buggy paths that skipped lifetime persistence.
      const isUntilLast = preferences[`containers.${cid}.lifetime`] === 'untilLastTab';
      const isTemp = isTempContainer(container.name);
      if (!isUntilLast && !isTemp) continue;

      console.warn('containTAB: removing leftover container:', container.name);
      removePromises.push(ContextualIdentities.remove(cid));
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
