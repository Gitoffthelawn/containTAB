/**
 * ContainersSection — Container management with integrated view.
 *
 * Lists Firefox native contextual identities with compact owner actions.
 * Also supports creating new containers.
 */

import State from '../State';
import ContextualIdentity, {NO_CONTAINER} from '../ContextualIdentity';
import ContainerExtension, {UI_ICON_VALUES, nativeIconForUiIcon} from '../ContainerExtension';
import {qs, ce, focusSoon} from '../utils';
import {showToast} from './toast';
import {buildIcon} from './components/uiIcon';
import {primaryButton, iconButton} from './components/button';
import {settingRow, subhead} from './components/field';
import {searchBar} from './components/searchBar';
import {containerPill} from './components/pill';
import {confirmDialog} from './components/confirmDialog';

const DEFAULT_UI_ICON = 'containers';

class ContainersSection {
  constructor() {
    this.container = qs('#containers-content');
    this.identities = [];
    this.rules = {};
    this.editingId = null;
    this.editDraft = '';
    this.editError = '';
    this.ruleCountCache = {};
    this.mode = 'list';
    this.createError = '';
    this.searchText = '';
    this.createIcon = DEFAULT_UI_ICON;
    this.editIcon = DEFAULT_UI_ICON;
    this.editIconChanged = false;
    this.editLifetime = 'forever';

    State.addListener(this.update.bind(this));
  }

  update(state, changedKey) {
    if (changedKey === 'identities') { this.identities = state.identities; this.render(); }
    else if (changedKey === 'urlMaps') { this.rules = state.urlMaps; this.render(); }
    else if (!changedKey) {
      this.identities = state.identities || [];
      this.rules = state.urlMaps || {};
      this.render();
    }
  }

