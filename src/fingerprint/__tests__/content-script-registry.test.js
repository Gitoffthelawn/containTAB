import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
const storage = {};

// Mock contentScripts.register — returns a handle with unregister()
const registeredScripts = [];
const unregisteredHandles = [];

// Mock contextualIdentities.query
let mockContainers = [];

global.browser = {
  storage: {
    local: {
      get: vi.fn(async (key) => {
        if (typeof key === 'string') return { [key]: storage[key] };
        return { ...storage };
      }),
      set: vi.fn(async (obj) => {
        Object.assign(storage, obj);
      }),
    },
  },
  runtime: {
    getURL: vi.fn((path) => `moz-extension://fake/${path}`),
  },
  contentScripts: {
    register: vi.fn(async (options) => {
      registeredScripts.push(options);
      const handle = {
        unregister: vi.fn(async () => {
          unregisteredHandles.push(handle);
        }),
      };
      return handle;
    }),
  },
  contextualIdentities: {
    query: vi.fn(async () => mockContainers),
  },
};

// Mock fetch for inject bundle
global.fetch = vi.fn(async (url) => ({
  ok: true,
  status: 200,
  text: async () => `// fake inject bundle for ${url}`,
}));

// Mock crypto
let mockSeedCounter = 2000;
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = mockSeedCounter++;
    return arr;
  }),
});

import {
  registerForContainer,
  unregisterForContainer,
  registerAll,
  _resetRegistry,
} from '../content-script-registry.js';
import { _resetCache as resetFpCache } from '../index.js';

describe('content-script-registry', () => {

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    storage.config = { experimental: { fingerprint: { enabled: true } } };
    _resetRegistry();
    resetFpCache();
    registeredScripts.length = 0;
    unregisteredHandles.length = 0;
    mockContainers = [];
    mockSeedCounter = 2000;
    vi.clearAllMocks();
  });

  it('registerForContainer loads inject bundle once', async () => {
    await registerForContainer('firefox-container-1');
    await registerForContainer('firefox-container-2');
    // fetch called exactly once (bundle cached)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('moz-extension://fake/inject/index.js');
  });

  it('registerForContainer calls contentScripts.register with config + inject source', async () => {
    await registerForContainer('firefox-container-1');
    expect(registeredScripts).toHaveLength(1);
    const opts = registeredScripts[0];
    expect(opts.matches).toEqual(['<all_urls>']);
    expect(opts.runAt).toBe('document_start');
    expect(opts.allFrames).toBe(true);
    expect(opts.cookieStoreId).toBe('firefox-container-1');
    expect(opts.js).toHaveLength(2);
    // first: config code sets __ctFingerprint
    expect(opts.js[0].code).toMatch(/^window\.__ctFingerprint = \{/);
    // second: inject source (from fetch mock)
    expect(opts.js[1].code).toContain('fake inject bundle');
  });

  it('firefox-default is skipped (no fingerprint for default)', async () => {
    await registerForContainer('firefox-default');
    expect(registeredScripts).toHaveLength(0);
  });

  it('global disabled gate skips registration before loading inject bundle', async () => {
    storage.config = { experimental: { fingerprint: { enabled: false } } };

    await registerForContainer('firefox-container-1');

    expect(registeredScripts).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('per-container disabled preference skips registration', async () => {
    storage['containers.firefox-container-1'] = {
      cookieStoreId: 'firefox-container-1',
      lifetime: 'forever',
      fingerprint: {
        cookieStoreId: 'firefox-container-1',
        seed: 123,
        values: {
          screen: { width: 1024 },
        },
        preferences: { enabled: false, cfSafe: false },
      },
    };

    await registerForContainer('firefox-container-1');

    expect(registeredScripts).toHaveLength(0);
  });

  it('re-registering same container unregisters old handle first', async () => {
    await registerForContainer('firefox-container-1');
    await registerForContainer('firefox-container-1');
    expect(registeredScripts).toHaveLength(2);
    expect(unregisteredHandles).toHaveLength(1);
  });

  it('different containers get different config codes', async () => {
    await registerForContainer('firefox-container-1');
    await registerForContainer('firefox-container-2');
    const code1 = registeredScripts[0].js[0].code;
    const code2 = registeredScripts[1].js[0].code;
    expect(code1).not.toBe(code2);
  });

  it('unregisterForContainer removes handle', async () => {
    await registerForContainer('firefox-container-1');
    await unregisterForContainer('firefox-container-1');
    expect(unregisteredHandles).toHaveLength(1);
    // unregister idempotent — second call is no-op
    await unregisterForContainer('firefox-container-1');
    expect(unregisteredHandles).toHaveLength(1);
  });

  it('registerAll walks existing containers', async () => {
    mockContainers = [
      { cookieStoreId: 'firefox-container-1', name: 'A' },
      { cookieStoreId: 'firefox-container-2', name: 'B' },
      { cookieStoreId: 'firefox-container-3', name: 'C' },
    ];
    await registerAll();
    expect(registeredScripts).toHaveLength(3);
    expect(registeredScripts.map(s => s.cookieStoreId).sort()).toEqual([
      'firefox-container-1',
      'firefox-container-2',
      'firefox-container-3',
    ]);
  });

  it('registerAll handles empty container list', async () => {
    mockContainers = [];
    await registerAll();
    expect(registeredScripts).toHaveLength(0);
  });

  it('config code contains serialized fingerprint fields', async () => {
    await registerForContainer('firefox-container-1');
    const code = registeredScripts[0].js[0].code;
    expect(code).toContain('"screen"');
    expect(code).toContain('"hardwareConcurrency"');
    expect(code).toContain('"timezoneOffset"');
    expect(code).toContain('"languages"');
    expect(code).toContain('"noiseSeed"');
  });

});
