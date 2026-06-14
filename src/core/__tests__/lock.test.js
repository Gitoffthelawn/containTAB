import { isLocked, isDefault, needsRedirect, isRedirectable, canNavigateTo, NO_CONTAINER_ID } from '../lock.js';

// Schema: Tab.schema.json x-invariants, AssignmentDecision.schema.json step_3b

describe('isLocked', () => {
  const existing = new Set(['firefox-container-1', 'firefox-container-42']);

  it('tab in existing container is locked', () => {
    expect(isLocked('firefox-container-1', existing)).toBe(true);
    expect(isLocked('firefox-container-42', existing)).toBe(true);
  });

  it('tab in default is not locked', () => {
    expect(isLocked('firefox-default', existing)).toBe(false);
  });

  it('orphan cookieStoreId (container deleted) is not locked', () => {
    expect(isLocked('firefox-container-999', existing)).toBe(false);
  });

  it('without existingContainerIds, falls back to non-default check', () => {
    expect(isLocked('firefox-container-1')).toBe(true);
    expect(isLocked('firefox-default')).toBe(false);
  });
});

describe('isDefault', () => {
  it('firefox-default is default', () => {
    expect(isDefault('firefox-default')).toBe(true);
  });

  it('container is not default', () => {
    expect(isDefault('firefox-container-1')).toBe(false);
  });
});

describe('needsRedirect', () => {
  it('different containers need redirect', () => {
    expect(needsRedirect('firefox-default', 'firefox-container-1')).toBe(true);
  });

  it('same container does not need redirect', () => {
    expect(needsRedirect('firefox-container-1', 'firefox-container-1')).toBe(false);
  });

  it('default to default does not need redirect', () => {
    expect(needsRedirect('firefox-default', 'firefox-default')).toBe(false);
  });
});

describe('isRedirectable', () => {
  const tab = (overrides = {}) => ({
    id: 1, incognito: false, ...overrides,
  });

  it('normal tab is redirectable', () => {
    expect(isRedirectable(tab(), {}, 'https://example.com')).toBe(true);
  });

  it('incognito tab is not redirectable', () => {
    expect(isRedirectable(tab({ incognito: true }), {}, 'https://example.com')).toBe(false);
  });

  it('tab being created with same URL is not redirectable', () => {
    const creating = { 1: 'https://example.com' };
    expect(isRedirectable(tab(), creating, 'https://example.com')).toBe(false);
  });

  it('tab being created with different URL is redirectable', () => {
    const creating = { 1: 'https://other.com' };
    expect(isRedirectable(tab(), creating, 'https://example.com')).toBe(true);
  });
});

describe('canNavigateTo', () => {
  it('always returns false (tabs are locked)', () => {
    expect(canNavigateTo()).toBe(false);
    expect(canNavigateTo('firefox-container-1')).toBe(false);
  });
});

describe('NO_CONTAINER_ID', () => {
  it('equals firefox-default', () => {
    expect(NO_CONTAINER_ID).toBe('firefox-default');
  });
});
