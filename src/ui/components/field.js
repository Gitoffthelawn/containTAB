/**
 * Field + Subhead render owners for the popup UI.
 *
 * Schema: docs/handbook/schemas/ui-field.schema.json
 *
 * settingRow — a labeled row: [icon?] [title + description] [control].
 *   Converges RulesSection.buildPageField, ContainersSection.buildCreateField,
 *   and SettingsSection.buildSettingRow. The three differ only in class strings
 *   and a few switches (optional icon, textarea-row, removed-empty-description,
 *   disabled), all passed as props so each call emits byte-identical DOM.
 *
 * subhead — back button + title + description. Converges
 *   RulesSection.buildSubhead and the two inline copies in ContainersSection.
 *   Returns { head, back } so the caller binds the back click.
 */

import {ce} from '../../utils';
import {buildIcon} from './uiIcon';

/**
 * settingRow — labeled setting/field row.
 * @param {object} opts
 * @param {string} [opts.icon] uiIcon name; omit for no icon
 * @param {string} opts.titleText
 * @param {string} [opts.description]
 * @param {HTMLElement} opts.control
 * @param {string} [opts.rowClass='setting-row'] full row class
 * @param {string} [opts.titleClass='title'] full title class
 * @param {string} [opts.subClass='sub'] full description class
 * @param {boolean} [opts.removeEmptyDescription=false] remove sub node when description is empty
 * @returns {HTMLDivElement}
 */
export function settingRow({
  icon,
  titleText,
  description = '',
  control,
  rowClass = 'setting-row',
  titleClass = 'title',
  subClass = 'sub',
  removeEmptyDescription = false,
}) {
  const row = ce('div');
  row.className = rowClass;

  if (icon) {
    const iconWrap = ce('div');
    iconWrap.className = 'setting-icon';
    iconWrap.appendChild(buildIcon(icon));
    row.appendChild(iconWrap);
  }

  const text = ce('div');
  const title = ce('div');
  title.className = titleClass;
  title.textContent = titleText;
  const sub = ce('div');
  sub.className = subClass;
  sub.textContent = description;
  text.append(title, sub);
  if (removeEmptyDescription && !description) sub.remove();

  row.append(text, control);
  return row;
}

/**
 * subhead — back button + title + description block.
 * @param {object} opts
 * @param {string} opts.titleText
 * @param {string} opts.description
 * @param {string} opts.backId id + data-action of the back button
 * @param {string} [opts.backAriaLabel='Back to rules']
 * @returns {{head: HTMLDivElement, back: HTMLButtonElement}}
 */
export function subhead({titleText, description, backId, backAriaLabel = 'Back to rules', withDataAction = true}) {
  const head = ce('div');
  head.className = 'subhead';

  const back = ce('button');
  back.className = 'back-button back';
  back.type = 'button';
  back.id = backId;
  if (withDataAction) back.dataset.action = backId;
  back.setAttribute('aria-label', backAriaLabel);
  back.appendChild(buildIcon('back'));

  const text = ce('div');
  const title = ce('div');
  title.className = 'sub-title';
  title.textContent = titleText;
  const sub = ce('div');
  sub.className = 'sub-description';
  sub.textContent = description;
  text.append(title, sub);

  head.append(back, text);
  return {head, back};
}
