/**
 * ContainersSection — Container management with integrated view.
 *
 * Lists all Firefox containers with: color badge, name (editable),
 * rule count, lifetime dropdown, delete button.
 * Also supports creating new containers.
 */

import State from '../State';
import ContextualIdentity, {NO_CONTAINER} from '../ContextualIdentity';
import PreferenceStorage from '../Storage/PreferenceStorage';
import {qs, ce} from '../utils';
import {showToast} from './toast';

class ContainersSection {
  constructor() {
    this.container = qs('#containers-content');
    this.identities = [];
    this.rules = {};
    this.editingId = null;
    this.ruleCountCache = {};

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
    this.container.appendChild(this.buildCreateForm());
    this.container.appendChild(this.buildContainerList());
  }

  // --- Create Form ---

  buildCreateForm() {
    const form = ce('div');
    form.className = 'containers-create-form';

    const nameInput = ce('input');
    nameInput.type = 'text';
    nameInput.className = 'containers-name-input';
    nameInput.placeholder = 'New container name...';

    const createBtn = ce('button');
    createBtn.className = 'containers-create-btn';
    createBtn.textContent = '+';
    createBtn.addEventListener('click', () => {
      this.handleCreate(nameInput);
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCreate(nameInput);
    });

    form.appendChild(nameInput);
    form.appendChild(createBtn);
    return form;
  }

  handleCreate(nameInput) {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Enter a container name');
      return;
    }

    nameInput.disabled = true;

    ContextualIdentity.create(name).then(() => {
      nameInput.value = '';
      nameInput.disabled = false;
      nameInput.focus();
      console.info('containTAB: container created:', name);
    }).catch(err => {
      nameInput.disabled = false;
      showToast(`Failed to create: ${err}`);
    });
  }

  // --- Container List ---

  buildContainerList() {
    const list = ce('div');
    list.className = 'containers-list';

    this.identities.forEach(identity => {
      list.appendChild(this.buildContainerRow(identity));
    });

    return list;
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
    if (isNoContainer) row.classList.add('no-container');

    // Color badge
    const badge = ce('span');
    badge.className = 'container-color-badge';
    badge.style.background = identity.colorCode || '#999';
    row.appendChild(badge);

    // Name (editable)
    const nameEl = ce('span');
    nameEl.className = 'container-name';

    if (this.editingId === identity.cookieStoreId && !isNoContainer) {
      const editInput = ce('input');
      editInput.type = 'text';
      editInput.className = 'container-name-edit';
      editInput.value = identity.name;
      editInput.addEventListener('blur', (e) => {
        this.handleRename(identity, e.target.value.trim());
      });
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') { this.editingId = null; this.render(); }
      });
      nameEl.appendChild(editInput);
      setTimeout(() => editInput.focus(), 0);
    } else {
      nameEl.textContent = identity.name;
      if (!isNoContainer) {
        nameEl.classList.add('editable');
        nameEl.addEventListener('click', () => {
          this.editingId = identity.cookieStoreId;
          this.render();
        });
      }
    }
    row.appendChild(nameEl);

    // Rule count
    const ruleCount = this.countRulesForContainer(identity.cookieStoreId);
    const countEl = ce('span');
    countEl.className = 'container-rule-count';
    countEl.textContent = ruleCount > 0 ? `${ruleCount} rule${ruleCount > 1 ? 's' : ''}` : '';
    row.appendChild(countEl);

    // Lifetime (only for real containers)
    if (!isNoContainer) {
      const lifetimeSelect = ce('select');
      lifetimeSelect.className = 'container-lifetime-select';

      ['forever', 'untilLastTab'].forEach(val => {
        const opt = ce('option');
        opt.value = val;
        opt.textContent = val === 'forever' ? 'Forever' : 'Until last tab';
        lifetimeSelect.appendChild(opt);
      });

      // Load async, attach listener after load
      this.loadLifetime(identity.cookieStoreId, lifetimeSelect).then(() => {
        lifetimeSelect.addEventListener('change', () => {
          this.handleLifetimeChange(identity.cookieStoreId, lifetimeSelect.value);
        });
      });

      row.appendChild(lifetimeSelect);
    } else {
      const spacer = ce('span');
      row.appendChild(spacer);
    }

    // Delete button
    if (!isNoContainer) {
      const delBtn = ce('button');
      delBtn.className = 'container-delete-btn';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Delete container';
      delBtn.addEventListener('click', () => {
        this.handleDelete(identity);
      });
      row.appendChild(delBtn);
    } else {
      const spacer = ce('span');
      row.appendChild(spacer);
    }

    return row;
  }

  // --- Handlers ---

  async loadLifetime(cookieStoreId, selectEl) {
    try {
      const lifetime = await PreferenceStorage.get(
        `containers.${cookieStoreId}.lifetime`,
        true,
      );
      selectEl.value = lifetime || 'forever';
    } catch (err) {
      console.warn('containTAB: failed to load lifetime:', cookieStoreId, err);
      selectEl.value = 'forever';
    }
  }

  handleLifetimeChange(cookieStoreId, lifetime) {
    PreferenceStorage.set({
      key: `containers.${cookieStoreId}.lifetime`,
      value: lifetime,
    }).then(() => {
      console.info('containTAB: lifetime changed:', cookieStoreId, lifetime);
    });
  }

  handleRename(identity, newName) {
    this.editingId = null;
    newName = (newName || '').trim();

    if (!newName || newName === identity.name) {
      this.render();
      return;
    }

    ContextualIdentity.update(identity.cookieStoreId, {name: newName}).then(() => {
      console.info('containTAB: container renamed:', identity.name, '→', newName);
    }).catch(err => {
      showToast(`Failed to rename: ${err}`);
    });
  }

  handleDelete(identity) {
    const ruleCount = this.countRulesForContainer(identity.cookieStoreId);
    const msg = ruleCount > 0
      ? `Delete "${identity.name}"? This will also remove ${ruleCount} rule(s).`
      : `Delete "${identity.name}"?`;

    if (!confirm(msg)) return;

    ContextualIdentity.remove(identity.cookieStoreId).then(() => {
      console.info('containTAB: container deleted:', identity.name);
    }).catch(err => {
      showToast(`Failed to delete: ${err}`);
    });
  }
}

export default new ContainersSection();
