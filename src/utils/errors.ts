/**
 * Error handling utilities for FIRE OS
 * Provides custom FireOSError class and error conversion/logging utilities
 */

import { getLogger } from '../lib/logger';

/**
 * Custom error class for FIRE OS
 * Extends Error with error code and optional context
 */
export class FireOSError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
  ) {
    super(message);
    this.name = 'FireOSError';
    // Maintain prototype chain for instanceof checks
    Object.setPrototypeOf(this, FireOSError.prototype);
  }

  /**
   * Convert error to serializable object
   * @returns Plain object with error details
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }

  /**
   * Get formatted error message with code
   * @returns Formatted error string
   */
  toString(): string {
    return `${this.code}: ${this.message}`;
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Validation errors
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_ISIN: 'INVALID_ISIN',
  INVALID_PORTFOLIO_DATA: 'INVALID_PORTFOLIO_DATA',

  // Network/API errors
  API_CALL_FAILED: 'API_CALL_FAILED',
  NAV_FETCH_FAILED: 'NAV_FETCH_FAILED',
  NIFTY_FETCH_FAILED: 'NIFTY_FETCH_FAILED',
  EXCHANGE_RATE_FETCH_FAILED: 'EXCHANGE_RATE_FETCH_FAILED',

  // Firebase errors
  AUTH_FAILED: 'AUTH_FAILED',
  SYNC_FAILED: 'SYNC_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Calculation errors
  XIRR_CALCULATION_FAILED: 'XIRR_CALCULATION_FAILED',
  INVALID_CASHFLOW: 'INVALID_CASHFLOW',

  // File/PDF errors
  PDF_PARSE_FAILED: 'PDF_PARSE_FAILED',
  IMPORT_FAILED: 'IMPORT_FAILED',

  // Generic/unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * Convert any error to a FireOSError
 * Logs the error via logger and returns standardized error
 * @param error - Error object or unknown value
 * @param defaultCode - Default error code if cannot determine
 * @param context - Additional context to attach
 * @returns FireOSError instance
 */
export function handleError(
  error: unknown,
  defaultCode: string = ErrorCodes.UNKNOWN_ERROR,
  context?: any,
): FireOSError {
  const logger = getLogger();

  let fireoserror: FireOSError;

  if (error instanceof FireOSError) {
    // Already a FireOSError, just log and return
    fireoserror = error;
  } else if (error instanceof Error) {
    // Convert standard Error to FireOSError
    fireoserror = new FireOSError(error.message, defaultCode, {
      originalError: error.name,
      stack: error.stack,
      ...context,
    });
  } else if (typeof error === 'string') {
    // String error
    fireoserror = new FireOSError(error, defaultCode, context);
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    // Object with message property
    const message = (error as any).message || 'Unknown error';
    fireoserror = new FireOSError(message, defaultCode, {
      originalError: error,
      ...context,
    });
  } else {
    // Completely unknown error
    fireoserror = new FireOSError(String(error), defaultCode, {
      originalError: error,
      ...context,
    });
  }

  // Log the error
  logger.error(fireoserror.toString(), {
    code: fireoserror.code,
    message: fireoserror.message,
    context: fireoserror.context,
  });

  return fireoserror;
}

/**
 * Assert a condition is true, or throw a FireOSError
 * Useful for validation checks
 * @param condition - Condition to assert
 * @param message - Error message if condition is false
 * @param code - Error code
 * @param context - Additional context
 * @throws FireOSError if condition is false
 */
export function assert(
  condition: any,
  message: string,
  code: string = ErrorCodes.UNKNOWN_ERROR,
  context?: any,
): void {
  if (!condition) {
    throw new FireOSError(message, code, context);
  }
}

/**
 * Try-catch wrapper that converts errors to FireOSError
 * @param fn - Async or sync function to execute
 * @param errorCode - Error code to use if function throws
 * @param context - Additional context for error
 * @returns Promise resolving to function result or FireOSError
 */
export async function tryCatch<T>(
  fn: () => T | Promise<T>,
  errorCode: string = ErrorCodes.UNKNOWN_ERROR,
  context?: any,
): Promise<T | FireOSError> {
  try {
    return await Promise.resolve(fn());
  } catch (error) {
    return handleError(error, errorCode, context);
  }
}

/**
 * Check if value is a FireOSError
 * @param value - Value to check
 * @returns true if value is a FireOSError
 */
export function isFireOSError(value: any): value is FireOSError {
  return value instanceof FireOSError;
}
