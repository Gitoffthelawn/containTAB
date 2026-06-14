/**
 * containerPill render owner for the popup UI.
 *
 * Schema: docs/handbook/schemas/ui-pill.schema.json
 *
 * A container pill: [icon wrapper] [label]. Same structure/style across the
 * Rules rule-container-badge and the Containers container-identity; content
 * and the locked per-tab class names differ (the icon-wrapper class —
 * rule-mini-icon vs container-icon — is asserted distinct per tab by the
 * smoke-parity gate). All class strings + the icon-wrapper tag are props.
 *
 * The uiIcon name is resolved by the caller and passed in, since the Rules
 * resolution path (string-or-identity) differs from Containers.
 */

import {ce} from '../../utils';
import {buildIcon} from './uiIcon';

/**
 * @param {object} opts
 * @param {string} opts.uiIcon resolved uiIcon name to render
 * @param {string} opts.labelText
 * @param {string} opts.pillClass full class for the pill element (incl. 'container-pill')
 * @param {string} opts.iconClass icon-wrapper class ('rule-mini-icon' | 'container-icon')
 * @param {string} opts.labelClass label class (incl. 'container-pill-label')
 * @param {'span'|'div'} [opts.iconTag='span'] icon-wrapper element tag
 * @param {'span'|'div'} [opts.pillTag='span'] pill element tag
 * @returns {{pill: HTMLElement, label: HTMLElement, icon: HTMLElement}}
 */
export function containerPill({uiIcon, labelText, pillClass, iconClass, labelClass, iconTag = 'span', pillTag = 'span'}) {
  const pill = ce(pillTag);
  pill.className = pillClass;

  const icon = ce(iconTag);
  icon.className = iconClass;
  icon.appendChild(buildIcon(uiIcon));

  const label = ce('span');
  label.className = labelClass;
  label.textContent = labelText;

  pill.append(icon, label);
  return {pill, label, icon};
}
