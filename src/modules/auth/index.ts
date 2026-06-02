/**
 * Auth Module - Firebase Authentication UI and Logic
 * Handles login/signup screen rendering, form validation, and Firebase integration
 */

import { validateLoginForm, validateSignupForm, validatePasswordResetEmail } from './validation';
import { loginUser, signupUser, sendPasswordReset, getCurrentUser } from './firebaseAuth';
import './styles.css';

/**
 * Module state
 */
let currentTab: 'login' | 'signup' = 'login';
let isLoading = false;
let containerId = 'auth-screen';

/**
 * Initialize the auth module
 * Called from main.ts on app startup
 */
export function initAuthModule(container: string = 'auth-screen'): void {
  containerId = container;
}

/**
 * Render the auth screen (login/signup form)
 */
export function renderAuthScreen(): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="auth-screen" id="auth-screen-root">
      <div class="auth-container">
        <h1>FIRE OS</h1>
        <p class="subtitle">Financial Independence Dashboard</p>

        <div class="auth-tabs">
          <button class="tab-login active">Login</button>
          <button class="tab-signup">Sign Up</button>
        </div>

        <!-- Login Form -->
        <form id="login-form" class="auth-form active">
          <div class="form-group">
            <label for="login-email">Email</label>
            <input
              type="email"
              id="login-email"
              placeholder="you@example.com"
              autocomplete="email"
            />
            <span class="error-message" id="login-email-error"></span>
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              placeholder="••••••"
              autocomplete="current-password"
            />
            <span class="error-message" id="login-password-error"></span>
          </div>

          <button type="submit" class="btn-primary" id="login-submit">Login</button>
          <a href="#forgot" class="forgot-password" id="forgot-password-link">Forgot password?</a>
        </form>

        <!-- Signup Form -->
        <form id="signup-form" class="auth-form">
          <div class="form-group">
            <label for="signup-email">Email</label>
            <input
              type="email"
              id="signup-email"
              placeholder="you@example.com"
              autocomplete="email"
            />
            <span class="error-message" id="signup-email-error"></span>
          </div>

          <div class="form-group">
            <label for="signup-password">Password</label>
            <input
              type="password"
              id="signup-password"
              placeholder="••••••"
              autocomplete="new-password"
            />
            <span class="error-message" id="signup-password-error"></span>
          </div>

          <div class="form-group">
            <label for="signup-confirm">Confirm Password</label>
            <input
              type="password"
              id="signup-confirm"
              placeholder="••••••"
              autocomplete="new-password"
            />
            <span class="error-message" id="signup-confirm-error"></span>
          </div>

          <button type="submit" class="btn-primary" id="signup-submit">Sign Up</button>
        </form>
      </div>
    </div>
  `;

  attachAuthEventListeners();
}

/**
 * Hide the auth screen
 */
export function hideAuthScreen(): void {
  const screen = document.getElementById('auth-screen-root');
  if (screen) {
    screen.style.display = 'none';
  }
}

/**
 * Show the auth screen
 */
export function showAuthScreen(): void {
  const screen = document.getElementById('auth-screen-root');
  if (screen) {
    screen.style.display = 'flex';
  }
}

/**
 * Attach event listeners to auth form elements
 */
function attachAuthEventListeners(): void {
  // Tab switching
  document.querySelector('.tab-login')?.addEventListener('click', () => switchTab('login'));
  document.querySelector('.tab-signup')?.addEventListener('click', () => switchTab('signup'));

  // Form submissions
  document.getElementById('login-form')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('signup-form')?.addEventListener('submit', handleSignupSubmit);

  // Forgot password link
  document.getElementById('forgot-password-link')?.addEventListener('click', handleForgotPassword);

  // Real-time validation on blur
  document.getElementById('login-email')?.addEventListener('blur', validateLoginEmailField);
  document.getElementById('login-password')?.addEventListener('blur', validateLoginPasswordField);
  document.getElementById('signup-email')?.addEventListener('blur', validateSignupEmailField);
  document.getElementById('signup-password')?.addEventListener('blur', validateSignupPasswordField);
  document.getElementById('signup-confirm')?.addEventListener('blur', validateSignupConfirmField);
}

/**
 * Switch between login and signup tabs
 */
function switchTab(tab: 'login' | 'signup'): void {
  currentTab = tab;

  // Update tab button styles
  document.querySelectorAll('.auth-tabs button').forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && tab === 'login') || (idx === 1 && tab === 'signup'));
  });

  // Show/hide forms
  document.getElementById('login-form')?.classList.toggle('active', tab === 'login');
  document.getElementById('signup-form')?.classList.toggle('active', tab === 'signup');

  // Clear previous errors
  clearAllErrors();
}

/**
 * Handle login form submission
 */
async function handleLoginSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const email = (document.getElementById('login-email') as HTMLInputElement)?.value.trim() || '';
  const password = (document.getElementById('login-password') as HTMLInputElement)?.value || '';

  // Validate form
  const validation = validateLoginForm(email, password);
  if (!validation.valid) {
    displayLoginErrors(validation.errors);
    return;
  }

  // Clear previous errors
  clearLoginErrors();

  // Set loading state
  setButtonLoading(true, 'login');

  try {
    await loginUser(email, password);
    // Auth listener in main.ts will handle redirect
  } catch (error: any) {
    displayLoginFormError(error.message || 'Login failed. Please try again.');
    setButtonLoading(false, 'login');
  }
}

/**
 * Handle signup form submission
 */
async function handleSignupSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const email = (document.getElementById('signup-email') as HTMLInputElement)?.value.trim() || '';
  const password = (document.getElementById('signup-password') as HTMLInputElement)?.value || '';
  const confirmPassword = (document.getElementById('signup-confirm') as HTMLInputElement)?.value || '';

  // Validate form
  const validation = validateSignupForm(email, password, confirmPassword);
  if (!validation.valid) {
    displaySignupErrors(validation.errors);
    return;
  }

  // Clear previous errors
  clearSignupErrors();

  // Set loading state
  setButtonLoading(true, 'signup');

  try {
    await signupUser(email, password);
    // Don't show modal - auth listener will handle redirect
    // Success is indicated by hideAuthScreen() call in main.ts
  } catch (error: any) {
    displaySignupFormError(error.message || 'Signup failed. Please try again.');
    setButtonLoading(false, 'signup');
  }
}

/**
 * Handle forgot password link click
 */
async function handleForgotPassword(e: Event): Promise<void> {
  e.preventDefault();

  const email = (document.getElementById('login-email') as HTMLInputElement)?.value.trim() || '';

  if (!email) {
    showErrorModal('Enter Email', 'Please enter your email address in the login field above.');
    return;
  }

  const validation = validatePasswordResetEmail(email);
  if (!validation.valid) {
    showErrorModal('Invalid Email', validation.errors.email || 'Invalid email address');
    return;
  }

  try {
    await sendPasswordReset(email);
    showSuccessModal('Email Sent', `Password reset email has been sent to ${email}. Check your inbox.`);
  } catch (error: any) {
    showErrorModal('Error', error.message || 'Failed to send reset email. Please try again.');
  }
}

/**
 * Display validation errors for login form
 */
function displayLoginErrors(errors: Record<string, string>): void {
  clearLoginErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`login-${field}-error`);
    const inputEl = document.getElementById(`login-${field}`) as HTMLInputElement;
    if (errorEl) {
      errorEl.textContent = message;
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  });
}

/**
 * Display validation errors for signup form
 */
function displaySignupErrors(errors: Record<string, string>): void {
  clearSignupErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const fieldName = field === 'confirmPassword' ? 'confirm' : field;
    const errorEl = document.getElementById(`signup-${fieldName}-error`);
    const inputEl = document.getElementById(`signup-${fieldName}`) as HTMLInputElement;
    if (errorEl) {
      errorEl.textContent = message;
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  });
}

/**
 * Display error for entire login form
 */
function displayLoginFormError(message: string): void {
  const errorEl = document.getElementById('login-email-error');
  if (errorEl) {
    errorEl.textContent = message;
  }
}

/**
 * Display error for entire signup form
 */
function displaySignupFormError(message: string): void {
  const errorEl = document.getElementById('signup-email-error');
  if (errorEl) {
    errorEl.textContent = message;
  }
}

/**
 * Clear all errors
 */
function clearAllErrors(): void {
  clearLoginErrors();
  clearSignupErrors();
}

/**
 * Clear login form errors
 */
function clearLoginErrors(): void {
  document.getElementById('login-email-error')!.textContent = '';
  document.getElementById('login-password-error')!.textContent = '';
  document.getElementById('login-email')?.classList.remove('error');
  document.getElementById('login-password')?.classList.remove('error');
}

/**
 * Clear signup form errors
 */
function clearSignupErrors(): void {
  document.getElementById('signup-email-error')!.textContent = '';
  document.getElementById('signup-password-error')!.textContent = '';
  document.getElementById('signup-confirm-error')!.textContent = '';
  document.getElementById('signup-email')?.classList.remove('error');
  document.getElementById('signup-password')?.classList.remove('error');
  document.getElementById('signup-confirm')?.classList.remove('error');
}

/**
 * Validate login email field on blur
 */
function validateLoginEmailField(): void {
  const email = (document.getElementById('login-email') as HTMLInputElement)?.value.trim() || '';
  const errorEl = document.getElementById('login-email-error');
  const inputEl = document.getElementById('login-email') as HTMLInputElement;

  if (!email) {
    errorEl!.textContent = 'Email is required';
    inputEl?.classList.add('error');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl!.textContent = 'Please enter a valid email address';
    inputEl?.classList.add('error');
  } else {
    errorEl!.textContent = '';
    inputEl?.classList.remove('error');
  }
}

/**
 * Validate login password field on blur
 */
function validateLoginPasswordField(): void {
  const password = (document.getElementById('login-password') as HTMLInputElement)?.value || '';
  const errorEl = document.getElementById('login-password-error');
  const inputEl = document.getElementById('login-password') as HTMLInputElement;

  if (!password) {
    errorEl!.textContent = 'Password is required';
    inputEl?.classList.add('error');
  } else if (password.length < 6) {
    errorEl!.textContent = 'Password must be at least 6 characters';
    inputEl?.classList.add('error');
  } else {
    errorEl!.textContent = '';
    inputEl?.classList.remove('error');
  }
}

/**
 * Validate signup email field on blur
 */
function validateSignupEmailField(): void {
  const email = (document.getElementById('signup-email') as HTMLInputElement)?.value.trim() || '';
  const errorEl = document.getElementById('signup-email-error');
  const inputEl = document.getElementById('signup-email') as HTMLInputElement;

  if (!email) {
    errorEl!.textContent = 'Email is required';
    inputEl?.classList.add('error');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl!.textContent = 'Please enter a valid email address';
    inputEl?.classList.add('error');
  } else {
    errorEl!.textContent = '';
    inputEl?.classList.remove('error');
  }
}

/**
 * Validate signup password field on blur
 */
function validateSignupPasswordField(): void {
  const password = (document.getElementById('signup-password') as HTMLInputElement)?.value || '';
  const errorEl = document.getElementById('signup-password-error');
  const inputEl = document.getElementById('signup-password') as HTMLInputElement;

  if (!password) {
    errorEl!.textContent = 'Password is required';
    inputEl?.classList.add('error');
  } else if (password.length < 6) {
    errorEl!.textContent = 'Password must be at least 6 characters';
    inputEl?.classList.add('error');
  } else {
    errorEl!.textContent = '';
    inputEl?.classList.remove('error');
  }
}

/**
 * Validate signup confirm password field on blur
 */
function validateSignupConfirmField(): void {
  const password = (document.getElementById('signup-password') as HTMLInputElement)?.value || '';
  const confirmPassword = (document.getElementById('signup-confirm') as HTMLInputElement)?.value || '';
  const errorEl = document.getElementById('signup-confirm-error');
  const inputEl = document.getElementById('signup-confirm') as HTMLInputElement;

  if (!confirmPassword) {
    errorEl!.textContent = 'Please confirm your password';
    inputEl?.classList.add('error');
  } else if (password !== confirmPassword) {
    errorEl!.textContent = 'Passwords do not match';
    inputEl?.classList.add('error');
  } else {
    errorEl!.textContent = '';
    inputEl?.classList.remove('error');
  }
}

/**
 * Set button loading state
 */
function setButtonLoading(loading: boolean, form: 'login' | 'signup'): void {
  isLoading = loading;
  const button = document.getElementById(
    form === 'login' ? 'login-submit' : 'signup-submit',
  ) as HTMLButtonElement;

  if (!button) return;

  if (loading) {
    button.disabled = true;
    button.classList.add('loading');
    button.textContent = form === 'login' ? 'Logging in...' : 'Signing up...';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    button.textContent = form === 'login' ? 'Login' : 'Sign Up';
  }
}

/**
 * Show success modal
 */
function showSuccessModal(title: string, message: string): void {
  const modal = createModal(title, message, true);
  document.body.appendChild(modal);
  modal.querySelector('button')?.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Show error modal
 */
function showErrorModal(title: string, message: string): void {
  const modal = createModal(title, message, false);
  document.body.appendChild(modal);
  modal.querySelector('button')?.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Create modal dialog element
 */
function createModal(title: string, message: string, isSuccess: boolean): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-content">
      <h2>${title}</h2>
      <p>${message}</p>
      <button>${isSuccess ? 'Close' : 'OK'}</button>
    </div>
  `;
  return modal;
}

/**
 * Cleanup module (remove event listeners, clear DOM)
 */
export function teardownAuthModule(): void {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}
