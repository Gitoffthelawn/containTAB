/**
 * ContainerExtension — containTAB-owned data attached to a Firefox container.
 *
 * Storage key: containers.{cookieStoreId}
 * Legacy input: pref=containers.{cookieStoreId}.lifetime
 */

const NO_CONTAINER_ID = 'firefox-default';
export const UI_ICON_VALUES = [
  'containers',
  'briefcase',
  'book',
  'cart',
  'play',
  'shield',
  'pin',
];
const DEFAULT_UI_ICON = 'containers';
const NATIVE_ICON_BY_UI_ICON = {
  containers: 'circle',
  briefcase: 'briefcase',
  book: 'tree',
  cart: 'cart',
  play: 'fingerprint',
  shield: 'fence',
  pin: 'dollar',
};
const UI_ICON_BY_NATIVE_ICON = {
  circle: 'containers',
  briefcase: 'briefcase',
  tree: 'book',
  cart: 'cart',
  fingerprint: 'play',
  fence: 'shield',
  dollar: 'pin',
};

function storageKey(cookieStoreId) {
  return `containers.${cookieStoreId}`;
}

function normalizeLifetime(value, fallback = 'forever') {
  return value === 'untilLastTab' || value === 'forever' ? value : fallback;
}

function normalizeUiIcon(value) {
  return UI_ICON_VALUES.includes(value) ? value : DEFAULT_UI_ICON;
}

export function nativeIconForUiIcon(value) {
  return NATIVE_ICON_BY_UI_ICON[normalizeUiIcon(value)];
}

export function uiIconForNativeIcon(value) {
  return UI_ICON_BY_NATIVE_ICON[value] || DEFAULT_UI_ICON;
}

function normalizeExtension(cookieStoreId, value) {
  if (!value) return undefined;
  return {
    ...value,
    cookieStoreId,
    lifetime: normalizeLifetime(value.lifetime),
  };
}

function applyPatch(existing, partial) {
  const next = { ...existing };
  for (const [key, value] of Object.entries(partial)) {
    if (key === 'uiIcon') continue;
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  next.lifetime = normalizeLifetime(next.lifetime);
  delete next.uiIcon;
  return next;
}

const ContainerExtension = {
  async create(cookieStoreId, opts = {}) {
    if (!cookieStoreId || cookieStoreId === NO_CONTAINER_ID) return undefined;
    const ext = {
      cookieStoreId,
      lifetime: normalizeLifetime(opts.lifetime),
    };
    await browser.storage.local.set({ [storageKey(cookieStoreId)]: ext });
    return ext;
  },

  async get(cookieStoreId) {
    if (!cookieStoreId || cookieStoreId === NO_CONTAINER_ID) return undefined;
    const key = storageKey(cookieStoreId);
    const result = await browser.storage.local.get(key);
    return normalizeExtension(cookieStoreId, result[key]);
  },

  async set(cookieStoreId, partial = {}) {
    if (!cookieStoreId || cookieStoreId === NO_CONTAINER_ID) return undefined;
    const existing = await this.get(cookieStoreId) || { cookieStoreId, lifetime: 'forever' };
    const updated = applyPatch(existing, partial);
    await browser.storage.local.set({ [storageKey(cookieStoreId)]: updated });
    return updated;
  },

  shouldAutoDelete(ext) {
    return ext?.lifetime === 'untilLastTab';
  },

  async destroy(cookieStoreId) {
    if (!cookieStoreId || cookieStoreId === NO_CONTAINER_ID) return;
    await browser.storage.local.remove(storageKey(cookieStoreId));
  },

  async migrate() {
    const all = await browser.storage.local.get(null);
    const writes = {};
    const legacyKeys = [];

    for (const [key, value] of Object.entries(all)) {
      const match = key.match(/^pref=containers\.(.+)\.lifetime$/);
      if (!match) continue;

      const cookieStoreId = match[1];
      const targetKey = storageKey(cookieStoreId);
      legacyKeys.push(key);

      if (all[targetKey] !== undefined) continue;

      writes[targetKey] = {
        cookieStoreId,
        lifetime: normalizeLifetime(value?.value),
      };
    }

    if (Object.keys(writes).length > 0) {
      await browser.storage.local.set(writes);
    }
    if (legacyKeys.length > 0) {
      await browser.storage.local.remove(legacyKeys);
      return true;
    }
    return false;
  },
};

export default ContainerExtension;
