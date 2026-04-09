import {qs} from '../utils';

const loader = qs('.loader');
let safetyTimer = null;
const LOADER_TIMEOUT = 10000;

export const showLoader = () => {
  if (safetyTimer) clearTimeout(safetyTimer);
  loader.classList.remove('hide');
  safetyTimer = setTimeout(hideLoader, LOADER_TIMEOUT);
};

export const hideLoader = () => {
  if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
  loader.classList.add('hide');
};
