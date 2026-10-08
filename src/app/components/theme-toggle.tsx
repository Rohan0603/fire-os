import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fire-os-theme';
type Theme = 'light' | 'dark';

function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/**
 * Manual dark-mode override.
 *
 * With no stored preference the `data-theme` attribute is left unset so the CSS
 * `@media (prefers-color-scheme)` rule decides, which is the spec's
 * system-default behaviour. An explicit choice is persisted under
 * `fire-os-theme` and always wins over the system preference.
 *
 * Mounted above the router outlet so the override survives navigation.
 * `#theme-toggle` keeps its id, and `themeChanged` is still dispatched on change
 * because `modules/dashboard` listens for it to re-theme its charts.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme) {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
      // Keep the checkbox aligned with the system preference while unset.
      setTheme(null);
    }
    document.getElementById('theme-toggle')?.toggleAttribute('data-unset', !theme);
  }, [theme]);

  const isDark = theme
    ? theme === 'dark'
    : typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const apply = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event('themeChanged'));
  };

  return (
    <button
      type="button"
      id="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={() => apply(isDark ? 'light' : 'dark')}
      className="rounded-md border border-[--color-border] px-3 py-1.5 text-sm
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-[--color-secondary]"
    >
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
}