  onShow() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    this.buildRuleCountCache();
    this.container.appendChild(this.buildMainView());
    this.container.appendChild(this.buildCreatePage());
    this.container.appendChild(this.buildEditPage());
  }

  // --- Main View ---

  buildMainView() {
    const wrap = ce('div');
    wrap.className = 'containers-main';
    wrap.id = 'overview-main';
    if (this.mode === 'list') wrap.classList.add('active');

    wrap.appendChild(this.buildTools());
    wrap.appendChild(this.buildContainerList());
    return wrap;
  }

  buildTools() {
    const tools = ce('div');
    tools.className = 'rule-tools containers-tools';

    const {label: wrap} = searchBar({
      labelClass: 'search containers-search', inputId: 'overview-search', inputClass: 'containers-search-input',
      placeholder: 'containers or sites...', value: this.searchText,
      onInput: (e) => { this.searchText = e.target.value; this.renderContainerListOnly(); },
    });

    const createBtn = primaryButton({
      icon: 'plus', text: 'Create', className: 'btn local-action containers-open-create-btn',
      title: 'Create container', ariaLabel: 'Create container', dataAction: 'open-create-container',
    });
    createBtn.id = 'open-create-container';
    createBtn.addEventListener('click', () => {
      this.mode = 'create';
      this.createError = '';
      this.createIcon = DEFAULT_UI_ICON;
      this.render();
      focusSoon('[data-field="container-name"]');
    });

    tools.append(wrap, createBtn);
    return tools;
  }

  // --- Create Page ---

  buildCreatePage() {
    const page = ce('div');
    page.className = 'containers-create-page';
    page.id = 'create-container-page';
    if (this.mode === 'create') page.classList.add('active');

    const {head, back} = subhead({
      titleText: 'Create container',
      description: 'Creates a Firefox contextual identity',
      backId: 'back-to-containers', backAriaLabel: 'Back to containers', withDataAction: false,
    });
    back.addEventListener('click', () => {
      this.mode = 'list';
      this.createError = '';
      this.render();
    });

    const nameInput = ce('input');
    nameInput.type = 'text';
    nameInput.id = 'container-name';
    nameInput.className = 'containers-name-input';
    nameInput.dataset.field = 'container-name';
    nameInput.placeholder = 'Research';
    nameInput.autocomplete = 'off';
    nameInput.addEventListener('input', () => {
      if (this.createError) {
        this.createError = '';
        const error = qs('.containers-create-error');
        if (error) error.textContent = '';
      }
    });

    const lifetimeToggle = this.buildLifetimeLabel('container-lifetime-forever', true);

    const iconInput = ce('input');
    iconInput.type = 'hidden';
    iconInput.id = 'container-icon';
    iconInput.value = this.createIcon;
    const iconPicker = ce('div');
    iconPicker.className = 'icon-edit-field';
    iconPicker.append(iconInput, this.buildIconChoiceList('container-icon', iconInput.value));

    const iconRow = this.buildCreateField(
      null,
      'Icon',
      '',
      iconPicker,
    );

    const nameRow = this.buildCreateField(
      'edit',
      'Container name',
      'Firefox contextual identity display name',
      nameInput,
    );

    const lifetimeRow = this.buildCreateField(
      'clock',
      'Lifetime',
      'Checked means keep the container forever',
      lifetimeToggle,
    );

    const error = ce('div');
    error.className = 'containers-create-error';
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'polite');
    error.textContent = this.createError;

    const createBtn = primaryButton({
      icon: 'plus', text: 'Create', className: 'primary-action containers-create-btn',
      dataAction: 'submit-create-container',
    });
    createBtn.id = 'create-container';
    createBtn.addEventListener('click', () => {
      this.handleCreate(nameInput, lifetimeToggle.querySelector('input'), iconInput);
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCreate(nameInput, lifetimeToggle.querySelector('input'), iconInput);
    });

    const group = ce('div');
    group.className = 'settings-group containers-create-group';
    group.append(iconRow, nameRow, lifetimeRow);

    page.append(head, group, error, createBtn);
    return page;
  }

  buildCreateField(iconName, titleText, description, control) {
    const row = settingRow({
      icon: iconName, titleText, description, control,
      rowClass: 'setting-row containers-create-field',
      titleClass: 'title field-title',
      subClass: 'sub field-description',
      removeEmptyDescription: true,
    });
    if (!iconName) row.classList.add('icon-setting-row');
    return row;
  }

  async handleCreate(nameInput, lifetimeInput, iconInput) {
    const name = nameInput.value.trim();
    if (name.length < 2) {
      this.createError = 'Use at least 2 characters.';
      this.render();
      return;
    }

    nameInput.disabled = true;

    try {
      const lifetime = lifetimeInput?.checked === false ? 'untilLastTab' : 'forever';
      await ContextualIdentity.create(name, {
        lifetime,
        uiIcon: iconInput?.value || DEFAULT_UI_ICON,
      });
      this.mode = 'list';
      this.createError = '';
      this.createIcon = DEFAULT_UI_ICON;
      console.info('containTAB: container created:', name);
      this.render();
    } catch (err) {
      nameInput.disabled = false;
      showToast(`Failed to create: ${err}`);
    }
  }

  // --- Container List ---

  buildContainerList() {
    const list = ce('div');
    list.className = 'containers-list';
    list.id = 'overview-list';

    const identities = this.filteredIdentities();
    identities.forEach(identity => {
      const row = this.buildContainerRow(identity);
      list.appendChild(row);
    });

    const empty = ce('div');
    empty.className = 'containers-empty';
    empty.id = 'container-empty';
    empty.textContent = 'No containers match.';
    empty.hidden = identities.length > 0;
    empty.setAttribute('aria-hidden', identities.length > 0 ? 'true' : 'false');
    list.appendChild(empty);

    return list;
  }

  filteredIdentities() {
    const needle = this.searchText.trim().toLowerCase();
    const identities = needle
      ? this.identities.filter(identity => this.containerSearchText(identity).includes(needle))
      : this.identities;
    return this.sortIdentitiesByName(identities);
  }

  containerSearchText(identity) {
    return (identity.name || '').toLowerCase();
  }

  sortIdentitiesByName(identities) {
    return [...identities].sort((a, b) => {
      const aDefault = a.cookieStoreId === NO_CONTAINER.cookieStoreId;
      const bDefault = b.cookieStoreId === NO_CONTAINER.cookieStoreId;
      if (aDefault !== bDefault) return aDefault ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }

  renderContainerListOnly() {
    const current = this.container.querySelector('.containers-list');
    if (current) current.replaceWith(this.buildContainerList());
  }

  buildRuleCountCache() {
    this.ruleCountCache = {};
    for (const r of Object.values(this.rules)) {
      if (r.cookieStoreId) {
        this.ruleCountCache[r.cookieStoreId] = (this.ruleCountCache[r.cookieStoreId] || 0) + 1;
      }
    }
  }

  countRulesForContainer(cookieStoreId) {
    return this.ruleCountCache[cookieStoreId] || 0;
  }

  buildContainerRow(identity) {
    const isNoContainer = identity.cookieStoreId === NO_CONTAINER.cookieStoreId;
    const row = ce('div');
    row.className = 'container-row';
    row.dataset.search = this.containerSearchText(identity);
    if (isNoContainer) row.classList.add('no-container');

    const {pill: identityCell} = containerPill({
      uiIcon: identity.uiIcon || DEFAULT_UI_ICON,
      labelText: identity.name,
      pillClass: 'container-identity container-pill',
      iconClass: 'container-icon',
      labelClass: 'container-name container-pill-label',
      iconTag: 'div',
    });

    const ruleCount = this.countRulesForContainer(identity.cookieStoreId);
    const countEl = ce('span');
    countEl.className = 'container-rule-count';
    countEl.textContent = `${ruleCount} rule${ruleCount === 1 ? '' : 's'}`;

    const meta = ce('span');
    meta.className = 'sub container-meta';
    meta.append(countEl);

    row.append(identityCell, meta);

    if (!isNoContainer) {
      row.appendChild(this.buildLifetimeButton(identity));
      row.appendChild(this.buildContainerActions(identity));
    }

    return row;
  }

  buildLifetimeButton(identity) {
    const isForever = (identity.lifetime || 'forever') === 'forever';
    const button = ce('button');
    button.type = 'button';
    button.className = 'lifetime-switch container-lifetime-btn';
    button.dataset.action = 'toggle-container-lifetime';
    button.dataset.lifetime = isForever ? 'forever' : 'last-tab';
    button.classList.toggle('on', isForever);
    button.title = isForever ? 'Forever' : 'Until last tab';
    button.setAttribute('aria-label', `Container lifetime ${button.title}`);
    button.addEventListener('click', () => {
      const nextLifetime = button.dataset.lifetime === 'forever' ? 'untilLastTab' : 'forever';
      this.handleLifetimeChange(identity, nextLifetime);
    });
    return button;
  }

  buildContainerActions(identity) {
    const actions = ce('div');
    actions.className = 'actions container-actions';

    const editBtn = iconButton({
      icon: 'edit', label: 'Edit container name', ariaLabel: `Edit ${identity.name}`,
      className: 'container-icon-btn', dataAction: 'edit-container',
    });
    editBtn.addEventListener('click', () => {
      this.startEdit(identity);
    });

    const delBtn = iconButton({
      icon: 'trash', label: 'Delete container', ariaLabel: `Delete ${identity.name}`,
      className: 'container-icon-btn is-danger', dataAction: 'delete-container',
    });
    delBtn.addEventListener('click', () => {
      this.handleDelete(identity);
    });

    actions.append(editBtn, delBtn);
    return actions;
  }

  buildEditPage() {
    const page = ce('div');
    page.className = 'containers-edit-page';
    page.id = 'edit-container-page';
    if (this.mode === 'edit') page.classList.add('active');

    if (!this.editingId) return page;
    const identity = this.identities.find(item => item.cookieStoreId === this.editingId);
    if (!identity) {
      this.cancelEdit();
      return page;
    }

    const {head, back} = subhead({
      titleText: 'Edit container', description: identity.name,
      backId: 'back-from-container-edit', backAriaLabel: 'Back to containers', withDataAction: false,
    });
    back.addEventListener('click', () => this.cancelEdit());

    const nameInput = ce('input');
    nameInput.type = 'text';
    nameInput.className = 'containers-name-input container-name-edit';
    nameInput.value = this.editDraft;
    nameInput.autocomplete = 'off';
    nameInput.setAttribute('aria-label', `Container name for ${identity.name}`);
    nameInput.addEventListener('input', (e) => {
      this.editDraft = e.target.value;
      if (this.editError) {
        this.editError = '';
        const error = qs('.container-edit-error');
        if (error) error.textContent = '';
      }
    });
    const iconInput = ce('input');
    iconInput.type = 'hidden';
    iconInput.id = 'edit-container-icon';
    iconInput.value = this.editIcon;
    iconInput.dataset.iconChanged = String(this.editIconChanged);
    const iconPicker = ce('div');
    iconPicker.className = 'icon-edit-field';
    iconPicker.append(iconInput, this.buildIconChoiceList('edit-container-icon', this.editIcon));

    const lifetimeLabel = this.buildLifetimeLabel(
      'edit-container-lifetime-forever',
      (this.editLifetime || identity.lifetime || 'forever') === 'forever'
    );
    const lifetimeInput = lifetimeLabel.querySelector('input');
    lifetimeInput.addEventListener('change', () => {
      this.editLifetime = lifetimeInput.checked ? 'forever' : 'untilLastTab';
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleUpdate(identity, nameInput.value, this.editIcon, this.editIconChanged, lifetimeInput.checked ? 'forever' : 'untilLastTab');
      } else if (e.key === 'Escape') {
        this.cancelEdit();
      }
    });

    const saveBtn = primaryButton({
      icon: 'check', text: 'Save', className: 'primary-action containers-create-btn containers-save-btn',
      dataAction: 'save-container-edit',
    });
    saveBtn.addEventListener('click', () => {
      this.handleUpdate(identity, nameInput.value, this.editIcon, this.editIconChanged, lifetimeInput.checked ? 'forever' : 'untilLastTab');
    });

    const error = ce('div');
    error.className = 'container-edit-error';
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'polite');
    error.textContent = this.editError;

    const group = ce('div');
    group.className = 'settings-group containers-create-group containers-edit-group';
    group.append(
      this.buildCreateField('edit', 'Container name', 'Firefox contextual identity display name', nameInput),
      this.buildCreateField(null, 'Icon', '', iconPicker),
      this.buildCreateField('clock', 'Lifetime', 'Checked means keep the container forever', lifetimeLabel),
    );

    page.append(head, group, error, saveBtn);
    return page;
  }

  // --- Handlers ---

  buildLifetimeLabel(id, checked) {
    const label = ce('label');
    label.className = 'container-lifetime-label';
    label.title = 'Keep this container forever';
    const input = ce('input');
    input.type = 'checkbox';
    input.id = id;
    input.className = 'container-lifetime-toggle';
    input.checked = checked;
    const text = ce('span');
    text.textContent = 'Forever';
    label.append(input, text);
    return label;
  }

  handleLifetimeChange(identity, lifetime) {
    ContainerExtension.set(identity.cookieStoreId, { lifetime }).then(() => {
      identity.lifetime = lifetime;
      console.info('containTAB: lifetime changed:', identity.cookieStoreId, lifetime);
      this.render();
    }).catch(err => {
      showToast(`Failed to change lifetime: ${err}`);
      this.render();
    });
  }

  startEdit(identity) {
    this.editingId = identity.cookieStoreId;
    this.editDraft = identity.name;
    this.editIcon = UI_ICON_VALUES.includes(identity.uiIcon) ? identity.uiIcon : '';
    this.editIconChanged = false;
    this.editLifetime = identity.lifetime || 'forever';
    this.editError = '';
    this.mode = 'edit';
    this.render();
    focusSoon('.container-name-edit');
  }

  cancelEdit() {
    this.editingId = null;
    this.editDraft = '';
    this.editIcon = DEFAULT_UI_ICON;
    this.editIconChanged = false;
    this.editLifetime = 'forever';
    this.editError = '';
    this.mode = 'list';
    this.render();
  }

  async handleUpdate(identity, newName, newIcon = identity.uiIcon || DEFAULT_UI_ICON, iconChanged = false, lifetime = identity.lifetime || 'forever') {
    newName = (newName || '').trim();
    if (iconChanged) {
      newIcon = UI_ICON_VALUES.includes(newIcon) ? newIcon : DEFAULT_UI_ICON;
      this.editIcon = newIcon;
      this.editIconChanged = true;
    }

    if (!newName) {
      this.editDraft = '';
      this.editError = 'Use a container name.';
      this.render();
      return;
    }

    const details = {};
    if (newName !== identity.name) details.name = newName;
    const nextIcon = iconChanged && newIcon !== (identity.uiIcon || DEFAULT_UI_ICON) ? newIcon : null;
    if (nextIcon) details.icon = nativeIconForUiIcon(nextIcon);
    const currentLifetime = identity.lifetime || 'forever';
    const nextLifetime = lifetime !== currentLifetime ? lifetime : null;

    if (Object.keys(details).length === 0 && !nextIcon && !nextLifetime) {
      this.cancelEdit();
      return;
    }

    this.editDraft = newName;
    this.editIcon = newIcon;

    try {
      if (Object.keys(details).length > 0) {
        await ContextualIdentity.update(identity.cookieStoreId, details);
      }
      if (nextLifetime) {
        await ContainerExtension.set(identity.cookieStoreId, { lifetime: nextLifetime });
      }
      if (nextIcon) identity.uiIcon = nextIcon;
      if (nextLifetime) {
        identity.lifetime = nextLifetime;
      }
      console.info('containTAB: container updated:', identity.name, '→', newName);
      this.cancelEdit();
    } catch (err) {
      this.editError = 'Rename failed.';
      showToast(`Failed to rename: ${err}`);
      this.render();
    }
  }

  handleDelete(identity) {
    const ruleCount = this.countRulesForContainer(identity.cookieStoreId);
    const msg = ruleCount > 0
      ? `Delete "${identity.name}"? ${ruleCount} rule(s) will stay and recreate this container on next match.`
      : `Delete "${identity.name}"?`;

    confirmDialog(msg, () => {
      ContextualIdentity.remove(identity.cookieStoreId).then(() => {
        console.info('containTAB: container deleted:', identity.name);
      }).catch(err => {
        showToast(`Failed to delete: ${err}`);
      });
    });
  }

  buildIconChoiceList(targetId, selectedIcon) {
    const list = ce('div');
    list.className = 'icon-choice-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Container icon');
    list.dataset.iconTarget = targetId;

    UI_ICON_VALUES.forEach((iconName) => {
      const button = ce('button');
      const active = iconName === selectedIcon;
      button.className = 'icon-choice';
      if (active) button.classList.add('active');
      button.type = 'button';
      button.dataset.iconChoice = iconName;
      button.setAttribute('aria-label', `${iconName} icon`);
      button.setAttribute('aria-selected', String(active));
      button.appendChild(buildIcon(iconName));
      button.addEventListener('click', () => {
        const target = qs(`#${targetId}`);
        if (target) {
          target.value = iconName;
          target.dataset.iconChanged = 'true';
        }
        this.handleIconChoice(targetId, iconName);
        list.querySelectorAll('.icon-choice').forEach((item) => {
          const isActive = item === button;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-selected', String(isActive));
        });
      });
      list.appendChild(button);
    });

    return list;
  }

  handleIconChoice(targetId, iconName) {
    if (targetId === 'container-icon') {
      this.createIcon = iconName;
    } else if (targetId === 'edit-container-icon') {
      this.editIcon = iconName;
      this.editIconChanged = true;
    }
  }
}

export default new ContainersSection();
