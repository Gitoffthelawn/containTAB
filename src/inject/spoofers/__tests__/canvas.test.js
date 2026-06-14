import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installCanvasSpoofer, createNoiseFn } from '../canvas.js';

describe('canvas spoofer', () => {

  describe('createNoiseFn', () => {
    it('same seed + same key → same output', () => {
      const n = createNoiseFn(12345, 0.5);
      expect(n('hello')).toBe(n('hello'));
    });

    it('different seeds produce different outputs', () => {
      const a = createNoiseFn(1, 0.5);
      const b = createNoiseFn(2, 0.5);
      expect(a('key')).not.toBe(b('key'));
    });

    it('noise is within [-magnitude, magnitude]', () => {
      const n = createNoiseFn(42, 0.3);
      for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
        const v = n(key);
        expect(v).toBeGreaterThanOrEqual(-0.3);
        expect(v).toBeLessThanOrEqual(0.3);
      }
    });

    it('different keys produce different outputs', () => {
      const n = createNoiseFn(42, 0.5);
      expect(n('a')).not.toBe(n('b'));
    });
  });

  describe('installCanvasSpoofer', () => {
    let pageWindow;
    let crc2dProto;
    let elementProto;
    let hceProto;
    let origMeasureText;
    let origGetRect;

    beforeEach(() => {
      vi.clearAllMocks();
      origMeasureText = vi.fn(() => {
        const m = { width: 100 };
        return m;
      });
      origGetRect = vi.fn(() => ({ width: 50, height: 20 }));
      crc2dProto = { measureText: origMeasureText };
      elementProto = { getBoundingClientRect: origGetRect };
      hceProto = { toDataURL: vi.fn(() => 'data:image/png;base64,AAA') };
      pageWindow = {
        CanvasRenderingContext2D: { prototype: crc2dProto },
        Element: { prototype: elementProto },
        HTMLCanvasElement: { prototype: hceProto },
      };
    });

    it('patches measureText to add noise to width', () => {
      installCanvasSpoofer(pageWindow, { noiseSeed: 12345 });
      const result = crc2dProto.measureText('hello');
      expect(result.width).not.toBe(100);
      expect(Math.abs(result.width - 100)).toBeLessThan(0.5);
    });

    it('measureText noise is deterministic for same text', () => {
      installCanvasSpoofer(pageWindow, { noiseSeed: 12345 });
      const a = crc2dProto.measureText('hello').width;
      // Reset proto and reinstall
      crc2dProto.measureText = origMeasureText;
      installCanvasSpoofer(pageWindow, { noiseSeed: 12345 });
      const b = crc2dProto.measureText('hello').width;
      expect(a).toBe(b);
    });

    it('patches getBoundingClientRect', () => {
      installCanvasSpoofer(pageWindow, { noiseSeed: 12345 });
      const fakeEl = { tagName: 'DIV', id: 'test', className: 'cls' };
      const rect = elementProto.getBoundingClientRect.call(fakeEl);
      expect(rect.width).not.toBe(50);
      expect(Math.abs(rect.width - 50)).toBeLessThan(0.2);
    });

    it('patches toDataURL', () => {
      installCanvasSpoofer(pageWindow, { noiseSeed: 42 });
      expect(hceProto.toDataURL).toBeDefined();
      // Calling it with a mock canvas
      const fakeCanvas = {
        width: 100,
        height: 100,
        getContext: vi.fn(() => ({ fillStyle: '', fillRect: vi.fn() })),
      };
      const result = hceProto.toDataURL.call(fakeCanvas);
      expect(result).toMatch(/^data:image/);
    });
  });
});
