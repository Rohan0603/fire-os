/**
 * Output formatting utilities for FIRE OS
 * Provides formatters for currency, numbers, percentages, dates, and relative time
 */

/**
 * Format a number as Indian currency (₹)
 * Uses Indian comma separation: ₹1,00,000 (not ₹100,000)
 * @param value - Numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string with ₹ symbol
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  if (!isFinite(value)) return '₹0.00';

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  // Format with specified decimal places
  let formatted = absValue.toFixed(decimals);
  const [integerPart, decimalPart] = formatted.split('.');

  // Indian comma separation: split integer part from right
  // Pattern: last 3 digits, then groups of 2
  let integerFormatted = '';
  const digits = integerPart.split('').reverse();

  for (let i = 0; i < digits.length; i++) {
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) {
      integerFormatted = ',' + integerFormatted;
    }
    integerFormatted = digits[i] + integerFormatted;
  }

  const result = `₹${integerFormatted}${decimalPart ? '.' + decimalPart : ''}`;
  return isNegative ? '-' + result : result;
}

/**
 * Format a number with Indian style comma separation
 * Example: 1000000 → "10,00,000"
 * @param value - Numeric value to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string with comma separation
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (!isFinite(value)) return '0';

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  let formatted = absValue.toFixed(decimals);
  const [integerPart, decimalPart] = formatted.split('.');

  let integerFormatted = '';
  const digits = integerPart.split('').reverse();

  for (let i = 0; i < digits.length; i++) {
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) {
      integerFormatted = ',' + integerFormatted;
    }
    integerFormatted = digits[i] + integerFormatted;
  }

  const result = `${integerFormatted}${decimalPart ? '.' + decimalPart : ''}`;
  return isNegative ? '-' + result : result;
}

/**
 * Format a decimal as percentage
 * Multiplies by 100 and adds % suffix
 * @param value - Decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "15.00%")
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (!isFinite(value)) return '0%';

  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Format ISO date string to DD/MM/YYYY format
 * @param isoString - ISO date string (e.g., "2024-12-25T10:30:00Z")
 * @returns Formatted date string (e.g., "25/12/2024")
 */
export function formatDateISO(isoString: string): string {
  if (!isoString || typeof isoString !== 'string') return '';

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Format ISO date string as relative time (e.g., "5m ago", "2h ago")
 * @param isoString - ISO date string
 * @returns Relative time string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatTimeAgo(isoString: string): string {
  if (!isoString || typeof isoString !== 'string') return '';

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    // Less than a minute
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    }

    // Less than an hour
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    // Less than a day
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    // Less than a month (30 days)
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays}d ago`;
    }

    // Less than a year (365 days)
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `${diffMonths}mo ago`;
    }

    // Years
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears}y ago`;
  } catch {
    return '';
  }
}

/**
 * Convenience object with all formatters for grouped access
 */
export const Formatters = {
  currency: formatCurrency,
  number: formatNumber,
  percentage: formatPercentage,
  dateISO: formatDateISO,
  timeAgo: formatTimeAgo,
};
