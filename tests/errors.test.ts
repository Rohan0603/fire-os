import { test, expect } from '@playwright/test';
import {
  FireOSError,
  handleError,
  ErrorCodes,
  assert,
  isFireOSError,
} from '../src/utils/errors';

// ============================================================================
// FireOSError Tests
// ============================================================================

test('FireOSError: Create with message and code', () => {
  const error = new FireOSError('Invalid email', ErrorCodes.INVALID_EMAIL);
  expect(error.message).toBe('Invalid email');
  expect(error.code).toBe('INVALID_EMAIL');
  expect(error.name).toBe('FireOSError');
});

test('FireOSError: Create with context', () => {
  const context = { email: 'test@invalid' };
  const error = new FireOSError('Invalid email', ErrorCodes.INVALID_EMAIL, context);
  expect(error.context).toEqual(context);
});

test('FireOSError: toString() includes code and message', () => {
  const error = new FireOSError('Test error', 'TEST_CODE');
  expect(error.toString()).toBe('TEST_CODE: Test error');
});

test('FireOSError: toJSON() serializes correctly', () => {
  const error = new FireOSError('Test error', 'TEST_CODE', { data: 'value' });
  const json = error.toJSON();
  expect(json.name).toBe('FireOSError');
  expect(json.message).toBe('Test error');
  expect(json.code).toBe('TEST_CODE');
  expect(json.context).toEqual({ data: 'value' });
});

test('FireOSError: instanceof check works', () => {
  const error = new FireOSError('Test', 'TEST');
  expect(error instanceof FireOSError).toBe(true);
  expect(error instanceof Error).toBe(true);
});

// ============================================================================
// Error Codes Tests
// ============================================================================

test('ErrorCodes: Has all expected codes', () => {
  expect(ErrorCodes.INVALID_EMAIL).toBe('INVALID_EMAIL');
  expect(ErrorCodes.INVALID_PASSWORD).toBe('INVALID_PASSWORD');
  expect(ErrorCodes.INVALID_DATE).toBe('INVALID_DATE');
  expect(ErrorCodes.INVALID_ISIN).toBe('INVALID_ISIN');
  expect(ErrorCodes.API_CALL_FAILED).toBe('API_CALL_FAILED');
  expect(ErrorCodes.NAV_FETCH_FAILED).toBe('NAV_FETCH_FAILED');
  expect(ErrorCodes.AUTH_FAILED).toBe('AUTH_FAILED');
  expect(ErrorCodes.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
});

// ============================================================================
// handleError Tests
// ============================================================================

test('handleError: Convert native Error to FireOSError', () => {
  const nativeError = new Error('Something went wrong');
  const result = handleError(nativeError, ErrorCodes.UNKNOWN_ERROR);
  expect(result instanceof FireOSError).toBe(true);
  expect(result.message).toBe('Something went wrong');
  expect(result.code).toBe('UNKNOWN_ERROR');
});

test('handleError: Keep FireOSError as-is', () => {
  const fireoserror = new FireOSError('Already FireOS', 'CUSTOM_CODE');
  const result = handleError(fireoserror);
  expect(result).toBe(fireoserror);
  expect(result.code).toBe('CUSTOM_CODE');
});

test('handleError: Convert string error', () => {
  const result = handleError('String error message', ErrorCodes.API_CALL_FAILED);
  expect(result instanceof FireOSError).toBe(true);
  expect(result.message).toBe('String error message');
  expect(result.code).toBe('API_CALL_FAILED');
});

test('handleError: Convert object with message property', () => {
  const errorObj = { message: 'Object error', code: 'OBJ_CODE' };
  const result = handleError(errorObj, ErrorCodes.UNKNOWN_ERROR);
  expect(result instanceof FireOSError).toBe(true);
  expect(result.message).toBe('Object error');
});

test('handleError: Convert null/undefined safely', () => {
  const result = handleError(null, 'NULL_ERROR');
  expect(result instanceof FireOSError).toBe(true);
  expect(result.code).toBe('NULL_ERROR');
});

test('handleError: Add context to error', () => {
  const context = { userId: '123', action: 'login' };
  const result = handleError('Login failed', ErrorCodes.AUTH_FAILED, context);
  expect(result.context).toEqual(expect.objectContaining(context));
});

// ============================================================================
// Assert Tests
// ============================================================================

test('assert: Pass when condition is true', () => {
  expect(() => {
    assert(true, 'Should not throw');
  }).not.toThrow();
});

test('assert: Throw FireOSError when condition is false', () => {
  expect(() => {
    assert(false, 'Test assertion failed', ErrorCodes.INVALID_DATE);
  }).toThrow(FireOSError);
});

test('assert: FireOSError has correct message and code', () => {
  try {
    assert(false, 'Email is invalid', ErrorCodes.INVALID_EMAIL);
    throw new Error('Should have thrown');
  } catch (error) {
    expect(error instanceof FireOSError).toBe(true);
    expect((error as FireOSError).message).toBe('Email is invalid');
    expect((error as FireOSError).code).toBe('INVALID_EMAIL');
  }
});

test('assert: Falsy values throw', () => {
  expect(() => assert(0, 'Zero is falsy')).toThrow();
  expect(() => assert('', 'Empty string is falsy')).toThrow();
  expect(() => assert(null, 'Null is falsy')).toThrow();
  expect(() => assert(undefined, 'Undefined is falsy')).toThrow();
});

test('assert: Truthy values pass', () => {
  expect(() => assert(1, 'One is truthy')).not.toThrow();
  expect(() => assert('text', 'Text is truthy')).not.toThrow();
  expect(() => assert({}, 'Object is truthy')).not.toThrow();
  expect(() => assert([], 'Array is truthy')).not.toThrow();
});

// ============================================================================
// isFireOSError Tests
// ============================================================================

test('isFireOSError: Returns true for FireOSError', () => {
  const error = new FireOSError('Test', 'TEST');
  expect(isFireOSError(error)).toBe(true);
});

test('isFireOSError: Returns false for native Error', () => {
  const error = new Error('Native error');
  expect(isFireOSError(error)).toBe(false);
});

test('isFireOSError: Returns false for plain object', () => {
  const obj = { message: 'Not an error' };
  expect(isFireOSError(obj)).toBe(false);
});

test('isFireOSError: Returns false for null', () => {
  expect(isFireOSError(null)).toBe(false);
});

test('isFireOSError: Returns false for undefined', () => {
  expect(isFireOSError(undefined)).toBe(false);
});

test('isFireOSError: Returns false for string', () => {
  expect(isFireOSError('error')).toBe(false);
});
