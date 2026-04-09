/**
 * RulesSection — Rule CRUD with immediate storage writes.
 *
 * Add form at top, rule list below. Each action
 * (add/delete/toggle/edit) writes to HostStorage directly.
 * State listener auto-refreshes the list.
 */

import State from '../State';
import HostStorage from '../Storage/HostStorage';
import PreferenceStorage from '../Storage/PreferenceStorage';
import {qs, ce, cleanHostInput} from '../utils';
import {showToast} from './toast';

class RulesSection {
  constructor() {
    this.container = qs('#rules-content');
    this.rules = {};
    this.identities = [];
    this.editingHost = null;
    this.filterContainer = '';

    State.addListener(this.update.bind(this));
  }

  update(state, changedKey) {
    if (changedKey === 'urlMaps') { this.rules = state.urlMaps; this.render(); }
    else if (changedKey === 'identities') { this.identities = state.identities; this.render(); }
    else if (!changedKey) {
      this.rules = state.urlMaps || {};
      this.identities = state.identities || [];
      this.render();
    }
  }

  onShow() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    this.container.appendChild(this.buildFilter());
    this.container.appendChild(this.buildAddForm());
    this.container.appendChild(this.buildRuleList());
    this.container.appendChild(this.buildBulkActions());
  }

  // --- Add Form ---

  buildAddForm() {
    const form = ce('div');
    form.className = 'rules-add-form';

    const hostInput = ce('input');
    hostInput.type = 'text';
    hostInput.className = 'rules-host-input';
    hostInput.placeholder = 'Host pattern (e.g. *.github.com)';
    hostInput.autocomplete = 'off';

    const containerInput = ce('input');
    containerInput.type = 'text';
    containerInput.className = 'rules-container-input';
    containerInput.placeholder = 'Container name';
    containerInput.autocomplete = 'off';

    const addBtn = ce('button');
    addBtn.className = 'rules-add-btn';
    addBtn.textContent = '+';
    addBtn.disabled = true;

    const validateAdd = () => {
      const host = cleanHostInput(hostInput.value);
      const name = containerInput.value.trim();
      addBtn.disabled = !host || !name || !this.isValidPattern(host);
    };

    hostInput.addEventListener('input', validateAdd);
    containerInput.addEventListener('input', validateAdd);

    addBtn.addEventListener('click', () => {
      this.handleAdd(hostInput, containerInput, lifetimeToggle);
    });

    hostInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !addBtn.disabled) this.handleAdd(hostInput, containerInput);
    });
    containerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !addBtn.disabled) this.handleAdd(hostInput, containerInput, lifetimeToggle);
    });

    const lifetimeLabel = ce('label');
    lifetimeLabel.className = 'rules-lifetime-label';
    lifetimeLabel.title = 'Delete container when last tab closes';
    const lifetimeToggle = ce('input');
    lifetimeToggle.type = 'checkbox';
    lifetimeToggle.className = 'rules-lifetime-toggle';
    lifetimeToggle.checked = true; // default: untilLastTab
    const lifetimeText = ce('span');
    lifetimeText.textContent = 'Until last tab';
    lifetimeLabel.appendChild(lifetimeToggle);
    lifetimeLabel.appendChild(lifetimeText);

    form.appendChild(hostInput);
    form.appendChild(containerInput);
    form.appendChild(lifetimeLabel);
    form.appendChild(addBtn);
    return form;
  }

  isValidPattern(host) {
    if (!host) return false;
    // fragment: @text — need at least 1 char after @
    if (host[0] === '@') return host.length > 1;
    // glob/exact: no spaces, no consecutive dots
    if (/\s/.test(host)) return false;
    if (host.includes('..')) return false;
    return true;
  }

  handleAdd(hostInput, containerInput, lifetimeToggle) {
    const host = cleanHostInput(hostInput.value);
    const containerName = containerInput.value.trim();
    const lifetime = lifetimeToggle.checked ? 'untilLastTab' : 'forever';

    if (!host) { showToast('Enter a host pattern'); return; }
    if (!containerName) { showToast('Enter a container name'); return; }
    if (this.rules[host]) { showToast(`Rule for "${host}" already exists`); return; }

    // Find existing container by name, or leave cookieStoreId empty (created on match)
    const identity = this.identities.find(i => i.name === containerName);
    const cookieStoreId = identity ? identity.cookieStoreId : '';

    hostInput.disabled = true;
    containerInput.disabled = true;

    HostStorage.set({
      host,
      cookieStoreId,
      containerName,
      enabled: true,
    }).then(() => {
      // Set lifetime if container exists
      if (cookieStoreId) {
        PreferenceStorage.set({
          key: `containers.${cookieStoreId}.lifetime`,
          value: lifetime,
        });
      }
      hostInput.value = '';
      containerInput.value = '';
      hostInput.disabled = false;
      containerInput.disabled = false;
      lifetimeToggle.checked = true;
      hostInput.focus();
      console.info('containTAB: rule added:', host, '→', containerName, lifetime);
    }).catch(err => {
      hostInput.disabled = false;
      containerInput.disabled = false;
      showToast(`Failed to add rule: ${err}`);
    });
  }

  // --- Filter ---

  buildFilter() {
    const hosts = Object.keys(this.rules);
    if (hosts.length < 5) return ce('span'); // no filter for few rules

    const wrap = ce('div');
    wrap.className = 'rules-filter';

    const select = ce('select');
    select.className = 'rules-filter-select';

    const allOpt = ce('option');
    allOpt.value = '';
    allOpt.textContent = 'All containers';
    select.appendChild(allOpt);

    // unique container names from rules
    const seen = new Set();
    hosts.forEach(h => {
      const r = this.rules[h];
      if (r.cookieStoreId && !seen.has(r.cookieStoreId)) {
        seen.add(r.cookieStoreId);
        const opt = ce('option');
        opt.value = r.cookieStoreId;
        const identity = this.identities.find(i => i.cookieStoreId === r.cookieStoreId);
        opt.textContent = identity ? identity.name : r.containerName || r.cookieStoreId;
        if (r.cookieStoreId === this.filterContainer) opt.selected = true;
        select.appendChild(opt);
      }
    });

    select.addEventListener('change', () => {
      this.filterContainer = select.value;
      this.render();
    });

    wrap.appendChild(select);
    return wrap;
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

    // Sort by container name, then host
    const sorted = hosts
      .filter(h => !this.filterContainer || this.rules[h].cookieStoreId === this.filterContainer)
      .sort((a, b) => {
        const nameA = (this.rules[a].containerName || '').toLowerCase();
        const nameB = (this.rules[b].containerName || '').toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.localeCompare(b);
      });

    sorted.forEach(host => {
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
      editInput.autocomplete = 'off';
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

    // Container badge (click to change)
    const identity = this.identities.find(i => i.cookieStoreId === rule.cookieStoreId);
    const badge = ce('span');
    badge.className = 'rule-container-badge';
    if (identity && identity.colorCode) {
      badge.style.borderLeft = `3px solid ${identity.colorCode}`;
    }
    badge.textContent = rule.containerName || (identity ? identity.name : rule.cookieStoreId);
    badge.style.cursor = 'pointer';
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

    // Lifetime toggle
    const lifetimeBtn = ce('button');
    lifetimeBtn.className = 'rule-lifetime-btn';
    if (rule.cookieStoreId) {
      lifetimeBtn.textContent = '...';
      lifetimeBtn.title = 'Loading lifetime';
      PreferenceStorage.get(
        `containers.${rule.cookieStoreId}.lifetime`,
        true,
      ).then(val => {
        const isTemp = val === 'untilLastTab';
        lifetimeBtn.textContent = isTemp ? 'temp' : 'keep';
        lifetimeBtn.title = isTemp ? 'Until last tab (click to keep forever)' : 'Forever (click to make temporary)';
        lifetimeBtn.classList.toggle('is-temp', isTemp);
      }).catch(() => {
        lifetimeBtn.textContent = 'keep';
        lifetimeBtn.title = 'Forever (click to make temporary)';
      });
      lifetimeBtn.addEventListener('click', () => {
        const current = lifetimeBtn.textContent;
        const newVal = current === 'temp' ? 'forever' : 'untilLastTab';
        PreferenceStorage.set({
          key: `containers.${rule.cookieStoreId}.lifetime`,
          value: newVal,
        }).then(() => {
          const isTemp = newVal === 'untilLastTab';
          lifetimeBtn.textContent = isTemp ? 'temp' : 'keep';
          lifetimeBtn.title = isTemp ? 'Until last tab' : 'Forever';
          lifetimeBtn.classList.toggle('is-temp', isTemp);
        });
      });
    } else {
      lifetimeBtn.textContent = 'temp';
      lifetimeBtn.title = 'Container will be created on first match';
      lifetimeBtn.disabled = true;
    }

    row.appendChild(hostEl);
    row.appendChild(badge);
    row.appendChild(lifetimeBtn);
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

  // --- Bulk Actions ---

  buildBulkActions() {
    const hosts = Object.keys(this.rules);
    if (hosts.length === 0) return ce('span');

    const wrap = ce('div');
    wrap.className = 'rules-bulk-actions';

    const exportBtn = ce('button');
    exportBtn.className = 'rules-bulk-btn';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => this.handleExport());

    const importBtn = ce('button');
    importBtn.className = 'rules-bulk-btn';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => this.handleImport());

    wrap.appendChild(exportBtn);
    wrap.appendChild(importBtn);
    return wrap;
  }

  handleExport() {
    const lines = ['host,cookieStoreId,containerName,enabled'];
    for (const [host, rule] of Object.entries(this.rules)) {
      const name = (rule.containerName || '').replace(/,/g, ' ');
      lines.push(`${host},${rule.cookieStoreId},${name},${rule.enabled !== false}`);
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
    const input = ce('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      let imported = 0;

      for (const line of lines) {
        if (line.startsWith('host,')) continue; // skip header
        const [host, cookieStoreId, containerName, enabled] = line.split(',');
        if (!host || !cookieStoreId) continue;
        await HostStorage.set({
          host: host.trim(),
          cookieStoreId: cookieStoreId.trim(),
          containerName: (containerName || '').trim(),
          enabled: enabled !== 'false',
        });
        imported++;
      }

      showToast(`Imported ${imported} rules`);
    });
    input.click();
  }
}

export default new RulesSection();
