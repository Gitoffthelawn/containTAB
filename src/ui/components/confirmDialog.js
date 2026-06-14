/**
 * confirmDialog render owner for the popup UI.
 *
 * Schema: docs/handbook/schemas/ui-confirm-dialog.schema.json
 *
 * Opens the shared #confirm-dialog with a message and an onConfirm callback.
 * Converges the byte-identical confirm() methods previously duplicated in
 * RulesSection and ContainersSection. Operates on the static dialog markup
 * (#confirm-dialog / #confirm-message / #confirm-cancel / #confirm-ok) defined
 * in index.html; falls back to window.confirm when that markup is absent.
 */

import {qs} from '../../utils';

/**
 * @param {string} message
 * @param {() => void} onConfirm
 */
export function confirmDialog(message, onConfirm) {
  const dialog = qs('#confirm-dialog');
  const messageEl = qs('#confirm-message');
  const cancel = qs('#confirm-cancel');
  const ok = qs('#confirm-ok');

  if (!dialog || !messageEl || !cancel || !ok) {
    if (confirm(message)) onConfirm();
    return;
  }

  const close = () => {
    dialog.classList.add('hide');
    dialog.classList.remove('active');
    cancel.onclick = null;
    ok.onclick = null;
  };

  messageEl.textContent = message;
  dialog.classList.remove('hide');
  dialog.classList.add('active');
  cancel.onclick = close;
  ok.onclick = () => {
    close();
    onConfirm();
  };
}
