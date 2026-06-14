import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock exportFunction: return the fn as-is (simulating export)
global.exportFunction = vi.fn((fn) => fn);

// Mock cloneInto: return value as-is
global.cloneInto = vi.fn((value) => value);

// Mock stealth markNative
vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installNavigatorSpoofer } from '../navigator.js';
import { markNative } from '../../stealth.js';

describe('navigator spoofer', () => {

  let pageWindow;
  let navProto;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Navigator.prototype as a plain object we can inspect
    navProto = {};
    pageWindow = {
      Navigator: { prototype: navProto },
    };
  });

  const sampleConfig = {
    navigator: {
      userAgent: 'Mozilla/5.0 Windows Firefox/128.0',
      platform: 'Win32',
      vendor: '',
      appVersion: '5.0 (Windows)',
    },
    hardwareConcurrency: 8,
    deviceMemory: 16,
    languages: ['en-US', 'en'],
  };

  it('defines userAgent getter that returns config value', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    const desc = Object.getOwnPropertyDescriptor(navProto, 'userAgent');
    expect(desc).toBeDefined();
    expect(desc.configurable).toBe(true);
    expect(desc.enumerable).toBe(true);
    expect(desc.get()).toBe('Mozilla/5.0 Windows Firefox/128.0');
  });

  it('defines all primitive navigator fields', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    const fields = [
      'userAgent', 'platform', 'vendor', 'appVersion',
      'hardwareConcurrency', 'deviceMemory',
      'languages', 'language',
      'plugins', 'mimeTypes', 'webdriver',
    ];
    for (const field of fields) {
      expect(Object.getOwnPropertyDescriptor(navProto, field)).toBeDefined();
    }
  });

  it('hardwareConcurrency getter returns config value', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    expect(navProto.hardwareConcurrency).toBe(8);
  });

  it('languages getter returns cloned array', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    expect(navProto.languages).toEqual(['en-US', 'en']);
    expect(global.cloneInto).toHaveBeenCalledWith(['en-US', 'en'], pageWindow);
  });

  it('language getter returns first of languages', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    expect(navProto.language).toBe('en-US');
  });

  it('plugins and mimeTypes return empty arrays', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    expect(navProto.plugins).toEqual([]);
    expect(navProto.mimeTypes).toEqual([]);
  });

  it('webdriver always false', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    expect(navProto.webdriver).toBe(false);
  });

  it('markNative called for each getter with "get X" name', () => {
    installNavigatorSpoofer(pageWindow, sampleConfig);
    const calls = markNative.mock.calls.map((c) => c[1]);
    expect(calls).toContain('get userAgent');
    expect(calls).toContain('get hardwareConcurrency');
    expect(calls).toContain('get languages');
  });

});
