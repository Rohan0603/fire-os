import { useEffect } from 'react';
import { refreshAuthControl, triggerAuthAction } from '../legacy-bridge';

/**
 * Sign-in / sign-out control.
 *
 * `#logout-btn` and the `btn-logout` class are preserved because
 * `AuthSessionController` looks the element up by id and drives its label and
 * visibility itself: it sets `textContent` to "Sign in" in guest mode and leaves
 * it as "Logout" when authenticated, and it hides the control while the auth
 * screen is showing. React therefore renders it with no children of its own, so
 * it never overwrites what the controller writes.
 *
 * The mount effect re-applies that state: the session resolves before React
 * mounts, so the controller's own update landed before this element existed.
 */
export function AuthButton() {
  useEffect(() => {
    refreshAuthControl();
  }, []);

  return (
    <button
      id="logout-btn"
      className="btn-logout"
      style={{ display: 'none' }}
      onClick={() => {
        void triggerAuthAction();
      }}
    />
  );
}
