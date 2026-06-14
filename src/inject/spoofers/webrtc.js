/* global exportFunction */
/**
 * webrtc.js — Block WebRTC to prevent local IP leaks.
 *
 * RTCPeerConnection exposes local IPs via ICE candidates. A privacy browser
 * container should never leak this. We replace all PeerConnection constructors
 * with stubs that throw.
 *
 * Note: this breaks sites that genuinely need WebRTC (video calls, etc).
 * Privacy-over-feature is the containTAB default.
 */

import { markNative } from '../stealth.js';

/**
 * Install WebRTC spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 */
export function installWebRTCSpoofer(pageWindow) {
  const names = [
    'RTCPeerConnection',
    'mozRTCPeerConnection',
    'webkitRTCPeerConnection',
  ];

  for (const name of names) {
    if (typeof pageWindow[name] === 'undefined') continue;

    const stub = exportFunction(function () {
      throw new pageWindow.DOMException(
        'WebRTC disabled by containTAB privacy policy',
        'NotAllowedError'
      );
    }, pageWindow);
    markNative(stub, name);

    Object.defineProperty(pageWindow, name, {
      value: stub,
      configurable: true,
      writable: true,
    });
  }

  // Also neutralize navigator.mediaDevices.enumerateDevices — leaks device list
  if (pageWindow.navigator && pageWindow.navigator.mediaDevices) {
    const emptyEnum = exportFunction(function () {
      return pageWindow.Promise.resolve([]);
    }, pageWindow);
    markNative(emptyEnum, 'enumerateDevices');
    try {
      Object.defineProperty(pageWindow.navigator.mediaDevices, 'enumerateDevices', {
        value: emptyEnum,
        configurable: true,
        writable: true,
      });
    } catch (_err) {
      // mediaDevices may be frozen on some Firefox versions
    }
  }
}
