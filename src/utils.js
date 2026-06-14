/**
 * utils.js — Shared utilities.
 *
 * Matching logic moved to core/matcher.js.
 * This file retains UI helpers and formatString.
 */

export const qs = (selector, node) => (node || document).querySelector(selector);
export const qsAll = (selector, node) => (node || document).querySelectorAll(selector);
export const ce = (tagName) => document.createElement(tagName);

export const cleanHostInput = (value = '') => value.trim().toLowerCase();

export function focusSoon(selectorOrElement) {
  setTimeout(() => {
    if (typeof document === 'undefined') return;
    if (typeof selectorOrElement === 'string') {
      qs(selectorOrElement)?.focus();
    } else {
      selectorOrElement?.focus();
    }
  }, 0);
}
