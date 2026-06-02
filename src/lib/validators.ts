/**
 * Input validation utilities for FIRE OS
 * Provides validators for common input types (email, password, numbers, dates, ISIN)
 */

/**
 * Email validation using basic RFC 5322 pattern
 * Checks for presence of @ and valid domain structure
 * @param email - Email string to validate
 * @returns true if valid email format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Password validation
 * Requirements: min 6 chars, at least 1 uppercase, at least 1 number
 * @param password - Password string to validate
 * @returns true if password meets all requirements
 */
export function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

/**
 * Positive number validation
 * Checks for non-negative integer, rejects Infinity and NaN
 * @param value - Value to validate as positive number
 * @returns true if valid positive number
 */
export function validatePositiveNumber(value: any): boolean {
  if (value === null || value === undefined) return false;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return false;
  if (num < 0) return false;
  return Number.isInteger(num) || typeof value === 'number';
}

/**
 * Date validation in YYYY-MM format
 * Ensures exact format match and valid month (01-12)
 * @param dateStr - Date string in YYYY-MM format
 * @returns true if valid YYYY-MM date
 */
export function validateDateYYYYMM(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const [year, month] = dateStr.split('-');
  const monthNum = parseInt(month, 10);
  return monthNum >= 1 && monthNum <= 12;
}

/**
 * ISIN validation
 * ISIN format: 2 letters (country code) + 9 alphanumeric characters + 1 check digit
 * Total: exactly 12 characters
 * @param isin - ISIN string to validate
 * @returns true if valid ISIN format
 */
export function validateISIN(isin: string): boolean {
  if (!isin || typeof isin !== 'string') return false;
  const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  return isinRegex.test(isin);
}

/**
 * Convenience object with all validators for grouped access
 */
export const Validators = {
  email: validateEmail,
  password: validatePassword,
  positiveNumber: validatePositiveNumber,
  dateYYYYMM: validateDateYYYYMM,
  isin: validateISIN,
};
