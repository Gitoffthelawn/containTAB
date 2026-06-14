import { describe, it, expect } from 'vitest';
import {
  generateFingerprint,
  SCREEN_PAIRS, CORES, MEMORY, DPR, TZ_OFFSETS, LANGUAGE_SETS,
  PLATFORMS, VENDORS, APP_VERSIONS, UA_VERSIONS,
} from '../fingerprint-generator.js';

describe('generateFingerprint', () => {

  it('same seed produces identical fingerprint', () => {
    const a = generateFingerprint(42);
    const b = generateFingerprint(42);
    expect(a).toEqual(b);
  });

  it('different seeds produce different fingerprints', () => {
    const a = generateFingerprint(1);
    const b = generateFingerprint(2);
    // at least one field differs
    const differs = (
      a.screen.width !== b.screen.width ||
      a.hardwareConcurrency !== b.hardwareConcurrency ||
      a.timezoneOffset !== b.timezoneOffset ||
      a.languages[0] !== b.languages[0] ||
      a.noiseSeed !== b.noiseSeed
    );
    expect(differs).toBe(true);
  });

  it('screen resolution is a valid pair', () => {
    const fp = generateFingerprint(100);
    const pair = [fp.screen.width, fp.screen.height];
    expect(SCREEN_PAIRS).toContainEqual(pair);
  });

  it('availHeight < height (taskbar offset)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const fp = generateFingerprint(seed);
      expect(fp.screen.availHeight).toBeLessThan(fp.screen.height);
      const diff = fp.screen.height - fp.screen.availHeight;
      expect(diff).toBeGreaterThanOrEqual(25);
      expect(diff).toBeLessThanOrEqual(50);
    }
  });

  it('availWidth equals width', () => {
    const fp = generateFingerprint(100);
    expect(fp.screen.availWidth).toBe(fp.screen.width);
  });

  it('hardwareConcurrency is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(CORES).toContain(generateFingerprint(seed).hardwareConcurrency);
    }
  });

  it('deviceMemory is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(MEMORY).toContain(generateFingerprint(seed).deviceMemory);
    }
  });

  it('devicePixelRatio is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(DPR).toContain(generateFingerprint(seed).screen.devicePixelRatio);
    }
  });

  it('navigator.platform is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(PLATFORMS).toContain(generateFingerprint(seed).navigator.platform);
    }
  });

  it('navigator.vendor is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(VENDORS).toContain(generateFingerprint(seed).navigator.vendor);
    }
  });

  it('navigator.appVersion is from valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(APP_VERSIONS).toContain(generateFingerprint(seed).navigator.appVersion);
    }
  });

  it('navigator.userAgent is a non-empty string containing Mozilla/5.0', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ua = generateFingerprint(seed).navigator.userAgent;
      expect(ua).toMatch(/^Mozilla\/5\.0 \(/);
    }
  });

  it('navigator fields are self-consistent (tree-constrained)', () => {
    // UA OS token must match platform and appVersion.
    for (let seed = 0; seed < 200; seed++) {
      const fp = generateFingerprint(seed);
      const { userAgent, platform, appVersion } = fp.navigator;
      if (/Windows NT/.test(userAgent)) {
        expect(platform).toBe('Win32');
        expect(appVersion).toBe('5.0 (Windows)');
      } else if (/Macintosh/.test(userAgent)) {
        expect(platform).toBe('MacIntel');
        expect(appVersion).toBe('5.0 (Macintosh)');
      } else if (/X11/.test(userAgent)) {
        expect(platform).toBe('Linux x86_64');
        expect(appVersion).toBe('5.0 (X11)');
      } else {
        throw new Error(`unexpected UA: ${userAgent}`);
      }
    }
  });

  it('navigator.vendor matches browser family (Firefox=empty, Chrome=Google Inc.)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const fp = generateFingerprint(seed);
      const { userAgent, vendor } = fp.navigator;
      if (/Chrome\//.test(userAgent)) {
        expect(vendor).toBe('Google Inc.');
      } else {
        expect(vendor).toBe('');
      }
    }
  });

  it('navigator.browser matches UA string family', () => {
    for (let seed = 0; seed < 50; seed++) {
      const fp = generateFingerprint(seed);
      const { userAgent, browser } = fp.navigator;
      if (/Chrome\//.test(userAgent)) {
        expect(browser).toBe('chrome');
      } else {
        expect(browser).toBe('firefox');
      }
    }
  });

  it('navigator.userAgent version is from UA_VERSIONS', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ua = generateFingerprint(seed).navigator.userAgent;
      // extract version: Firefox/XXX.0 or Chrome/XXX.0.0.0
      const m = ua.match(/(?:Firefox|Chrome)\/(\d+)/);
      expect(m).toBeTruthy();
      expect(UA_VERSIONS).toContain(Number(m[1]));
    }
  });

  it('timezoneOffset is a valid UTC offset', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(TZ_OFFSETS).toContain(generateFingerprint(seed).timezoneOffset);
    }
  });

  it('languages is a valid set', () => {
    for (let seed = 0; seed < 50; seed++) {
      const langs = generateFingerprint(seed).languages;
      expect(LANGUAGE_SETS).toContainEqual(langs);
    }
  });

  it('noiseSeed is a 32-bit unsigned integer', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ns = generateFingerprint(seed).noiseSeed;
      expect(Number.isInteger(ns)).toBe(true);
      expect(ns).toBeGreaterThanOrEqual(0);
      expect(ns).toBeLessThanOrEqual(0xFFFFFFFF);
    }
  });

  it('colorDepth and pixelDepth are 24', () => {
    const fp = generateFingerprint(77);
    expect(fp.screen.colorDepth).toBe(24);
    expect(fp.screen.pixelDepth).toBe(24);
  });

});
