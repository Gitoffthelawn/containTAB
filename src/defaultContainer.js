/**
 * defaultContainer.js — Auto-create containers for unmatched URLs.
 *
 * One-tab-one-world: each unmatched URL gets its own container
 * with a sequential name like "github.com-001".
 *
 * Schema: Container.schema.json x-naming, Preference.schema.json
 */

import ContextualIdentities, { NO_CONTAINER } from './ContextualIdentity';
import PreferenceStorage from './Storage/PreferenceStorage';
import { formatName, nextSequentialName } from './core/index.js';

/**
 * Build a default container for an unmatched URL.
 *
 * @param {object} preferences - defaultContainer.* preferences
 * @param {string} url - full URL string
 * @returns {Promise<{cookieStoreId: string, name: string}>}
 */
export async function buildDefaultContainer(preferences, url) {
  // resolve base name from template
  const template = preferences['defaultContainer.containerName'] || '{fqdn}';
  const baseName = formatName(template, url);

  // generate sequential name
  const allContainers = await ContextualIdentities.getAll();
  const existingNames = allContainers.map(c => c.name);
  const name = nextSequentialName(baseName, existingNames);

  // create container
  const container = await ContextualIdentities.create(name);
  const cookieStoreId = container.cookieStoreId;

  // set lifetime preference
  const lifetime = preferences['defaultContainer.lifetime'] || 'untilLastTab';
  if (lifetime !== 'forever' && cookieStoreId !== NO_CONTAINER.cookieStoreId) {
    await PreferenceStorage.set({
      key: `containers.${cookieStoreId}.lifetime`,
      value: lifetime,
    });
  }

  return container;
}
