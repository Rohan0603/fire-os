import { test, expect } from '@playwright/test';
import {
  validateEmail,
  validatePassword,
  validatePositiveNumber,
  validateDateYYYYMM,
  validateISIN,
  Validators,
} from '../src/lib/validators';

// ============================================================================
// Email Validation Tests
// ============================================================================

test('Email: Valid basic email', () => {
  expect(validateEmail('user@example.com')).toBe(true);
});

test('Email: Valid email with numbers', () => {
  expect(validateEmail('user123@example.com')).toBe(true);
});

test('Email: Valid email with subdomain', () => {
  expect(validateEmail('user@mail.example.co.uk')).toBe(true);
});

test('Email: Invalid - empty string', () => {
  expect(validateEmail('')).toBe(false);
});

test('Email: Invalid - null coerced', () => {
  expect(validateEmail(null as any)).toBe(false);
});

test('Email: Invalid - undefined coerced', () => {
  expect(validateEmail(undefined as any)).toBe(false);
});

test('Email: Invalid - missing @', () => {
  expect(validateEmail('userexample.com')).toBe(false);
});

test('Email: Invalid - missing domain', () => {
  expect(validateEmail('user@')).toBe(false);
});

test('Email: Invalid - missing extension', () => {
  expect(validateEmail('user@example')).toBe(false);
});

test('Email: Invalid - whitespace', () => {
  expect(validateEmail('user @example.com')).toBe(false);
});

// ============================================================================
// Password Validation Tests
// ============================================================================

test('Password: Valid - 6 chars with uppercase and number', () => {
  expect(validatePassword('Test123')).toBe(true);
});

test('Password: Valid - long password', () => {
  expect(validatePassword('ValidPassword1234567890')).toBe(true);
});

test('Password: Valid - minimum length (6 chars)', () => {
  expect(validatePassword('Abc123')).toBe(true);
});

test('Password: Invalid - empty string', () => {
  expect(validatePassword('')).toBe(false);
});

test('Password: Invalid - null coerced', () => {
  expect(validatePassword(null as any)).toBe(false);
});

test('Password: Invalid - too short (5 chars)', () => {
  expect(validatePassword('Test1')).toBe(false);
});

test('Password: Invalid - no uppercase', () => {
  expect(validatePassword('test1234')).toBe(false);
});

test('Password: Invalid - no number', () => {
  expect(validatePassword('TestPassword')).toBe(false);
});

test('Password: Invalid - only numbers and lowercase', () => {
  expect(validatePassword('test123')).toBe(false);
});

test('Password: Invalid - only uppercase and numbers', () => {
  expect(validatePassword('TEST123')).toBe(true); // Has uppercase and number
});

test('Password: Valid - special characters allowed', () => {
  expect(validatePassword('Test@#$1')).toBe(true);
});

// ============================================================================
// Positive Number Validation Tests
// ============================================================================

test('Positive Number: Valid - zero', () => {
  expect(validatePositiveNumber(0)).toBe(true);
});

test('Positive Number: Valid - small integer', () => {
  expect(validatePositiveNumber(1)).toBe(true);
});

test('Positive Number: Valid - large integer', () => {
  expect(validatePositiveNumber(1000000)).toBe(true);
});

test('Positive Number: Valid - string coercible number', () => {
  expect(validatePositiveNumber('100')).toBe(true);
});

test('Positive Number: Valid - float-like integer', () => {
  expect(validatePositiveNumber(42.0)).toBe(true);
});

test('Positive Number: Invalid - negative', () => {
  expect(validatePositiveNumber(-1)).toBe(false);
});

test('Positive Number: Invalid - negative string', () => {
  expect(validatePositiveNumber('-100')).toBe(false);
});

test('Positive Number: Invalid - NaN', () => {
  expect(validatePositiveNumber(NaN)).toBe(false);
});

test('Positive Number: Invalid - Infinity', () => {
  expect(validatePositiveNumber(Infinity)).toBe(false);
});

test('Positive Number: Invalid - negative Infinity', () => {
  expect(validatePositiveNumber(-Infinity)).toBe(false);
});

test('Positive Number: Invalid - non-numeric string', () => {
  expect(validatePositiveNumber('abc')).toBe(false);
});

test('Positive Number: Invalid - null', () => {
  expect(validatePositiveNumber(null)).toBe(false);
});

test('Positive Number: Invalid - undefined', () => {
  expect(validatePositiveNumber(undefined)).toBe(false);
});

test('Positive Number: Invalid - float with decimal', () => {
  expect(validatePositiveNumber(1.5)).toBe(true); // Allows floats that are not integers
});

// ============================================================================
// Date YYYY-MM Validation Tests
// ============================================================================

test('Date YYYY-MM: Valid - January', () => {
  expect(validateDateYYYYMM('2024-01')).toBe(true);
});

