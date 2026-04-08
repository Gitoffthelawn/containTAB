/**
 * index.js — containTAB background script entry point.
 *
 * Registers browser event listeners for:
 *   - webRequest.onBeforeRequest (URL interception)
 *   - tabs.onUpdated (URL change in existing tab)
 *   - tabs.onCreated (new tab tracking)
 *   - tabs.onRemoved (container lifecycle cleanup)
 *   - runtime.onMessageExternal (external messaging)
 */

import './manifest.json';
import '../static/icons/icon.png';
import { tabUpdatedListener, webRequestListener } from './containers';
import { messageExternalListener } from './messageExternalListener';
import { cleanUpTemporaryContainers, onTabCreated, onTabRemoved } from './temporaryContainers';

browser.webRequest.onBeforeRequest.addListener(
  webRequestListener,
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking'],
);

browser.runtime.onMessageExternal.addListener(
  messageExternalListener
);

browser.tabs.onUpdated.addListener(tabUpdatedListener);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);

// Clean up leftover temporary containers at startup
cleanUpTemporaryContainers();
