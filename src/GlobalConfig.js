/**
 * GlobalConfig — storage object for schema-owned global settings.
 *
 * Storage key: "config"
 * Legacy input: "pref=*" keys, migrated once when config is absent.
 */

const CONFIG_KEY = 'config';

export const DEFAULT_CONFIG = {
  keepOldTabs: false,
  matchDomainOnly: false,
  theme: 'system',
  defaultContainer: {
    enabled: true,
    containerStrategy: 'one_tab_one_world',
    lifetime: 'untilLastTab',
    ruleAddition: '*.{domain}.*',
  },
  experimental: {
    fingerprint: {
      enabled: false,
    },
  },
};

const SETTINGS_KEY_MAPPING = {
  'pref=keepOldTabs': 'keepOldTabs',
  'pref=matchDomainOnly': 'matchDomainOnly',
  'pref=theme': 'theme',
  'pref=defaultContainer': 'defaultContainer.enabled',
  'pref=defaultContainer.containerStrategy': 'defaultContainer.containerStrategy',
  'pref=defaultContainer.lifetime': 'defaultContainer.lifetime',
  'pref=defaultContainer.ruleAddition': 'defaultContainer.ruleAddition',
};

const THEME_VALUES = new Set(['system', 'light', 'dark']);
const CONTAINER_STRATEGY_VALUES = new Set(['one_tab_one_world', 'by_domain', 'by_host']);
const LIFETIME_VALUES = new Set(['forever', 'untilLastTab']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  const out = clone(base);
  if (!isObject(patch)) return out;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isObject(value) && isObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = clone(value);
    }
  }
  return out;
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!isObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function unwrapLegacyValue(record) {
  if (isObject(record) && Object.prototype.hasOwnProperty.call(record, 'value')) {
    return record.value;
  }
  return record;
}

function normalizeConfig(config) {
  const merged = deepMerge(DEFAULT_CONFIG, config);

  if (typeof merged.keepOldTabs !== 'boolean') merged.keepOldTabs = DEFAULT_CONFIG.keepOldTabs;
  if (typeof merged.matchDomainOnly !== 'boolean') merged.matchDomainOnly = DEFAULT_CONFIG.matchDomainOnly;
  if (!THEME_VALUES.has(merged.theme)) merged.theme = DEFAULT_CONFIG.theme;

  if (!isObject(merged.defaultContainer)) {
    merged.defaultContainer = clone(DEFAULT_CONFIG.defaultContainer);
  }
  if (typeof merged.defaultContainer.enabled !== 'boolean') {
    merged.defaultContainer.enabled = DEFAULT_CONFIG.defaultContainer.enabled;
  }
  if (!CONTAINER_STRATEGY_VALUES.has(merged.defaultContainer.containerStrategy)) {
    merged.defaultContainer.containerStrategy = DEFAULT_CONFIG.defaultContainer.containerStrategy;
  }
  if (!LIFETIME_VALUES.has(merged.defaultContainer.lifetime)) {
    merged.defaultContainer.lifetime = DEFAULT_CONFIG.defaultContainer.lifetime;
  }
  if (typeof merged.defaultContainer.ruleAddition !== 'string') {
    merged.defaultContainer.ruleAddition = DEFAULT_CONFIG.defaultContainer.ruleAddition;
  }

  if (!isObject(merged.experimental)) merged.experimental = clone(DEFAULT_CONFIG.experimental);
  if (!isObject(merged.experimental.fingerprint)) {
    merged.experimental.fingerprint = clone(DEFAULT_CONFIG.experimental.fingerprint);
  }
  if (typeof merged.experimental.fingerprint.enabled !== 'boolean') {
    merged.experimental.fingerprint.enabled = DEFAULT_CONFIG.experimental.fingerprint.enabled;
  }

  return merged;
}

const GlobalConfig = {
  async get() {
    const result = await browser.storage.local.get(CONFIG_KEY);
    return normalizeConfig(result[CONFIG_KEY]);
  },

  async set(partial = {}) {
    const current = await this.get();
    const next = normalizeConfig(deepMerge(current, partial));
    await browser.storage.local.set({ [CONFIG_KEY]: next });
    return next;
  },

  async reset() {
    await browser.storage.local.remove(CONFIG_KEY);
  },

  async migrate() {
    const all = await browser.storage.local.get(null);
    if (all[CONFIG_KEY] !== undefined) return false;

    const partial = {};
    const migratedKeys = [];
    for (const [legacyKey, configPath] of Object.entries(SETTINGS_KEY_MAPPING)) {
      if (!Object.prototype.hasOwnProperty.call(all, legacyKey)) continue;
      setPath(partial, configPath, unwrapLegacyValue(all[legacyKey]));
      migratedKeys.push(legacyKey);
    }

    if (migratedKeys.length === 0) return false;

    await browser.storage.local.set({ [CONFIG_KEY]: normalizeConfig(partial) });
    await browser.storage.local.remove(migratedKeys);
    return true;
  },
};

export default GlobalConfig;
