import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installTimezoneSpoofer, offsetToTimezone, OFFSET_TO_TZ } from '../timezone.js';

describe('timezone spoofer', () => {
  let pageWindow;
  let dateProto;
  let intlProto;
  let origResolvedOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    dateProto = {};
    origResolvedOptions = vi.fn(() => ({ timeZone: 'America/Guess', locale: 'en' }));
    intlProto = { resolvedOptions: origResolvedOptions };
    pageWindow = {
      Date: { prototype: dateProto },
      Intl: { DateTimeFormat: function () {} },
    };
    pageWindow.Intl.DateTimeFormat.prototype = intlProto;
  });

  it('offsetToTimezone returns IANA name for known offset', () => {
    expect(offsetToTimezone(480)).toBe('Asia/Shanghai');
    expect(offsetToTimezone(0)).toBe('Europe/London');
    expect(offsetToTimezone(-480)).toBe('America/Los_Angeles');
  });

  it('offsetToTimezone falls back to UTC for unknown', () => {
    expect(offsetToTimezone(9999)).toBe('UTC');
  });

  it('OFFSET_TO_TZ exported for worker preamble', () => {
    expect(OFFSET_TO_TZ).toBeDefined();
    expect(OFFSET_TO_TZ['480']).toBe('Asia/Shanghai');
  });

  it('patches Date.prototype.getTimezoneOffset', () => {
    installTimezoneSpoofer(pageWindow, { timezoneOffset: 480 });
    // config.timezoneOffset = +480 (UTC+8), JS getTimezoneOffset returns -480
    expect(dateProto.getTimezoneOffset()).toBe(-480);
  });

  it('negative offset inverts correctly', () => {
    installTimezoneSpoofer(pageWindow, { timezoneOffset: -300 });
    expect(dateProto.getTimezoneOffset()).toBe(300);
  });

  it('patches Intl.DateTimeFormat resolvedOptions timeZone', () => {
    installTimezoneSpoofer(pageWindow, { timezoneOffset: 480 });
    const fakeDTF = { locale: 'en' };
    const opts = intlProto.resolvedOptions.call(fakeDTF);
    expect(opts.timeZone).toBe('Asia/Shanghai');
  });

  it('resolvedOptions preserves other options', () => {
    origResolvedOptions.mockReturnValue({ timeZone: 'x', locale: 'fr', numberingSystem: 'latn' });
    installTimezoneSpoofer(pageWindow, { timezoneOffset: 0 });
    const opts = intlProto.resolvedOptions.call({});
    expect(opts.timeZone).toBe('Europe/London');
    expect(opts.locale).toBe('fr');
    expect(opts.numberingSystem).toBe('latn');
  });
});
