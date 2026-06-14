/**
 * core/index.js — Public API for containTAB core logic.
 * All exports are pure functions with zero browser.* dependency.
 */

export { match, ruleMatchesHost, sortBySpecificity, targetContainer, hasRules } from './matcher.js';
export { isLocked, isDefault, needsRedirect, isRedirectable, canNavigateTo, NO_CONTAINER_ID } from './lock.js';
export { formatName } from './naming.js';
export { decide, decidePreRule, toWebRequestResult } from './assignmentDecision.js';
export { extract, parse, tokenize } from './url-ast.js';
