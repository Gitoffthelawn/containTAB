/**
 * assignmentDecision.js — materialized method output for navigation assignment.
 *
 * Pure logic only: no browser.* dependency and no storage writes.
 */

import { match, targetContainer } from './matcher.js';
import { isLocked, needsRedirect } from './lock.js';

const IGNORED_URLS_REGEX = /^(about|moz-extension|file|javascript|data|chrome):/;

function noEffect(action, reason, extra = {}) {
  return { action, reason, matched: false, effects: ['none'], ...extra };
}

function tabEffects(config) {
  return config.keepOldTabs ? ['create_tab'] : ['create_tab', 'remove_old_tab'];
}

export function decidePreRule(url, tab, context = {}) {
  const {
    creatingTabs = {},
    identities = [],
    existingContainerIds = new Set(identities.map(i => i.cookieStoreId)),
    skipLock = false,
  } = context;

  if (IGNORED_URLS_REGEX.test(url)) {
    return noEffect('skip', 'ignored_url');
  }

  if (creatingTabs[tab.id] === url) {
    return noEffect('skip', 'self_created_tab');
  }

  if (tab.incognito) {
    return noEffect('skip', 'incognito');
  }

  if (!skipLock && isLocked(tab.cookieStoreId, existingContainerIds)) {
    return noEffect('skip', 'locked_container');
  }

  return null;
}

export function decide(url, tab, rules, config, context = {}) {
  const preRuleDecision = decidePreRule(url, tab, context);
  if (preRuleDecision) return preRuleDecision;

  const { identities = [] } = context;
  const matchedRule = match(url, rules);
  if (matchedRule) {
    const existingIdentity = matchedRule.cookieStoreId
      ? targetContainer(matchedRule, identities)
      : null;

    if (!existingIdentity) {
      return {
        action: 'rebind',
        reason: 'rule_target_missing',
        matched: true,
        rule: matchedRule,
        effects: ['create_container', 'update_rule', ...tabEffects(config)],
      };
    }

    if (needsRedirect(tab.cookieStoreId, existingIdentity.cookieStoreId)) {
      return {
        action: 'redirect',
        reason: 'rule_target_different',
        matched: true,
        rule: matchedRule,
        targetContainer: existingIdentity,
        effects: tabEffects(config),
      };
    }

    return {
      action: 'keep',
      reason: 'rule_target_same',
      matched: true,
      rule: matchedRule,
      targetContainer: existingIdentity,
      effects: ['none'],
    };
  }

  if (config.defaultContainer.enabled) {
    return {
      action: 'create',
      reason: 'default_container_enabled',
      matched: false,
      effects: ['create_container', ...tabEffects(config)],
    };
  }

  return noEffect('skip', 'default_container_disabled');
}

export function toWebRequestResult(decision) {
  return decision.effects?.includes('create_tab') ? { cancel: true } : {};
}
