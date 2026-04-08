/**
 * Navigator — Main↔Sub screen drill-down navigation.
 *
 * Main screen shows 3 cards (Rules, Containers, Settings).
 * Click card → sub screen. Back button → main screen.
 */

import {qs, qsAll} from '../utils';

class Navigator {
  constructor() {
    this.current = 'main';
    this.sections = {};
    this.setupEvents();
  }

  setupEvents() {
    // Card clicks → navigate to sub screen
    qsAll('.nav-card').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.target;
        if (target) this.showSub(target);
      });
    });

    // Back buttons → return to main
    qsAll('.back-button').forEach(btn => {
      btn.addEventListener('click', () => this.showMain());
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

  showMain() {
    // Hide current sub screen
    if (this.current !== 'main' && this.sections[this.current]?.onHide) {
      this.sections[this.current].onHide();
    }

    qsAll('.screen').forEach(s => {
      s.classList.add('hide');
      s.classList.remove('active');
    });

    const main = qs('#main-screen');
    main.classList.remove('hide');
    main.classList.add('active');
    this.current = 'main';
  }

  showSub(name) {
    qsAll('.screen').forEach(s => {
      s.classList.add('hide');
      s.classList.remove('active');
    });

    const sub = qs(`#${name}-screen`);
    if (sub) {
      sub.classList.remove('hide');
      sub.classList.add('active');
    }

    this.current = name;

    if (this.sections[name]?.onShow) {
      this.sections[name].onShow();
    }
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
