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

  // Initial setup
  setDarkTheme(resolveInitialTheme(savedTheme, prefersDark));

  if (toggleInput) {
    toggleInput.addEventListener('change', (e) => {
      setDarkTheme((e.target as HTMLInputElement).checked);
    });
  }
}