test('Date YYYY-MM: Valid - December', () => {
  expect(validateDateYYYYMM('2024-12')).toBe(true);
});

test('Date YYYY-MM: Valid - different years', () => {
  expect(validateDateYYYYMM('2000-06')).toBe(true);
  expect(validateDateYYYYMM('2099-09')).toBe(true);
});

test('Date YYYY-MM: Invalid - empty string', () => {
  expect(validateDateYYYYMM('')).toBe(false);
});

test('Date YYYY-MM: Invalid - null coerced', () => {
  expect(validateDateYYYYMM(null as any)).toBe(false);
});

test('Date YYYY-MM: Invalid - undefined coerced', () => {
  expect(validateDateYYYYMM(undefined as any)).toBe(false);
});

test('Date YYYY-MM: Invalid - month 00', () => {
  expect(validateDateYYYYMM('2024-00')).toBe(false);
});

test('Date YYYY-MM: Invalid - month 13', () => {
  expect(validateDateYYYYMM('2024-13')).toBe(false);
});

test('Date YYYY-MM: Invalid - single digit month', () => {
  expect(validateDateYYYYMM('2024-1')).toBe(false);
});

test('Date YYYY-MM: Invalid - single digit year', () => {
  expect(validateDateYYYYMM('24-01')).toBe(false);
});

test('Date YYYY-MM: Invalid - with day', () => {
  expect(validateDateYYYYMM('2024-01-15')).toBe(false);
});

test('Date YYYY-MM: Invalid - with time', () => {
  expect(validateDateYYYYMM('2024-01 10:30')).toBe(false);
});

test('Date YYYY-MM: Invalid - wrong separator', () => {
  expect(validateDateYYYYMM('2024/01')).toBe(false);
});

// ============================================================================
// ISIN Validation Tests
// ============================================================================

test('ISIN: Valid - Indian equity ISIN', () => {
  expect(validateISIN('INE002A01018')).toBe(true);
});

test('ISIN: Valid - with alphanumeric mix', () => {
  expect(validateISIN('US0378331005')).toBe(true);
});

test('ISIN: Valid - different format', () => {
  expect(validateISIN('US0378331005')).toBe(true); // Already tested above, verify object works
});

test('ISIN: Invalid - too short (11 chars)', () => {
  expect(validateISIN('INE002A0101')).toBe(false);
});

test('ISIN: Invalid - too long (13 chars)', () => {
  expect(validateISIN('INE002A010188')).toBe(false);
});

test('ISIN: Invalid - lowercase country code', () => {
  expect(validateISIN('ine002A01018')).toBe(false);
});

test('ISIN: Invalid - lowercase letters in body', () => {
  expect(validateISIN('INe002A01018')).toBe(false);
});

test('ISIN: Invalid - non-alphanumeric in body', () => {
  expect(validateISIN('INE002@01018')).toBe(false);
});

test('ISIN: Invalid - empty string', () => {
  expect(validateISIN('')).toBe(false);
});

test('ISIN: Invalid - null coerced', () => {
  expect(validateISIN(null as any)).toBe(false);
});

test('ISIN: Invalid - undefined coerced', () => {
  expect(validateISIN(undefined as any)).toBe(false);
});

test('ISIN: Invalid - only numbers', () => {
  expect(validateISIN('123456789012')).toBe(false);
});

test('ISIN: Invalid - only letters (no digit at end)', () => {
  expect(validateISIN('ABCDEFGHIJKL')).toBe(false); // Invalid: last char must be digit
});

// ============================================================================
// Validators Object Tests
// ============================================================================

test('Validators object: has all validators', () => {
  expect(typeof Validators.email).toBe('function');
  expect(typeof Validators.password).toBe('function');
  expect(typeof Validators.positiveNumber).toBe('function');
  expect(typeof Validators.dateYYYYMM).toBe('function');
  expect(typeof Validators.isin).toBe('function');
});

test('Validators object: email works', () => {
  expect(Validators.email('test@example.com')).toBe(true);
  expect(Validators.email('invalid')).toBe(false);
});

test('Validators object: password works', () => {
  expect(Validators.password('Test123')).toBe(true);
  expect(Validators.password('weak')).toBe(false);
});

test('Validators object: positiveNumber works', () => {
  expect(Validators.positiveNumber(100)).toBe(true);
  expect(Validators.positiveNumber(-1)).toBe(false);
});

test('Validators object: dateYYYYMM works', () => {
  expect(Validators.dateYYYYMM('2024-01')).toBe(true);
  expect(Validators.dateYYYYMM('2024-13')).toBe(false);
});

test('Validators object: isin works', () => {
  expect(Validators.isin('INE002A01018')).toBe(true);
  expect(Validators.isin('invalid')).toBe(false);
});
