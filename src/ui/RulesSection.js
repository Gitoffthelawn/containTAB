/**
 * RulesSection — Rule CRUD with immediate storage writes.
 *
 * Add form at top, rule list below. Each action
 * (add/delete/toggle/edit) writes to HostStorage directly.
 * State listener auto-refreshes the list.
 */

import State from '../State';
import HostStorage from '../Storage/HostStorage';
import {qs, ce, cleanHostInput} from '../utils';
import {showToast} from './toast';

class RulesSection {
  constructor() {
    this.container = qs('#rules-content');
    this.rules = {};
    this.identities = [];
    this.editingHost = null;

    State.addListener(this.update.bind(this));
  }

  update(state) {
    let changed = false;
    if (state.urlMaps) { this.rules = state.urlMaps; changed = true; }
    if (state.identities) { this.identities = state.identities; changed = true; }
    if (changed) this.render();
  }

  onShow() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    this.container.appendChild(this.buildAddForm());
    this.container.appendChild(this.buildRuleList());
  }

  // --- Add Form ---

  buildAddForm() {
    const form = ce('div');
    form.className = 'rules-add-form';

    const hostInput = ce('input');
    hostInput.type = 'text';
    hostInput.className = 'rules-host-input';
    hostInput.placeholder = 'Host pattern (e.g. *.github.com)';

    const containerSelect = this.buildContainerSelect('');

    const addBtn = ce('button');
    addBtn.className = 'rules-add-btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => {
      this.handleAdd(hostInput, containerSelect);
    });

    hostInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAdd(hostInput, containerSelect);
    });

    form.appendChild(hostInput);
    form.appendChild(containerSelect);
    form.appendChild(addBtn);
    return form;
  }

  handleAdd(hostInput, containerSelect) {
    const host = cleanHostInput(hostInput.value);
    const cookieStoreId = containerSelect.value;

    if (!host) {
      showToast('Enter a host pattern');
      return;
    }
    if (!cookieStoreId) {
      showToast('Select a container');
      return;
    }

    if (this.rules[host]) {
      showToast(`Rule for "${host}" already exists`);
      return;
    }

    const identity = this.identities.find(i => i.cookieStoreId === cookieStoreId);
    const containerName = identity ? identity.name : '';

    HostStorage.set({
      host,
      cookieStoreId,
      containerName,
      enabled: true,
    }).then(() => {
      hostInput.value = '';
      console.info('containTAB: rule added:', host, '→', containerName);
    }).catch(err => {
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

  // --- Rule List ---

  buildRuleList() {
    const list = ce('div');
    list.className = 'rules-list';

    const hosts = Object.keys(this.rules);
    if (hosts.length === 0) {
      const empty = ce('div');
      empty.className = 'rules-empty';
      empty.textContent = 'No rules configured.';
      list.appendChild(empty);
      return list;
    }

    hosts.forEach(host => {
      list.appendChild(this.buildRuleRow(host, this.rules[host]));
    });

    return list;
  }

  buildRuleRow(host, rule) {
    const row = ce('div');
    row.className = 'rule-row';
    if (rule.enabled === false) row.classList.add('disabled');

    // Host label (click to edit)
    const hostEl = ce('span');
    hostEl.className = 'rule-host';

    if (this.editingHost === host) {
      const editInput = ce('input');
      editInput.type = 'text';
      editInput.className = 'rule-host-edit';
      editInput.value = host;
      editInput.addEventListener('blur', (e) => {
        this.handleEditHost(host, rule, cleanHostInput(e.target.value));
      });
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') { this.editingHost = null; this.render(); }
      });
      hostEl.appendChild(editInput);
      setTimeout(() => editInput.focus(), 0);
    } else {
      hostEl.textContent = host;
      hostEl.addEventListener('click', () => {
        this.editingHost = host;
        this.render();
      });
    }

    // Container badge
    const identity = this.identities.find(i => i.cookieStoreId === rule.cookieStoreId);
    const badge = ce('span');
    badge.className = 'rule-container-badge';
    if (identity && identity.colorCode) {
      badge.style.borderLeft = `3px solid ${identity.colorCode}`;
    }
    badge.textContent = rule.containerName || (identity ? identity.name : rule.cookieStoreId);

    // Enable toggle
    const toggle = ce('input');
    toggle.type = 'checkbox';
    toggle.className = 'rule-toggle';
    toggle.checked = rule.enabled !== false;
    toggle.title = rule.enabled !== false ? 'Enabled' : 'Disabled';
    toggle.addEventListener('change', () => {
      this.handleToggle(host, rule, toggle.checked);
    });

    // Delete button
    const delBtn = ce('button');
    delBtn.className = 'rule-delete-btn';
    delBtn.textContent = '\u00d7';
    delBtn.title = 'Delete rule';
    delBtn.addEventListener('click', () => {
      this.handleDelete(host);
    });

    row.appendChild(hostEl);
    row.appendChild(badge);
    row.appendChild(toggle);
    row.appendChild(delBtn);
    return row;
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
    HostStorage.remove(host).then(() => {
      console.info('containTAB: rule deleted:', host);
    });
  }

  handleEditHost(oldHost, rule, newHost) {
    this.editingHost = null;

    if (!newHost || newHost === oldHost) {
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
}

export default new RulesSection();
