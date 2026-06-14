/**
 * containers.js — Main orchestrator for tab-container assignment.
 *
 * Data flow (AssignmentDecision.schema.json x-decision-tree):
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
import GlobalConfig from './GlobalConfig';
import ContainerExtension from './ContainerExtension';
import { buildDefaultContainer } from './defaultContainer';
import { decide, decidePreRule, toWebRequestResult } from './core/index.js';

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

const startupMigration = Promise.all([
  GlobalConfig.migrate(),
  ContainerExtension.migrate(),
]).catch((err) => {
  console.error('containTAB: storage migration failed:', err);
});

/**
 * Create a new tab in the target container, optionally closing the old one.
 */
const createTab = (url, newTabIndex, currentTabId, openerTabId, cookieStoreId, keepOldTabs) => {
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

    if (!keepOldTabs || /^(about:|moz-extension:)/.test(currentTab.url)) {
      Tabs.remove(currentTabId);
    }
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
  await startupMigration;

  // Step 2: prevent redirect loops (clean up stale entry)
  if (creatingTabs[tabId] && creatingTabs[tabId] !== url) {
    delete creatingTabs[tabId];
  }

  const earlyDecision = decidePreRule(url, {
    id: tabId,
    cookieStoreId: 'firefox-default',
    incognito: false,
  }, {
    creatingTabs,
    skipLock: true,
  });
  if (earlyDecision) {
    return toWebRequestResult(earlyDecision);
  }

  const [config, currentTab, identities] = await Promise.all([
    GlobalConfig.get(),
    Tabs.get(tabId),
    ContextualIdentity.getAll(),
  ]);

  const preRuleDecision = decidePreRule(url, currentTab, {
    creatingTabs,
    identities,
    skipLock,
  });
  if (preRuleDecision) {
    return toWebRequestResult(preRuleDecision);
  }

  const allRules = await Storage.getAll();
  const rulesArray = Object.keys(allRules).map(key => allRules[key]);
  const decision = decide(url, currentTab, rulesArray, config, {
    creatingTabs,
    identities,
    skipLock,
  });
  const committedDecision = await commitEffects(decision, { url, currentTab, config });
  return toWebRequestResult(committedDecision);
}

async function commitEffects(decision, { url, currentTab, config }) {
  if (!decision.effects?.includes('create_tab')) return decision;

  if (decision.action === 'rebind') {
    const containerName = decision.rule.containerName || decision.rule.host;
    try {
      const newContainer = await ContextualIdentity.create(containerName);
      await Storage.set({
        ...decision.rule,
        cookieStoreId: newContainer.cookieStoreId,
      });
      console.info('containTAB: created container for rule:', decision.rule.host, '→', containerName);
      createTab(
        url,
        currentTab.index + 1,
        currentTab.id,
        currentTab.openerTabId,
        newContainer.cookieStoreId,
        config.keepOldTabs
      );
      return {
        ...decision,
        targetContainer: newContainer,
      };
    } catch (err) {
      console.error('containTAB: failed to create container:', err);
      return { action: 'skip', reason: 'rule_target_missing', matched: true, effects: ['none'] };
    }
  }

  if (decision.action === 'create') {
    const defaultContainer = await buildDefaultContainer(config.defaultContainer, url);
    createTab(
      url,
      currentTab.index + 1,
      currentTab.id,
      currentTab.openerTabId,
      defaultContainer.cookieStoreId,
      config.keepOldTabs
    );
    return {
      ...decision,
      targetContainer: defaultContainer,
    };
  }

  createTab(
    url,
    currentTab.index + 1,
    currentTab.id,
    currentTab.openerTabId,
    decision.targetContainer.cookieStoreId,
    config.keepOldTabs
  );
  return decision;
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
