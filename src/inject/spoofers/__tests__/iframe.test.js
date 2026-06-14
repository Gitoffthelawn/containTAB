import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);
global.cloneInto = vi.fn((v) => v);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

// Mock every spoofer this module imports
vi.mock('../navigator.js', () => ({ installNavigatorSpoofer: vi.fn() }));
vi.mock('../screen.js', () => ({ installScreenSpoofer: vi.fn() }));
vi.mock('../timezone.js', () => ({ installTimezoneSpoofer: vi.fn() }));
vi.mock('../connection.js', () => ({ installConnectionSpoofer: vi.fn() }));
vi.mock('../webrtc.js', () => ({ installWebRTCSpoofer: vi.fn() }));
vi.mock('../canvas.js', () => ({ installCanvasSpoofer: vi.fn() }));

import { installIframeSpoofer } from '../iframe.js';
import { installNavigatorSpoofer } from '../navigator.js';

describe('iframe spoofer', () => {
  let pageWindow;
  let observerInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    observerInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    pageWindow = {
      document: {
        querySelectorAll: vi.fn(() => []),
        documentElement: {},
      },
      MutationObserver: vi.fn(function () { return observerInstance; }),
    };
  });

  const config = { navigator: { userAgent: 'UA' } };

  it('queries existing iframes at install time', () => {
    installIframeSpoofer(pageWindow, config);
    expect(pageWindow.document.querySelectorAll).toHaveBeenCalledWith('iframe');
  });

  it('patches existing same-origin iframes', () => {
    const fakeContentWindow = { document: {} };
    const iframeEl = { contentWindow: fakeContentWindow };
    pageWindow.document.querySelectorAll = vi.fn(() => [iframeEl]);
    installIframeSpoofer(pageWindow, config);
    expect(installNavigatorSpoofer).toHaveBeenCalledWith(fakeContentWindow, config);
  });

  it('silently skips cross-origin iframes', () => {
    const iframeEl = {
      get contentWindow() {
        const cw = {};
        Object.defineProperty(cw, 'document', {
          get() { throw new Error('SecurityError'); },
        });
        return cw;
      },
    };
    pageWindow.document.querySelectorAll = vi.fn(() => [iframeEl]);
    expect(() => installIframeSpoofer(pageWindow, config)).not.toThrow();
    expect(installNavigatorSpoofer).not.toHaveBeenCalled();
  });

  it('sets up MutationObserver for new iframes', () => {
    installIframeSpoofer(pageWindow, config);
    expect(pageWindow.MutationObserver).toHaveBeenCalled();
    expect(observerInstance.observe).toHaveBeenCalledWith(
      pageWindow.document.documentElement,
      expect.objectContaining({ childList: true, subtree: true })
    );
  });
});
