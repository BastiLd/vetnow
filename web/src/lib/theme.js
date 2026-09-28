/* v3: Hell / Dunkel / Automatisch (wie das Gerät). Gespeichert pro Gerät unter vn3:theme.
   'auto' entfernt das Attribut → CSS folgt prefers-color-scheme. */
const KEY = 'vn3:theme';
export const THEMES = ['auto', 'light', 'dark'];
export const THEME_LABEL = { auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' };

export function getTheme() {
  try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}

export function applyTheme(v) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (v === 'light' || v === 'dark') root.dataset.theme = v; else delete root.dataset.theme;
  const dark = v === 'dark' || (v !== 'light' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', dark ? '#0e1715' : '#0c7d72');
}

export function setTheme(v) {
  try { localStorage.setItem(KEY, v); } catch { /* privater Modus */ }
  applyTheme(v);
}

export function nextTheme(v) { return THEMES[(THEMES.indexOf(v) + 1) % THEMES.length]; }
