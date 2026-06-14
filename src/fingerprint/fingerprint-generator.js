/**
 * fingerprint-generator.js — Seed → PRNG → random fingerprint config.
 *
 * Each container gets one seed, one PRNG, one set of randomized values.
 * All sites within the same container see the same fingerprint.
 * No profile pool, no real browser data — pure random from valid ranges.
 */

import { createPRNG } from './prng.js';

/** Common screen resolution pairs (width × height). */
const SCREEN_PAIRS = [
  [1024, 768],
  [1280, 720],
  [1280, 800],
  [1280, 1024],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1600, 900],
  [1680, 1050],
  [1920, 1080],
  [1920, 1200],
  [2560, 1080],
  [2560, 1440],
  [3440, 1440],
  [3840, 2160],
];

const CORES = [2, 4, 6, 8, 12, 16];
const MEMORY = [2, 4, 8, 16, 32];
const DPR = [1, 1.25, 1.5, 2];

/** Valid UTC offsets in minutes (real-world timezones). */
const TZ_OFFSETS = [
  -720, -660, -600, -570, -540, -480, -420, -360,
  -300, -240, -210, -180, -120, -60, 0,
  60, 120, 180, 210, 240, 270, 300, 330, 345,
  360, 390, 420, 480, 525, 540, 570, 600,
  630, 660, 720, 765, 780, 840,
];

/** Language sets — realistic combinations. */
const LANGUAGE_SETS = [
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['de-DE', 'de', 'en'],
  ['fr-FR', 'fr', 'en'],
  ['es-ES', 'es', 'en'],
  ['pt-BR', 'pt', 'en'],
  ['it-IT', 'it', 'en'],
  ['nl-NL', 'nl', 'en'],
  ['pl-PL', 'pl', 'en'],
  ['ru-RU', 'ru', 'en'],
  ['ja-JP', 'ja', 'en'],
  ['ko-KR', 'ko', 'en'],
  ['zh-CN', 'zh', 'en'],
  ['zh-TW', 'zh-Hant', 'en'],
];

/**
 * Navigator field pools — each picked independently.
 * No archetype, no OS/browser consistency enforcement.
 * Every container = one random combo from each pool.
 */
const UA_OS_TOKENS = [
  'Windows NT 10.0; Win64; x64',
  'Windows NT 11.0; Win64; x64',
  'X11; Linux x86_64',
  'X11; Ubuntu; Linux x86_64',
  'Macintosh; Intel Mac OS X 10.15',
  'Macintosh; Intel Mac OS X 14.5',
];

const UA_BROWSER_TEMPLATES = [
  // Firefox variants
  (os, ver) => `Mozilla/5.0 (${os}; rv:${ver}.0) Gecko/20100101 Firefox/${ver}.0`,
  // Chrome variants
  (os, ver) => `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver}.0.0.0 Safari/537.36`,
];

const UA_VERSIONS = [115, 120, 125, 128, 130, 135, 140];

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l'];

const VENDORS = ['', 'Google Inc.'];

const APP_VERSIONS = [
  '5.0 (Windows)',
  '5.0 (Macintosh)',
  '5.0 (X11)',
];

/** WebGL vendor/renderer string pools — realistic GPU identifiers. */
const WEBGL_VENDORS = [
  'Intel Inc.',
  'NVIDIA Corporation',
  'AMD',
  'Apple Inc.',
];

const WEBGL_RENDERERS = [
  'Intel Iris OpenGL Engine',
  'Intel UHD Graphics 630',
  'ANGLE (Intel HD Graphics 630)',
  'ANGLE (NVIDIA GeForce GTX 1080)',
  'ANGLE (AMD Radeon RX 5700 XT)',
  'Apple M1',
  'Quadro RTX 5000',
];

/**
 * Navigator combination tree — references the raw pools above by index.
 *
 * Purpose: keep the "one container = one random set" principle while
 * constraining navigator fields to self-consistent combinations. The pools
 * stay as the single source of truth; this tree only declares which indices
 * belong together. Each container picks ONE path through the tree:
 *   stage 1: OS family              → os key
 *   stage 2: osToken variant        → UA_OS_TOKENS[idx]
 *   stage 3: browser family         → browser key
 *   stage 4: UA version             → UA_VERSIONS[idx]
 *
 * Platform, appVersion, vendor, and uaTemplate are fixed per OS/browser.
 * Screen / cores / memory / tz / languages / noiseSeed are still independent
 * — they don't constitute a consistency break.
 */
