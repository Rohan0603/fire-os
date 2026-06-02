/**
 * Global Error Handler
 * Manages error logging, user notifications, and graceful error recovery
 */

import { showToast } from '../modules/ui';
import { getLogger } from './logger';

const logger = getLogger();

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public severity: 'info' | 'warning' | 'error' = 'error'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle error with logging and user notification
 */
export function handleError(error: unknown, userMessage?: string) {
  let message = userMessage || 'An error occurred';
  let code = 'UNKNOWN_ERROR';
  let severity: 'info' | 'warning' | 'error' = 'error';

  if (error instanceof AppError) {
    message = userMessage || error.message;
    code = error.code;
    severity = error.severity;
  } else if (error instanceof Error) {
    message = userMessage || error.message;
    code = error.name;
  }

  logger.error(`[${code}] ${message}`, error);

  if (severity !== 'info') {
    showToast(`${severity === 'error' ? '✗' : '⚠️'} ${message}`);
  }

  return { message, code, severity };
}

/**
 * Validation error (for form input validation)
 */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 'warning');
    this.name = 'ValidationError';
  }
}

/**
 * API error
 */
export class APIError extends AppError {
  constructor(
    message: string,
    public endpoint: string,
    public statusCode?: number
  ) {
    super(message, 'API_ERROR', 'error');
    this.name = 'APIError';
  }
}

/**
 * Firebase error
 */
export class FirebaseError extends AppError {
  constructor(
    message: string,
    public operation: string
  ) {
    super(message, 'FIREBASE_ERROR', 'error');
    this.name = 'FirebaseError';
  }
}

/**
 * Offline error - special handling for offline state
 */
export class OfflineError extends AppError {
  constructor(message: string = 'You are offline. Changes will be synced when you reconnect.') {
    super(message, 'OFFLINE_ERROR', 'warning');
    this.name = 'OfflineError';
  }
}

/**
 * Setup global error handler
 */
export function setupErrorHandling() {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason);
  });

  // Global error handler
  window.addEventListener('error', (event) => {
    handleError(event.error);
  });

  // Offline detection
  window.addEventListener('offline', () => {
    showToast('📡 You are offline - changes will sync when connected');
    logger.warn('App went offline');
  });

  window.addEventListener('online', () => {
    showToast('✓ Back online - syncing changes');
    logger.log('App came online');
  });

  logger.log('Error handling initialized');
}

/**
 * Validate form input
 */
export function validateFormInput(
  value: any,
  field: string,
  type: 'string' | 'number' | 'email' | 'date' = 'string'
): boolean {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  if (type === 'number' && typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new ValidationError(`${field} must be a valid number`, field);
    }
  }

  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${field} must be a valid email`, field);
    }
  }

  if (type === 'date') {
    const dateRegex = /^\d{4}-\d{2}$/; // YYYY-MM format
    if (!dateRegex.test(value)) {
      throw new ValidationError(`${field} must be in YYYY-MM format`, field);
    }
  }

  return true;
}

/**
 * Safe async wrapper - catches errors and notifies user
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    handleError(e, errorMessage);
    return null;
  }
}

/**
 * Safe sync wrapper - catches errors and notifies user
 */
export function safeSync<T>(
  fn: () => T,
  errorMessage: string = 'Operation failed'
): T | null {
  try {
    return fn();
  } catch (e) {
    handleError(e, errorMessage);
    return null;
  }
}
