/* global exportFunction, cloneInto */
/**
 * navigator.js — Spoof navigator.* properties in page world.
 *
 * Overrides getters on Navigator.prototype (and WorkerNavigator.prototype
 * where possible) so all reads return the container's fingerprint values.
 *
 * Uses Firefox-only `exportFunction` + `cloneInto` to cross the content
 * script / page world boundary without leaking the content script scope.
 */

import { markNative } from '../stealth.js';

/**
 * Install a spoofed getter on a prototype in page world.
 *
 * @param {object} proto - target prototype in page world
 * @param {string} prop - property name
 * @param {*} value - value to return (primitive or already cross-compartment-safe)
 * @param {Window} pageWindow - page world window (for cloneInto)
 */
function defineGetter(proto, prop, value, pageWindow) {
  // Getter runs in content script world; exportFunction brings it to page world.
  const getter = exportFunction(function () {
    // Return either a primitive (auto-cloned) or a value already in page world
    return value;
  }, pageWindow);

  markNative(getter, `get ${prop}`);

  // defineProperty must happen in page world so the descriptor lives there
  Object.defineProperty(proto, prop, {
    get: getter,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Create a stub object that looks like navigator.storage with estimate() and persist().
 */
function _createStorageStub(pageWindow, storageConfig) {
  const estimate = exportFunction(function () {
    return Promise.resolve({
      usage: storageConfig.usage,
      quota: storageConfig.quota,
    });
  }, pageWindow);

  const persist = exportFunction(function () {
    return Promise.resolve(storageConfig.persist);
  }, pageWindow);

  const storage = cloneInto({ estimate, persist }, pageWindow);
  markNative(storage.estimate, 'estimate');
  markNative(storage.persist, 'persist');
  return storage;
}

/**
 * Create a stub object that looks like navigator.permissions with query().
 */
function _createPermissionsStub(pageWindow) {
  const query = exportFunction(function () {
    return Promise.resolve({ state: 'granted' });
  }, pageWindow);

  const permissions = cloneInto({ query }, pageWindow);
  markNative(permissions.query, 'query');
  return permissions;
}

/**
 * Install navigator spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config (Phase 1 output)
 */
export function installNavigatorSpoofer(pageWindow, config) {
  const nav = config.navigator;
  const NavigatorProto = pageWindow.Navigator.prototype;

  // Primitive fields — each picked independently in fingerprint-generator
  defineGetter(NavigatorProto, 'userAgent', nav.userAgent, pageWindow);
  defineGetter(NavigatorProto, 'platform', nav.platform, pageWindow);
  defineGetter(NavigatorProto, 'vendor', nav.vendor, pageWindow);
  defineGetter(NavigatorProto, 'appVersion', nav.appVersion, pageWindow);
  defineGetter(NavigatorProto, 'hardwareConcurrency', config.hardwareConcurrency, pageWindow);
  defineGetter(NavigatorProto, 'deviceMemory', config.deviceMemory, pageWindow);

  // languages: array — must cloneInto page world
  const langsCloned = cloneInto(config.languages, pageWindow);
  defineGetter(NavigatorProto, 'languages', langsCloned, pageWindow);
  defineGetter(NavigatorProto, 'language', config.languages[0], pageWindow);

  // plugins / mimeTypes: empty array-like (Firefox returns empty since 87+)
  const emptyPlugins = cloneInto([], pageWindow);
  defineGetter(NavigatorProto, 'plugins', emptyPlugins, pageWindow);
  defineGetter(NavigatorProto, 'mimeTypes', emptyPlugins, pageWindow);

  // webdriver — always false (hide automation signal)
  defineGetter(NavigatorProto, 'webdriver', false, pageWindow);

  // storage — stub estimate() and persist() with realistic promises
  const storageStub = _createStorageStub(pageWindow, config.storage);
  defineGetter(NavigatorProto, 'storage', storageStub, pageWindow);

  // permissions — stub query() to return granted
  const permissionsStub = _createPermissionsStub(pageWindow);
  defineGetter(NavigatorProto, 'permissions', permissionsStub, pageWindow);

  // credentials — hide to prevent automation signal; undefined in real browsers
  defineGetter(NavigatorProto, 'credentials', undefined, pageWindow);
}
