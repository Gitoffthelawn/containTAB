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
import { match, isLocked, needsRedirect, isRedirectable, targetContainer } from './core/index.js';

const IGNORED_URLS_REGEX = /^(about|moz-extension|file|javascript|data|chrome):/;

/**
 * Track tabs we are actively creating to prevent redirect loops.
 * Key: tabId, Value: url
 */
const creatingTabs = {};

/**
 * Track newly-created tabs awaiting their first real URL.
 * Firefox fires tabs.onCreated with tab.url === 'about:blank'; the real
 * URL arrives via tabs.onUpdated. When it does, we must re-decide the
 * container (bypass isLocked), since new tabs inherit the opener's
 * cookieStoreId by Firefox default — that is not a user choice.
 *
 * TTL: auto-forget after 30 s to guard against tabs that are created but
 * never navigate (e.g. closed before first URL fires tabs.onRemoved).
 */
const newTabs = new Set();
const _newTabTimers = new Map();

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
    }).catch(err => {
      console.error('containTAB: failed to create tab:', err);
    });

    PreferenceStorage.get('keepOldTabs').then(({ value }) => {
      if (!value || /^(about:|moz-extension:)/.test(currentTab.url)) {
        Tabs.remove(currentTabId);
      }
    }).catch(() => {
      Tabs.remove(currentTabId);
    });
  }).catch(err => {
    console.error('containTAB: failed to get tab for redirect:', err);
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
async function handle(url, tabId, { skipLock = false } = {}) {
  // Step 1: filter ignored URLs
  if (IGNORED_URLS_REGEX.test(url)) {
    return {};
  }

  // Step 2: prevent redirect loops (clean up stale entry)
  if (creatingTabs[tabId] && creatingTabs[tabId] !== url) {
    delete creatingTabs[tabId];
  }

  const [preferences, currentTab, identities] = await Promise.all([
    PreferenceStorage.getAll(true).then(p => ({ ...PREFERENCE_DEFAULTS, ...p })),
    Tabs.get(tabId),
    ContextualIdentity.getAll(),
  ]);

  const existingContainerIds = new Set(identities.map(i => i.cookieStoreId));

  // Step 3: skip if not redirectable (incognito or being created)
  if (!isRedirectable(currentTab, creatingTabs, url)) {
    return {};
  }

  // Step 4: CONTAINER LOCK — tab in a valid existing container → locked, done.
  // Orphan cookieStoreId (container was deleted) falls through to rebuild.
  // skipLock=true used by tabs.onCreated: new tab inherits opener's container
  // by Firefox default, which is NOT a user choice — must re-decide.
  if (!skipLock && isLocked(currentTab.cookieStoreId, existingContainerIds)) {
    return {};
  }

  // Step 5: try rule match (tab is in default or orphan, needs assignment)
  const allRules = await Storage.getAll();
  const rulesArray = Object.keys(allRules).map(key => allRules[key]);
  const matchedRule = match(url, rulesArray);

  if (matchedRule) {
    // find or create target container
    const existingIdentity = matchedRule.cookieStoreId
      ? targetContainer(matchedRule, identities)
      : null;

    let targetCookieStoreId;

    if (existingIdentity) {
      targetCookieStoreId = existingIdentity.cookieStoreId;
    } else {
      // container missing (empty, deleted, or untilLastTab) — create it
      const containerName = matchedRule.containerName || matchedRule.host;
      try {
        const newContainer = await ContextualIdentity.create(containerName);
        targetCookieStoreId = newContainer.cookieStoreId;
        await Storage.set({
          ...matchedRule,
          cookieStoreId: targetCookieStoreId,
        });
        console.info('containTAB: created container for rule:', matchedRule.host, '→', containerName);
      } catch (err) {
        console.error('containTAB: failed to create container:', err);
        return {};
      }
    }

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
  // Rule 2: no match → ISOLATED container (one-tab-one-world)
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
  // New tab's first real URL can arrive via webRequest before tabs.onUpdated —
  // bypass lock so Firefox's inherited cookieStoreId doesn't stick.
  if (newTabs.has(requestDetails.tabId)) {
    newTabs.delete(requestDetails.tabId);
    const t = _newTabTimers.get(requestDetails.tabId);
    if (t !== undefined) { clearTimeout(t); _newTabTimers.delete(requestDetails.tabId); }
    return handle(requestDetails.url, requestDetails.tabId, { skipLock: true });
  }
  return handle(requestDetails.url, requestDetails.tabId);
};

export const tabUpdatedListener = (tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }
  // First real URL after tabs.onCreated → bypass lock, re-decide container
  if (newTabs.has(tabId)) {
    newTabs.delete(tabId);
    const t = _newTabTimers.get(tabId);
    if (t !== undefined) { clearTimeout(t); _newTabTimers.delete(tabId); }
    return handle(changeInfo.url, tabId, { skipLock: true });
  }
  return handle(changeInfo.url, tabId);
};

/**
 * tabs.onCreated listener — mark the tab as new so its first real URL
 * (delivered later via tabs.onUpdated) re-decides the container with
 * skipLock. Firefox fires onCreated with tab.url === 'about:blank' and
 * the real URL arrives on onUpdated, so we cannot decide here directly.
 * If onCreated already has a real URL, decide immediately.
 */
export const tabCreatedListener = (tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  if (tab.url && !IGNORED_URLS_REGEX.test(tab.url)) {
    return handle(tab.url, tab.id, { skipLock: true });
  }
  newTabs.add(tab.id);
  // TTL guard: auto-forget if tab never fires onUpdated/onRemoved
  const timer = setTimeout(() => {
    newTabs.delete(tab.id);
    _newTabTimers.delete(tab.id);
  }, 30000);
  _newTabTimers.set(tab.id, timer);
};

/**
 * Forget a removed tab from the new-tabs set and creatingTabs map.
 * Called by onTabRemoved to prevent stale entries leaking across tab ID reuse.
 */
export const forgetNewTab = (tabId) => {
  newTabs.delete(tabId);
  const timer = _newTabTimers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    _newTabTimers.delete(tabId);
  }
  delete creatingTabs[tabId];
};
