import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock exportFunction as a simple define-on-target
global.exportFunction = vi.fn((fn, target, { defineAs }) => {
  target[defineAs] = fn;
  return fn;
});

import { installStealth, markNative, _resetStealth } from '../stealth.js';

describe('stealth', () => {

  let pageWindow;

  beforeEach(() => {
    _resetStealth();
    vi.clearAllMocks();

    // Minimal page window mock: real Function prototype
    pageWindow = {
      Function: function MockFunction() {},
    };
    pageWindow.Function.prototype = Object.create(Function.prototype);
    pageWindow.Function.prototype.toString = function () {
      return 'function original() { [native code] }';
    };
  });

  it('installStealth replaces Function.prototype.toString via exportFunction', () => {
    installStealth(pageWindow);
    expect(global.exportFunction).toHaveBeenCalledTimes(1);
    const call = global.exportFunction.mock.calls[0];
    expect(call[1]).toBe(pageWindow.Function.prototype);
    expect(call[2].defineAs).toBe('toString');
  });

  it('marked function toString reports as native', () => {
    installStealth(pageWindow);
    const fakeSpoofer = function spoofer() { return 42; };
    markNative(fakeSpoofer, 'userAgent');

    const newToString = pageWindow.Function.prototype.toString;
    const result = newToString.call(fakeSpoofer);
    expect(result).toBe('function userAgent() { [native code] }');
  });

  it('unmarked function falls through to original toString', () => {
    installStealth(pageWindow);
    const unmarked = function () {};
    const newToString = pageWindow.Function.prototype.toString;
    const result = newToString.call(unmarked);
    expect(result).toBe('function original() { [native code] }');
  });

  it('markNative can tag multiple functions with different names', () => {
    installStealth(pageWindow);
    const fnA = function () {};
    const fnB = function () {};
    markNative(fnA, 'userAgent');
    markNative(fnB, 'hardwareConcurrency');

    const newToString = pageWindow.Function.prototype.toString;
    expect(newToString.call(fnA)).toBe('function userAgent() { [native code] }');
    expect(newToString.call(fnB)).toBe('function hardwareConcurrency() { [native code] }');
  });

});
