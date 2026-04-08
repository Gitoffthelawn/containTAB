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

/**
 * Filter object keys by predicate.
 *
 * @param {Object} dict
 * @param {Function} func - key predicate
 * @returns {Object}
 */
export const filterByKey = (dict, func) => {
  return Object.keys(dict)
    .filter(func)
    .reduce((acc, curr) => {
      acc[curr] = dict[curr];
      return acc;
    }, {});
};