const NAVIGATOR_TREE = {
  windows: {
    platformIdx: 0,           // PLATFORMS[0] = 'Win32'
    appVersionIdx: 0,         // APP_VERSIONS[0] = '5.0 (Windows)'
    osTokenIdxs: [0, 1],      // UA_OS_TOKENS[0..1] = Win10, Win11
    browsers: {
      firefox: { templateIdx: 0, vendorIdx: 0, versionIdxs: [0, 1, 3, 5, 6] },
      chrome:  { templateIdx: 1, vendorIdx: 1, versionIdxs: [1, 2, 4, 5, 6] },
    },
  },
  mac: {
    platformIdx: 1,           // 'MacIntel'
    appVersionIdx: 1,         // '5.0 (Macintosh)'
    osTokenIdxs: [4, 5],      // Mac 10.15, Mac 14.5
    browsers: {
      firefox: { templateIdx: 0, vendorIdx: 0, versionIdxs: [0, 3, 6] },
      chrome:  { templateIdx: 1, vendorIdx: 1, versionIdxs: [1, 2, 4, 5, 6] },
    },
  },
  linux: {
    platformIdx: 2,           // 'Linux x86_64'
    appVersionIdx: 2,         // '5.0 (X11)'
    osTokenIdxs: [2, 3],      // X11 Linux, X11 Ubuntu
    browsers: {
      firefox: { templateIdx: 0, vendorIdx: 0, versionIdxs: [0, 3, 6] },
      chrome:  { templateIdx: 1, vendorIdx: 1, versionIdxs: [1, 2, 4, 5, 6] },
    },
  },
};

/**
 * Generate a complete fingerprint config from a seed.
 *
 * @param {number} seed - 32-bit unsigned integer
 * @returns {object} fingerprint config
 */
export function generateFingerprint(seed) {
  const rng = createPRNG(seed);

  const [width, height] = rng.pick(SCREEN_PAIRS);
  const taskbarHeight = rng.nextInt(25, 50);

  // Walk the navigator tree: OS → osToken → browser → version.
  // Fields are index references into the raw pools so the pools stay
  // authoritative and editable without touching combination logic.
  const osKeys = Object.keys(NAVIGATOR_TREE);
  const osKey = rng.pick(osKeys);
  const osNode = NAVIGATOR_TREE[osKey];
  const osTokenIdx = rng.pick(osNode.osTokenIdxs);
  const osToken = UA_OS_TOKENS[osTokenIdx];

  const browserKeys = Object.keys(osNode.browsers);
  const browserKey = rng.pick(browserKeys);
  const browserNode = osNode.browsers[browserKey];
  const uaVersionIdx = rng.pick(browserNode.versionIdxs);
  const uaVersion = UA_VERSIONS[uaVersionIdx];

  const uaTemplate = UA_BROWSER_TEMPLATES[browserNode.templateIdx];
  const userAgent = uaTemplate(osToken, uaVersion);
  const platform = PLATFORMS[osNode.platformIdx];
  const appVersion = APP_VERSIONS[osNode.appVersionIdx];
  const vendor = VENDORS[browserNode.vendorIdx];

  return {
    navigator: {
      userAgent,
      browser: browserKey,
      platform,
      vendor,
      appVersion,
    },
    screen: {
      width,
      height,
      availWidth: width,
      availHeight: height - taskbarHeight,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: rng.pick(DPR),
    },
    webgl: {
      vendor: rng.pick(WEBGL_VENDORS),
      renderer: rng.pick(WEBGL_RENDERERS),
    },
    storage: {
      usage: rng.nextInt(1024 * 1024 * 5, 1024 * 1024 * 100),  // 5–100 MB
      quota: rng.pick([512, 1024, 2048, 4096]) * 1024 * 1024,   // 512MB–4GB
      persist: rng.nextInt(0, 2) === 1,
    },
    hardwareConcurrency: rng.pick(CORES),
    deviceMemory: rng.pick(MEMORY),
    timezoneOffset: rng.pick(TZ_OFFSETS),
    languages: rng.pick(LANGUAGE_SETS),
    noiseSeed: rng.nextInt(0, 0xFFFFFFFF),
  };
}

// Export pools + tree for testing
export {
  SCREEN_PAIRS, CORES, MEMORY, DPR, TZ_OFFSETS, LANGUAGE_SETS,
  UA_OS_TOKENS, UA_BROWSER_TEMPLATES, UA_VERSIONS, PLATFORMS, VENDORS, APP_VERSIONS,
  WEBGL_VENDORS, WEBGL_RENDERERS,
  NAVIGATOR_TREE,
};
