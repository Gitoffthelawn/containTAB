import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../ContextualIdentity', () => ({
  default: {
    create: vi.fn().mockResolvedValue({ cookieStoreId: 'firefox-container-9', name: 'Research' }),
    remove: vi.fn().mockResolvedValue(),
    update: vi.fn().mockResolvedValue(),
  },
  NO_CONTAINER: { name: 'No Container', cookieStoreId: 'firefox-default', colorCode: '#999' },
}));

vi.mock('../../ContainerExtension', () => ({
  default: {
    get: vi.fn((cookieStoreId) => Promise.resolve({
      lifetime: cookieStoreId === 'firefox-container-4' ? 'untilLastTab' : 'forever',
    })),
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

vi.mock('../../GlobalConfig', () => ({
  default: {
    get: vi.fn().mockResolvedValue(defaultConfig),
    set: vi.fn().mockResolvedValue(defaultConfig),
    reset: vi.fn().mockResolvedValue(),
  },
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

function docFromFile(path) {
  return new JSDOM(fs.readFileSync(path, 'utf8')).window.document;
}

function setupRuntimeDom() {
  const dom = new JSDOM(fs.readFileSync('src/ui/index.html', 'utf8'), {
    url: 'moz-extension://contain-tab/ui/index.html',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.confirm = vi.fn(() => true);
  return dom.window.document;
}

function text(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function firstNonBadgeLabel(item) {
  return Array.from(item.querySelectorAll('span'))
    .find(span => !span.classList.contains('nav-badge'))?.textContent.trim() || '';
}

function navSignature(doc, attrName) {
  const keyMap = { overview: 'containers' };
  return Array.from(doc.querySelectorAll('.bottom-nav .nav-item')).map(item => ({
    key: keyMap[item.getAttribute(attrName)] || item.getAttribute(attrName),
    label: firstNonBadgeLabel(item),
    hasBadge: !!item.querySelector('.nav-badge'),
    active: item.classList.contains('active'),
  }));
}

function actionKinds(scope) {
  return Array.from(scope.querySelectorAll('button')).map((button) => {
    const label = `${button.title || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
    if (button.classList.contains('delete') || label.includes('delete')) return 'delete';
    if (label.includes('edit')) return 'edit';
    if (button.hasAttribute('data-switch') || button.classList.contains('rule-toggle') || label.includes('toggle')) return 'toggle';
    if (button.classList.contains('confirm') || label.includes('save') || label.includes('add')) return 'confirm';
    if (label.includes('cancel')) return 'cancel';
    return 'button';
  });
}

function classListSignature(scope) {
  return Array.from(scope.children).map(child => child.className);
}

function containerRowSignature(row) {
  return {
    children: classListSignature(row),
    name: text(row.querySelector('.container-name')),
    ruleCount: text(row.querySelector('.container-rule-count')),
    hasLifetimeText: !!row.querySelector('.container-lifetime'),
    hasLifetimeToggle: !!row.querySelector('.container-lifetime-btn[data-action="toggle-container-lifetime"][data-lifetime]'),
    hasIcon: !!row.querySelector('.container-icon .svg-icon, .container-icon svg'),
    containerIconUsesSettingClass: !!row.querySelector('.container-icon.setting-icon'),
    actions: actionKinds(row.querySelector('.container-actions, .actions')),
  };
}

function ruleRowSignature(row) {
  return {
    hasContainerPill: !!row.querySelector('.container-pill'),
    hasContainerIcon: !!row.querySelector('.rule-mini-icon .svg-icon, .rule-mini-icon svg'),
    ruleIconUsesContainerClass: !!row.querySelector('.rule-mini-icon.container-icon'),
    hasContainerLabel: !!row.querySelector('.container-pill-label'),
    hasPattern: !!row.querySelector('.rule-pattern'),
    hasLifetime: !!row.querySelector('.lifetime-switch[data-action="toggle-rule-lifetime"][data-lifetime]'),
    actions: actionKinds(row.querySelector('.rule-actions')),
  };
}

function rulePageSignature(page) {
  return {
    title: text(page.querySelector('.sub-title, .title')),
    fields: Array.from(page.querySelectorAll('.rules-page-field')).map(row => ({
      title: text(row.querySelector('.title')),
      textareaRows: row.querySelector('textarea')?.rows || null,
      hasCheckbox: !!row.querySelector('input[type="checkbox"]'),
      checked: row.querySelector('input[type="checkbox"]')?.checked || false,
    })),
    primaryText: text(page.querySelector('.primary-action')),
    backId: page.querySelector('.back')?.id || '',
  };
}

function importPageSignature(page) {
  return {
    title: text(page.querySelector('.sub-title, .title')),
    hasFileInput: !!page.querySelector('.rules-import-file-input'),
    textareaRows: page.querySelector('.rules-import-textarea')?.rows || null,
    errorRole: page.querySelector('.rules-import-error')?.getAttribute('role'),
    primaryText: text(page.querySelector('.primary-action')),
    backId: page.querySelector('.back')?.id || '',
  };
}

function iconChoices(scope) {
  return Array.from(scope.querySelectorAll('.icon-choice')).map(button => (
    button.dataset.iconChoice || ''
  ).replace(/^icon-/, ''));
}

function settingSignature(scope) {
  return Array.from(scope.querySelectorAll('.settings-group')).map(group => ({
    title: text(group.querySelector('.settings-title')),
    rows: Array.from(group.querySelectorAll(':scope > .setting-row')).map(row => text(row.querySelector('.title'))),
  }));
}

function scssRule(source, selector) {
  const selectorPattern = selector
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const match = source.match(new RegExp(`(^|\\n)\\s*${selectorPattern}\\s*\\{`));
  if (!match) throw new Error(`Missing SCSS selector ${selector}`);
  const open = match.index + match[0].lastIndexOf('{');
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed SCSS selector ${selector}`);
}

function declaration(rule, property) {
  const match = rule.match(new RegExp(`${property}\\s*:\\s*([^;]+);`));
  return match?.[1]?.trim();
}

function declarations(source, selector, properties) {
  const rule = scssRule(source, selector);
  return Object.fromEntries(properties.map(property => [property, declaration(rule, property)]));
}

function cssBlock(source, selector) {
  return scssRule(source, selector);
}

async function renderRuntime() {
  const runtimeDoc = setupRuntimeDom();
  const identities = [
    { name: 'Work', cookieStoreId: 'firefox-container-1', uiIcon: 'briefcase', lifetime: 'forever' },
    { name: 'Study', cookieStoreId: 'firefox-container-2', uiIcon: 'book', lifetime: 'untilLastTab' },
    { name: 'Shopping', cookieStoreId: 'firefox-container-3', uiIcon: 'cart', lifetime: 'forever' },
    { name: 'Media', cookieStoreId: 'firefox-container-4', uiIcon: 'play', lifetime: 'untilLastTab' },
    { name: 'Banking', cookieStoreId: 'firefox-container-5', uiIcon: 'shield', lifetime: 'forever' },
  ];
  const urlMaps = {
    '@gmail; mail.google.com/*': {
      host: '@gmail; mail.google.com/*',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    },
    '@youtube; *.yahoo': {
      host: '@youtube; *.yahoo',
      cookieStoreId: 'firefox-container-4',
      containerName: 'Media',
      enabled: true,
    },
    'amazon.com/*': {
      host: 'amazon.com/*',
      cookieStoreId: 'firefox-container-3',
      containerName: 'Shopping',
      enabled: false,
    },
    'notion.so/*': {
      host: 'notion.so/*',
      cookieStoreId: 'firefox-container-1',
      containerName: 'Work',
      enabled: true,
    },
  };

  const { default: RulesSection } = await import('../RulesSection.js');
  const { default: ContainersSection } = await import('../ContainersSection.js');
  const { default: SettingsSection } = await import('../SettingsSection.js');

  RulesSection.update({ identities, selectedIdentity: identities[0], activeHost: '', urlMaps });
  RulesSection.mode = 'add';
  RulesSection.editingHost = '@gmail; mail.google.com/*';
  RulesSection.render();

  ContainersSection.update({ identities, urlMaps });
  ContainersSection.mode = 'create';
  ContainersSection.editingId = 'firefox-container-1';
  ContainersSection.editDraft = 'Work';
  ContainersSection.editIcon = 'briefcase';
  ContainersSection.editIconChanged = false;
  ContainersSection.render();

  SettingsSection.preferences = defaultConfig;
  SettingsSection.loaded = true;
  SettingsSection.render();

  await Promise.resolve();
  await Promise.resolve();
  return runtimeDoc;
}

describe('popup smoke element parity', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('keeps runtime shell, rows, dialogs, and settings aligned to smoke HTML elements', async () => {
    const smoke = docFromFile('docs/handbook/ui/smoke-prototype.html');
    const runtimeStatic = docFromFile('src/ui/index.html');
    const runtime = await renderRuntime();

    expect(navSignature(runtimeStatic, 'data-target')).toEqual(
      navSignature(smoke, 'data-tab'),
    );

    expect(text(runtime.querySelector('#confirm-cancel'))).toBe(text(smoke.querySelector('#cancel-delete')));
    expect(text(runtime.querySelector('#confirm-ok'))).toBe(text(smoke.querySelector('#confirm-delete')));

    expect(text(runtime.querySelector('#rules-search')?.closest('.search')?.querySelector('input'))).toBe('');
    expect(runtime.querySelector('#rules-search')?.getAttribute('placeholder')).toBe(
      smoke.querySelector('#rules-search')?.getAttribute('placeholder'),
    );
    expect(text(runtime.querySelector('#focus-add'))).toBe(text(smoke.querySelector('#focus-add')));

    const smokeRuleShape = ruleRowSignature(smoke.querySelector('.rule-row'));
    const runtimeRuleRows = Array.from(runtime.querySelectorAll('#rules-list .rule-row'));
    expect(runtimeRuleRows.length).toBeGreaterThan(0);
    expect(runtimeRuleRows.map(ruleRowSignature)).toEqual(
      runtimeRuleRows.map(() => smokeRuleShape),
    );
    expect(runtimeRuleRows.some(row => row.querySelector('.rule-mini-icon.container-icon'))).toBe(false);
    expect(smokeRuleShape.ruleIconUsesContainerClass).toBe(false);

    expect(rulePageSignature(runtime.querySelector('#add-rule-page'))).toEqual(
      rulePageSignature(smoke.querySelector('#add-rule-page')),
    );
    expect(rulePageSignature(runtime.querySelector('#edit-rule-page'))).toEqual(
      rulePageSignature(smoke.querySelector('#edit-rule-page')),
    );
    expect(importPageSignature(runtime.querySelector('#import-rules-page'))).toEqual(
      importPageSignature(smoke.querySelector('#import-rules-page')),
    );

    expect(runtime.querySelector('#overview-search')?.getAttribute('placeholder')).toBe(
      smoke.querySelector('#overview-search')?.getAttribute('placeholder'),
    );
    expect(text(runtime.querySelector('#open-create-container'))).toBe(text(smoke.querySelector('#open-create-container')));
    expect(runtime.querySelector('#overview-list .container-row .container-actions, #overview-list .container-row .actions')).not.toBeNull();
    expect(classListSignature(smoke.querySelector('#overview-list .container-row'))).toEqual([
      'container-identity container-pill',
      'sub container-meta',
      'lifetime-switch container-lifetime-btn on',
      'actions container-actions',
    ]);
    expect(containerRowSignature(runtime.querySelector('#overview-list .container-row'))).toEqual(
      containerRowSignature(smoke.querySelector('#overview-list .container-row')),
    );
    expect(runtime.querySelector('#overview-list .container-row .container-icon.setting-icon')).toBeNull();
    expect(smoke.querySelector('#overview-list .container-row .container-icon.setting-icon')).toBeNull();
    expect(actionKinds(runtime.querySelector('#overview-list .container-row'))).toEqual(
      actionKinds(smoke.querySelector('#overview-list .container-row')),
    );

    expect(iconChoices(runtime.querySelector('#create-container-page'))).toEqual(
      iconChoices(smoke.querySelector('#create-container-page')),
    );
    expect(iconChoices(runtime.querySelector('#edit-container-page'))).toEqual(
      iconChoices(smoke.querySelector('#edit-container-page')),
    );

    const runtimeIconCss = fs.readFileSync('src/ui/styles/_containers.scss', 'utf8');
    const smokeIconCss = fs.readFileSync('docs/handbook/assets/ui-smoke-prototype.css', 'utf8');
    const runtimeIconChoiceBlock = cssBlock(runtimeIconCss, '.icon-choice');
    expect(runtimeIconChoiceBlock).toContain('&:hover:not(.active)');
    expect(runtimeIconChoiceBlock).not.toContain('&:hover {');
    expect(smokeIconCss).toContain('.icon-choice:hover:not(.active)');
    expect(smokeIconCss).not.toContain('.icon-choice:hover {\n      color: var(--text);');

    expect(settingSignature(runtime.querySelector('#settings-content'))).toEqual(
      settingSignature(smoke.querySelector('#tab-settings')),
    );
    expect(Array.from(runtime.querySelector('#lifetime-row select').options).map(option => option.textContent)).toEqual(
      Array.from(smoke.querySelector('#lifetime-row select').options).map(option => option.textContent),
    );
  }, 30000);

  it('keeps rule icons the same rendered size as the real container list icons', () => {
    const rulesScss = fs.readFileSync('src/ui/styles/_rules.scss', 'utf8');
    const containersScss = fs.readFileSync('src/ui/styles/_containers.scss', 'utf8');
    const rowsScss = fs.readFileSync('src/ui/styles/_rows.scss', 'utf8');
    const smokeCss = fs.readFileSync('docs/handbook/assets/ui-smoke-prototype.css', 'utf8');
    const iconBoxProperties = ['width', 'height', 'border-radius', 'background', 'color', 'font-size', 'font-weight'];
    const rowMetricProperties = ['gap', 'min-height', 'padding', 'font-size'];
    const svgProperties = ['width', 'height'];
    const sharedIconSelector = '.container-icon,\n.rule-mini-icon,\n.setting-icon';

    expect(declarations(rulesScss, '.rule-row', rowMetricProperties)).toEqual(
      declarations(containersScss, '.container-row', rowMetricProperties),
    );
    expect(declaration(scssRule(rulesScss, '.rule-host'), 'font-size')).toBe(
      declaration(scssRule(containersScss, '.container-row'), 'font-size'),
    );
    expect(declarations(rowsScss, sharedIconSelector, iconBoxProperties)).toEqual({
      width: '$row-icon-box',
      height: '$row-icon-box',
      'border-radius': 'var(--radius-md)',
      background: 'var(--btn)',
      color: 'var(--text-muted)',
      'font-size': 'var(--text-small)',
      'font-weight': '600',
    });
    expect(declaration(scssRule(rowsScss, sharedIconSelector), 'border')).toBeUndefined();
    expect(declaration(scssRule(rowsScss, sharedIconSelector), 'flex')).toBe('0 0 $row-icon-box');
    expect(scssRule(rowsScss, sharedIconSelector)).toContain('width: $row-icon-size;');
    expect(scssRule(rowsScss, sharedIconSelector)).toContain('height: $row-icon-size;');
    expect(rulesScss).not.toMatch(/^\.rule-mini-icon\s*\{/m);
    expect(containersScss).not.toMatch(/^\.container-icon\s*\{/m);

    expect(declarations(smokeCss, '.rule-mini-icon', iconBoxProperties)).toEqual(
      declarations(smokeCss, '.container-icon', iconBoxProperties),
    );
    expect(declarations(smokeCss, '.rule-mini-icon .svg-icon', svgProperties)).toEqual(
      declarations(smokeCss, '.container-icon .svg-icon', svgProperties),
    );
    expect(declaration(scssRule(smokeCss, '.rule-row'), 'min-height')).toBe(
      declaration(scssRule(smokeCss, '.container-row'), 'min-height'),
    );
    expect(declaration(scssRule(smokeCss, '.rule-pattern'), 'font-size')).toBe(
      declaration(scssRule(smokeCss, '.container-name'), 'font-size'),
    );
    expect(declaration(scssRule(smokeCss, '.rules-page-field.textarea-row'), 'grid-template-columns')).toBe(
      'var(--row-icon-box) minmax(0, 1fr)',
    );
    expect(declaration(scssRule(smokeCss, '.rule-pattern-textarea'), 'min-height')).toBe('96px');
  });
});
