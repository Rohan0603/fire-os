/**
 * Decide the initial colour scheme: an explicit saved theme wins over the OS
 * preference, and an unset/unknown saved value falls back to light unless the
 * OS prefers dark.
 */
export function resolveInitialTheme(savedTheme: string | null, prefersDark: boolean): boolean {
  return savedTheme === 'dark' || (!savedTheme && prefersDark);
}

// Theme toggle logic
export function setupTheme(): void {
  const toggleInput = document.getElementById('theme-toggle') as HTMLInputElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('fire-os-theme');

  const setDarkTheme = (isDark: boolean) => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('fire-os-theme', isDark ? 'dark' : 'light');
    if (toggleInput) toggleInput.checked = isDark;
    window.dispatchEvent(new Event('themeChanged'));
  };

  // Initial setup applies the resolved theme WITHOUT persisting it. Only a real
  // toggle writes a preference, so an unset preference stays unset and the CSS
  // `@media (prefers-color-scheme)` rule stays authoritative (docs/ui.md).
  // Writing here would freeze the OS preference seen on first load into
  // localStorage, so a later change of OS setting would be ignored.
  const initialIsDark = resolveInitialTheme(savedTheme, prefersDark);
  document.documentElement.dataset.theme = initialIsDark ? 'dark' : 'light';
  if (toggleInput) toggleInput.checked = initialIsDark;
  window.dispatchEvent(new Event('themeChanged'));

  if (toggleInput) {
    toggleInput.addEventListener('change', (e) => {
      setDarkTheme((e.target as HTMLInputElement).checked);
    });
  }
}
