import ContainerExtension, { nativeIconForUiIcon } from '../ContainerExtension';
import { onContainerCreated, onContainerRemoved } from '../fingerprint/index.js';

export const NO_CONTAINER = {
  name: 'No Container',
  icon: 'circle',
  iconUrl: 'resource://usercontext-content/circle.svg',
  color: 'grey',
  colorCode: '#999',
  cookieStoreId: 'firefox-default',
};
export const COLORS = [
  'blue',
  'green',
  'orange',
  'pink',
  'purple',
  'red',
  'turquoise',
  'yellow',
];

class ContextualIdentities {

  constructor() {
    this.contextualIdentities = browser.contextualIdentities;
    this.addOnRemoveListener(async (changeInfo) => {
      const cookieStoreId = changeInfo.contextualIdentity.cookieStoreId;
      // Keep rules: orphan cookieStoreId is repaired on the next matching request.
      await onContainerRemoved(cookieStoreId);
      await ContainerExtension.destroy(cookieStoreId);
    });
  }

  async create(name, opts = {}) {
    const identity = await this.contextualIdentities.create({
      name: name,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      icon: nativeIconForUiIcon(opts.uiIcon),
    });
    await ContainerExtension.create(identity.cookieStoreId, {
      lifetime: opts.lifetime || 'forever',
    });
    await onContainerCreated(identity.cookieStoreId);
    return identity;
  }

  /**
   * Update Firefox-owned container properties.
   * containTAB UI icons are projected from Firefox native identity.icon.
   */
  update(cookieStoreId, details) {
    return this.contextualIdentities.update(cookieStoreId, details);
  }

  /**
   * Removes the Firefox native container identity.
   * Host rules are preserved so deleted containers can be recreated on match.
   */
  async remove(cookieStoreId) {
    if (cookieStoreId === NO_CONTAINER.cookieStoreId) {
      return;
    }
    return this.contextualIdentities.remove(cookieStoreId);
  }

  getAll(details = {}) {
    return this.contextualIdentities.query(details).then((identities) => [...identities, NO_CONTAINER]);
  }

  get(name) {
    if (name === NO_CONTAINER.name) {
      return Promise.resolve([NO_CONTAINER]);
    }
    return this.contextualIdentities.query({name});
  }

  addOnCreateListener(fn) {
    browser.contextualIdentities.onCreated.addListener(fn);
  }

  addOnRemoveListener(fn) {
    browser.contextualIdentities.onRemoved.addListener(fn);
  }

  addOnUpdateListener(fn) {
    browser.contextualIdentities.onUpdated.addListener(fn);
  }

  addOnChangedListener(fn) {
    this.addOnCreateListener(fn);
    this.addOnRemoveListener(fn);
    this.addOnUpdateListener(fn);
  }
}

export default new ContextualIdentities();
