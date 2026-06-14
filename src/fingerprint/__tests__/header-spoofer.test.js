import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser APIs
const storage = {};
const addedListeners = [];

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
    register: vi.fn(async () => ({ unregister: vi.fn(async () => {}) })),
  },
  contextualIdentities: {
    query: vi.fn(async () => []),
  },
  webRequest: {
    onBeforeSendHeaders: {
      addListener: vi.fn((listener, filter, extra) => {
        addedListeners.push({ listener, filter, extra });
      }),
    },
  },
};

global.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => '// fake inject',
}));

let mockSeedCounter = 7000;
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = mockSeedCounter++;
    return arr;
  }),
});

import {
  formatAcceptLanguage,
  modifyHeaders,
  headerListener,
  installHeaderSpoofer,
} from '../header-spoofer.js';
import { _resetCache as resetFpCache } from '../index.js';
import { _resetRegistry } from '../content-script-registry.js';

describe('header-spoofer', () => {

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    storage.config = { experimental: { fingerprint: { enabled: true } } };
    resetFpCache();
    _resetRegistry();
    addedListeners.length = 0;
    mockSeedCounter = 7000;
    vi.clearAllMocks();
  });

  describe('formatAcceptLanguage', () => {
    it('single language returns plain', () => {
      expect(formatAcceptLanguage(['en-US'], 'firefox')).toBe('en-US');
    });

    it('Firefox multi-language with q=0.5 base', () => {
      const result = formatAcceptLanguage(['en-US', 'en'], 'firefox');
      expect(result).toBe('en-US,en;q=0.5');
    });

    it('Chrome multi-language with q=0.9 base', () => {
      const result = formatAcceptLanguage(['en-US', 'en'], 'chrome');
      expect(result).toBe('en-US,en;q=0.9');
    });

    it('three languages descending q', () => {
      const result = formatAcceptLanguage(['de-DE', 'de', 'en'], 'firefox');
      expect(result).toBe('de-DE,de;q=0.5,en;q=0.4');
    });

    it('empty array returns fallback', () => {
      expect(formatAcceptLanguage([], 'firefox')).toBe('en-US,en;q=0.5');
    });
  });

  describe('modifyHeaders', () => {
    const config = {
      navigator: {
        userAgent: 'Mozilla/5.0 Fake UA',
        browser: 'firefox',
      },
      languages: ['de-DE', 'de', 'en'],
    };

    it('replaces User-Agent', () => {
      const headers = [{ name: 'User-Agent', value: 'old' }];
      modifyHeaders(headers, config);
      expect(headers[0].value).toBe('Mozilla/5.0 Fake UA');
    });

    it('replaces Accept-Language', () => {
      const headers = [{ name: 'Accept-Language', value: 'en-US' }];
      modifyHeaders(headers, config);
      expect(headers[0].value).toBe('de-DE,de;q=0.5,en;q=0.4');
    });

    it('is case-insensitive on header name', () => {
      const headers = [
        { name: 'USER-AGENT', value: 'old' },
        { name: 'accept-language', value: 'old' },
      ];
      modifyHeaders(headers, config);
      expect(headers[0].value).toBe('Mozilla/5.0 Fake UA');
      expect(headers[1].value).toBe('de-DE,de;q=0.5,en;q=0.4');
    });

    it('leaves unknown headers untouched', () => {
      const headers = [{ name: 'Cookie', value: 'abc' }];
      modifyHeaders(headers, config);
      expect(headers[0].value).toBe('abc');
    });
  });

  describe('headerListener', () => {
    it('returns {} for firefox-default', async () => {
      const result = await headerListener({
        cookieStoreId: 'firefox-default',
        requestHeaders: [{ name: 'User-Agent', value: 'real' }],
      });
      expect(result).toEqual({});
    });

    it('returns {} when no cookieStoreId', async () => {
      const result = await headerListener({
        requestHeaders: [{ name: 'User-Agent', value: 'real' }],
      });
      expect(result).toEqual({});
    });

    it('returns {} when global fingerprint gate is disabled', async () => {
      storage.config = { experimental: { fingerprint: { enabled: false } } };

      const result = await headerListener({
        cookieStoreId: 'firefox-container-1',
        requestHeaders: [{ name: 'User-Agent', value: 'real' }],
      });

      expect(result).toEqual({});
    });

    it('returns {} when per-container fingerprint preference is disabled', async () => {
      storage['containers.firefox-container-1'] = {
        cookieStoreId: 'firefox-container-1',
        lifetime: 'forever',
        fingerprint: {
          cookieStoreId: 'firefox-container-1',
          seed: 123,
          values: {
            navigator: {
              userAgent: 'Mozilla/5.0 Fake UA',
              browser: 'firefox',
            },
            languages: ['en-US', 'en'],
          },
          preferences: { enabled: false, cfSafe: false },
        },
      };

      const result = await headerListener({
        cookieStoreId: 'firefox-container-1',
        requestHeaders: [{ name: 'User-Agent', value: 'real' }],
      });

      expect(result).toEqual({});
    });

    it('rewrites headers for a real container', async () => {
      const result = await headerListener({
        cookieStoreId: 'firefox-container-1',
        requestHeaders: [
          { name: 'User-Agent', value: 'real' },
          { name: 'Accept-Language', value: 'real' },
        ],
      });
      expect(result.requestHeaders).toBeDefined();
      const ua = result.requestHeaders.find((h) => h.name === 'User-Agent');
      expect(ua.value).not.toBe('real');
      expect(ua.value).toContain('Mozilla');
    });

    it('same container returns consistent UA across calls', async () => {
      const call = () => headerListener({
        cookieStoreId: 'firefox-container-1',
        requestHeaders: [{ name: 'User-Agent', value: 'real' }],
      });
      const a = await call();
      const b = await call();
      expect(a.requestHeaders[0].value).toBe(b.requestHeaders[0].value);
    });

    it('different containers return different UAs (eventually)', async () => {
      const get = async (id) => {
        const r = await headerListener({
          cookieStoreId: id,
          requestHeaders: [{ name: 'User-Agent', value: 'real' }],
        });
        return r.requestHeaders[0].value;
      };
      // Try several containers; at least one pair should differ
      const uas = await Promise.all([
        get('firefox-container-1'),
        get('firefox-container-2'),
        get('firefox-container-3'),
        get('firefox-container-4'),
      ]);
      const unique = new Set(uas);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('installHeaderSpoofer', () => {
    it('registers webRequest listener with correct filter and extras', () => {
      installHeaderSpoofer();
      expect(addedListeners).toHaveLength(1);
      const entry = addedListeners[0];
      expect(entry.filter).toEqual({ urls: ['<all_urls>'] });
      expect(entry.extra).toEqual(['blocking', 'requestHeaders']);
    });
  });

});
