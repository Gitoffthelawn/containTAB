/* global exportFunction */
/**
 * timezone.js — Spoof Date.getTimezoneOffset + Intl timezone.
 *
 * Overrides Date.prototype.getTimezoneOffset to return the container's
 * fingerprint offset, and patches Intl.DateTimeFormat().resolvedOptions()
 * to report a timezone consistent with that offset.
 */

import { markNative } from '../stealth.js';

/**
 * Map UTC offset (minutes) to a representative IANA timezone name.
 * Not exhaustive — just picks one plausible zone per offset.
 */
export const OFFSET_TO_TZ = {
  '-720': 'Etc/GMT+12',
  '-660': 'Pacific/Midway',
  '-600': 'Pacific/Honolulu',
  '-570': 'Pacific/Marquesas',
  '-540': 'America/Anchorage',
  '-480': 'America/Los_Angeles',
  '-420': 'America/Denver',
  '-360': 'America/Chicago',
  '-300': 'America/New_York',
  '-240': 'America/Halifax',
  '-210': 'America/St_Johns',
  '-180': 'America/Sao_Paulo',
  '-120': 'Atlantic/South_Georgia',
  '-60': 'Atlantic/Azores',
  '0': 'Europe/London',
  '60': 'Europe/Berlin',
  '120': 'Europe/Helsinki',
  '180': 'Europe/Moscow',
  '210': 'Asia/Tehran',
  '240': 'Asia/Dubai',
  '270': 'Asia/Kabul',
  '300': 'Asia/Karachi',
  '330': 'Asia/Kolkata',
  '345': 'Asia/Kathmandu',
  '360': 'Asia/Dhaka',
  '390': 'Asia/Yangon',
  '420': 'Asia/Bangkok',
  '480': 'Asia/Shanghai',
  '525': 'Australia/Eucla',
  '540': 'Asia/Tokyo',
  '570': 'Australia/Adelaide',
  '600': 'Australia/Sydney',
  '630': 'Australia/Lord_Howe',
  '660': 'Pacific/Noumea',
  '720': 'Pacific/Auckland',
  '765': 'Pacific/Chatham',
  '780': 'Pacific/Tongatapu',
  '840': 'Pacific/Kiritimati',
};

export function offsetToTimezone(offsetMinutes) {
  return OFFSET_TO_TZ[String(offsetMinutes)] || 'UTC';
}

/**
 * Install timezone spoofer.
 *
 * @param {Window} pageWindow - from window.wrappedJSObject
 * @param {object} config - fingerprint config (Phase 1 output)
 */
/**
 * Patch Intl constructor's resolvedOptions to return locale consistent with config.
 * Works for DateTimeFormat, Collator, NumberFormat.
 */
function _patchIntlResolvedOptions(pageWindow, OrigConstructor, locale) {
  const origResolvedOptions = OrigConstructor.prototype.resolvedOptions;
  const patchedResolvedOptions = exportFunction(function () {
    const opts = origResolvedOptions.call(this);
    opts.locale = locale;
    return opts;
  }, pageWindow);
  markNative(patchedResolvedOptions, 'resolvedOptions');
  Object.defineProperty(OrigConstructor.prototype, 'resolvedOptions', {
    value: patchedResolvedOptions,
    configurable: true,
    writable: true,
  });
}

export function installTimezoneSpoofer(pageWindow, config) {
  // Note: JS getTimezoneOffset returns (UTC - local) in minutes.
  // Our config stores the conventional UTC offset (local - UTC).
  // So getTimezoneOffset should return -config.timezoneOffset.
  const jsOffset = -config.timezoneOffset;
  const tzName = offsetToTimezone(config.timezoneOffset);

  // Patch Date.prototype.getTimezoneOffset
  const patchedGetOffset = exportFunction(function () {
    return jsOffset;
  }, pageWindow);
  markNative(patchedGetOffset, 'getTimezoneOffset');
  Object.defineProperty(pageWindow.Date.prototype, 'getTimezoneOffset', {
    value: patchedGetOffset,
    configurable: true,
    writable: true,
  });

  // Patch Intl.DateTimeFormat().resolvedOptions().timeZone
  const OrigDTF = pageWindow.Intl.DateTimeFormat;
  const origResolvedOptions = OrigDTF.prototype.resolvedOptions;
  const patchedResolvedOptions = exportFunction(function () {
    // Mutate the original opts in-place. `origResolvedOptions.call(this)` is
    // spec-defined to return a FRESH object (per ECMA-402), so in-place
    // mutation is safe and — crucially — keeps the object in page-world
    // compartment. Building `Object.assign({}, opts, ...)` inside the content
    // script leaks a content-script-world `{}` into page world, which Xray
    // wraps and the page cannot read ("Permission denied to access property").
    const opts = origResolvedOptions.call(this);
    opts.timeZone = tzName;
    return opts;
  }, pageWindow);
  markNative(patchedResolvedOptions, 'resolvedOptions');
  Object.defineProperty(OrigDTF.prototype, 'resolvedOptions', {
    value: patchedResolvedOptions,
    configurable: true,
    writable: true,
  });

  // Patch Intl.Collator and Intl.NumberFormat to report locale consistent with timezone
  if (config.languages) {
    const locale = config.languages[0] || 'en-US';
    _patchIntlResolvedOptions(pageWindow, pageWindow.Intl.Collator, locale);
    _patchIntlResolvedOptions(pageWindow, pageWindow.Intl.NumberFormat, locale);
  }
}
