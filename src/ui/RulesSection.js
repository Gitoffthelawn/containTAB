/**
 * RulesSection — Rule CRUD with immediate storage writes.
 *
 * Add form at top, rule list below. Each action
 * (add/delete/toggle/edit) writes to HostStorage directly.
 * State listener auto-refreshes the list.
 */

import State from '../State';
import ContextualIdentity, {NO_CONTAINER} from '../ContextualIdentity';
import HostStorage from '../Storage/HostStorage';
import {qs, ce, cleanHostInput, focusSoon} from '../utils';
import {showToast} from './toast';
import {buildIcon} from './components/uiIcon';
import {primaryButton, iconButton, switchButton} from './components/button';
import {settingRow, subhead} from './components/field';
import {searchBar} from './components/searchBar';
import {containerPill} from './components/pill';
import {confirmDialog} from './components/confirmDialog';

function csvEscape(value = '') {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvLine(line) {
  const columns = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      columns.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  columns.push(value.trim());
  return columns;
}

function errorMessage(err) {
  return err?.message || String(err);
}

class RulesSection {
  constructor() {
    this.container = qs('#rules-content');
    this.rules = {};
    this.identities = [];
    this.editingHost = null;
    this.searchText = '';
    this.mode = 'list';
    this.selectedIdentity = null;
    this.activeHost = '';

    State.addListener(this.update.bind(this));
  }

  update(state, changedKey) {
    if (changedKey === 'urlMaps') { this.rules = state.urlMaps; this.render(); }
    else if (changedKey === 'identities') { this.identities = state.identities; this.render(); }
    else if (changedKey === 'selectedIdentity') { this.selectedIdentity = state.selectedIdentity; this.render(); }
    else if (changedKey === 'activeHost') { this.activeHost = state.activeHost || ''; this.render(); }
    else if (!changedKey) {
      this.rules = state.urlMaps || {};
      this.identities = state.identities || [];
      this.selectedIdentity = state.selectedIdentity || null;
      this.activeHost = state.activeHost || '';
      this.render();
    }
  }

  onShow() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    if (this.mode === 'edit' && (!this.editingHost || !this.rules[this.editingHost])) {
      this.editingHost = null;
      this.mode = 'list';
    }

    this.container.appendChild(this.buildMainPage());
    this.container.appendChild(this.buildAddPage());
    this.container.appendChild(this.buildEditPage());
    this.container.appendChild(this.buildImportPage());
  }

  buildMainPage() {
    const page = ce('div');
    page.className = 'rules-main subpage';
    page.id = 'rules-main';
    if (this.mode === 'list') page.classList.add('active');
    page.append(this.buildTools(), this.buildRuleList(), this.buildTransferActions());
    return page;
  }

  buildTools() {
    const wrap = ce('div');
    wrap.className = 'rule-tools';

    const {label: search} = searchBar({
      labelClass: 'search rules-search', inputId: 'rules-search', inputClass: 'rules-search-input',
      placeholder: 'rules...', value: this.searchText,
      onInput: (e) => { this.searchText = e.target.value; this.renderRuleListOnly(); },
    });

    const focusAdd = primaryButton({
      icon: 'plus', text: 'Add rule', className: 'btn local-action rules-focus-add-btn',
      title: 'Add rule', ariaLabel: 'Add rule', dataAction: 'focus-add-rule',
    });
    focusAdd.id = 'focus-add';
    focusAdd.addEventListener('click', () => {
      this.mode = 'add';
      this.render();
      focusSoon('.rules-host-input');
    });

    wrap.append(search, focusAdd);
    return wrap;
  }

  // --- Add Form ---

  buildAddPage() {
    const page = ce('div');
    page.className = 'rules-add-page subpage';
    page.id = 'add-rule-page';
    if (this.mode === 'add') page.classList.add('active');

    const head = this.buildSubhead('Add rule', 'Create a host rule', 'back-to-rules');

    const form = ce('div');
    form.className = 'settings-group rules-add-form rules-add-group';

    const hostInput = this.buildRulePatternTextarea({
      className: 'field rules-host-input',
      placeholder: 'Host patterns (e.g. @youtube; *.yahoo)',
      value: this.activeHost || '',
    });
    hostInput.id = 'new-host';

    const containerInput = this.buildContainerCombo('', 'new-container');

    const addBtn = primaryButton({
      icon: 'check', text: 'Add rule', className: 'primary-action rules-add-btn',
      title: 'Add rule', ariaLabel: 'Add rule', dataAction: 'add-rule', disabled: true,
    });

    const validateAdd = () => {
      const host = this.normalizePatternInput(hostInput.value);
      const name = this.containerNameForSelect(containerInput);
      addBtn.disabled = !host || !name || !this.isValidPattern(host);
    };

    hostInput.addEventListener('input', validateAdd);
    containerInput.addEventListener('input', validateAdd);
    validateAdd();

    addBtn.addEventListener('click', () => {
      this.handleAdd(hostInput, containerInput);
    });

    hostInput.addEventListener('keydown', (e) => {
      if (this.isSubmitKey(e) && !addBtn.disabled) {
        e.preventDefault();
        this.handleAdd(hostInput, containerInput);
      } else if (e.key === 'Escape') {
        this.mode = 'list';
        this.render();
      }
    });
    containerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !addBtn.disabled) this.handleAdd(hostInput, containerInput);
    });

    form.append(
      this.buildPageField('containers', 'Container', 'Rule target container', containerInput),
      this.buildPageField('edit', 'Host pattern', 'Use semicolons for multiple match strings', hostInput),
    );

    page.append(head, form, addBtn);
    return page;
  }

  buildSubhead(titleText, description, backAction) {
    const {head, back} = subhead({titleText, description, backId: backAction, backAriaLabel: 'Back to rules'});
    back.addEventListener('click', () => {
      this.mode = 'list';
      this.render();
    });
    return head;
  }

  buildPageField(iconName, titleText, description, control) {
    const row = settingRow({
      icon: iconName, titleText, description, control,
      rowClass: 'setting-row rules-page-field',
      titleClass: 'field-title title',
      subClass: 'field-description sub',
    });
    if (control.classList?.contains('rule-pattern-textarea')) row.classList.add('textarea-row');
    return row;
  }

  buildRulePatternTextarea({ className, placeholder = '', value = '' }) {
    const textarea = ce('textarea');
    textarea.className = `${className} rule-pattern-textarea`;
    textarea.placeholder = placeholder;
    textarea.autocomplete = 'off';
    textarea.spellcheck = false;
    textarea.rows = 2;
    textarea.value = value;
    return textarea;
  }

  isSubmitKey(event) {
    return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
  }

  buildEditPage() {
    const page = ce('div');
    page.className = 'rules-edit-page subpage';
    page.id = 'edit-rule-page';
    if (this.mode === 'edit') page.classList.add('active');

    const host = this.editingHost;
    const rule = this.rules[host];
    if (!host || !rule) {
      return page;
    }

    const head = this.buildSubhead('Edit rule', host, 'back-from-rule-edit');

    const form = ce('div');
    form.className = 'settings-group rules-edit-form rules-add-group';

    const containerInput = this.buildContainerCombo(this.containerNameForRule(rule), 'edit-rule-container');

    const hostInput = this.buildRulePatternTextarea({
      className: 'field rule-host-edit',
      value: host,
    });
    hostInput.id = 'edit-rule-host';

    const saveBtn = primaryButton({
      icon: 'check', text: 'Save rule', className: 'primary-action rules-add-btn rules-save-btn',
      title: 'Save rule', ariaLabel: 'Save rule', dataAction: 'save-rule-edit',
    });

    const validateEdit = () => {
      const nextHost = this.normalizePatternInput(hostInput.value);
      const name = this.containerNameForSelect(containerInput);
      saveBtn.disabled = !nextHost || !name || !this.isValidPattern(nextHost);
    };

    hostInput.addEventListener('input', validateEdit);
    containerInput.addEventListener('input', validateEdit);
    validateEdit();

    saveBtn.addEventListener('click', () => {
      this.handleEditRule(host, rule, hostInput.value, containerInput);
    });

    hostInput.addEventListener('keydown', (e) => {
      if (this.isSubmitKey(e) && !saveBtn.disabled) {
        e.preventDefault();
        this.handleEditRule(host, rule, hostInput.value, containerInput);
      } else if (e.key === 'Escape') {
        this.editingHost = null;
        this.mode = 'list';
        this.render();
      }
    });
    containerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !saveBtn.disabled) {
        this.handleEditRule(host, rule, hostInput.value, containerInput);
      }
    });

    form.append(
      this.buildPageField('containers', 'Container', 'Rule target container', containerInput),
      this.buildPageField('edit', 'Host pattern', 'Use semicolons for multiple match strings', hostInput),
    );

    page.append(head, form, saveBtn);
    return page;
  }

  isValidPattern(host) {
    const tokens = this.patternTokens(host);
    return tokens.length > 0 && tokens.every(token => this.isValidPatternToken(token));
  }

  patternTokens(host) {
    return (host || '').split(';').map(token => token.trim()).filter(Boolean);
  }

  normalizePatternInput(host) {
    return this.patternTokens(cleanHostInput(host)).join('; ');
  }

  resolveContainerForAdd(containerName) {
    const identity = this.identities.find(i => i.name === containerName);
    if (identity) return Promise.resolve(identity);
    return ContextualIdentity.create(containerName, {lifetime: 'forever'});
  }

  isValidPatternToken(host) {
    // fragment: @text — need at least 1 char after @
    if (host[0] === '@') return host.length > 1 && !/\s/.test(host);
    // glob/exact: no spaces, no consecutive dots
    if (/\s/.test(host)) return false;
    if (host.includes('..')) return false;
    return true;
  }

  handleAdd(hostInput, containerInput) {
    const host = this.normalizePatternInput(hostInput.value);
    const containerName = this.containerNameForSelect(containerInput);

    if (!host || !this.isValidPattern(host)) { showToast('Enter a valid host pattern'); return; }
    if (!containerName) { showToast('Enter a container name'); return; }
    if (this.rules[host]) { showToast(`Rule for "${host}" already exists`); return; }

    hostInput.disabled = true;
    this.setContainerComboDisabled(containerInput, true);

    this.resolveContainerForAdd(containerName).then((identity) => HostStorage.set({
      host,
      cookieStoreId: identity?.cookieStoreId || '',
      containerName: identity?.name || containerName,
      enabled: true,
    }).then(() => identity)).then((identity) => {
      const resolvedName = identity?.name || containerName;
      hostInput.value = '';
      this.setContainerComboValue(containerInput, '');
      hostInput.disabled = false;
      this.setContainerComboDisabled(containerInput, false);
      this.mode = 'list';
      this.render();
      console.info('containTAB: rule added:', host, '→', resolvedName);
    }).catch(err => {
      hostInput.disabled = false;
      this.setContainerComboDisabled(containerInput, false);
      showToast(`Failed to add rule: ${err}`);
    });
  }

  // --- Container Select ---

  buildContainerSelect(selectedId) {
    const select = ce('select');
    select.className = 'rules-container-select';

    const emptyOpt = ce('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- container --';
    select.appendChild(emptyOpt);

    this.identities.forEach(identity => {
      const opt = ce('option');
      opt.value = identity.cookieStoreId;
      opt.textContent = identity.name;
      if (identity.cookieStoreId === selectedId) opt.selected = true;
      select.appendChild(opt);
    });

    return select;
  }

  buildContainerCombo(value = '', inputId = '') {
    const wrap = ce('span');
    wrap.className = 'combo-field rules-container-combo';

    const input = ce('input');
    input.type = 'text';
    input.className = 'field rules-container-input';
    input.autocomplete = 'off';
    input.value = value;
    if (inputId) input.id = inputId;

    const toggle = ce('button');
    toggle.type = 'button';
    toggle.className = 'combo-toggle';
    toggle.setAttribute('aria-label', 'Show containers');
    toggle.appendChild(buildIcon('chevron'));

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleContainerMenu(wrap, input);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!wrap.classList.contains('open')) {
          this.openContainerMenu(wrap, input);
        } else {
          this.setComboActiveOption(wrap, Number(wrap.dataset.activeIndex || '0') + 1);
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!wrap.classList.contains('open')) {
          this.openContainerMenu(wrap, input);
        } else {
          this.setComboActiveOption(wrap, Number(wrap.dataset.activeIndex || '0') - 1);
        }
      } else if (event.key === 'Enter' && wrap.classList.contains('open')) {
        const option = wrap.querySelectorAll('.combo-option')[Number(wrap.dataset.activeIndex || '0')];
        if (option) {
          event.preventDefault();
          this.selectComboOption(wrap, option);
        }
      } else if (event.key === 'Escape') {
        this.closeContainerMenus();
      }
    });

    wrap.append(input, toggle);
    return wrap;
  }

  closeContainerMenus(except = null) {
    document.querySelectorAll('.rules-container-combo.open').forEach((wrap) => {
      if (wrap === except) return;
      wrap.classList.remove('open');
      wrap.querySelector('.combo-menu')?.remove();
      wrap.removeAttribute('aria-activedescendant');
      delete wrap.dataset.activeIndex;
    });
  }

  toggleContainerMenu(wrap, input) {
    if (wrap.classList.contains('open')) {
      this.closeContainerMenus();
      return;
    }
    this.openContainerMenu(wrap, input);
    input.focus();
  }

  openContainerMenu(wrap, input) {
    this.closeContainerMenus(wrap);
    wrap.querySelector('.combo-menu')?.remove();

    const menu = ce('div');
    menu.className = 'combo-menu';
    menu.setAttribute('role', 'listbox');

    const names = this.collectContainerNames();

    if (names.length === 0) {
      const empty = ce('div');
      empty.className = 'combo-empty';
      empty.textContent = 'No containers';
      menu.appendChild(empty);
    } else {
      names.forEach((name) => {
        const option = ce('button');
        option.type = 'button';
        option.className = 'combo-option';
        option.dataset.value = name;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.append(
          this.buildContainerIcon(name),
          document.createTextNode(name),
        );
        option.addEventListener('click', () => this.selectComboOption(wrap, option));
        menu.appendChild(option);
      });
    }

    wrap.appendChild(menu);
    wrap.classList.add('open');
    this.setComboActiveOption(wrap, Math.max(0, names.indexOf(input.value)));
  }

  setComboActiveOption(wrap, nextIndex) {
    const options = Array.from(wrap?.querySelectorAll('.combo-option') || []);
    if (!options.length) return;
    const bounded = (nextIndex + options.length) % options.length;
    wrap.dataset.activeIndex = String(bounded);
    options.forEach((option, index) => {
      const active = index === bounded;
      option.classList.toggle('active', active);
      option.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        if (!option.id) option.id = `combo-option-${Date.now()}-${index}`;
        wrap.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView?.({ block: 'nearest' });
      }
    });
  }

  selectComboOption(wrap, option) {
    const input = wrap?.querySelector?.('input');
    const name = option?.dataset.value || option?.querySelector?.('.container-pill-label')?.textContent || '';
    if (!input || !name) return;
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.closeContainerMenus();
    input.focus();
  }

  collectContainerNames() {
    const names = new Set();
    this.identities.forEach((identity) => {
      const name = (identity?.name || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  containerNameForRule(rule) {
    return this.identityNameForRule(rule)
      || rule.containerName
      || '';
  }

  identityNameForRule(rule) {
    if (!rule?.cookieStoreId) return '';
    return this.identities.find(i => i.cookieStoreId === rule.cookieStoreId)?.name || '';
  }

  containerNameForSelect(input) {
    const field = input?.matches?.('.rules-container-input')
      ? input
      : input?.querySelector?.('.rules-container-input');
    return field?.value?.trim() || '';
  }

  setContainerComboValue(combo, value) {
    const field = combo?.matches?.('.rules-container-input')
      ? combo
      : combo?.querySelector?.('.rules-container-input');
    if (field) field.value = value;
  }

  setContainerComboDisabled(combo, disabled) {
    const field = combo?.matches?.('.rules-container-input')
      ? combo
      : combo?.querySelector?.('.rules-container-input');
    const toggle = combo?.querySelector?.('.combo-toggle');
    if (field) field.disabled = disabled;
    if (toggle) toggle.disabled = disabled;
  }

  // --- Rule List ---

  buildRuleList() {
    const list = ce('div');
    list.className = 'rules-list';
    list.id = 'rules-list';

    const entries = this.filteredRuleEntries();
    entries.forEach(([host, rule]) => {
      const row = this.buildRuleRow(host, rule);
      list.appendChild(row);
    });

    const empty = ce('div');
    empty.className = 'rules-empty';
    empty.id = 'rules-empty';
    empty.textContent = 'No rules match.';
    empty.hidden = entries.length > 0;
    empty.setAttribute('aria-hidden', entries.length > 0 ? 'true' : 'false');
    list.appendChild(empty);

    return list;
  }

  sortedRuleEntries() {
    return Object.entries(this.rules)
      .sort(([hostA, ruleA], [hostB, ruleB]) => {
        const nameA = this.containerNameForRule(ruleA).toLowerCase();
        const nameB = this.containerNameForRule(ruleB).toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return hostA.localeCompare(hostB);
      });
  }

  filteredRuleEntries() {
    const needle = this.searchText.trim().toLowerCase();
    const entries = this.sortedRuleEntries();
    if (!needle) return entries;
    return entries.filter(([host, rule]) => this.ruleSearchText(host, rule).includes(needle));
  }

  ruleSearchText(host, rule) {
    return [
      host,
      this.containerNameForRule(rule),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  renderRuleListOnly() {
    const current = this.container.querySelector('.rules-list');
    if (current) current.replaceWith(this.buildRuleList());
  }

  buildRuleRow(host, rule) {
    const row = ce('div');
    row.className = 'rule-row';
    row.dataset.search = this.ruleSearchText(host, rule);
    if (rule.enabled === false) row.classList.add('disabled', 'rule-disabled');

    // Host label (click to edit)
    const hostEl = ce('div');
    hostEl.className = 'rule-host rule-pattern';

    hostEl.textContent = host;
    hostEl.addEventListener('click', () => {
      this.editingHost = host;
      this.mode = 'edit';
      this.render();
      focusSoon('.rule-host-edit');
    });

    // Container badge (click to change)
    const identity = this.identities.find(i => i.cookieStoreId === rule.cookieStoreId);
    const {pill: badge} = containerPill({
      uiIcon: identity?.uiIcon || this.iconForContainer(identity?.name) || 'containers',
      labelText: identity?.name || rule.containerName || rule.cookieStoreId || 'Unbound',
      pillClass: 'rule-container-badge container-pill',
      iconClass: 'rule-mini-icon',
      labelClass: 'container-pill-label',
    });
    badge.title = 'Click to change container';
    badge.addEventListener('click', () => {
      const select = this.buildContainerSelect(rule.cookieStoreId);
      select.className = 'rule-container-inline-select';
      select.addEventListener('change', () => {
        const newId = select.value;
        if (newId && newId !== rule.cookieStoreId) {
          const newIdentity = this.identities.find(i => i.cookieStoreId === newId);
          HostStorage.set({
            ...rule,
            host,
            cookieStoreId: newId,
            containerName: newIdentity ? newIdentity.name : '',
          });
        }
        this.render();
      });
      select.addEventListener('blur', () => this.render());
      badge.replaceWith(select);
      select.focus();
    });

    // Enable toggle
    const toggle = switchButton({
      on: rule.enabled !== false,
      className: 'rule-toggle settings-switch',
      dataSwitch: true,
      title: rule.enabled !== false ? 'Enabled' : 'Disabled',
      ariaLabel: `Toggle ${host}`,
    });
    toggle.addEventListener('click', () => {
      const next = !toggle.classList.contains('on');
      toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-pressed', String(next));
      this.handleToggle(host, rule, next);
    });

    // Delete button
    const delBtn = this.buildSmallButton('trash', 'Delete rule');
    delBtn.classList.add('delete');
    delBtn.dataset.deleteRule = host;
    delBtn.addEventListener('click', () => {
      this.handleDelete(host);
    });

    const actions = ce('div');
    actions.className = 'rule-actions';
    const editBtn = this.buildSmallButton('edit', 'Edit rule');
    editBtn.dataset.editRule = host;
    editBtn.addEventListener('click', () => {
      this.editingHost = host;
      this.mode = 'edit';
      this.render();
      focusSoon('.rule-host-edit');
    });
    actions.append(editBtn, delBtn, toggle);

    row.append(badge, hostEl, actions);
    return row;
  }

  buildContainerIcon(identity) {
    const icon = ce('span');
    icon.className = 'rule-mini-icon';
    const iconId = typeof identity === 'string'
      ? this.iconForContainer(identity)
      : identity?.uiIcon || this.iconForContainer(identity?.name) || 'containers';
    icon.appendChild(buildIcon(iconId));
    return icon;
  }

  iconForContainer(name) {
    const identity = this.identities.find((item) => item.name === name);
    return identity?.uiIcon || 'containers';
  }

  buildSmallButton(iconName, label) {
    return iconButton({icon: iconName, label, className: 'small-btn'});
  }

  // --- Handlers ---

  handleToggle(host, rule, enabled) {
    HostStorage.set({
      ...rule,
      host,
      enabled,
    }).then(() => {
      console.info('containTAB: rule toggled:', host, enabled);
    });
  }

  handleDelete(host) {
    confirmDialog(`Delete rule "${host}"?`, () => {
      HostStorage.remove(host).then(() => {
        console.info('containTAB: rule deleted:', host);
      }).catch(err => {
        showToast(`Failed to delete rule: ${err}`);
      });
    });
  }

  handleEditHost(oldHost, rule, newHost) {
    this.editingHost = null;

    if (!newHost || newHost === oldHost) {
      this.render();
      return;
    }

    if (!this.isValidPattern(newHost)) {
      showToast(`Invalid host pattern "${newHost}"`);
      this.render();
      return;
    }

    if (this.rules[newHost]) {
      showToast(`Rule for "${newHost}" already exists`);
      this.render();
      return;
    }

    // Create new first, then delete old (safe order)
    HostStorage.set({
      ...rule,
      host: newHost,
    }).then(() => {
      return HostStorage.remove(oldHost);
    }).then(() => {
      console.info('containTAB: rule renamed:', oldHost, '→', newHost);
    }).catch(err => {
      showToast(`Failed to rename: ${err}`);
    });
  }

  handleEditRule(oldHost, rule, newHostInput, containerInput) {
    const newHost = this.normalizePatternInput(newHostInput);
    const containerName = typeof containerInput === 'string'
      ? containerInput.trim()
      : this.containerNameForSelect(containerInput);

    if (!newHost || !this.isValidPattern(newHost)) {
      showToast(`Invalid host pattern "${newHostInput}"`);
      this.render();
      return;
    }

    if (!containerName) {
      showToast('Enter a container name');
      this.render();
      return;
    }

    if (newHost !== oldHost && this.rules[newHost]) {
      showToast(`Rule for "${newHost}" already exists`);
      this.render();
      return;
    }

    const identity = this.identities.find(i => i.name === containerName);
    const nextRule = {
      ...rule,
      host: newHost,
      cookieStoreId: identity?.cookieStoreId || '',
      containerName,
    };

    HostStorage.set(nextRule).then(() => {
      if (newHost !== oldHost) {
        return HostStorage.remove(oldHost);
      }
      return null;
    }).then(() => {
      this.editingHost = null;
      this.mode = 'list';
      this.render();
      console.info('containTAB: rule edited:', oldHost, '→', newHost);
    }).catch(err => {
      showToast(`Failed to edit rule: ${err}`);
      this.render();
    });
  }

  // --- Bulk Actions ---

  buildTransferActions() {
    const hosts = Object.keys(this.rules);
    const wrap = ce('div');
    wrap.className = 'rules-transfer-owner-actions';
    wrap.hidden = true;

    const exportBtn = ce('button');
    exportBtn.className = 'rules-transfer-owner-btn';
    exportBtn.textContent = 'Export';
    exportBtn.dataset.action = 'export-rules';
    exportBtn.disabled = hosts.length === 0;
    exportBtn.title = hosts.length === 0 ? 'No rules to export' : 'Export rules';
    exportBtn.addEventListener('click', () => this.handleExport());

    const importBtn = ce('button');
    importBtn.className = 'rules-transfer-owner-btn';
    importBtn.textContent = 'Import';
    importBtn.dataset.action = 'import-rules';
    importBtn.addEventListener('click', () => this.handleImport());

    wrap.appendChild(exportBtn);
    wrap.appendChild(importBtn);
    return wrap;
  }

  handleExport() {
    const lines = ['host,containerName,enabled'];
    for (const [host, rule] of Object.entries(this.rules)) {
      lines.push([
        host,
        rule.containerName || '',
        rule.enabled !== false,
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = ce('a');
    a.href = url;
    a.download = 'containTAB-rules.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rules exported');
  }

  handleImport() {
    this.mode = 'import';
    this.render();
    focusSoon('.rules-import-textarea');
  }

  buildImportPage() {
    const page = ce('div');
    page.className = 'rules-import-page subpage';
    page.id = 'import-rules-page';
    if (this.mode === 'import') page.classList.add('active');

    const head = this.buildSubhead('Import rules', 'Paste exported CSV rows', 'back-from-rule-import');

    const textarea = ce('textarea');
    textarea.className = 'field rules-import-textarea rule-pattern-textarea';
    textarea.id = 'rules-import-textarea';
    textarea.rows = 14;
    textarea.spellcheck = false;
    textarea.placeholder = [
      'host,containerName,enabled',
      'example.com,Work,true',
      'legacy.example,Work',
    ].join('\n');

    const error = ce('div');
    error.className = 'rules-import-error';
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'polite');

    const importBtn = primaryButton({
      icon: 'check', text: 'Import rules', className: 'primary-action rules-import-btn',
      title: 'Import rules', ariaLabel: 'Import rules', dataAction: 'confirm-rule-import', disabled: true,
    });

    const setError = (message = '') => {
      error.textContent = message;
      error.classList.toggle('active', !!message);
    };
    const validate = () => {
      importBtn.disabled = !textarea.value.trim();
      if (textarea.value.trim()) setError('');
    };

    textarea.addEventListener('input', validate);
    textarea.addEventListener('keydown', (e) => {
      if (this.isSubmitKey(e) && !importBtn.disabled) {
        e.preventDefault();
        importBtn.click();
      } else if (e.key === 'Escape') {
        this.mode = 'list';
        this.render();
      }
    });

    importBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        setError('Choose a file or paste rule rows');
        return;
      }
      importBtn.disabled = true;
      try {
        const imported = await this.importRulesFromText(text);
        this.mode = 'list';
        this.render();
        showToast(imported === 1 ? 'Imported 1 rule' : `Imported ${imported} rules`);
      } catch (err) {
        const message = `Import failed: ${errorMessage(err)}`;
        setError(message);
        showToast(message);
        importBtn.disabled = false;
      }
    });

    const panel = ce('div');
    panel.className = 'settings-group rules-import-form';
    const field = ce('label');
    field.className = 'rules-import-field';
    const label = ce('span');
    label.className = 'title';
    label.textContent = 'Rows';
    field.append(label, textarea);
    panel.append(
      field,
      error,
    );

    page.append(head, panel, importBtn);
    return page;
  }

  async importRulesFromText(text) {
    const lines = text.split('\n').filter(l => l.trim());
    let imported = 0;

    for (const line of lines) {
      const columns = parseCsvLine(line);
      if (columns[0]?.toLowerCase() === 'host') continue;
      const [host] = columns;
      if (!host) continue;

      let cookieStoreId = '';
      let containerName = '';
      let enabled = true;

      if (columns.length === 2) {
        containerName = columns[1];
      } else if (columns[1]?.startsWith('firefox-') || columns[1] === '') {
        // Backward compatibility for old exports:
        // host,cookieStoreId,containerName,enabled
        cookieStoreId = columns[1] || '';
        containerName = columns[2] || '';
        enabled = columns[3] !== 'false';
      } else {
        containerName = columns[1] || '';
        enabled = columns[2] !== 'false';
      }

      if (containerName === NO_CONTAINER.name) {
        cookieStoreId = NO_CONTAINER.cookieStoreId;
      } else if (containerName) {
        const identity = this.identities.find(i => i.name === containerName);
        cookieStoreId = identity?.cookieStoreId || cookieStoreId;
      }

      await HostStorage.set({
        host,
        cookieStoreId,
        containerName,
        enabled,
      });
      imported++;
    }

    return imported;
  }

}

export default new RulesSection();
