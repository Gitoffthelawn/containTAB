/**
 * containers.js — handle() 集成測試
 *
 * 驗證三條核心邏輯：
 *   1. URL match rule → 進 rule 的共享容器
 *   2. URL not match → 建新隔離容器
 *   3. 已在容器 → 鎖死
 */

import { vi } from 'vitest';

// --- mock modules (factories cannot reference outer scope) ---

vi.mock('../Storage/HostStorage', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../ContextualIdentity', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
    ]),
    create: vi.fn().mockResolvedValue({ cookieStoreId: 'firefox-container-99', name: 'new' }),
  },
  NO_CONTAINER: { name: 'No Container', cookieStoreId: 'firefox-default' },
}));

vi.mock('../Tabs', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      id: 1, url: 'https://github.com', cookieStoreId: 'firefox-default',
      incognito: false, active: true, pinned: false, discarded: false,
      isInReaderMode: false, index: 0, openerTabId: undefined,
    }),
    create: vi.fn().mockResolvedValue({ id: 100 }),
    remove: vi.fn().mockResolvedValue(),
    update: vi.fn().mockResolvedValue(),
  },
}));

const { defaultConfig } = vi.hoisted(() => ({
  defaultConfig: {
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
  },
}));

vi.mock('../GlobalConfig', () => ({
  default: {
    get: vi.fn().mockResolvedValue(defaultConfig),
    migrate: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../ContainerExtension', () => ({
  default: {
    migrate: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../defaultContainer', () => ({
  buildDefaultContainer: vi.fn().mockResolvedValue({
    cookieStoreId: 'firefox-container-50',
    name: 'github.com-001',
  }),
}));

// import after mocks
import Storage from '../Storage/HostStorage';
import ContextualIdentity from '../ContextualIdentity';
import Tabs from '../Tabs';
import GlobalConfig from '../GlobalConfig';
import { buildDefaultContainer } from '../defaultContainer';
import { webRequestListener, tabUpdatedListener } from '../containers';

// helper
const defaultTab = (overrides = {}) => ({
  id: 1, url: 'https://github.com', cookieStoreId: 'firefox-default',
  incognito: false, active: true, pinned: false, discarded: false,
  isInReaderMode: false, index: 0, openerTabId: undefined,
  ...overrides,
});

const fireRequest = (url, tabId = 1) =>
  webRequestListener({ url, tabId, frameId: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  Tabs.get.mockResolvedValue(defaultTab());
  GlobalConfig.get.mockResolvedValue(defaultConfig);
  Storage.getAll.mockResolvedValue({});
  ContextualIdentity.getAll.mockResolvedValue([
    { name: 'No Container', cookieStoreId: 'firefox-default' },
  ]);
});

// ─── 核心邏輯 1：match rule → 共享容器 ─────────────────

describe('Rule match → shared container', () => {
  it('match rule → redirect to rule container', async () => {
    Storage.getAll.mockResolvedValue({
      'github.com': {
        host: 'github.com', cookieStoreId: 'firefox-container-1',
        containerName: 'GitHub', enabled: true,
      },
    });
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
      { name: 'GitHub', cookieStoreId: 'firefox-container-1' },
    ]);

    const result = await fireRequest('https://github.com/repo');
    expect(result).toEqual({ cancel: true });
  });

  it('same rule, different URLs → same container', async () => {
    const rule = {
      host: '*.github.com', cookieStoreId: 'firefox-container-1',
      containerName: 'GitHub', enabled: true,
    };
    Storage.getAll.mockResolvedValue({ '*.github.com': rule });
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
      { name: 'GitHub', cookieStoreId: 'firefox-container-1' },
    ]);

    const r1 = await fireRequest('https://docs.github.com');
    const r2 = await fireRequest('https://api.github.com');
    expect(r1).toEqual({ cancel: true });
    expect(r2).toEqual({ cancel: true });
  });

  it('rule container deleted → re-create and update rule', async () => {
    Storage.getAll.mockResolvedValue({
      'github.com': {
        host: 'github.com', cookieStoreId: 'firefox-container-dead',
        containerName: 'GitHub', enabled: true,
      },
    });
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
    ]);
    ContextualIdentity.create.mockResolvedValue({
      cookieStoreId: 'firefox-container-new', name: 'GitHub',
    });

    const result = await fireRequest('https://github.com');
    expect(result).toEqual({ cancel: true });
    expect(ContextualIdentity.create).toHaveBeenCalledWith('GitHub');
    expect(Storage.set).toHaveBeenCalledWith(
      expect.objectContaining({ cookieStoreId: 'firefox-container-new' }),
    );
  });
});

