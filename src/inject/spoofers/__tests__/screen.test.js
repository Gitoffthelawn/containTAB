import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);
global.cloneInto = vi.fn((value) => value);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installScreenSpoofer } from '../screen.js';

describe('screen spoofer', () => {
  let pageWindow;
  let screenProto;

  beforeEach(() => {
    vi.clearAllMocks();
    screenProto = {};
    pageWindow = {
      Screen: { prototype: screenProto },
      matchMedia: vi.fn(() => ({ matches: false, media: '' })),
    };
  });

  const config = {
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 2,
    },
  };

  it('defines all Screen.prototype getters', () => {
    installScreenSpoofer(pageWindow, config);
    const fields = ['width', 'height', 'availWidth', 'availHeight', 'availLeft', 'availTop', 'colorDepth', 'pixelDepth'];
    for (const field of fields) {
      expect(Object.getOwnPropertyDescriptor(screenProto, field)).toBeDefined();
    }
  });

  it('width / height getters return config values', () => {
    installScreenSpoofer(pageWindow, config);
    expect(screenProto.width).toBe(1920);
    expect(screenProto.height).toBe(1080);
    expect(screenProto.availHeight).toBe(1040);
  });

  it('availLeft and availTop are 0', () => {
    installScreenSpoofer(pageWindow, config);
    expect(screenProto.availLeft).toBe(0);
    expect(screenProto.availTop).toBe(0);
  });

  it('defines devicePixelRatio on pageWindow', () => {
    installScreenSpoofer(pageWindow, config);
    expect(pageWindow.devicePixelRatio).toBe(2);
  });

  it('patches matchMedia for resolution query', () => {
    installScreenSpoofer(pageWindow, config);
    const result = pageWindow.matchMedia('(resolution: 2dppx)');
    expect(result.matches).toBe(true);
  });

  it('matchMedia min-resolution check', () => {
    installScreenSpoofer(pageWindow, config);
    expect(pageWindow.matchMedia('(min-resolution: 1dppx)').matches).toBe(true);
    expect(pageWindow.matchMedia('(min-resolution: 3dppx)').matches).toBe(false);
  });

  it('matchMedia device-pixel-ratio query', () => {
    installScreenSpoofer(pageWindow, config);
    expect(pageWindow.matchMedia('(device-pixel-ratio: 2)').matches).toBe(true);
    expect(pageWindow.matchMedia('(min-device-pixel-ratio: 1)').matches).toBe(true);
    expect(pageWindow.matchMedia('(max-device-pixel-ratio: 1)').matches).toBe(false);
  });

  it('matchMedia falls through for non-resolution queries', () => {
    const orig = vi.fn(() => ({ matches: true, media: 'orig' }));
    pageWindow.matchMedia = orig;
    installScreenSpoofer(pageWindow, config);
    const result = pageWindow.matchMedia('(prefers-color-scheme: dark)');
    expect(orig).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(result.media).toBe('orig');
  });
});
