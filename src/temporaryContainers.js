/**
 * temporaryContainers.js — Container lifecycle management.
 *
 * Auto-deletes temporary containers when last tab closes
 * (lifetime === 'untilLastTab').
 *
 * Owner gate: only acts on containers containTAB owns, identified by the
 * presence of a ContainerExtension with lifetime === 'untilLastTab'. Never infers ownership
 * from name patterns — Firefox `contextualIdentities` is a global resource
 * shared across extensions and the user's manual creations.
 *
 * Uses browser.tabs.query for real-time tab count — no in-memory state.
 *
 * Schema: Container.schema.json x-lifecycle
 */

import ContextualIdentities from './ContextualIdentity';
import ContainerExtension from './ContainerExtension';
import { forgetNewTab } from './containers';

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

  const containers = await browser.contextualIdentities.query({});

  for (const container of containers) {
    const cid = container.cookieStoreId;
    const ext = await ContainerExtension.get(cid);
    if (!ContainerExtension.shouldAutoDelete(ext)) continue;

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
  ]).then(async ([containers, tabs]) => {
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

      // Owner gate: only remove containers containTAB owns.
      const ext = await ContainerExtension.get(cid);
      if (!ContainerExtension.shouldAutoDelete(ext)) continue;

      console.warn('containTAB: removing leftover container:', container.name);
      removePromises.push(ContextualIdentities.remove(cid));
    }

    return Promise.all(removePromises);
  });
}
