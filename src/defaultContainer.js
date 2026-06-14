/**
 * defaultContainer.js — Auto-create containers for unmatched URLs.
 *
 * One-tab-one-world: each unmatched URL gets its own short numbered container
 * with a readable domain prefix like "github-01".
 *
 * Schema: Container.schema.json x-naming, GlobalConfig.schema.json,
 * ContainerExtension.schema.json
 */

import ContextualIdentities from './ContextualIdentity';
import { formatName } from './core/index.js';

const STRATEGY_MAP = {
  one_tab_one_world: '{domain}-{seq}',
  by_domain: '{domain}',
  by_host: '{fqdn}',
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function domainPrefix(url) {
  const name = formatName('{domain}', url);
  return name && name !== '{domain}' ? name : 'domain';
}

function nextDomainSequenceName(identities, url) {
  const prefix = domainPrefix(url);
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const max = identities.reduce((highest, identity) => {
    const match = pattern.exec(identity.name || '');
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

/**
 * Build a default container for an unmatched URL.
 *
 * @param {object} defaultContainer - GlobalConfig.defaultContainer subtree
 * @param {string} url - full URL string
 * @returns {Promise<{cookieStoreId: string, name: string}>}
 */
export async function buildDefaultContainer(defaultContainer, url) {
  const strategy = defaultContainer.containerStrategy || 'one_tab_one_world';
  const template = STRATEGY_MAP[strategy] || STRATEGY_MAP.one_tab_one_world;
  const name = strategy === 'one_tab_one_world'
    ? nextDomainSequenceName(await ContextualIdentities.getAll(), url)
    : formatName(template, url);

  const lifetime = defaultContainer.lifetime || 'untilLastTab';
  const container = await ContextualIdentities.create(name, { lifetime });

  return container;
}
