import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installWorkerSpoofer } from '../worker.js';
import { buildWorkerPreamble } from '../../worker-preamble.js';

describe('worker preamble generator', () => {
  it('buildWorkerPreamble returns a string containing config', () => {
    const config = {
      navigator: { userAgent: 'UA', platform: 'P', appVersion: 'A', vendor: 'V' },
      hardwareConcurrency: 8,
      deviceMemory: 16,
      languages: ['en-US', 'en'],
      timezoneOffset: 480,
    };
    const src = buildWorkerPreamble(config);
    expect(typeof src).toBe('string');
    expect(src).toContain('UA');
    expect(src).toContain('WorkerNavigator');
    expect(src).toContain('getTimezoneOffset');
    expect(src).toContain('Asia/Shanghai');
  });

  it('preamble JSON-escapes config properly', () => {
    const config = {
      navigator: { userAgent: 'UA "with" quotes', platform: 'P', appVersion: 'A', vendor: 'V' },
      hardwareConcurrency: 4,
      deviceMemory: 8,
      languages: ['en'],
      timezoneOffset: 0,
    };
    const src = buildWorkerPreamble(config);
    // JSON.stringify should handle the escaping
    expect(() => new Function(src)).not.toThrow();
  });
});

describe('worker constructor spoofer', () => {
  let pageWindow;
  let OrigWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    OrigWorker = vi.fn(function (url) { this.url = url; });
    OrigWorker.prototype = {};
    pageWindow = {
      Worker: OrigWorker,
      URL: class URL {
        constructor(u) { this.href = 'http://test/' + u; }
        static createObjectURL() { return 'blob:fake'; }
      },
      Blob: class Blob {
        constructor(parts) { this.parts = parts; }
      },
      location: { href: 'http://test/' },
    };
  });

  const config = {
    navigator: { userAgent: 'UA', platform: 'P', appVersion: 'A', vendor: 'V' },
    hardwareConcurrency: 4,
    deviceMemory: 8,
    languages: ['en-US', 'en'],
    timezoneOffset: 480,
  };

  it('replaces Worker constructor', () => {
    installWorkerSpoofer(pageWindow, config);
    expect(pageWindow.Worker).not.toBe(OrigWorker);
  });

  it('new Worker() wraps URL with blob', () => {
    installWorkerSpoofer(pageWindow, config);
    const w = new pageWindow.Worker('script.js');
    // OrigWorker should have been called with blob URL
    expect(OrigWorker).toHaveBeenCalledWith('blob:fake', undefined);
    expect(w).toBeDefined();
  });

  it('preserves prototype chain', () => {
    const origProto = OrigWorker.prototype;
    installWorkerSpoofer(pageWindow, config);
    expect(pageWindow.Worker.prototype).toBe(origProto);
  });

  it('handles missing Worker gracefully', () => {
    delete pageWindow.Worker;
    expect(() => installWorkerSpoofer(pageWindow, config)).not.toThrow();
  });
});
