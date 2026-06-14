import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import applyTheme from '../applyTheme';

describe('applyTheme', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
    global.document = dom.window.document;
  });

  it('system removes data-theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('light sets data-theme=light', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('dark sets data-theme=dark', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('unknown value falls back to system (no attribute)', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme('bogus');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('is idempotent on repeated calls', () => {
    applyTheme('dark');
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
