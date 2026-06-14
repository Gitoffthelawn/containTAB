import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ContextualIdentity', () => ({
  default: {
    create: vi.fn().mockResolvedValue({ cookieStoreId: 'firefox-container-9', name: 'Research' }),
    remove: vi.fn().mockResolvedValue(),
    update: vi.fn().mockResolvedValue(),
  },
  NO_CONTAINER: { name: 'No Container', cookieStoreId: 'firefox-default', colorCode: '#999' },
}));

const { defaultConfig } = vi.hoisted(() => ({
  defaultConfig: {
    keepOldTabs: false,
    matchDomainOnly: false,
    theme: 'system',
      defaultContainer: {
        enabled: true,
        containerStrategy: 'one_tab_one_world',
        lifetime: 'untilLastTab',
      ruleAddition: '*.{domain}.*',
    },
    experimental: {
      fingerprint: {
        enabled: false,
      },
    },
  },
}));

vi.mock('../../GlobalConfig', () => ({
  default: {
    get: vi.fn().mockResolvedValue(defaultConfig),
    set: vi.fn().mockResolvedValue(defaultConfig),
    reset: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../../ContainerExtension', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ lifetime: 'forever' }),
    set: vi.fn().mockResolvedValue({ lifetime: 'forever' }),
    shouldAutoDelete: vi.fn(ext => ext?.lifetime === 'untilLastTab'),
  },
  UI_ICON_VALUES: ['containers', 'briefcase', 'book', 'cart', 'play', 'shield', 'pin'],
  nativeIconForUiIcon: vi.fn(value => ({
    containers: 'circle',
    briefcase: 'briefcase',
    book: 'tree',
    cart: 'cart',
    play: 'fingerprint',
    shield: 'fence',
    pin: 'dollar',
  }[value] || 'circle')),
  uiIconForNativeIcon: vi.fn(value => ({
    circle: 'containers',
    briefcase: 'briefcase',
    tree: 'book',
    cart: 'cart',
    fingerprint: 'play',
    fence: 'shield',
    dollar: 'pin',
  }[value] || 'containers')),
}));

vi.mock('../../Storage/HostStorage', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(),
    remove: vi.fn().mockResolvedValue(),
  },
}));

vi.mock('../toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../loader', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
}));

