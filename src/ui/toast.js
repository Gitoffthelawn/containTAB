import {qs} from '../utils';

const toast = qs('.toast');
let hideTimer = null;

export const showToast = (msg, duration = 3000) => {
  if (msg) {
    if (hideTimer) clearTimeout(hideTimer);
    toast.textContent = msg;
    toast.classList.remove('hide');
    hideTimer = setTimeout(hideToast, duration);
  }
};

export const hideToast = () => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  toast.classList.add('hide');
};
