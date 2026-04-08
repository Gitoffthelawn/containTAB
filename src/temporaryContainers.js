/**
 * temporaryContainers.js — Container lifecycle management.
 *
 * Tracks tabs per container, auto-deletes temporary containers
 * when last tab closes (lifetime === 'untilLastTab').
 *
 * Schema: Container.schema.json x-lifecycle
 */

import ContextualIdentities from './ContextualIdentity';
import PreferenceStorage from './Storage/PreferenceStorage';

/**
 * Track tabs per context for fast counting.
 * tabId → cookieStoreId
 */
let tabContexts = {};

function countTabsInContext(contextId) {
  if (!contextId) throw 'Must provide contextId';
  return Object.keys(tabContexts)
    .filter((tabId) => tabContexts[tabId] === contextId)
    .length;
}

/**
 * Register a new tab in its container context.
 * @param {object} tab
 */
export function onTabCreated(tab) {
  tabContexts[tab.id] = tab.cookieStoreId;
}

/**
 * Handle tab removal: check if container should auto-delete.
 * @param {number|string} tabId
 */
export async function onTabRemoved(tabId) {
  const tabContextId = tabContexts[tabId];
  if (!tabContextId) return;

  delete tabContexts[tabId];

  if (countTabsInContext(tabContextId) > 0) return;

  const contextLifetime = await PreferenceStorage.get(
    `containers.${tabContextId}.lifetime`,
    true
  );

  if (contextLifetime === 'untilLastTab') {
    console.info('containTAB: removing temporary container:', tabContextId);
    return ContextualIdentities.remove(tabContextId);
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
    // Build active tab counts per container
    const activeCookieStoreIds = {};
    for (const tab of tabs) {
      activeCookieStoreIds[tab.cookieStoreId] = true;
    }

    const knownCookieStoreIds = {};
    const removePromises = [];

    // Remove inactive temporary containers
    for (const container of containers) {
      const cid = container.cookieStoreId;
      knownCookieStoreIds[cid] = true;

      if (!activeCookieStoreIds[cid] &&
          preferences[`containers.${cid}.lifetime`] === 'untilLastTab') {
        console.warn('containTAB: removing leftover container:', container.name);
        removePromises.push(ContextualIdentities.remove(cid));
      }
    }

    // Remove orphaned container preferences
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