function setupDom(html) {
  const dom = new JSDOM(html, { url: 'moz-extension://contain-tab/ui/index.html' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.confirm = vi.fn(() => true);
}

function click(selector) {
  document.querySelector(selector).click();
}

function input(selector, value) {
  const el = document.querySelector(selector);
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function visibleNodes(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(node => !node.hidden);
}

function keydown(selector, key, options = {}) {
  document.querySelector(selector).dispatchEvent(new window.KeyboardEvent('keydown', {
    bubbles: true,
    key,
    ...options,
  }));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('popup runtime UI', () => {
  beforeEach(() => {
    vi.resetModules();
    setupDom(`
      <main id="popup-shell">
        <section id="rules-screen" class="screen active"><div id="rules-content"></div></section>
        <section id="containers-screen" class="screen hide"><div id="containers-content"></div></section>
        <section id="settings-screen" class="screen hide"><div id="settings-content"></div></section>
        <section id="help-screen" class="screen hide"></section>
        <nav class="bottom-nav">
          <button class="nav-item active" data-target="rules"><svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18"></svg><span>Rules</span></button>
          <button class="nav-item" data-target="containers"><img class="nav-icon" src="../icons/icon.svg" alt=""><span>Containers</span></button>
          <button class="nav-item" data-target="settings"><svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18"></svg><span>Settings</span></button>
        </nav>
        <button id="help-toggle" data-target="help">Help</button>
        <div id="confirm-dialog" class="modal hide">
          <div id="confirm-message"></div>
          <button id="confirm-cancel">Cancel</button>
          <button id="confirm-ok">Delete</button>
        </div>
      </main>
    `);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Event;
    delete global.KeyboardEvent;
    delete global.confirm;
  });

  it('Navigator opens Rules first and switches bottom tabs', async () => {
    const { default: Navigator } = await import('../Navigator.js');

    expect(Navigator.current).toBe('rules');
    expect(Array.from(document.querySelectorAll('.bottom-nav .nav-item')).map(btn => btn.dataset.target)).toEqual([
      'rules',
      'containers',
      'settings',
    ]);
    expect(document.querySelector('#rules-screen').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-target="rules"]').classList.contains('active')).toBe(true);

    click('[data-target="containers"]');

    expect(Navigator.current).toBe('containers');
    expect(document.querySelector('#containers-screen').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-target="containers"]').classList.contains('active')).toBe(true);
  });

  it('create container stays on subpage with inline error until input is valid', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {},
    });

    click('[data-action="open-create-container"]');
    click('.containers-create-page [data-icon-choice="play"]');
    click('[data-action="submit-create-container"]');

    expect(document.querySelector('.containers-create-page').classList.contains('active')).toBe(true);
    expect(document.querySelectorAll('.containers-create-group .setting-row')).toHaveLength(3);
    expect(document.querySelector('[data-action="submit-create-container"]').textContent).toBe('Create');
    expect(document.querySelector('.containers-create-error').textContent).toContain('at least 2 characters');
    expect(document.querySelector('#container-icon').value).toBe('play');
    expect(document.querySelector('.containers-create-page [data-icon-choice="play"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-field="container-name"]').tagName).toBe('INPUT');
    expect(document.querySelector('[data-field="container-name"]').closest('.combo-field')).toBeNull();
    expect(ContextualIdentity.create).not.toHaveBeenCalled();

    input('[data-field="container-name"]', 'Research');
    click('[data-action="submit-create-container"]');
    await flush();

    expect(ContextualIdentity.create).toHaveBeenCalledWith('Research', {
      lifetime: 'forever',
      uiIcon: 'play',
    });
    expect(document.querySelector('.containers-main').classList.contains('active')).toBe(true);
  });

  it('delete container uses in-popup confirmation before removing owner data', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Media', cookieStoreId: 'firefox-container-2', colorCode: '#f63' },
      ],
      urlMaps: {
        'youtube.com': { host: 'youtube.com', cookieStoreId: 'firefox-container-2' },
      },
    });

    click('[data-action="delete-container"]');

    expect(document.querySelector('#confirm-dialog').classList.contains('active')).toBe(true);
    expect(document.querySelector('#confirm-message').textContent).toContain('Media');
    expect(document.querySelector('#confirm-message').textContent).toContain('will stay');
    expect(ContextualIdentity.remove).not.toHaveBeenCalled();

    click('#confirm-ok');
    await flush();

    expect(ContextualIdentity.remove).toHaveBeenCalledWith('firefox-container-2');
  });

  it('renders compact one-line container rows with Firefox owner actions and containTAB icons', async () => {
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
        { name: 'No Container', cookieStoreId: 'firefox-default', colorCode: '#999' },
      ],
      urlMaps: {
        'docs.example': { host: 'docs.example', cookieStoreId: 'firefox-container-1' },
        'mail.example': { host: 'mail.example', cookieStoreId: 'firefox-container-1' },
      },
    });

    const rows = document.querySelectorAll('.container-row');
    const workRow = rows[0];
    const defaultRow = rows[1];
    const main = document.querySelector('.containers-main');
    const mainChildClasses = Array.from(main.children).map(el => el.className);

    expect(mainChildClasses).toEqual(['rule-tools containers-tools', 'containers-list']);
    expect(main.querySelector('.section-head')).toBeNull();
    expect(main.querySelector('.containers-open-create-btn').classList.contains('local-action')).toBe(true);
    expect(main.querySelector('.containers-open-create-btn').textContent).toBe('Create');

    expect(Array.from(workRow.children).map(el => el.className)).toEqual([
      'container-identity container-pill',
      'sub container-meta',
      'lifetime-switch container-lifetime-btn on',
      'actions container-actions',
    ]);
    expect(workRow.querySelector('.container-name').textContent).toBe('Work');
    expect(workRow.querySelector('.container-rule-count').textContent).toBe('2 rules');
    expect(workRow.querySelector('.container-lifetime')).toBeNull();
    expect(workRow.querySelector('.container-meta').textContent).toBe('2 rules');
    expect(workRow.querySelector('[data-action="toggle-container-lifetime"]').dataset.lifetime).toBe('forever');
    expect(workRow.querySelector('[data-action="edit-container"]')).not.toBeNull();
    expect(workRow.querySelector('[data-action="delete-container"]')).not.toBeNull();
    expect(workRow.querySelector('.container-color-badge')).toBeNull();

    expect(Array.from(defaultRow.children).map(el => el.className)).toEqual([
      'container-identity container-pill',
      'sub container-meta',
    ]);
    expect(defaultRow.querySelector('.container-name').textContent).toBe('No Container');
    expect(defaultRow.querySelector('[data-action="edit-container"]')).toBeNull();
    expect(defaultRow.querySelector('[data-action="delete-container"]')).toBeNull();
  });

  it('containers search filters by container name only on each input', async () => {
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
        { name: 'Media', cookieStoreId: 'firefox-container-2', colorCode: '#f63' },
      ],
      urlMaps: {
        'mail.google.com': {
          host: 'mail.google.com',
          cookieStoreId: 'firefox-container-1',
          containerName: 'Work',
        },
        'youtube.com': {
          host: 'youtube.com',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
        },
      },
    });

    input('.containers-search-input', 'w');

    expect(Array.from(document.querySelectorAll('.container-row:not([hidden]) .container-name')).map(el => el.textContent)).toEqual(['Work']);
    expect(document.querySelector('.containers-empty').hidden).toBe(true);
    expect(document.querySelector('.containers-empty').getAttribute('aria-hidden')).toBe('true');

    input('.containers-search-input', 'mail');

    expect(visibleNodes('.container-row')).toHaveLength(0);
    expect(document.querySelector('.containers-empty').hidden).toBe(false);
    expect(document.querySelector('.containers-empty').getAttribute('aria-hidden')).toBe('false');

    input('.containers-search-input', 'delete');

    expect(visibleNodes('.container-row')).toHaveLength(0);
    expect(document.querySelector('.containers-empty').hidden).toBe(false);
    expect(document.querySelector('.containers-empty').getAttribute('aria-hidden')).toBe('false');

    input('.containers-search-input', 'missing');

    expect(visibleNodes('.container-row')).toHaveLength(0);
    expect(Array.from(document.querySelectorAll('.container-row')).every(row => row.hidden)).toBe(true);
    expect(document.querySelector('.containers-empty').hidden).toBe(false);
    expect(document.querySelector('.containers-empty').getAttribute('aria-hidden')).toBe('false');
    expect(document.querySelector('.containers-empty').textContent).toContain('No containers match');

    input('.containers-search-input', '');

    expect(Array.from(document.querySelectorAll('.container-row:not([hidden]) .container-name')).map(el => el.textContent)).toEqual(['Media', 'Work']);
    expect(document.querySelector('.containers-empty').hidden).toBe(true);
  });

  it('containers list is sorted by container name with No Container last', async () => {
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'zeta', cookieStoreId: 'firefox-container-3', colorCode: '#36f' },
        { name: 'No Container', cookieStoreId: 'firefox-default', colorCode: '#999' },
        { name: 'Alpha', cookieStoreId: 'firefox-container-1', colorCode: '#f63' },
        { name: 'media', cookieStoreId: 'firefox-container-2', colorCode: '#6f3' },
      ],
      urlMaps: {},
    });

    expect(Array.from(document.querySelectorAll('.container-row .container-name')).map(el => el.textContent)).toEqual([
      'Alpha',
      'media',
      'zeta',
      'No Container',
    ]);
  });

  it('edits containers in a subpage without opening a modal', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const ContainerExtension = (await import('../../ContainerExtension')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {
        'docs.example': { host: 'docs.example', cookieStoreId: 'firefox-container-1' },
      },
    });

    click('[data-action="edit-container"]');

    const page = document.querySelector('#edit-container-page');
    expect(page.classList.contains('active')).toBe(true);
    expect(document.querySelector('.containers-main').classList.contains('active')).toBe(false);
    expect(document.querySelector('.container-edit-modal')).toBeNull();
    expect(page.querySelector('.sub-title').textContent).toBe('Edit container');
    expect(page.querySelector('.container-name-edit').value).toBe('Work');
    expect(Array.from(page.querySelectorAll('.containers-create-field .title')).map(el => el.textContent)).toEqual([
      'Container name',
      'Icon',
      'Lifetime',
    ]);
    expect(page.querySelector('[data-action="save-container-edit"]')).not.toBeNull();
    expect(document.querySelector('.container-row').classList.contains('editing')).toBe(false);

    click('#edit-container-page [data-icon-choice="play"]');
    input('.container-name-edit', '');
    keydown('.container-name-edit', 'Enter');
    await flush();

    expect(ContextualIdentity.update).not.toHaveBeenCalled();
    expect(document.querySelector('#edit-container-page').classList.contains('active')).toBe(true);
    expect(document.querySelector('.container-edit-error').textContent).toContain('name');
    expect(document.querySelector('#edit-container-icon').value).toBe('play');
    expect(document.querySelector('#edit-container-page [data-icon-choice="play"]').classList.contains('active')).toBe(true);

    input('.container-name-edit', 'Work Dev');
    keydown('.container-name-edit', 'Enter');
    await flush();

    expect(ContextualIdentity.update).toHaveBeenCalledWith('firefox-container-1', { name: 'Work Dev', icon: 'fingerprint' });
    expect(ContainerExtension.set).not.toHaveBeenCalled();
  });

  it('renames containers without changing Firefox-native icons', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const ContainerExtension = (await import('../../ContainerExtension')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Gift Box', cookieStoreId: 'firefox-container-1', icon: 'gift' },
      ],
      urlMaps: {},
    });

    click('[data-action="edit-container"]');
    expect(document.querySelector('#edit-container-icon').value).toBe('');
    expect(document.querySelectorAll('#edit-container-page .icon-choice.active')).toHaveLength(0);
    input('.container-name-edit', 'Gift Work');
    keydown('.container-name-edit', 'Enter');
    await flush();

    expect(ContextualIdentity.update).toHaveBeenCalledWith('firefox-container-1', { name: 'Gift Work' });
    expect(ContainerExtension.set).not.toHaveBeenCalled();
  });

  it('container edit can explicitly change the Firefox-native icon', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const ContainerExtension = (await import('../../ContainerExtension')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'containers' },
      ],
      urlMaps: {},
    });

    click('[data-action="edit-container"]');
    click('#edit-container-page [data-icon-choice="briefcase"]');
    click('[data-action="save-container-edit"]');
    await flush();

    expect(ContextualIdentity.update).toHaveBeenCalledWith('firefox-container-1', { icon: 'briefcase' });
    expect(ContainerExtension.set).not.toHaveBeenCalled();
  });

  it('cancels container name edit without writing to Firefox', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {},
    });

    click('[data-action="edit-container"]');
    input('.container-name-edit', 'Draft');
    keydown('.container-name-edit', 'Escape');

    expect(ContextualIdentity.update).not.toHaveBeenCalled();
    expect(document.querySelector('#edit-container-page').classList.contains('active')).toBe(false);
    expect(document.querySelector('.container-name').textContent).toBe('Work');
  });

  it('keeps rule transfer visible through Settings and opens the import subpage', async () => {
    await import('../Navigator.js');
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {},
    });

    expect(document.querySelector('.rules-bulk-actions')).toBeNull();
    expect(document.querySelector('.rules-transfer-owner-actions').hidden).toBe(true);
    expect(document.querySelector('[data-action="import-rules"]')).not.toBeNull();

    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();
    const transferButtons = Array.from(document.querySelectorAll('.setting-actions .secondary')).map(btn => btn.textContent);
    expect(transferButtons).toEqual(['Import', 'Export']);

    click('.setting-actions .secondary');

    expect(document.querySelector('#rules-screen').classList.contains('active')).toBe(true);
    expect(document.querySelector('#import-rules-page').classList.contains('active')).toBe(true);
    expect(document.querySelector('#rules-main').classList.contains('active')).toBe(false);
    expect(document.querySelector('.rules-import-file-input')).toBeNull();
    expect(document.querySelector('.rules-import-textarea').rows).toBe(14);
    expect(document.querySelector('.rules-import-textarea').placeholder).toContain('host,containerName,enabled');
    expect(document.querySelector('[data-action="confirm-rule-import"]').disabled).toBe(true);
  });

  it('rule table projects renamed container names from current identities', async () => {
    const { default: RulesSection } = await import('../RulesSection.js');
    const rule = {
      host: 'mail.google.com',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
    };
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {
        'mail.google.com': rule,
      },
    });

    expect(document.querySelector('.rule-container-badge .container-pill-label').textContent).toBe('Work');

    RulesSection.update({
      identities: [
        { name: 'Work Dev', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {
        'mail.google.com': rule,
      },
    });

    expect(document.querySelector('.rule-container-badge .container-pill-label').textContent).toBe('Work Dev');

    input('.rules-search-input', 'work dev');

    expect(Array.from(document.querySelectorAll('.rule-row:not([hidden]) .rule-host')).map(el => el.textContent)).toEqual(['mail.google.com']);

    input('.rules-search-input', 'work old');

    expect(visibleNodes('.rule-row')).toHaveLength(0);
    expect(document.querySelector('.rules-empty').hidden).toBe(false);
  });

  it('rules search filters rows and Add rule opens the subpage flow', async () => {
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
        { name: 'Media', cookieStoreId: 'firefox-container-2', colorCode: '#f63' },
      ],
      urlMaps: {
        'mail.google.com': {
          host: 'mail.google.com',
          cookieStoreId: 'firefox-container-1',
          containerName: 'Work',
        },
        'youtube.com': {
          host: 'youtube.com',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
        },
      },
    });

    input('.rules-search-input', 'youtube');

    expect(Array.from(document.querySelectorAll('.rule-row:not([hidden]) .rule-host')).map(el => el.textContent)).toEqual(['youtube.com']);
    expect(document.querySelector('.rules-empty').hidden).toBe(true);

    input('.rules-search-input', 'work');

    expect(Array.from(document.querySelectorAll('.rule-row:not([hidden]) .rule-host')).map(el => el.textContent)).toEqual(['mail.google.com']);
    expect(document.querySelector('.rules-empty').hidden).toBe(true);

    input('.rules-search-input', 'delete');

    expect(visibleNodes('.rule-row')).toHaveLength(0);
    expect(document.querySelector('.rules-empty').hidden).toBe(false);
    expect(document.querySelector('.rules-empty').getAttribute('aria-hidden')).toBe('false');

    input('.rules-search-input', 'missing');

    expect(visibleNodes('.rule-row')).toHaveLength(0);
    expect(Array.from(document.querySelectorAll('.rule-row')).every(row => row.hidden)).toBe(true);
    expect(document.querySelector('.rules-empty').hidden).toBe(false);
    expect(document.querySelector('.rules-empty').getAttribute('aria-hidden')).toBe('false');
    expect(document.querySelector('.rules-empty').textContent).toContain('No rules match');

    input('.rules-search-input', '');
    expect(document.querySelector('#add-rule-page').classList.contains('active')).toBe(false);
    click('[data-action="focus-add-rule"]');

    expect(document.querySelector('#add-rule-page').classList.contains('active')).toBe(true);
    expect(document.querySelector('#rules-main').classList.contains('active')).toBe(false);
    expect(document.querySelector('.rules-add-form')).not.toBeNull();
    expect(document.querySelector('#back-to-rules')).not.toBeNull();
    expect(document.querySelector('[data-action="add-rule"]').textContent).toBe('Add rule');
  });

  it('settings surface exposes current GlobalConfig-backed fields only', async () => {
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const text = document.querySelector('#settings-content').textContent;
    expect(text).toContain('Default Container');
    expect(text).toContain('Container mode');
    expect(text).toContain('Keep old tabs');
    expect(text).not.toContain('Enable auto-container creation');
    expect(text).toContain('Default lifetime');
    expect(text).toContain('Appearance');
    expect(text).toContain('Theme');
    expect(text).toContain('Rule Transfer');
    expect(text).toContain('Import / Export rules');
    expect(text).toContain('Container mode for unmatched URLs');
    expect(text).toContain('Initial lifetime for auto-created containers');
    expect(text).toContain('Preserve the original tab when redirecting to a container');
    expect(text).toContain('Follow system, force light, or force dark');
    expect(text).toContain('Storage transfer actions for rule backup and restore');
    expect(text).not.toContain('Config path');
    expect(text).not.toContain('Owned by RulesSection');
    expect(text).not.toContain('Rules tab');
    expect(text).toContain('Danger Zone');
    expect(text).toContain('Reset to defaults');
    expect(text).not.toContain('matchDomainOnly');
    expect(text).not.toContain('ruleAddition');

    const transferButtons = Array.from(document.querySelectorAll('.setting-actions .secondary')).map(btn => btn.textContent);
    expect(transferButtons).toEqual(['Import', 'Export']);
  });

  it('help page explains hostname pattern matching without implying regex support', () => {
    const doc = new JSDOM(fs.readFileSync('src/ui/index.html', 'utf8')).window.document;
    const text = doc.querySelector('#help-screen')?.textContent || '';

    expect(text).toContain('Rules match the URL hostname only');
    expect(text).toContain('Rules are not regular expressions');
    expect(text).toContain('Use semicolons for OR logic');
    expect(text).toContain('@youtube; *.yahoo; example.com');
    expect(text).toContain('No regex syntax');
    expect(text).toContain('No path matching');
  });

  it('add rule uses a multiline host textarea and submits with Ctrl+Enter', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', colorCode: '#36f' },
      ],
      urlMaps: {},
    });

    click('[data-action="focus-add-rule"]');
    expect(document.querySelector('.rules-container-input').tagName).toBe('INPUT');
    expect(document.querySelector('.rules-container-input').value).toBe('');
    expect(document.querySelector('.rules-container-combo .combo-toggle')).not.toBeNull();
    expect(document.querySelector('.rules-host-input').tagName).toBe('TEXTAREA');
    expect(document.querySelector('.rules-host-input').rows).toBe(2);
    expect(document.querySelector('.rules-host-input').closest('.rules-page-field').classList.contains('textarea-row')).toBe(true);
    expect(document.querySelector('.rules-lifetime-toggle')).toBeNull();
    expect(Array.from(document.querySelectorAll('.rules-page-field .title')).map(el => el.textContent)).toEqual([
      'Container',
      'Host pattern',
    ]);
    input('.rules-host-input', '*.example.com');
    input('.rules-container-input', 'Work');
    keydown('.rules-host-input', 'Enter');
    await flush();

    expect(HostStorage.set).not.toHaveBeenCalled();

    keydown('.rules-host-input', 'Enter', { ctrlKey: true });
    await flush();

    expect(HostStorage.set).toHaveBeenCalledWith(expect.objectContaining({
      host: '*.example.com',
      containerName: 'Work',
    }));
  });

  it('rule container combo opens and navigates with Arrow keys in add and edit flows', async () => {
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      urlMaps: {
        'mail.google.com': {
          host: 'mail.google.com',
          cookieStoreId: 'firefox-container-1',
          containerName: 'Work',
        },
        'youtube.com': {
          host: 'youtube.com',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
        },
      },
    });

    click('[data-action="focus-add-rule"]');
    keydown('#new-container', 'ArrowDown');

    let combo = document.querySelector('.rules-container-combo.open');
    expect(combo).not.toBeNull();
    expect(combo.querySelector('.combo-menu').getAttribute('role')).toBe('listbox');
    expect(Array.from(combo.querySelectorAll('.combo-option')).every(option => option.getAttribute('role') === 'option')).toBe(true);
    expect(combo.querySelector('.combo-option.active').textContent).toContain('Media');

    keydown('#new-container', 'ArrowDown');
    expect(document.querySelector('.rules-container-combo.open .combo-option.active').textContent).toContain('Work');

    keydown('#new-container', 'ArrowUp');
    expect(document.querySelector('.rules-container-combo.open .combo-option.active').textContent).toContain('Media');

    keydown('#new-container', 'Enter');
    await flush();

    expect(document.querySelector('#new-container').value).toBe('Media');
    expect(document.querySelector('.rules-container-combo.open')).toBeNull();

    click('[data-edit-rule="mail.google.com"]');
    keydown('#edit-rule-container', 'ArrowDown');

    combo = document.querySelector('.rules-container-combo.open');
    expect(combo).not.toBeNull();
    expect(combo.querySelector('.combo-menu').getAttribute('role')).toBe('listbox');
    expect(combo.querySelector('.combo-option.active').textContent).toContain('Work');

    keydown('#edit-rule-container', 'Escape');
    expect(document.querySelector('.rules-container-combo.open')).toBeNull();
  });

  it('quick-add preselects the active host but leaves container input empty', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      selectedIdentity: { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      activeHost: 'mail.google.com',
      urlMaps: {},
    });

    click('[data-action="focus-add-rule"]');

    expect(document.querySelector('.rules-host-input').value).toBe('mail.google.com');
    expect(document.querySelector('.rules-container-input').value).toBe('');

    input('.rules-container-input', 'Media');
    keydown('.rules-host-input', 'Enter', { ctrlKey: true });
    await flush();

    expect(HostStorage.set).toHaveBeenCalledWith(expect.objectContaining({
      host: 'mail.google.com',
      cookieStoreId: 'firefox-container-2',
      containerName: 'Media',
      enabled: true,
    }));
  });

  it('add rule accepts semicolon-delimited host text and keeps one HostStorage row', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      urlMaps: {},
    });

    click('[data-action="focus-add-rule"]');
    input('.rules-host-input', '@youtube;\n*.yahoo');
    input('.rules-container-input', 'Media');
    keydown('.rules-host-input', 'Enter', { ctrlKey: true });
    await flush();

    expect(HostStorage.set).toHaveBeenCalledWith(expect.objectContaining({
      host: '@youtube; *.yahoo',
      cookieStoreId: 'firefox-container-2',
      containerName: 'Media',
    }));
  });

  it('add rule creates a missing container before writing the rule owner row', async () => {
    const ContextualIdentity = (await import('../../ContextualIdentity')).default;
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
      ],
      urlMaps: {},
    });

    click('[data-action="focus-add-rule"]');
    input('.rules-host-input', 'research.example');
    input('.rules-container-input', 'Research');
    keydown('.rules-host-input', 'Enter', { ctrlKey: true });
    await flush();

    expect(ContextualIdentity.create).toHaveBeenCalledWith('Research', {
      lifetime: 'forever',
    });
    expect(HostStorage.set).toHaveBeenCalledWith(expect.objectContaining({
      host: 'research.example',
      cookieStoreId: 'firefox-container-9',
      containerName: 'Research',
      enabled: true,
    }));
  });

  it('disabled rule rows mute pattern, icon, and actions together without lifetime controls', async () => {
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      urlMaps: {
        '@youtube; *.yahoo': {
          host: '@youtube; *.yahoo',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
          enabled: false,
        },
      },
    });

    const row = document.querySelector('.rule-row');
    expect(row.classList.contains('rule-disabled')).toBe(true);
    expect(row.querySelector('.rule-pattern').textContent).toBe('@youtube; *.yahoo');
    expect(row.querySelector('.rule-mini-icon')).not.toBeNull();
    expect(row.querySelector('[data-action="toggle-rule-lifetime"]')).toBeNull();
    expect(row.querySelector('.small-btn')).not.toBeNull();
  });

  it('container lifetime checkbox uses forever as checked state without temp styling', async () => {
    const ContainerExtension = (await import('../../ContainerExtension')).default;
    const { default: ContainersSection } = await import('../ContainersSection.js');
    ContainersSection.update({
      identities: [
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play', lifetime: 'forever' },
      ],
      urlMaps: {
        '@youtube; *.yahoo': {
          host: '@youtube; *.yahoo',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
          enabled: true,
        },
      },
    });

    let lifetime = document.querySelector('[data-action="toggle-container-lifetime"]');
    expect(lifetime.dataset.lifetime).toBe('forever');
    expect(lifetime.classList.contains('on')).toBe(true);
    expect(lifetime.classList.contains('is-temp')).toBe(false);
    expect(document.querySelector('.container-lifetime')).toBeNull();

    lifetime.click();
    await flush();

    expect(ContainerExtension.set).toHaveBeenCalledWith('firefox-container-2', { lifetime: 'untilLastTab' });
    lifetime = document.querySelector('[data-action="toggle-container-lifetime"]');
    expect(lifetime.dataset.lifetime).toBe('last-tab');
    expect(lifetime.classList.contains('on')).toBe(false);
    expect(lifetime.classList.contains('is-temp')).toBe(false);
    expect(document.querySelector('.container-lifetime')).toBeNull();

    lifetime.click();
    await flush();

    expect(ContainerExtension.set).toHaveBeenLastCalledWith('firefox-container-2', { lifetime: 'forever' });
    lifetime = document.querySelector('[data-action="toggle-container-lifetime"]');
    expect(lifetime.dataset.lifetime).toBe('forever');
    expect(lifetime.classList.contains('on')).toBe(true);
    expect(lifetime.classList.contains('is-temp')).toBe(false);
    expect(document.querySelector('.container-lifetime')).toBeNull();
  });

  it('delete rule uses in-popup confirmation before removing owner data', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      urlMaps: {
        '@youtube; *.yahoo': {
          host: '@youtube; *.yahoo',
          cookieStoreId: 'firefox-container-2',
          containerName: 'Media',
          enabled: true,
        },
      },
    });

    click('.rule-actions .delete');

    expect(document.querySelector('#confirm-dialog').classList.contains('active')).toBe(true);
    expect(document.querySelector('#confirm-message').textContent).toContain('@youtube; *.yahoo');
    expect(HostStorage.remove).not.toHaveBeenCalled();

    click('#confirm-cancel');
    expect(document.querySelector('#confirm-dialog').classList.contains('active')).toBe(false);
    expect(HostStorage.remove).not.toHaveBeenCalled();

    click('.rule-actions .delete');
    click('#confirm-ok');
    await flush();

    expect(HostStorage.remove).toHaveBeenCalledWith('@youtube; *.yahoo');
  });

  it('opens rule edit in the smoke-style subpage and writes through rule owners', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
        { name: 'Media', cookieStoreId: 'firefox-container-2', uiIcon: 'play' },
      ],
      urlMaps: {
        'mail.google.com': {
          host: 'mail.google.com',
          cookieStoreId: 'firefox-container-1',
          containerName: 'Work',
          enabled: true,
        },
      },
    });

    click('.rule-actions .small-btn');

    const page = document.querySelector('#edit-rule-page');
    expect(page.classList.contains('active')).toBe(true);
    expect(document.querySelector('#rules-main').classList.contains('active')).toBe(false);
    expect(page.querySelector('.sub-title').textContent).toBe('Edit rule');
    expect(Array.from(page.querySelectorAll('.rules-page-field .title')).map(el => el.textContent)).toEqual([
      'Container',
      'Host pattern',
    ]);
    expect(page.querySelector('.rule-host-edit').tagName).toBe('TEXTAREA');
    expect(page.querySelector('.rule-host-edit').rows).toBe(2);
    expect(page.querySelector('.rule-host-edit').closest('.rules-page-field').classList.contains('textarea-row')).toBe(true);

    input('#edit-rule-container', 'Media');
    input('#edit-rule-host', '@mail;\nmail.example.com');
    click('[data-action="save-rule-edit"]');
    await flush();
    await flush();

    expect(HostStorage.set).toHaveBeenCalledWith(expect.objectContaining({
      host: '@mail; mail.example.com',
      cookieStoreId: 'firefox-container-2',
      containerName: 'Media',
      enabled: true,
    }));
    expect(HostStorage.remove).toHaveBeenCalledWith('mail.google.com');
    expect(page.querySelector('[data-action="toggle-rule-lifetime"]')).toBeNull();
  });

  it('imports legacy and unresolved rule transfer rows without dropping owner data', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
      ],
      urlMaps: {},
    });

    const imported = await RulesSection.importRulesFromText([
      'host,containerName,enabled',
      'legacy.example,Work',
      'future.example,,Future,true',
      'off.example,firefox-container-1,Work,false',
    ].join('\n'));

    expect(imported).toBe(3);
    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'legacy.example',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    });
    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'future.example',
      cookieStoreId: '',
      containerName: 'Future',
      enabled: true,
    });
    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'off.example',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: false,
    });
  });

  it('exports rules as importable CSV without losing rule owner fields', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [],
      urlMaps: {
        'plain.example': {
          host: 'plain.example',
          cookieStoreId: 'firefox-default',
          containerName: 'No Container',
          enabled: true,
        },
        'future.example': {
          host: 'future.example',
          cookieStoreId: '',
          containerName: 'Future, Draft',
          enabled: false,
        },
      },
    });

    let exportedText = '';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blob.text().then(text => { exportedText = text; });
      return 'blob:rules';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    RulesSection.handleExport();
    await flush();
    HostStorage.set.mockClear();

    const imported = await RulesSection.importRulesFromText(exportedText);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(exportedText.split('\n')[0]).toBe('host,containerName,enabled');
    expect(exportedText).not.toContain('firefox-default');
    expect(exportedText).toContain('"Future, Draft"');
    expect(imported).toBe(2);
    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'plain.example',
      cookieStoreId: 'firefox-default',
      containerName: 'No Container',
      enabled: true,
    });
    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'future.example',
      cookieStoreId: '',
      containerName: 'Future, Draft',
      enabled: false,
    });
  });

  it('imports pasted rule transfer content from the import subpage', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { showToast } = await import('../toast');
    const { default: RulesSection } = await import('../RulesSection.js');
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
      ],
      urlMaps: {},
    });

    RulesSection.handleImport();
    expect(document.querySelector('#import-rules-page').classList.contains('active')).toBe(true);
    expect(document.querySelector('.rules-import-file-input')).toBeNull();
    input('.rules-import-textarea', 'legacy.example,Work');
    expect(document.querySelector('.rules-import-textarea').value).toBe('legacy.example,Work');
    expect(document.querySelector('[data-action="confirm-rule-import"]').disabled).toBe(false);

    click('[data-action="confirm-rule-import"]');
    await flush();

    expect(HostStorage.set).toHaveBeenCalledWith({
      host: 'legacy.example',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    });
    expect(showToast).toHaveBeenCalledWith('Imported 1 rule');
    expect(document.querySelector('#rules-main').classList.contains('active')).toBe(true);
    expect(document.querySelector('#import-rules-page').classList.contains('active')).toBe(false);
  });

  it('shows a popup message when rule import fails', async () => {
    const HostStorage = (await import('../../Storage/HostStorage')).default;
    const { showToast } = await import('../toast');
    const { default: RulesSection } = await import('../RulesSection.js');
    HostStorage.set.mockRejectedValueOnce(new Error('storage locked'));
    RulesSection.update({
      identities: [
        { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase' },
      ],
      urlMaps: {},
    });

    RulesSection.handleImport();
    input('.rules-import-textarea', 'legacy.example,Work');
    click('[data-action="confirm-rule-import"]');
    await flush();

    expect(showToast).toHaveBeenCalledWith('Import failed: storage locked');
    expect(document.querySelector('.rules-import-error').textContent).toBe('Import failed: storage locked');
    expect(document.querySelector('#import-rules-page').classList.contains('active')).toBe(true);
  });

  it('settings dependent fields enabled when defaultContainer is on', async () => {
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const strategy = document.querySelector('[name="defaultContainer.containerStrategy"]');
    const lifetime = document.querySelector('[name="defaultContainer.lifetime"]');
    expect(strategy.disabled).toBe(false);
    expect(lifetime.disabled).toBe(false);
    expect(strategy.options[0].value).toBe('one_tab_one_world');
    expect(strategy.options[0].textContent).toBe('bytab');

    expect(strategy.closest('.setting-row').classList.contains('disabled-row')).toBe(false);
    expect(lifetime.closest('.setting-row').classList.contains('disabled-row')).toBe(false);
  });

  it('settings hides auto-container toggle and leaves default controls enabled when internal gate is false', async () => {
    const GlobalConfig = (await import('../../GlobalConfig')).default;
    GlobalConfig.get.mockResolvedValueOnce({
      ...defaultConfig,
      defaultContainer: {
        ...defaultConfig.defaultContainer,
        enabled: false,
      },
    });
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const strategy = document.querySelector('[name="defaultContainer.containerStrategy"]');
    const lifetime = document.querySelector('[name="defaultContainer.lifetime"]');
    expect(document.querySelector('#pref-defaultContainer-enabled')).toBeNull();
    expect(strategy.disabled).toBe(false);
    expect(lifetime.disabled).toBe(false);
  });

  it('settings exposes Theme select in Implemented bucket with system default', async () => {
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const select = document.querySelector('#pref-theme');
    expect(select).not.toBeNull();
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('system');

    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(options).toEqual(['system', 'light', 'dark']);
  });

  it('settings Theme select dark writes pref and applies data-theme', async () => {
    const GlobalConfig = (await import('../../GlobalConfig')).default;
    GlobalConfig.set.mockResolvedValueOnce({ ...defaultConfig, theme: 'dark' });
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const select = document.querySelector('#pref-theme');
    select.value = 'dark';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();

    expect(GlobalConfig.set).toHaveBeenCalledWith({ theme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('settings Theme select system removes data-theme attribute', async () => {
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    document.documentElement.setAttribute('data-theme', 'dark');
    const select = document.querySelector('#pref-theme');
    select.value = 'system';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('settings Theme select rollback restores prev value on storage failure', async () => {
    const GlobalConfig = (await import('../../GlobalConfig')).default;
    GlobalConfig.set.mockRejectedValueOnce(new Error('boom'));
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const select = document.querySelector('#pref-theme');
    select.value = 'dark';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();
    await flush();

    expect(select.value).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('settings Reset re-applies theme to default system', async () => {
    const GlobalConfig = (await import('../../GlobalConfig')).default;
    GlobalConfig.reset.mockReset().mockResolvedValue();
    GlobalConfig.get.mockReset().mockResolvedValue(defaultConfig);
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    document.documentElement.setAttribute('data-theme', 'dark');
    global.confirm = vi.fn(() => true);
    await SettingsSection.handleReset();
    await flush();
    await flush();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('settings switch rollback restores aria-pressed on storage failure', async () => {
    const GlobalConfig = (await import('../../GlobalConfig')).default;
    GlobalConfig.set.mockRejectedValueOnce(new Error('boom'));
    const { default: SettingsSection } = await import('../SettingsSection.js');
    await SettingsSection.onShow();

    const toggle = document.querySelector('#pref-keepOldTabs');
    const prevPressed = toggle.getAttribute('aria-pressed');
    toggle.click();
    await flush();
    await flush();

    expect(toggle.getAttribute('aria-pressed')).toBe(prevPressed);
    expect(toggle.classList.contains('on')).toBe(prevPressed === 'true');
  });

  it('three bottom-nav icons share identical width and height attributes', async () => {
    await import('../Navigator.js');

    const icons = document.querySelectorAll('.bottom-nav .nav-icon');
    expect(icons).toHaveLength(3);

    const dims = Array.from(icons).map(el => ({
      w: el.getAttribute('width'),
      h: el.getAttribute('height'),
    }));

    // All three must declare the same width/height attributes; mixing <img>
    // (which omits width/height attribute and relies on CSS) with <svg> (which
    // sets viewBox-derived dimensions) requires CSS-level locking via
    // .nav-icon { width: 18px; height: 18px; display: block }.
    const svgDims = dims.filter(d => d.w !== null);
    svgDims.forEach(d => {
      expect(d.w).toBe('18');
      expect(d.h).toBe('18');
    });
  });
});
