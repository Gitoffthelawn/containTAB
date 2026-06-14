/**
 * SettingsSection — Global preferences form with auto-save.
 *
 * Each field change writes through GlobalConfig immediately.
 * Conditional fields: defaultContainer toggle controls sub-fields.
 */

import GlobalConfig from '../GlobalConfig';
import {qs, ce} from '../utils';
import {showToast} from './toast';
import {switchButton} from './components/button';
import {settingRow} from './components/field';
import {showLoader, hideLoader} from './loader';
import applyTheme from './applyTheme';
import RulesSection from './RulesSection';

function getPath(source, path) {
  return path.split('.').reduce((cursor, part) => (
    cursor === undefined || cursor === null ? undefined : cursor[part]
  ), source);
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function partialFromPath(path, value) {
  const partial = {};
  setPath(partial, path, value);
  return partial;
}

class SettingsSection {
  constructor() {
    this.container = qs('#settings-content');
    this.preferences = {};
    this.loaded = false;
  }

  async onShow() {
    if (!this.loaded) {
      await this.loadPreferences();
    }
    this.render();
  }

  async loadPreferences() {
    try {
      this.preferences = await GlobalConfig.get();
      this.loaded = true;
    } catch (err) {
      showToast(`Failed to load settings: ${err}`);
    }
  }

  pref(key) {
    return getPath(this.preferences, key);
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    const form = ce('div');
    form.className = 'settings-scroll';

    form.appendChild(this.buildSection('Default Container', [
      this.buildContainerStrategyRow(
        'defaultContainer.containerStrategy',
        'edit',
        'Container mode',
        'Container mode for unmatched URLs',
        false,
      ),
      this.buildSelectRow(
        'defaultContainer.lifetime',
        'clock',
        'Default lifetime',
        'Initial lifetime for auto-created containers',
        false,
      ),
      this.buildSwitchRow(
        'keepOldTabs',
        'pin',
        'Keep old tabs',
        'Preserve the original tab when redirecting to a container',
      ),
    ]));

    form.appendChild(this.buildSection('Appearance', [
      this.buildThemeRow(),
    ]));

    form.appendChild(this.buildSection('Rule Transfer', [
      this.buildRulesTransferRow(),
    ]));

    form.appendChild(this.buildSection('Danger Zone', [
      this.buildResetRow(),
    ]));

    this.container.appendChild(form);
  }

  // --- Form Builders ---

  buildSection(title, fields) {
    const section = ce('div');
    section.className = 'settings-group';
    if (title === 'Danger Zone') section.classList.add('danger-zone');

    const heading = ce('div');
    heading.className = 'settings-title';
    heading.textContent = title;
    section.appendChild(heading);

    fields.forEach(f => section.appendChild(f));
    return section;
  }

  buildSettingRow(iconName, titleText, description, control, disabled = false) {
    const row = settingRow({
      icon: iconName, titleText, description, control,
      rowClass: 'setting-row',
    });
    if (disabled) row.classList.add('disabled-row');
    return row;
  }

  buildSwitchRow(name, iconName, label, description) {
    const button = switchButton({
      on: !!this.pref(name),
      id: `pref-${name.replace(/\./g, '-')}`,
      name,
      ariaLabel: label,
    });
    button.addEventListener('click', async () => {
      const prev = button.classList.contains('on');
      const next = !prev;
      button.classList.toggle('on', next);
      button.setAttribute('aria-pressed', String(next));
      const ok = await this.savePref(name, next);
      if (!ok) {
        button.classList.toggle('on', prev);
        button.setAttribute('aria-pressed', String(prev));
      }
    });

    return this.buildSettingRow(iconName, label, description, button);
  }

  buildSelectRow(name, iconName, label, description, disabled) {
    const select = ce('select');
    select.className = 'select settings-select';
    select.name = name;
    select.disabled = disabled;
    [
      {value: 'untilLastTab', label: 'Until last tab'},
      {value: 'forever', label: 'Forever'},
    ].forEach(item => {
      const option = ce('option');
      option.value = item.value;
      option.textContent = item.label;
      if (this.pref(name) === item.value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => this.savePref(name, select.value));
    const row = this.buildSettingRow(iconName, label, description, select, disabled);
    if (name === 'defaultContainer.lifetime') row.id = 'lifetime-row';
    return row;
  }

  buildContainerStrategyRow(name, iconName, label, description, disabled) {
    const select = ce('select');
    select.className = 'select settings-select';
    select.name = name;
    select.disabled = disabled;
    [
      { value: 'one_tab_one_world', label: 'bytab' },
      { value: 'by_domain', label: 'Group by domain' },
      { value: 'by_host', label: 'Group by host' },
    ].forEach((item) => {
      const option = ce('option');
      option.value = item.value;
      option.textContent = item.label;
      if (this.pref(name) === item.value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => this.savePref(name, select.value));
    const row = this.buildSettingRow(iconName, label, description, select, disabled);
    if (name === 'defaultContainer.containerStrategy') row.id = 'container-mode-row';
    return row;
  }

  buildThemeRow() {
    const select = ce('select');
    select.className = 'select settings-select';
    select.name = 'theme';
    select.id = 'pref-theme';
    [
      { value: 'system', label: 'System default' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ].forEach((item) => {
      const option = ce('option');
      option.value = item.value;
      option.textContent = item.label;
      if (this.pref('theme') === item.value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', async () => {
      const prev = this.pref('theme') || 'system';
      const next = select.value;
      applyTheme(next);
      const ok = await this.savePref('theme', next);
      if (!ok) {
        select.value = prev;
        applyTheme(prev);
      }
    });
    return this.buildSettingRow(
      'settings',
      'Theme',
      'Follow system, force light, or force dark',
      select,
    );
  }

  buildResetRow() {
    const resetBtn = ce('button');
    resetBtn.type = 'button';
    resetBtn.className = 'select danger';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => this.handleReset());
    return this.buildSettingRow(
      'trash',
      'Reset to defaults',
      'Restore the default tab and container behavior',
      resetBtn,
    );
  }

  buildRulesTransferRow() {
    const actions = ce('div');
    actions.className = 'setting-actions';

    const importBtn = ce('button');
    importBtn.type = 'button';
    importBtn.id = 'settings-import-rules';
    importBtn.className = 'secondary';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => this.routeRuleTransfer('import'));

    const exportBtn = ce('button');
    exportBtn.type = 'button';
    exportBtn.className = 'secondary';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => this.routeRuleTransfer('export'));

    actions.append(importBtn, exportBtn);
    return this.buildSettingRow(
      'rules',
      'Import / Export rules',
      'Storage transfer actions for rule backup and restore',
      actions,
    );
  }

  routeRuleTransfer(action) {
    document.querySelector('[data-target="rules"]')?.click();
    if (action === 'import') {
      RulesSection.handleImport();
    } else if (action === 'export') {
      RulesSection.handleExport();
    }
  }

  // --- Save / Reset ---

  async savePref(name, value) {
    try {
      const nextConfig = await GlobalConfig.set(partialFromPath(name, value));
      if (nextConfig) {
        this.preferences = nextConfig;
      } else {
        setPath(this.preferences, name, value);
      }
      console.info('containTAB: setting saved:', name, '=', value);
      if (name === 'defaultContainer.enabled') this.render();
      return true;
    } catch (err) {
      showToast(`Save failed: ${err}`);
      return false;
    }
  }

  async handleReset() {
    if (!confirm('Reset all settings to defaults?')) return;

    showLoader();

    try {
      await GlobalConfig.reset();
      this.preferences = await GlobalConfig.get();
      applyTheme(this.pref('theme') || 'system');
      this.render();

      hideLoader();
      showToast('Settings reset to defaults');
    } catch (err) {
      hideLoader();
      showToast(`Reset failed: ${err}`);
    }
  }

}

export default new SettingsSection();
