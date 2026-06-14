import { vi } from 'vitest';

vi.mock('../../fingerprint/index.js', () => ({
  onContainerCreated: vi.fn().mockResolvedValue(undefined),
  onContainerRemoved: vi.fn().mockResolvedValue(undefined),
}));

describe('ContextualIdentities', () => {

  let ContextualIdentities;
  let Fingerprint;
  let removedListener;
  let storageData;

  beforeEach(async () => {
    vi.resetModules();
    removedListener = null;
    storageData = {};
    global.browser = {
      contextualIdentities: {
        create: vi.fn((details) => Promise.resolve({
          ...details,
          cookieStoreId: 'firefox-container-created',
        })),

        remove: vi.fn(async (cookieStoreId) => {
          if (removedListener) {
            await removedListener({
              contextualIdentity: { cookieStoreId },
            });
          }
          return { cookieStoreId };
        }),

        update: vi.fn(() => Promise.resolve({})),

        query: vi.fn((details) => new Promise((resolve) => {
          if (details.name === 'MOCK') {
            resolve([{
              name: 'Mock',
              cookieStoreId: 'cookie store',
            }]);
          } else {
            resolve([{
              name: 'Mock 1',
              cookieStoreId: 'cookie store 1',
            }, {
              name: 'Mock 2',
              cookieStoreId: 'cookie store 2',
            }]);
          }}),
        ),

        onCreated: {
          addListener: vi.fn(() => {}),
        },

        onRemoved: {
          addListener: vi.fn((fn) => {
            removedListener = fn;
          }),
        },

        onUpdated: {
          addListener: vi.fn(() => {}),
        },
      },
      storage: {
        local: {
          get: vi.fn((key) => {
            if (key === null) return Promise.resolve({...storageData});
            if (typeof key === 'string') return Promise.resolve({[key]: storageData[key]});
            return Promise.resolve({});
          }),
          remove: vi.fn((keys) => {
            const list = Array.isArray(keys) ? keys : [keys];
            list.forEach(key => delete storageData[key]);
            return Promise.resolve();
          }),
          set: vi.fn((obj) => {
            Object.assign(storageData, obj);
            return Promise.resolve();
          }),
        },
      },
    };

    const mod = await import('../index.js');
    Fingerprint = await import('../../fingerprint/index.js');
    ContextualIdentities = mod.default;
    vi.clearAllMocks();
  });

  it('should get all identities', () => {
    expect.assertions(1);
    return ContextualIdentities.getAll().then(identities => {
      expect(identities).toEqual([{
        name: 'Mock 1',
        cookieStoreId: 'cookie store 1',
      }, {
        name: 'Mock 2',
        cookieStoreId: 'cookie store 2',
      }, {
        name: 'No Container',
        icon: 'circle',
        iconUrl: 'resource://usercontext-content/circle.svg',
        color: 'grey',
        colorCode: '#999',
        cookieStoreId: 'firefox-default',
      }]);
    });
  });

  it('should get single identity', () => {
    expect.assertions(1);
    return ContextualIdentities.get('MOCK').then(identities => {
      expect(identities).toEqual([{
        name: 'Mock',
        cookieStoreId: 'cookie store',
      }]);
    });
  });

  it('should add onCreated listener', () => {
    const MOCK_FN = vi.fn();
    ContextualIdentities.addOnCreateListener(MOCK_FN);
    expect(global.browser.contextualIdentities.onCreated.addListener).toBeCalledWith(MOCK_FN);
  });

  it('should add onRemoved listener', () => {
    const MOCK_FN = vi.fn();
    ContextualIdentities.addOnRemoveListener(MOCK_FN);
    expect(global.browser.contextualIdentities.onRemoved.addListener).toBeCalledWith(MOCK_FN);
  });

  it('should add onChanged listener', () => {
    const MOCK_FN = vi.fn();
    ContextualIdentities.addOnUpdateListener(MOCK_FN);
    expect(global.browser.contextualIdentities.onUpdated.addListener).toBeCalledWith(MOCK_FN);
  });

  it('should add all three (onCreated, onRemoved and onChanged) listeners', () => {
    const MOCK_FN = vi.fn();
    ContextualIdentities.addOnChangedListener(MOCK_FN);
    expect(global.browser.contextualIdentities.onCreated.addListener).toBeCalledWith(MOCK_FN);
    expect(global.browser.contextualIdentities.onRemoved.addListener).toBeCalledWith(MOCK_FN);
    expect(global.browser.contextualIdentities.onUpdated.addListener).toBeCalledWith(MOCK_FN);
  });

  it('creates ContainerExtension with selected lifetime and calls fingerprint hook once', async () => {
    const identity = await ContextualIdentities.create('Research', {
      lifetime: 'untilLastTab',
      uiIcon: 'briefcase',
    });

    expect(identity).toEqual(expect.objectContaining({
      cookieStoreId: 'firefox-container-created',
      name: 'Research',
    }));
    expect(storageData['containers.firefox-container-created']).toEqual({
      cookieStoreId: 'firefox-container-created',
      lifetime: 'untilLastTab',
    });
    expect(Fingerprint.onContainerCreated).toHaveBeenCalledTimes(1);
    expect(Fingerprint.onContainerCreated).toHaveBeenCalledWith(
      'firefox-container-created',
    );
    expect(global.browser.contextualIdentities.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Research',
        icon: 'briefcase',
      }),
    );
  });

  it('explicit remove delegates cleanup to browser onRemoved event once', async () => {
    storageData = {
      'containers.firefox-container-1': {
        cookieStoreId: 'firefox-container-1',
        lifetime: 'forever',
      },
    };

    await ContextualIdentities.remove('firefox-container-1');

    expect(global.browser.contextualIdentities.remove).toHaveBeenCalledWith(
      'firefox-container-1',
    );
    expect(Fingerprint.onContainerRemoved).toHaveBeenCalledTimes(1);
    expect(Fingerprint.onContainerRemoved).toHaveBeenCalledWith(
      'firefox-container-1',
    );
    expect(global.browser.storage.local.remove).toHaveBeenCalledTimes(1);
    expect(global.browser.storage.local.remove).toHaveBeenCalledWith(
      'containers.firefox-container-1',
    );
    expect(storageData['containers.firefox-container-1']).toBeUndefined();
  });

  it('keeps rules when Firefox removes a container identity', async () => {
    storageData = {
      'map=github.com': {
        host: 'github.com',
        cookieStoreId: 'firefox-container-1',
        containerName: 'GitHub',
        enabled: true,
      },
      'containers.firefox-container-1': {
        cookieStoreId: 'firefox-container-1',
        lifetime: 'forever',
      },
    };

    await removedListener({
      contextualIdentity: {cookieStoreId: 'firefox-container-1'},
    });

    expect(storageData['map=github.com']).toEqual({
      host: 'github.com',
      cookieStoreId: 'firefox-container-1',
      containerName: 'GitHub',
      enabled: true,
    });
    expect(storageData['containers.firefox-container-1']).toBeUndefined();
    expect(global.browser.storage.local.remove).toHaveBeenCalledWith(
      'containers.firefox-container-1',
    );
  });

});
