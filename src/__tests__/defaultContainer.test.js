import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ContextualIdentity', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
  },
}));

import ContextualIdentities from '../ContextualIdentity';
import { buildDefaultContainer } from '../defaultContainer';

describe('buildDefaultContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ContextualIdentities.getAll.mockResolvedValue([]);
    ContextualIdentities.create.mockImplementation((name, opts) => Promise.resolve({
      cookieStoreId: 'firefox-container-new',
      name,
      opts,
    }));
  });

  it('uses short domain-prefixed sequential names for bytab containers', async () => {
    ContextualIdentities.getAll.mockResolvedValue([
      { name: 'github-01', cookieStoreId: 'firefox-container-1' },
      { name: 'Work', cookieStoreId: 'firefox-container-2' },
      { name: 'github-02', cookieStoreId: 'firefox-container-3' },
      { name: 'youtube-01', cookieStoreId: 'firefox-container-4' },
    ]);

    await buildDefaultContainer({
      containerStrategy: 'one_tab_one_world',
      lifetime: 'untilLastTab',
    }, 'https://github.com/openai');

    expect(ContextualIdentities.create).toHaveBeenCalledWith('github-03', {
      lifetime: 'untilLastTab',
    });
  });

  it('keeps bytab sequence scoped to the URL domain', async () => {
    ContextualIdentities.getAll.mockResolvedValue([
      { name: 'github-01', cookieStoreId: 'firefox-container-1' },
      { name: 'youtube-01', cookieStoreId: 'firefox-container-2' },
    ]);

    await buildDefaultContainer({
      containerStrategy: 'one_tab_one_world',
      lifetime: 'untilLastTab',
    }, 'https://music.youtube.com/watch');

    expect(ContextualIdentities.create).toHaveBeenCalledWith('youtube-02', {
      lifetime: 'untilLastTab',
    });
  });

  it('keeps domain strategy names based on the URL domain', async () => {
    await buildDefaultContainer({
      containerStrategy: 'by_domain',
      lifetime: 'forever',
    }, 'https://docs.github.com/openai');

    expect(ContextualIdentities.getAll).not.toHaveBeenCalled();
    expect(ContextualIdentities.create).toHaveBeenCalledWith('github', {
      lifetime: 'forever',
    });
  });
});
