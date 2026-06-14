/**
 * applyTheme — Pure write to <html data-theme>.
 *
 * 'system' removes the attribute so @media (prefers-color-scheme: dark)
 * inside SCSS can drive vars. 'light' / 'dark' force the explicit selector.
 * Unknown values fall back to 'system'.
 */

const VALID = new Set(['system', 'light', 'dark']);

export default function applyTheme(value) {
  const root = document.documentElement;
  if (value === 'light' || value === 'dark') {
    root.setAttribute('data-theme', value);
  } else {
    root.removeAttribute('data-theme');
  }
}

export { VALID as VALID_THEMES };
