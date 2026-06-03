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
 * Validation Rules - Composable validation for form inputs
 */
export interface ValidationRule {
  name: string;
  validate: (value: any) => string | null; // Returns error message or null if valid
}

export const ValidationRules = {
  required: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const strValue = String(value || '').trim();
      return strValue ? null : `${fieldName} is required`;
    },
  }),

  positiveNumber: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 ? null : `${fieldName} must be a positive number`;
    },
  }),

  positiveNumberRequired: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const num = parseFloat(value);
      return !isNaN(num) && num > 0 ? null : `${fieldName} must be a positive number`;
    },
  }),

  dateYYYYMM: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      if (!value) return null; // Optional field
      const match = /^\d{4}-\d{2}$/.test(String(value).trim());
      if (!match) return `${fieldName} must be in YYYY-MM format`;
      const [year, month] = String(value).split('-').map(Number);
      if (month < 1 || month > 12) return 'Month must be 01-12';
      if (year < 1900 || year > 2100) return 'Year must be between 1900 and 2100';
      return null;
    },
  }),

  email: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      if (!value) return `${fieldName} is required`;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(String(value)) ? null : `${fieldName} must be a valid email`;
    },
  }),

  minLength: (fieldName: string, minLen: number): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const strValue = String(value || '').trim();
      return strValue.length >= minLen ? null : `${fieldName} must be at least ${minLen} characters`;
    },
  }),

  maxLength: (fieldName: string, maxLen: number): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const strValue = String(value || '').trim();
      return strValue.length <= maxLen ? null : `${fieldName} must be at most ${maxLen} characters`;
    },
  }),

  range: (fieldName: string, min: number, max: number): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      const num = parseFloat(value);
      if (isNaN(num)) return `${fieldName} must be a valid number`;
      return num >= min && num <= max ? null : `${fieldName} must be between ${min} and ${max}`;
    },
  }),

  schemeCode: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      if (!value) return null; // Optional field
      return /^\d{6}$/.test(String(value).trim()) ? null : `${fieldName} must be 6 digits`;
    },
  }),

  isin: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: any) => {
      if (!value) return null; // Optional field
      return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(value).trim())
        ? null
        : `${fieldName} must be valid ISIN (12 characters)`;
    },
  }),
};

/**
 * Validate form input against multiple rules
 * Returns first error found or null if all valid
 */
export function validateFormInput(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const error = rule.validate(value);
    if (error) return error;
  }
  return null;
}

/**
 * Validate multiple fields at once
 * Returns array of errors, empty if all valid
 */
export function validateFormFields(
  fields: Array<{ name: string; value: any; rules: ValidationRule[] }>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of fields) {
    const error = validateFormInput(field.value, field.rules);
    if (error) {
      errors.push({ field: field.name, message: error });
    }
  }

  return errors;
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
