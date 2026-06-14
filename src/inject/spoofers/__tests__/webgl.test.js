import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installWebGLSpoofer } from '../webgl.js';

describe('webgl spoofer', () => {
  describe('installWebGLSpoofer', () => {
    let pageWindow;
    let hceProto;
    let mockWebGLContext;
    let origGetContext;

    beforeEach(() => {
      vi.clearAllMocks();

      // Mock WebGL context
      mockWebGLContext = {
        getParameter: vi.fn(() => {
          // Return dummy values for parameters we don't spoof
          return null;
        }),
      };

      // Original getContext returns the mock context
      origGetContext = vi.fn(() => mockWebGLContext);

      hceProto = { getContext: origGetContext };
      pageWindow = {
        HTMLCanvasElement: { prototype: hceProto },
      };
    });

    it('returns null if config.webgl is missing', () => {
      installWebGLSpoofer(pageWindow, {});
      expect(origGetContext).not.toHaveBeenCalled();
    });

    it('returns null context unchanged if getContext returns null', () => {
      origGetContext.mockReturnValue(null);
      installWebGLSpoofer(pageWindow, {
        webgl: { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      });

      const result = hceProto.getContext('webgl');
      expect(result).toBeNull();
    });

    it('does not patch 2d context', () => {
      const ctx2d = { some: 'thing' };
      origGetContext.mockReturnValue(ctx2d);
      installWebGLSpoofer(pageWindow, {
        webgl: { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      });

      const result = hceProto.getContext('2d');
      expect(result).toBe(ctx2d);
      expect(result.getParameter).toBeUndefined();
    });

    it('patches webgl context and returns spoofed UNMASKED_VENDOR_WEBGL', () => {
      const config = {
        webgl: { vendor: 'NVIDIA Corporation', renderer: 'ANGLE (NVIDIA GeForce GTX 1080)' },
      };

      installWebGLSpoofer(pageWindow, config);

      const result = hceProto.getContext('webgl');
      expect(result).toBeDefined();
      expect(result.getParameter).toBeDefined();

      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const vendor = result.getParameter(UNMASKED_VENDOR_WEBGL);
      expect(vendor).toBe('NVIDIA Corporation');
    });

    it('patches webgl context and returns spoofed UNMASKED_RENDERER_WEBGL', () => {
      const config = {
        webgl: { vendor: 'Intel Inc.', renderer: 'Intel UHD Graphics 630' },
      };

      installWebGLSpoofer(pageWindow, config);

      const result = hceProto.getContext('webgl');
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      const renderer = result.getParameter(UNMASKED_RENDERER_WEBGL);
      expect(renderer).toBe('Intel UHD Graphics 630');
    });

    it('passes through non-spoofed parameters to original', () => {
      const config = {
        webgl: { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      };

      origGetContext.mockReturnValue({
        getParameter: vi.fn((pname) => {
          if (pname === 0x0001) return 42; // arbitrary parameter
          return null;
        }),
      });

      installWebGLSpoofer(pageWindow, config);

      const result = hceProto.getContext('webgl');
      expect(result.getParameter(0x0001)).toBe(42);
    });

    it('patches webgl2 context', () => {
      const config = {
        webgl: { vendor: 'AMD', renderer: 'ANGLE (AMD Radeon RX 5700 XT)' },
      };

      installWebGLSpoofer(pageWindow, config);

      const result = hceProto.getContext('webgl2');
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const vendor = result.getParameter(UNMASKED_VENDOR_WEBGL);
      expect(vendor).toBe('AMD');
    });

    it('deterministic for same config', () => {
      const config = {
        webgl: { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      };

      installWebGLSpoofer(pageWindow, config);

      const result1 = hceProto.getContext('webgl');
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const vendor1 = result1.getParameter(UNMASKED_VENDOR_WEBGL);

      // Reinstall with same config
      hceProto.getContext = origGetContext;
      installWebGLSpoofer(pageWindow, config);

      const result2 = hceProto.getContext('webgl');
      const vendor2 = result2.getParameter(UNMASKED_VENDOR_WEBGL);

      expect(vendor1).toBe(vendor2);
    });
  });
});
