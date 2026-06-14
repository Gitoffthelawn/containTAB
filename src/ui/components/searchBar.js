/**
 * searchBar render owner for the popup UI.
 *
 * Schema: docs/handbook/schemas/ui-search-bar.schema.json
 *
 * Same structure/style across Rules and Containers tools: a <label.search>
 * wrapping a search icon and a <input type=search>. Content differs (class,
 * id, placeholder, value, input handler) — passed as props. Returns
 * { label, input } so the caller keeps its input reference.
 */

import {ce} from '../../utils';
import {buildIcon} from './uiIcon';

/**
 * @param {object} opts
 * @param {string} opts.labelClass full class for the <label> (incl. 'search')
 * @param {string} opts.inputId
 * @param {string} opts.inputClass
 * @param {string} opts.placeholder
 * @param {string} [opts.value='']
 * @param {(e: Event) => void} [opts.onInput]
 * @returns {{label: HTMLLabelElement, input: HTMLInputElement}}
 */
export function searchBar({labelClass, inputId, inputClass, placeholder, value = '', onInput}) {
  const label = ce('label');
  label.className = labelClass;

  const input = ce('input');
  input.type = 'search';
  input.id = inputId;
  input.className = inputClass;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.value = value;
  if (onInput) input.addEventListener('input', onInput);

  label.append(buildIcon('search'), input);
  return {label, input};
}
