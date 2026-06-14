import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);
global.cloneInto = vi.fn((value) => value);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installConnectionSpoofer } from '../connection.js';

describe('connection spoofer', () => {
  let pageWindow;
  let navProto;

  beforeEach(() => {
    vi.clearAllMocks();
    navProto = {};
    pageWindow = { Navigator: { prototype: navProto } };
  });

  it('defines navigator.connection getter', () => {
    installConnectionSpoofer(pageWindow, {});
    expect(Object.getOwnPropertyDescriptor(navProto, 'connection')).toBeDefined();
  });

  it('connection returns NetworkInformation-like object', () => {
    installConnectionSpoofer(pageWindow, {});
    const conn = navProto.connection;
    expect(conn.effectiveType).toBe('4g');
    expect(conn.type).toBe('wifi');
    expect(conn.downlink).toBe(10);
    expect(conn.rtt).toBe(50);
    expect(conn.saveData).toBe(false);
  });

  it('connection is cloned into page world', () => {
    installConnectionSpoofer(pageWindow, {});
    expect(global.cloneInto).toHaveBeenCalled();
  });
});
