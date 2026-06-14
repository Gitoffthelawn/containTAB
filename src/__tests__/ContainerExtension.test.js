import { beforeEach, describe, expect, it, vi } from 'vitest';

let ContainerExtension;
let storageData;

beforeEach(async () => {
  vi.resetModules();
  storageData = {};
  global.browser = {
    storage: {
      local: {
        get: vi.fn((key) => {
          if (key === null) return Promise.resolve({ ...storageData });
          if (typeof key === 'string') return Promise.resolve({ [key]: storageData[key] });
          return Promise.resolve({});
        }),
        set: vi.fn((obj) => {
          Object.assign(storageData, obj);
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach(key => delete storageData[key]);
          return Promise.resolve();
        }),
      },
    },
  };

  const mod = await import('../ContainerExtension.js');
  ContainerExtension = mod.default;
});

describe('ContainerExtension', () => {
  it('create/get round-trips one container extension object', async () => {
    await ContainerExtension.create('firefox-container-1', { lifetime: 'untilLastTab' });

    await expect(ContainerExtension.get('firefox-container-1')).resolves.toEqual({
      cookieStoreId: 'firefox-container-1',
      lifetime: 'untilLastTab',
    });
    expect(storageData['containers.firefox-container-1']).toEqual({
      cookieStoreId: 'firefox-container-1',
      lifetime: 'untilLastTab',
    });
  });

  it('maps containTAB UI icon choices to Firefox native identity icons', async () => {
    const { nativeIconForUiIcon, uiIconForNativeIcon } = await import('../ContainerExtension.js');

    expect(nativeIconForUiIcon('book')).toBe('tree');
    expect(uiIconForNativeIcon('tree')).toBe('book');
    expect(nativeIconForUiIcon('unknown')).toBe('circle');
    expect(uiIconForNativeIcon('unknown')).toBe('containers');
  });

  it('does not store uiIcon in ContainerExtension data', async () => {
    await ContainerExtension.create('firefox-container-1', {
      lifetime: 'forever',
      uiIcon: 'book',
    });

    expect(storageData['containers.firefox-container-1']).toEqual({
      cookieStoreId: 'firefox-container-1',
      lifetime: 'forever',
    });

    await ContainerExtension.set('firefox-container-1', { uiIcon: 'play' });

    expect(storageData['containers.firefox-container-1']).toEqual({
      cookieStoreId: 'firefox-container-1',
      lifetime: 'forever',
    });
  });

  it('drops legacy uiIcon when patching extension-owned data', async () => {
    storageData['containers.firefox-container-2'] = {
      cookieStoreId: 'firefox-container-2',
      lifetime: 'forever',
      uiIcon: 'book',
      fingerprint: { seed: 7 },
    };

    await ContainerExtension.set('firefox-container-2', { lifetime: 'untilLastTab' });

    expect(storageData['containers.firefox-container-2']).toEqual({
      cookieStoreId: 'firefox-container-2',
      lifetime: 'untilLastTab',
      fingerprint: { seed: 7 },
    });
  });

  it('set patches lifetime and preserves existing fingerprint data', async () => {
    storageData['containers.firefox-container-2'] = {
      cookieStoreId: 'firefox-container-2',
      lifetime: 'forever',
      fingerprint: { seed: 7, values: {}, preferences: { enabled: true } },
    };

    await ContainerExtension.set('firefox-container-2', { lifetime: 'untilLastTab' });

    expect(storageData['containers.firefox-container-2']).toEqual({
      cookieStoreId: 'firefox-container-2',
      lifetime: 'untilLastTab',
      fingerprint: { seed: 7, values: {}, preferences: { enabled: true } },
    });
  });

  it('set removes undefined fields for child object cleanup', async () => {
    storageData['containers.firefox-container-2'] = {
      cookieStoreId: 'firefox-container-2',
      lifetime: 'forever',
      fingerprint: { seed: 7 },
    };

    await ContainerExtension.set('firefox-container-2', { fingerprint: undefined });

    expect(storageData['containers.firefox-container-2']).toEqual({
      cookieStoreId: 'firefox-container-2',
      lifetime: 'forever',
    });
  });

  it('shouldAutoDelete returns true only for untilLastTab lifetime', () => {
    expect(ContainerExtension.shouldAutoDelete({ lifetime: 'untilLastTab' })).toBe(true);
    expect(ContainerExtension.shouldAutoDelete({ lifetime: 'forever' })).toBe(false);
    expect(ContainerExtension.shouldAutoDelete(undefined)).toBe(false);
  });

  it('destroy removes the container extension key', async () => {
    storageData['containers.firefox-container-3'] = {
      cookieStoreId: 'firefox-container-3',
      lifetime: 'forever',
    };

    await ContainerExtension.destroy('firefox-container-3');

    expect(storageData['containers.firefox-container-3']).toBeUndefined();
    expect(browser.storage.local.remove).toHaveBeenCalledWith('containers.firefox-container-3');
  });

  it('migrate converts legacy lifetime preference keys and deletes sources', async () => {
    storageData = {
      'pref=containers.firefox-container-4.lifetime': { value: 'untilLastTab' },
    };

    await expect(ContainerExtension.migrate()).resolves.toBe(true);

    expect(storageData['containers.firefox-container-4']).toEqual({
      cookieStoreId: 'firefox-container-4',
      lifetime: 'untilLastTab',
    });
    expect(storageData['pref=containers.firefox-container-4.lifetime']).toBeUndefined();
  });

  it('migrate does not overwrite existing container extension data', async () => {
    storageData = {
      'containers.firefox-container-5': {
        cookieStoreId: 'firefox-container-5',
        lifetime: 'forever',
      },
      'pref=containers.firefox-container-5.lifetime': { value: 'untilLastTab' },
    };

    await expect(ContainerExtension.migrate()).resolves.toBe(true);

    expect(storageData['containers.firefox-container-5']).toEqual({
      cookieStoreId: 'firefox-container-5',
      lifetime: 'forever',
    });
    expect(storageData['pref=containers.firefox-container-5.lifetime']).toBeUndefined();
  });
});
