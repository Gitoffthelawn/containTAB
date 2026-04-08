import {qs} from '../utils';

const toast = qs('.toast');

export const showToast = (msg) => {
  if (msg) {
    toast.textContent = msg;
    toast.classList.remove('hide');
  }
};

export const hideToast = () => toast.classList.add('hide');
