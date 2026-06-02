import { test, expect } from '@playwright/test';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDateISO,
  formatTimeAgo,
  Formatters,
} from '../src/lib/formatters';

// ============================================================================
// Currency Formatting Tests
// ============================================================================

test('Currency: Format 1,00,000 (one lakh)', () => {
  expect(formatCurrency(100000)).toBe('₹1,00,000.00');
});

test('Currency: Format 10,00,000 (ten lakhs)', () => {
  expect(formatCurrency(1000000)).toBe('₹10,00,000.00');
});

test('Currency: Format 100 (simple)', () => {
  expect(formatCurrency(100)).toBe('₹100.00');
});

test('Currency: Format 1000 (one thousand)', () => {
  expect(formatCurrency(1000)).toBe('₹1,000.00');
});

test('Currency: Format 12345 (with comma)', () => {
  expect(formatCurrency(12345)).toBe('₹12,345.00');
});

test('Currency: Format zero', () => {
  expect(formatCurrency(0)).toBe('₹0.00');
});

test('Currency: Format negative number', () => {
  expect(formatCurrency(-100000)).toBe('-₹1,00,000.00');
});

test('Currency: Custom decimals (0 decimal places)', () => {
  expect(formatCurrency(100000, 0)).toBe('₹1,00,000');
});

test('Currency: Custom decimals (4 decimal places)', () => {
  expect(formatCurrency(100000.5678, 4)).toBe('₹1,00,000.5678');
});

test('Currency: Infinity returns ₹0.00', () => {
  expect(formatCurrency(Infinity)).toBe('₹0.00');
});

test('Currency: NaN returns ₹0.00', () => {
  expect(formatCurrency(NaN)).toBe('₹0.00');
});

// ============================================================================
// Number Formatting Tests
// ============================================================================

test('Number: Format 1,00,000 (Indian style)', () => {
  expect(formatNumber(100000)).toBe('1,00,000');
});

test('Number: Format 10,00,000', () => {
  expect(formatNumber(1000000)).toBe('10,00,000');
});

test('Number: Format 100', () => {
  expect(formatNumber(100)).toBe('100');
});

test('Number: Format 1000', () => {
  expect(formatNumber(1000)).toBe('1,000');
});

test('Number: Format 12345', () => {
  expect(formatNumber(12345)).toBe('12,345');
});

test('Number: Format zero', () => {
  expect(formatNumber(0)).toBe('0');
});

test('Number: Format negative number', () => {
  expect(formatNumber(-100000)).toBe('-1,00,000');
});

test('Number: Custom decimals (2 decimal places)', () => {
  expect(formatNumber(100000.567, 2)).toBe('1,00,000.57');
});

test('Number: Infinity returns 0', () => {
  expect(formatNumber(Infinity)).toBe('0');
});

// ============================================================================
// Percentage Formatting Tests
// ============================================================================

test('Percentage: Format 0.15 (15%)', () => {
  expect(formatPercentage(0.15)).toBe('15.00%');
});

test('Percentage: Format 0.5 (50%)', () => {
  expect(formatPercentage(0.5)).toBe('50.00%');
});

test('Percentage: Format 1.0 (100%)', () => {
  expect(formatPercentage(1.0)).toBe('100.00%');
});

test('Percentage: Format 0.01 (1%)', () => {
  expect(formatPercentage(0.01)).toBe('1.00%');
});

test('Percentage: Format 0 (0%)', () => {
  expect(formatPercentage(0)).toBe('0.00%');
});

test('Percentage: Format negative decimal', () => {
  expect(formatPercentage(-0.25)).toBe('-25.00%');
});

test('Percentage: Custom decimals (0 decimal places)', () => {
  expect(formatPercentage(0.156, 0)).toBe('16%');
});

test('Percentage: Custom decimals (4 decimal places)', () => {
  expect(formatPercentage(0.15625, 4)).toBe('15.6250%');
});

test('Percentage: Infinity returns 0%', () => {
  expect(formatPercentage(Infinity)).toBe('0%');
});

// ============================================================================
// Date ISO Formatting Tests
// ============================================================================

test('Date ISO: Format 2024-12-25', () => {
  expect(formatDateISO('2024-12-25T10:30:00Z')).toBe('25/12/2024');
});

test('Date ISO: Format with different time', () => {
  expect(formatDateISO('2023-06-15T14:45:30Z')).toBe('15/06/2023');
});

test('Date ISO: Format January 1st', () => {
  expect(formatDateISO('2024-01-01T00:00:00Z')).toBe('01/01/2024');
});

test('Date ISO: Empty string returns empty', () => {
  expect(formatDateISO('')).toBe('');
});

test('Date ISO: Invalid ISO string returns empty', () => {
  expect(formatDateISO('invalid-date')).toBe('');
});

test('Date ISO: Null coerced returns empty', () => {
  expect(formatDateISO(null as any)).toBe('');
});

test('Date ISO: Undefined coerced returns empty', () => {
  expect(formatDateISO(undefined as any)).toBe('');
});

// ============================================================================
// Time Ago Formatting Tests
// ============================================================================

test('Time Ago: Seconds ago', () => {
  const now = new Date();
  const thirtySecondsAgo = new Date(now.getTime() - 30000);
  const result = formatTimeAgo(thirtySecondsAgo.toISOString());
  expect(result).toMatch(/^\d+s ago$/);
});

test('Time Ago: Minutes ago', () => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
  const result = formatTimeAgo(fiveMinutesAgo.toISOString());
  expect(result).toBe('5m ago');
});

test('Time Ago: Hours ago', () => {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
  const result = formatTimeAgo(twoHoursAgo.toISOString());
  expect(result).toBe('2h ago');
});

test('Time Ago: Days ago', () => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600000);
  const result = formatTimeAgo(threeDaysAgo.toISOString());
  expect(result).toBe('3d ago');
});

test('Time Ago: Months ago', () => {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 3600000); // ~2 months
  const result = formatTimeAgo(twoMonthsAgo.toISOString());
  expect(result).toMatch(/^2mo ago$/);
});

test('Time Ago: Year ago', () => {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 3600000);
  const result = formatTimeAgo(oneYearAgo.toISOString());
  expect(result).toBe('1y ago');
});

test('Time Ago: Empty string returns empty', () => {
  expect(formatTimeAgo('')).toBe('');
});

test('Time Ago: Invalid ISO string returns empty', () => {
  expect(formatTimeAgo('invalid-date')).toBe('');
});

test('Time Ago: Null coerced returns empty', () => {
  expect(formatTimeAgo(null as any)).toBe('');
});

// ============================================================================
// Formatters Object Tests
// ============================================================================

test('Formatters object: has all formatters', () => {
  expect(typeof Formatters.currency).toBe('function');
  expect(typeof Formatters.number).toBe('function');
  expect(typeof Formatters.percentage).toBe('function');
  expect(typeof Formatters.dateISO).toBe('function');
  expect(typeof Formatters.timeAgo).toBe('function');
});

test('Formatters object: currency works', () => {
  expect(Formatters.currency(100000)).toBe('₹1,00,000.00');
});

test('Formatters object: number works', () => {
  expect(Formatters.number(100000)).toBe('1,00,000');
});

test('Formatters object: percentage works', () => {
  expect(Formatters.percentage(0.5)).toBe('50.00%');
});

test('Formatters object: dateISO works', () => {
  expect(Formatters.dateISO('2024-12-25T10:30:00Z')).toBe('25/12/2024');
});

test('Formatters object: timeAgo works', () => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
  expect(Formatters.timeAgo(fiveMinutesAgo.toISOString())).toBe('5m ago');
});
