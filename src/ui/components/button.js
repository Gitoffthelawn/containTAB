/**
 * Button render owners for the popup UI.
 *
 * Schema: docs/handbook/schemas/ui-button.schema.json
 *
 * Two render methods converge the duplicated button construction across
 * RulesSection / ContainersSection:
 *
 *   primaryButton — full-width primary action (.primary-action + variant)
 *   iconButton    — compact icon-only action (.small-btn / .container-icon-btn)
 *
 * These return a bare <button> element. Event binding stays with the caller
 * (the section owns the click behavior and its closure state); the owner only
 * fixes the structure (icon + label + type + a11y + data-action) so every
 * section emits byte-identical DOM. class is a prop so existing locked class
 * names (smoke-parity / test selectors) are preserved exactly.
 */

import {ce} from '../../utils';
import {buildIcon} from './uiIcon';

/**
 * primaryButton — full-width primary action button.
 * @param {object} opts
 * @param {string} opts.icon uiIcon name
 * @param {string} opts.text visible span text
 * @param {string} opts.className full class string (incl. 'primary-action' + variants)
 * @param {string} [opts.title] title attribute (omit to not set)
 * @param {string} [opts.ariaLabel] aria-label attribute (omit to not set)
 * @param {string} [opts.dataAction] data-action attribute value
 * @param {boolean} [opts.disabled]
 * @returns {HTMLButtonElement}
 */
export function primaryButton({icon, text, className, title, ariaLabel, dataAction, disabled = false}) {
  const button = ce('button');
  button.className = className;
  button.type = 'button';
  if (title !== undefined) button.title = title;
  if (ariaLabel !== undefined) button.setAttribute('aria-label', ariaLabel);
  if (dataAction) button.dataset.action = dataAction;
  button.append(buildIcon(icon), document.createElement('span'));
  button.lastChild.textContent = text;
  if (disabled) button.disabled = true;
  return button;
}

/**
 * iconButton — compact icon-only action button.
 * @param {object} opts
 * @param {string} opts.icon uiIcon name
 * @param {string} opts.label title attribute; also aria-label unless ariaLabel given
 * @param {string} opts.className full class string ('small-btn' | 'container-icon-btn ...')
 * @param {string} [opts.ariaLabel] aria-label override (defaults to label)
 * @param {string} [opts.dataAction] data-action attribute value
 * @returns {HTMLButtonElement}
 */
export function iconButton({icon, label, className, ariaLabel, dataAction}) {
  const button = ce('button');
  button.className = className;
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', ariaLabel !== undefined ? ariaLabel : label);
  if (dataAction) button.dataset.action = dataAction;
  button.appendChild(buildIcon(icon));
  return button;
}

/**
 * switchButton — a toggle styled as .settings-switch.
 * Same structure/style (button.settings-switch[.on]); content differs (extra
 * class, id, name, data-switch flag, title, aria-label). Click behavior is
 * bound by the caller.
 * @param {object} opts
 * @param {boolean} opts.on
 * @param {string} opts.ariaLabel
 * @param {string} [opts.className='settings-switch'] full class (incl. 'settings-switch')
 * @param {string} [opts.id]
 * @param {string} [opts.name]
 * @param {boolean} [opts.dataSwitch=false] add empty data-switch attribute
 * @param {string} [opts.title] title attribute (omit to not set)
 * @returns {HTMLButtonElement}
 */
export function switchButton({on, ariaLabel, className = 'settings-switch', id, name, dataSwitch = false, title}) {
  const button = ce('button');
  button.type = 'button';
  if (id) button.id = id;
  if (name) button.name = name;
  button.className = className;
  if (dataSwitch) button.dataset.switch = '';
  button.classList.toggle('on', on);
  if (title !== undefined) button.title = title;
  button.setAttribute('aria-label', ariaLabel);
  button.setAttribute('aria-pressed', String(on));
  return button;
}
