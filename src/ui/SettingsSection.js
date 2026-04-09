/**
 * SettingsSection — Global preferences form with auto-save.
 *
 * Each field change writes to PreferenceStorage immediately.
 * Conditional fields: defaultContainer toggle controls sub-fields.
 */

import PreferenceStorage from '../Storage/PreferenceStorage';
import {qs, ce} from '../utils';
import {showToast} from './toast';
import {showLoader, hideLoader} from './loader';

const DEFAULTS = {
  keepOldTabs: false,
  defaultContainer: true,
  'defaultContainer.containerName': '{domain}',
  'defaultContainer.lifetime': 'untilLastTab',
};

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
      this.preferences = await PreferenceStorage.getAll(true);
      this.loaded = true;
    } catch (err) {
      showToast(`Failed to load settings: ${err}`);
    }
  }

  pref(key) {
    return this.preferences[key] !== undefined
      ? this.preferences[key]
      : DEFAULTS[key];
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';

    const form = ce('div');
    form.className = 'settings-form';

    // Section: Tab Behavior
    form.appendChild(this.buildSection('Tab Behavior', [
      this.buildCheckbox(
        'keepOldTabs',
        'Keep old tabs',
        'Preserve the original tab when redirecting to a container',
      ),
    ]));

    // Section: Default Container
    const dcEnabled = this.pref('defaultContainer');
    form.appendChild(this.buildSection('Default Container', [
      this.buildCheckbox(
        'defaultContainer',
        'Enable auto-container creation',
        'Create containers for unmatched URLs',
      ),
      this.buildTextInput(
        'defaultContainer.containerName',
        'Container name template',
        'Variables: {domain}, {fqdn}, {tld}, {host}, {ms}',
        !dcEnabled,
      ),
      this.buildRadioGroup(
        'defaultContainer.lifetime',
        'Default lifetime',
        [
          {value: 'forever', label: 'Forever'},
          {value: 'untilLastTab', label: 'Until last tab'},
        ],
        !dcEnabled,
      ),
    ]));

    // Reset button only
    const actions = ce('div');
    actions.className = 'settings-actions';

    const resetBtn = ce('button');
    resetBtn.type = 'button';
    resetBtn.className = 'settings-reset-btn';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => this.handleReset());

    actions.appendChild(resetBtn);
    form.appendChild(actions);

    this.container.appendChild(form);
    this.setupConditionalFields();
  }

  // --- Form Builders ---

  buildSection(title, fields) {
    const section = ce('div');
    section.className = 'settings-section';

    const heading = ce('h3');
    heading.className = 'settings-section-title';
    heading.textContent = title;
    section.appendChild(heading);

    fields.forEach(f => section.appendChild(f));
    return section;
  }

  buildCheckbox(name, label, description) {
    const wrapper = ce('div');
    wrapper.className = 'settings-item';

    const labelEl = ce('label');
    labelEl.className = 'settings-checkbox-label';

    const checkbox = ce('input');
    checkbox.type = 'checkbox';
    checkbox.id = `pref-${name}`;
    checkbox.name = name;
    checkbox.checked = !!this.pref(name);
    checkbox.addEventListener('change', () => this.savePref(name, checkbox.checked));

    const labelText = ce('span');
    labelText.textContent = label;

    labelEl.appendChild(checkbox);
    labelEl.appendChild(labelText);
    wrapper.appendChild(labelEl);

    const desc = ce('div');
    desc.className = 'settings-description';
    desc.textContent = description;
    wrapper.appendChild(desc);

    return wrapper;
  }

  buildTextInput(name, label, description, disabled) {
    const wrapper = ce('div');
    wrapper.className = 'settings-item';
    if (disabled) wrapper.classList.add('disabled');

    const labelEl = ce('label');
    labelEl.htmlFor = `pref-${name}`;
    labelEl.textContent = label;

    const input = ce('input');
    input.type = 'text';
    input.id = `pref-${name}`;
    input.name = name;
    input.className = 'settings-text-input';
    input.value = this.pref(name) || '';
    input.disabled = disabled;
    input.addEventListener('change', () => this.savePref(name, input.value));

    const desc = ce('div');
    desc.className = 'settings-description';
    desc.textContent = description;

    wrapper.appendChild(labelEl);
    wrapper.appendChild(input);
    wrapper.appendChild(desc);
    return wrapper;
  }

  buildRadioGroup(name, label, choices, disabled) {
    const wrapper = ce('div');
    wrapper.className = 'settings-item';
    if (disabled) wrapper.classList.add('disabled');

    const labelEl = ce('label');
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);

    const group = ce('div');
    group.className = 'settings-radio-group';

    const currentValue = this.pref(name);

    choices.forEach(choice => {
      const choiceLabel = ce('label');
      choiceLabel.className = 'settings-radio-option';

      const radio = ce('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = choice.value;
      radio.checked = currentValue === choice.value;
      radio.disabled = disabled;
      radio.addEventListener('change', () => {
        if (radio.checked) this.savePref(name, choice.value);
      });

      const text = ce('span');
      text.textContent = choice.label;

      choiceLabel.appendChild(radio);
      choiceLabel.appendChild(text);
      group.appendChild(choiceLabel);
    });

    wrapper.appendChild(group);
    return wrapper;
  }

  // --- Conditional Fields ---

  setupConditionalFields() {
    const toggle = qs('#pref-defaultContainer');
    if (!toggle) return;

    const update = () => {
      const enabled = toggle.checked;
      const dependents = [
        'defaultContainer.containerName',
        'defaultContainer.lifetime',
      ];

      dependents.forEach(name => {
        const field = qs(`[name="${name}"]`);
        const wrapper = field?.closest('.settings-item');

        if (field) field.disabled = !enabled;
        if (wrapper) {
          wrapper.classList.toggle('disabled', !enabled);
        }
      });
    };

    toggle.addEventListener('change', update);
    update();
  }

  // --- Save / Reset ---

  async savePref(name, value) {
    // validate container name template
    if (name === 'defaultContainer.containerName') {
      if (!value || !value.trim()) {
        showToast('Container name cannot be empty');
        return;
      }
    }

    try {
      this.preferences[name] = value;
      await PreferenceStorage.setAll({[name]: {value}});
      console.info('containTAB: setting saved:', name, '=', value);
      if (name === 'defaultContainer') this.render();
    } catch (err) {
      showToast(`Save failed: ${err}`);
    }
  }

  async handleReset() {
    if (!confirm('Reset all settings to defaults?')) return;

    showLoader();

    try {
      const defaultData = {};
      for (const [key, val] of Object.entries(DEFAULTS)) {
        defaultData[key] = {value: val};
      }

      await PreferenceStorage.setAll(defaultData);

      this.preferences = await PreferenceStorage.getAll(true);
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
