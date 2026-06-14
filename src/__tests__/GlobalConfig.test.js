import { beforeEach, describe, expect, it, vi } from 'vitest';

let GlobalConfig;
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

  const mod = await import('../GlobalConfig.js');
  GlobalConfig = mod.default;
});

describe('GlobalConfig', () => {
  it('get returns schema defaults when config is absent', async () => {
    await expect(GlobalConfig.get()).resolves.toEqual({
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
    });
  });

  it('set deep-merges partial data into config', async () => {
    await GlobalConfig.set({
      defaultContainer: {
        enabled: false,
        containerStrategy: 'by_host',
      },
    });

    expect(storageData.config.defaultContainer).toEqual({
      enabled: false,
      containerStrategy: 'by_host',
      lifetime: 'untilLastTab',
      ruleAddition: '*.{domain}.*',
    });
  });

  it('reset removes the config key', async () => {
    storageData.config = { theme: 'dark' };

    await GlobalConfig.reset();

    expect(storageData.config).toBeUndefined();
    expect(browser.storage.local.remove).toHaveBeenCalledWith('config');
  });

  it('migrate writes config from legacy pref keys and removes source keys', async () => {
    storageData = {
      'pref=keepOldTabs': { value: true },
      'pref=theme': { value: 'dark' },
      'pref=defaultContainer': { value: false },
      'pref=defaultContainer.containerStrategy': { value: 'by_domain' },
      'pref=defaultContainer.lifetime': { value: 'forever' },
      'pref=defaultContainer.ruleAddition': { value: '' },
    };

    await expect(GlobalConfig.migrate()).resolves.toBe(true);

    expect(storageData.config).toEqual({
      keepOldTabs: true,
      matchDomainOnly: false,
      theme: 'dark',
      defaultContainer: {
        enabled: false,
        containerStrategy: 'by_domain',
        lifetime: 'forever',
        ruleAddition: '',
      },
      experimental: {
        fingerprint: {
          enabled: false,
        },
      },
    });
    expect(storageData['pref=keepOldTabs']).toBeUndefined();
    expect(storageData['pref=defaultContainer']).toBeUndefined();
  });

  it('migrate skips legacy keys when config already exists', async () => {
    storageData = {
      config: { theme: 'light' },
      'pref=theme': { value: 'dark' },
    };

    await expect(GlobalConfig.migrate()).resolves.toBe(false);

    expect(storageData.config).toEqual({ theme: 'light' });
    expect(storageData['pref=theme']).toEqual({ value: 'dark' });
  });

  it('get normalizes invalid stored enum values back to defaults', async () => {
    storageData.config = {
      theme: 'neon',
      defaultContainer: {
        containerStrategy: 'raw_template',
        lifetime: 'session',
      },
    };

    const config = await GlobalConfig.get();

    expect(config.theme).toBe('system');
    expect(config.defaultContainer.containerStrategy).toBe('one_tab_one_world');
    expect(config.defaultContainer.lifetime).toBe('untilLastTab');
  });
});
