/**
 * index.js — containTAB popup entry point.
 *
 * Initializes State, loads data from storage/API,
 * sets up change listeners, registers sections with Navigator.
 */

import './styles/style.scss';
import './index.html';
import State from '../State';
import ContextualIdentity, {NO_CONTAINER} from '../ContextualIdentity';
import HostStorage from '../Storage/HostStorage';
import GlobalConfig from '../GlobalConfig';
import ContainerExtension, { uiIconForNativeIcon } from '../ContainerExtension';
import Tabs from '../Tabs';
import Navigator from './Navigator';
import RulesSection from './RulesSection';
import ContainersSection from './ContainersSection';
import SettingsSection from './SettingsSection';
import applyTheme from './applyTheme';

// Apply theme as early as possible to reduce FOUC on popup open.
GlobalConfig.get().then((config) => {
  applyTheme(config.theme || 'system');
}).catch(() => {
  applyTheme('system');
});

// Initialize state
State.setState({
  identities: [],
  selectedIdentity: {},
  activeHost: '',
  urlMaps: {},
});

// Load data
const withContainerExtension = async (identity) => {
  const ext = await ContainerExtension.get(identity.cookieStoreId);
  return {
    ...identity,
    uiIcon: uiIconForNativeIcon(identity.icon),
    lifetime: ext?.lifetime || 'forever',
  };
};

const getIdentities = () => {
  ContextualIdentity.getAll().then(async (identities) => {
    const decorated = await Promise.all(identities.map(withContainerExtension));
    State.set('identities', decorated);
  });
};

const getUrlMaps = () => {
  HostStorage.getAll().then((urlMaps) => {
    State.set('urlMaps', urlMaps);
  });
};

getIdentities();
getUrlMaps();

// Listen for external changes
ContextualIdentity.addOnChangedListener(() => {
  getIdentities();
});

HostStorage.addOnChangedListener(() => {
  getUrlMaps();
});

// Set selected identity from active tab
Tabs.query({active: true}).then(tabs => {
  const activeTab = tabs[0];
  try {
    State.set('activeHost', activeTab?.url ? new URL(activeTab.url).hostname : '');
  } catch (_) {
    State.set('activeHost', '');
  }

  if (activeTab.cookieStoreId === 'firefox-default') {
    State.set('selectedIdentity', NO_CONTAINER);
    return;
  }

  ContextualIdentity.getAll().then((identities) => {
    for (const identity of identities) {
      if (identity.cookieStoreId === activeTab.cookieStoreId) {
        State.set('selectedIdentity', identity);
        break;
      }
    }
  });
});

// Register sections with Navigator
Navigator.register('rules', RulesSection);
Navigator.register('containers', ContainersSection);
Navigator.register('settings', SettingsSection);

// Update Navigator badges on state change
State.addListener((state) => {
  Navigator.updateBadges(state);
});

window.State = State;
