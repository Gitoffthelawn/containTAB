import { decide, toWebRequestResult } from '../assignmentDecision.js';

const config = (overrides = {}) => ({
  keepOldTabs: false,
  defaultContainer: {
    enabled: true,
  },
  ...overrides,
});

const tab = (overrides = {}) => ({
  id: 1,
  cookieStoreId: 'firefox-default',
  incognito: false,
  ...overrides,
});

const identities = [
  { name: 'No Container', cookieStoreId: 'firefox-default' },
  { name: 'Work', cookieStoreId: 'firefox-container-1' },
];

describe('decide', () => {
  it('skips ignored URLs', () => {
    expect(decide('about:blank', tab(), [], config(), { identities })).toEqual({
      action: 'skip',
      reason: 'ignored_url',
      matched: false,
      effects: ['none'],
    });
  });

  it('skips self-created tabs', () => {
    expect(decide('https://example.com', tab(), [], config(), {
      identities,
      creatingTabs: { 1: 'https://example.com' },
    })).toEqual({
      action: 'skip',
      reason: 'self_created_tab',
      matched: false,
      effects: ['none'],
    });
  });

  it('skips incognito tabs', () => {
    expect(decide('https://example.com', tab({ incognito: true }), [], config(), { identities }))
      .toEqual({
        action: 'skip',
        reason: 'incognito',
        matched: false,
        effects: ['none'],
      });
  });

  it('skips locked existing container tabs', () => {
    expect(decide('https://example.com', tab({ cookieStoreId: 'firefox-container-1' }), [], config(), { identities }))
      .toEqual({
        action: 'skip',
        reason: 'locked_container',
        matched: false,
        effects: ['none'],
      });
  });

  it('redirects to an existing matched rule target', () => {
    const rule = {
      host: 'github.com',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    };

    expect(decide('https://github.com/repo', tab(), [rule], config(), { identities }))
      .toEqual({
        action: 'redirect',
        reason: 'rule_target_different',
        matched: true,
        rule,
        targetContainer: { name: 'Work', cookieStoreId: 'firefox-container-1' },
        effects: ['create_tab', 'remove_old_tab'],
      });
  });

  it('keeps when matched rule target already equals current tab container', () => {
    const rule = {
      host: 'github.com',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    };

    expect(decide('https://github.com/repo', tab({ cookieStoreId: 'firefox-container-1' }), [rule], config(), {
      identities,
      skipLock: true,
    })).toEqual({
      action: 'keep',
      reason: 'rule_target_same',
      matched: true,
      rule,
      targetContainer: { name: 'Work', cookieStoreId: 'firefox-container-1' },
      effects: ['none'],
    });
  });

  it('rebinds when matched rule has a missing target container', () => {
    const rule = {
      host: 'github.com',
      cookieStoreId: 'firefox-container-dead',
      containerName: 'Work',
      enabled: true,
    };

    expect(decide('https://github.com/repo', tab(), [rule], config(), { identities }))
      .toEqual({
        action: 'rebind',
        reason: 'rule_target_missing',
        matched: true,
        rule,
        effects: ['create_container', 'update_rule', 'create_tab', 'remove_old_tab'],
      });
  });

  it('creates a default container when no rule matches and default container is enabled', () => {
    expect(decide('https://random-site.com', tab(), [], config(), { identities }))
      .toEqual({
        action: 'create',
        reason: 'default_container_enabled',
        matched: false,
        effects: ['create_container', 'create_tab', 'remove_old_tab'],
      });
  });

  it('skips when no rule matches and default container is disabled', () => {
    expect(decide('https://random-site.com', tab(), [], config({
      defaultContainer: { enabled: false },
    }), { identities })).toEqual({
      action: 'skip',
      reason: 'default_container_disabled',
      matched: false,
      effects: ['none'],
    });
  });
});

describe('toWebRequestResult', () => {
  it('cancels only decisions that create replacement tabs', () => {
    expect(toWebRequestResult({ action: 'redirect', effects: ['create_tab'] })).toEqual({ cancel: true });
    expect(toWebRequestResult({ action: 'skip', effects: ['none'] })).toEqual({});
  });
});
