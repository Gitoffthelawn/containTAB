import { describe, it, expect, vi, beforeEach } from 'vitest';

global.exportFunction = vi.fn((fn) => fn);

vi.mock('../../stealth.js', () => ({
  markNative: vi.fn(),
}));

import { installWebRTCSpoofer } from '../webrtc.js';

describe('webrtc spoofer', () => {
  let pageWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    pageWindow = {
      RTCPeerConnection: function () {},
      mozRTCPeerConnection: function () {},
      DOMException: class DOMException extends Error {
        constructor(msg, name) { super(msg); this.name = name; }
      },
      Promise,
      navigator: {
        mediaDevices: {
          enumerateDevices: () => Promise.resolve([{ kind: 'audio' }]),
        },
      },
    };
  });

  it('replaces RTCPeerConnection with throwing stub', () => {
    installWebRTCSpoofer(pageWindow, {});
    expect(() => new pageWindow.RTCPeerConnection()).toThrow(/WebRTC disabled/);
  });

  it('replaces mozRTCPeerConnection', () => {
    installWebRTCSpoofer(pageWindow, {});
    expect(() => new pageWindow.mozRTCPeerConnection()).toThrow();
  });

  it('skips undefined constructors', () => {
    delete pageWindow.mozRTCPeerConnection;
    expect(() => installWebRTCSpoofer(pageWindow, {})).not.toThrow();
  });

  it('neutralizes enumerateDevices to return empty array', async () => {
    installWebRTCSpoofer(pageWindow, {});
    const devices = await pageWindow.navigator.mediaDevices.enumerateDevices();
    expect(devices).toEqual([]);
  });

  it('handles missing mediaDevices gracefully', () => {
    delete pageWindow.navigator.mediaDevices;
    expect(() => installWebRTCSpoofer(pageWindow, {})).not.toThrow();
  });
});
