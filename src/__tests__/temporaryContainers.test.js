/**
 * temporaryContainers — owner-gate cleanup tests
 *
 * Verifies cleanUpTemporaryContainers and onTabRemoved only act on containers
 * containTAB owns (ContainerExtension.lifetime === 'untilLastTab'),
 * never on containers identified by name pattern alone.
 */

import { vi } from 'vitest';

vi.mock('../ContextualIdentity', () => ({
  default: {
    remove: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../ContainerExtension', () => ({
  default: {
    get: vi.fn().mockResolvedValue(undefined),
    shouldAutoDelete: vi.fn(ext => ext?.lifetime === 'untilLastTab'),
  },
}));

vi.mock('../containers', () => ({
  forgetNewTab: vi.fn(),
}));

import ContextualIdentities from '../ContextualIdentity';
import ContainerExtension from '../ContainerExtension';

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('temporaryContainers owner gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.browser = {
      contextualIdentities: {
        query: vi.fn().mockResolvedValue([]),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it('cleanUpTemporaryContainers leaves -NNN named containers without lifetime preference alone', async () => {
    global.browser.contextualIdentities.query.mockResolvedValue([
      { cookieStoreId: 'firefox-container-7', name: 'release-2025' },
      { cookieStoreId: 'firefox-container-8', name: 'youtube-001' },
    ]);
    global.browser.tabs.query.mockResolvedValue([]);
    ContainerExtension.get.mockResolvedValue(undefined);

    const { cleanUpTemporaryContainers } = await import('../temporaryContainers');
    await cleanUpTemporaryContainers();
    await flush();

    expect(ContextualIdentities.remove).not.toHaveBeenCalled();
  });

  it('cleanUpTemporaryContainers still removes containers with untilLastTab preference and zero tabs', async () => {
    global.browser.contextualIdentities.query.mockResolvedValue([
      { cookieStoreId: 'firefox-container-7', name: 'work' },
    ]);
    global.browser.tabs.query.mockResolvedValue([]);
    ContainerExtension.get.mockResolvedValue({
      cookieStoreId: 'firefox-container-7',
      lifetime: 'untilLastTab',
    });

    const { cleanUpTemporaryContainers } = await import('../temporaryContainers');
    await cleanUpTemporaryContainers();
    await flush();

    expect(ContextualIdentities.remove).toHaveBeenCalledWith('firefox-container-7');
  });

  it('onTabRemoved does not remove -NNN containers without lifetime preference', async () => {
    global.browser.contextualIdentities.query.mockResolvedValue([
      { cookieStoreId: 'firefox-container-9', name: 'project-001' },
    ]);
    global.browser.tabs.query.mockResolvedValue([]);
    ContainerExtension.get.mockResolvedValue(undefined);

    const { onTabRemoved } = await import('../temporaryContainers');
    await onTabRemoved(42);
    await flush();

    expect(ContextualIdentities.remove).not.toHaveBeenCalled();
  });

  it('onTabRemoved removes containers with untilLastTab preference and zero tabs', async () => {
    global.browser.contextualIdentities.query.mockResolvedValue([
      { cookieStoreId: 'firefox-container-9', name: 'temp' },
    ]);
    global.browser.tabs.query.mockResolvedValue([]);
    ContainerExtension.get.mockResolvedValue({
      cookieStoreId: 'firefox-container-9',
      lifetime: 'untilLastTab',
    });

    const { onTabRemoved } = await import('../temporaryContainers');
    await onTabRemoved(42);
    await flush();

    expect(ContextualIdentities.remove).toHaveBeenCalledWith('firefox-container-9');
  });
});
