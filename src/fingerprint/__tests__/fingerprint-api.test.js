import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser.storage.local + runtime + contentScripts + contextualIdentities
// (onContainerCreated/Removed now calls the content-script-registry.)
const storage = {};
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
    register: vi.fn(async () => ({
      unregister: vi.fn(async () => {}),
    })),
  },
  contextualIdentities: {
    query: vi.fn(async () => []),
  },
};

// Mock fetch for inject bundle
global.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => '// fake inject bundle',
}));

let mockSeedCounter = 5000;
const mockGetRandomValues = vi.fn((arr) => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = mockSeedCounter++;
  }
  return arr;
});
vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues });

import {
  getFingerprint,
  onContainerCreated,
  onContainerRemoved,
  _resetCache,
} from '../index.js';
import { _resetRegistry } from '../content-script-registry.js';

describe('fingerprint API', () => {

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    storage.config = { experimental: { fingerprint: { enabled: true } } };
    _resetCache();
    _resetRegistry();
    mockSeedCounter = 5000;
    vi.clearAllMocks();
  });

  it('getFingerprint returns seed + config + prng', async () => {
    const fp = await getFingerprint('firefox-container-1');
    expect(fp).toHaveProperty('seed');
    expect(fp).toHaveProperty('config');
    expect(fp).toHaveProperty('prng');
    expect(typeof fp.seed).toBe('number');
    expect(typeof fp.config.screen.width).toBe('number');
    expect(typeof fp.prng.nextFloat).toBe('function');
  });

  it('same container returns cached result', async () => {
    const a = await getFingerprint('firefox-container-1');
    const b = await getFingerprint('firefox-container-1');
    expect(a).toBe(b); // same reference
  });

  it('different containers return different fingerprints', async () => {
    const a = await getFingerprint('firefox-container-1');
    const b = await getFingerprint('firefox-container-2');
    expect(a.seed).not.toBe(b.seed);
  });

  it('onContainerCreated pre-generates fingerprint', async () => {
    await onContainerCreated('firefox-container-3');
    expect(storage['containers.firefox-container-3'].fingerprint).toBeDefined();
    // should be cached now
    const fp = await getFingerprint('firefox-container-3');
    expect(fp.seed).toBe(5000); // first seed generated
  });

  it('onContainerRemoved clears cache and storage', async () => {
    await getFingerprint('firefox-container-1');
    expect(storage['containers.firefox-container-1'].fingerprint).toBeDefined();
    await onContainerRemoved('firefox-container-1');
    expect(storage['containers.firefox-container-1'].fingerprint).toBeUndefined();

    // cache cleared — next call generates new seed
    mockSeedCounter = 9000;
    const fp = await getFingerprint('firefox-container-1');
    expect(fp.seed).toBe(9000); // new seed, not old
  });

  it('config is deterministic from seed', async () => {
    const fp1 = await getFingerprint('firefox-container-1');
    const seed = fp1.seed;

    // reset everything and re-populate storage with same seed
    _resetCache();
    storage['containers.firefox-container-1'] = {
      cookieStoreId: 'firefox-container-1',
      lifetime: 'forever',
      fingerprint: {
        cookieStoreId: 'firefox-container-1',
        seed,
        values: fp1.config,
        preferences: { enabled: true, cfSafe: false },
      },
    };

    const fp2 = await getFingerprint('firefox-container-1');
    expect(fp2.config).toEqual(fp1.config);
  });

  it('onContainerCreated is bypassed when experimental gate is disabled', async () => {
    storage.config = { experimental: { fingerprint: { enabled: false } } };

    await onContainerCreated('firefox-container-9');

    expect(storage['containers.firefox-container-9']).toBeUndefined();
    expect(browser.contentScripts.register).not.toHaveBeenCalled();
  });

});