// ─── 核心邏輯 2：no match → 建新隔離容器 ────────────────

describe('No match → new isolated container', () => {
  it('no match + defaultContainer on → buildDefaultContainer', async () => {
    GlobalConfig.get.mockResolvedValue({
      ...defaultConfig,
      defaultContainer: { ...defaultConfig.defaultContainer, enabled: true },
    });

    const result = await fireRequest('https://random-site.com');
    expect(buildDefaultContainer).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
      'https://random-site.com',
    );
    expect(result).toEqual({ cancel: true });
  });

  it('no match + defaultContainer off → skip', async () => {
    GlobalConfig.get.mockResolvedValue({
      ...defaultConfig,
      defaultContainer: { ...defaultConfig.defaultContainer, enabled: false },
    });

    const result = await fireRequest('https://random-site.com');
    expect(buildDefaultContainer).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});

// ─── 核心邏輯 3：已在容器 → 鎖死 ───────────────────────

describe('Already in container → locked', () => {
  it('tab in container → no match, no redirect', async () => {
    Tabs.get.mockResolvedValue(
      defaultTab({ cookieStoreId: 'firefox-container-1' }),
    );
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
      { name: 'Work', cookieStoreId: 'firefox-container-1' },
    ]);
    Storage.getAll.mockResolvedValue({
      'github.com': {
        host: 'github.com', cookieStoreId: 'firefox-container-2',
        containerName: 'Other', enabled: true,
      },
    });

    const result = await fireRequest('https://github.com');
    expect(result).toEqual({});
    expect(Storage.getAll).not.toHaveBeenCalled();
  });

  it('navigate to different URL inside container → still locked', async () => {
    Tabs.get.mockResolvedValue(
      defaultTab({ cookieStoreId: 'firefox-container-1' }),
    );
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
      { name: 'Work', cookieStoreId: 'firefox-container-1' },
    ]);

    const result = await fireRequest('https://example.com');
    expect(result).toEqual({});
    expect(Storage.getAll).not.toHaveBeenCalled();
    expect(buildDefaultContainer).not.toHaveBeenCalled();
  });

  it('orphan cookieStoreId (container deleted) → falls through to rebuild', async () => {
    Tabs.get.mockResolvedValue(
      defaultTab({ cookieStoreId: 'firefox-container-999' }),
    );
    ContextualIdentity.getAll.mockResolvedValue([
      { name: 'No Container', cookieStoreId: 'firefox-default' },
    ]);
    GlobalConfig.get.mockResolvedValue({
      ...defaultConfig,
      defaultContainer: { ...defaultConfig.defaultContainer, enabled: true },
    });

    const result = await fireRequest('https://github.com');
    expect(buildDefaultContainer).toHaveBeenCalled();
    expect(result).toEqual({ cancel: true });
  });
});

// ─── Edge cases ─────────────────────────────────────────

describe('Edge cases', () => {
  it('about: URL → skip', async () => {
    const result = await fireRequest('about:blank');
    expect(result).toEqual({});
    expect(Tabs.get).not.toHaveBeenCalled();
  });

  it('moz-extension: URL → skip', async () => {
    const result = await fireRequest('moz-extension://uuid/page.html');
    expect(result).toEqual({});
  });

  it('incognito tab → skip', async () => {
    Tabs.get.mockResolvedValue(defaultTab({ incognito: true }));

    const result = await fireRequest('https://github.com');
    expect(result).toEqual({});
    expect(Storage.getAll).not.toHaveBeenCalled();
  });

  it('sub-frame → skip', () => {
    const result = webRequestListener({ url: 'https://github.com', tabId: 1, frameId: 5 });
    expect(result).toEqual({});
  });

  it('tabId -1 → skip', () => {
    const result = webRequestListener({ url: 'https://github.com', tabId: -1, frameId: 0 });
    expect(result).toEqual({});
  });

  it('tabUpdated without URL change → skip', () => {
    const result = tabUpdatedListener(1, { status: 'complete' });
    expect(result).toBeUndefined();
  });
});
