/**
 * PromptDialog - Modal dialog for text input with validation
 */

class PromptDialog {
  constructor() {
    this.overlay = document.querySelector('.prompt-dialog-overlay');
    this.dialog = document.querySelector('.prompt-dialog');
    this.input = document.querySelector('.dialog-input');
    this.errorDiv = document.querySelector('.dialog-error');
    this.confirmButton = document.querySelector('.dialog-confirm-button');
    this.cancelButton = document.querySelector('.dialog-cancel-button');
    this.closeButton = document.querySelector('.dialog-close-button');

    this.resolve = null;
    this.validateFn = null;

    this._bindEvents();
  }

  _bindEvents() {
    // Cancel button
    this.cancelButton.addEventListener('click', () => this._cancel());

    // Close button
    this.closeButton.addEventListener('click', () => this._cancel());

    // Confirm button
    this.confirmButton.addEventListener('click', () => this._confirm());

    // Overlay click (outside dialog)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this._cancel();
      }
    });

    // Input change - validate
    this.input.addEventListener('input', () => this._validateInput());

    // Keyboard shortcuts
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.confirmButton.disabled) {
        this._confirm();
      } else if (e.key === 'Escape') {
        this._cancel();
      }
    });
  }

  /**
   * Show dialog and return a promise
   * @param {Object} options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Prompt message
   * @param {string} options.placeholder - Input placeholder
   * @param {string} options.defaultValue - Default input value
   * @param {Function} options.validate - Validation function (value) => errorMessage | null
   * @returns {Promise<string|null>} User input or null if cancelled
   */
  show(options = {}) {
    // Set content
    const title = this.dialog.querySelector('#dialog-title');
    const message = this.dialog.querySelector('#dialog-message');

    if (options.title) title.textContent = options.title;
    if (options.message) message.textContent = options.message;
    if (options.placeholder) this.input.placeholder = options.placeholder;

    // Set default value
    this.input.value = options.defaultValue || '';

    // Set validation function
    this.validateFn = options.validate || null;

    // Show dialog
    this.overlay.classList.remove('hide');

    // Focus input
    setTimeout(() => this.input.focus(), 100);

    // Initial validation
    this._validateInput();

    // Return promise
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  _validateInput() {
    const value = this.input.value.trim();

    if (!this.validateFn) {
      // No validation function, enable if not empty
      this._setError(null);
      this.confirmButton.disabled = value === '';
      return;
    }

    // Run validation
    const error = this.validateFn(value);

    if (error) {
      this._setError(error);
      this.confirmButton.disabled = true;
      this.input.classList.add('error');
    } else {
      this._setError(null);
      this.confirmButton.disabled = false;
      this.input.classList.remove('error');
    }
  }

  _setError(message) {
    if (message) {
      this.errorDiv.textContent = message;
      this.errorDiv.style.display = 'block';
    } else {
      this.errorDiv.textContent = '';
      this.errorDiv.style.display = 'none';
    }
  }

  _confirm() {
    const value = this.input.value.trim();
    this._close();
    if (this.resolve) {
      this.resolve(value);
      this.resolve = null;
    }
  }

  _cancel() {
    this._close();
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
  }

  _close() {
    this.overlay.classList.add('hide');
    this.input.value = '';
    this._setError(null);
    this.input.classList.remove('error');
  }
}

// Create singleton instance
const promptDialog = new PromptDialog();

/**
 * Show prompt dialog (convenience function)
 * @param {Object} options - Dialog options
 * @returns {Promise<string|null>}
 */
export function showPromptDialog(options) {
  return promptDialog.show(options);
}

export default PromptDialog;
