/**
 * Navigator — Bottom-tab popup navigation.
 *
 * Containers, Rules, and Settings are primary tabs. Help is a temporary
 * secondary screen that returns to the last primary tab.
 */

import {qs, qsAll} from '../utils';

class Navigator {
  constructor() {
    this.current = 'rules';
    this.previousPrimary = 'rules';
    this.sections = {};
    this.setupEvents();
    this.showScreen(this.current);
  }

  setupEvents() {
    qsAll('[data-target]').forEach(button => {
      button.addEventListener('click', () => {
        const target = button.dataset.target;
        if (!target) return;
        if (target === 'help') {
          this.showHelp();
          return;
        }
        this.showScreen(target);
      });
    });

    qsAll('.back-button').forEach(btn => {
      btn.addEventListener('click', () => this.showScreen(this.previousPrimary));
    });
  }

  /**
   * Register a section so Navigator can call onShow/onHide.
   * @param {string} name - 'rules' | 'containers' | 'settings'
   * @param {object} section - section instance with optional onShow/onHide
   */
  register(name, section) {
    this.sections[name] = section;
  }

  showScreen(name) {
    if (this.current !== name && this.sections[this.current]?.onHide) {
      this.sections[this.current].onHide();
    }

    qsAll('.screen').forEach(s => {
      s.classList.add('hide');
      s.classList.remove('active');
    });

    const screen = qs(`#${name}-screen`);
    if (screen) {
      screen.classList.remove('hide');
      screen.classList.add('active');
    }

    this.current = name;
    if (name !== 'help') {
      this.previousPrimary = name;
    }

    qsAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.target === name);
    });

    if (this.sections[name]?.onShow) {
      this.sections[name].onShow();
    }
  }

  showHelp() {
    this.showScreen('help');
  }

  /**
   * Update badge counts on main screen cards.
   * @param {object} state - {urlMaps, identities}
   */
  updateBadges(state) {
    const rulesBadge = qs('#rules-badge');
    const containersBadge = qs('#containers-badge');

    if (rulesBadge && state.urlMaps) {
      rulesBadge.textContent = Object.keys(state.urlMaps).length;
    }

    if (containersBadge && state.identities) {
      // Subtract 1 for NO_CONTAINER
      const count = Math.max(0, state.identities.length - 1);
      containersBadge.textContent = count;
    }
  }
}

export default new Navigator();
