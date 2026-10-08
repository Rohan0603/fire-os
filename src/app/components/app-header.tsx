import { AuthButton } from './auth-button';
import { ThemeToggle } from './theme-toggle';

/**
 * App header: brand, auth control and theme toggle.
 *
 * The auth control keeps `#logout-btn`; `AuthSessionController` drives its label
 * and visibility. See components/auth-button.tsx.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-(--color-border) p-3">
      <span className="text-lg font-bold">FIRE OS</span>
      <div className="flex items-center gap-3">
        <AuthButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
