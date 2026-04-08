/**
 * containers.js — Main orchestrator for tab-container assignment.
 *
 * Data flow (MatchResult.schema.json x-decision-tree):
 *   1. Ignored URL? → skip
 *   2. Tab being created by us? → skip (prevent loop)
 *   3. Incognito? → skip
 *   4. Tab already in container? → skip (container lock)
 *   5. Rule match? → redirect to rule's container
 *   6. No match + defaultContainer enabled? → create one-tab-one-world
 *   7. No match + defaultContainer disabled? → skip
 */

import Storage from './Storage/HostStorage';
import ContextualIdentity from './ContextualIdentity';
import Tabs from './Tabs';
import PreferenceStorage from './Storage/PreferenceStorage';
import { buildDefaultContainer } from './defaultContainer';
import { match, isLocked, needsRedirect } from './core/index.js';

const IGNORED_URLS_REGEX = /^(about|moz-extension|file|javascript|data|chrome):/;

/**
 * Track tabs we are actively creating to prevent redirect loops.
 * Key: tabId, Value: url
 */
const creatingTabs = {};

const PREFERENCE_DEFAULTS = {
  defaultContainer: true,
  'defaultContainer.containerName': '{fqdn}',
  'defaultContainer.lifetime': 'untilLastTab',
  keepOldTabs: false,
};

/**
 * Create a new tab in the target container, optionally closing the old one.
 */
const createTab = (url, newTabIndex, currentTabId, openerTabId, cookieStoreId) => {
  Tabs.get(currentTabId).then((currentTab) => {
    const createOptions = {
      url,
      index: newTabIndex,
      cookieStoreId,
      active: currentTab.active,
      pinned: currentTab.pinned,
      discarded: currentTab.discarded,
      openInReaderMode: currentTab.isInReaderMode,
    };

    if (cookieStoreId && openerTabId) {
      createOptions.openerTabId = openerTabId;
    }

    Tabs.create(createOptions).then((createdTab) => {
      creatingTabs[createdTab.id] = url;
      if (!cookieStoreId && openerTabId) {
        Tabs.update(createdTab.id, { openerTabId });
      }
    });

    PreferenceStorage.get('keepOldTabs').then(({ value }) => {
      if (!value || /^(about:|moz-extension:)/.test(currentTab.url)) {
        Tabs.remove(currentTabId);
      }
    }).catch(() => {
      Tabs.remove(currentTabId);
    });
  });

  return { cancel: true };
};

/**
 * Main handler: decide what to do with a URL in a tab.
 *
 * @param {string} url
 * @param {number} tabId
 * @returns {Promise<object>}
 */
async function handle(url, tabId) {
  // Step 1: filter ignored URLs
  if (IGNORED_URLS_REGEX.test(url)) {
    return {};
  }

  // Step 2: prevent redirect loops
  const creatingUrl = creatingTabs[tabId];
  if (creatingUrl === url) {
    return {};
  } else if (creatingUrl) {
    delete creatingTabs[tabId];
    return {};
  }

  const [preferences, currentTab] = await Promise.all([
    PreferenceStorage.getAll(true).then(p => ({ ...PREFERENCE_DEFAULTS, ...p })),
    Tabs.get(tabId),
  ]);

  // Step 3: skip incognito
  if (currentTab.incognito) {
    return {};
  }

  // Step 4: CONTAINER LOCK — tab already in container → skip all matching
  if (isLocked(currentTab.cookieStoreId)) {
    return {};
  }

  // Step 5: try rule match
  const allRules = await Storage.getAll();
  const rulesArray = Object.keys(allRules).map(key => allRules[key]);
  const matchedRule = match(url, rulesArray);

  if (matchedRule && matchedRule.cookieStoreId) {
    // verify target container still exists
    const identities = await ContextualIdentity.getAll();
    const targetIdentity = identities.find(
      (id) => id.cookieStoreId === matchedRule.cookieStoreId
    );

    if (!targetIdentity) {
      // orphaned rule — target container deleted
      return {};
    }

    const targetCookieStoreId = targetIdentity.cookieStoreId;

    if (needsRedirect(currentTab.cookieStoreId, targetCookieStoreId)) {
      return createTab(
        url,
        currentTab.index + 1,
        currentTab.id,
        currentTab.openerTabId,
        targetCookieStoreId
      );
    }
    return {};
  }

  // Step 6 & 7: no match — check defaultContainer preference
  if (preferences.defaultContainer) {
    const defaultContainer = await buildDefaultContainer(preferences, url);
    const targetCookieStoreId = defaultContainer.cookieStoreId;

    if (needsRedirect(currentTab.cookieStoreId, targetCookieStoreId)) {
      return createTab(
        url,
        currentTab.index + 1,
        currentTab.id,
        currentTab.openerTabId,
        targetCookieStoreId
      );
    }
  }

  return {};
}

export const webRequestListener = (requestDetails) => {
  if (requestDetails.frameId !== 0 || requestDetails.tabId === -1) {
    return {};
  }
  return handle(requestDetails.url, requestDetails.tabId);
};

export const tabUpdatedListener = (tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }
  return handle(changeInfo.url, tabId);
};
