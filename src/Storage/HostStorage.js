/**
 * HostStorage — Rule CRUD with prefix-based storage.
 *
 * Stores rules as { host, cookieStoreId, containerName, enabled }
 * with prefix "map=" in browser.storage.local.
 *
 * Schema: Rule.schema.json x-storage
 */

import PrefixStorage from './PrefixStorage';

class HostStorage extends PrefixStorage {
  constructor() {
    super();
    this.PREFIX = 'map=';
    this.SET_KEY = 'host';
  }

  /**
   * Get all stored rules as an object.
   * Keys are host patterns, values are rule objects.
   *
   * @returns {Promise<Object>}
   */
  getAll() {
    return super.getAll();
  }
}

export default new HostStorage();
