/* global exportFunction, cloneInto */
/**
 * connection.js — Spoof navigator.connection to a generic value.
 *
 * NetworkInformation is a fingerprint vector (effectiveType, downlink, rtt).
 * We return a fixed plausible value so the container looks the same to all sites.
 */

import { markNative } from '../stealth.js';

/**
 * Install connection spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 */
export function installConnectionSpoofer(pageWindow) {
  const fakeConnection = cloneInto({
    effectiveType: '4g',
    type: 'wifi',
    downlink: 10,
    downlinkMax: Infinity,
    rtt: 50,
    saveData: false,
    onchange: null,
  }, pageWindow);

  const getter = exportFunction(function () {
    return fakeConnection;
  }, pageWindow);
  markNative(getter, 'get connection');

  Object.defineProperty(pageWindow.Navigator.prototype, 'connection', {
    get: getter,
    configurable: true,
    enumerable: true,
  });
}
