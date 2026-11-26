/**
 * Colour theme for every extension page (popup, side panel, options): system | light | dark.
 * The choice lives in localStorage, which all extension pages share and can read synchronously, so the
 * theme is applied before first paint (MV3 forbids inline scripts, so this module is imported first in each main.tsx).
 * The `storage` event keeps open pages in sync when it changes in another one.
 */
export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'decima-theme';
const mq = matchMedia('(prefers-color-scheme: light)');

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

function apply(pref: ThemePref) {
  const light = pref === 'light' || (pref === 'system' && mq.matches);
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme-pref', pref);
}

export function setThemePref(pref: ThemePref) {
  try { pref === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
  apply(pref);
  window.dispatchEvent(new Event('decima-theme'));
}

export function initTheme() {
  apply(getThemePref());
  mq.addEventListener('change', () => { if (getThemePref() === 'system') apply('system'); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { apply(getThemePref()); window.dispatchEvent(new Event('decima-theme')); } });
}
