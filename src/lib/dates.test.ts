import { describe, expect, it } from 'vitest';
import { isWithinDateRange, parseCalendarDate, parseYearMonth } from './dates';

describe('parseYearMonth', () => {
  it('accepts a valid YYYY-MM and returns local midnight of the 1st', () => {
    const parsed = parseYearMonth('2024-01');
    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(new Date(2024, 0, 1).getTime());
  });

  it('rejects impossible or non-strict months', () => {
    expect(parseYearMonth('2024-13')).toBeNull();
    expect(parseYearMonth('2024-00')).toBeNull();
    expect(parseYearMonth('2024-1')).toBeNull();
    expect(parseYearMonth('2024-1-01')).toBeNull();
  });

  it('rejects calendar dates, partial and malformed values', () => {
    expect(parseYearMonth('2024-01-01')).toBeNull();
    expect(parseYearMonth('2024-01-')).toBeNull();
    expect(parseYearMonth('24-01')).toBeNull();
    expect(parseYearMonth('2024/01')).toBeNull();
    expect(parseYearMonth('')).toBeNull();
    expect(parseYearMonth('not-a-date')).toBeNull();
  });

  it('pins local-midnight semantics (not UTC midnight) at a timezone boundary', () => {
    const parsed = parseYearMonth('1970-01');
    expect(parsed?.getTime()).toBe(new Date(1970, 0, 1).getTime());
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(parsed?.getSeconds()).toBe(0);
    expect(parsed?.getMilliseconds()).toBe(0);
  });
});

describe('parseCalendarDate', () => {
  it('accepts a valid YYYY-MM-DD and returns local midnight', () => {
    const parsed = parseCalendarDate('2024-05-15');
    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(new Date(2024, 4, 15).getTime());
  });

  it('accepts a leap day only in leap years', () => {
    expect(parseCalendarDate('2024-02-29')).not.toBeNull();
    expect(parseCalendarDate('2023-02-29')).toBeNull();
    expect(parseCalendarDate('1900-02-29')).toBeNull();
    expect(parseCalendarDate('2000-02-29')).not.toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseCalendarDate('2024-02-30')).toBeNull();
    expect(parseCalendarDate('2024-04-31')).toBeNull();
    expect(parseCalendarDate('2024-13-01')).toBeNull();
    expect(parseCalendarDate('2024-00-10')).toBeNull();
    expect(parseCalendarDate('2024-01-00')).toBeNull();
    expect(parseCalendarDate('2024-01-32')).toBeNull();
  });

  it('rejects partial, extended and malformed values', () => {
    expect(parseCalendarDate('2024-1-01')).toBeNull();
    expect(parseCalendarDate('2024-01-1')).toBeNull();
    expect(parseCalendarDate('01-01-2024')).toBeNull();
    expect(parseCalendarDate('2024-01-01T00:00:00Z')).toBeNull();
    expect(parseCalendarDate('2024-01-01 ')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate('not-a-date')).toBeNull();
  });

  it('pins local-midnight semantics (not UTC midnight) across the date boundary', () => {
    const parsed = parseCalendarDate('1970-01-01');
    expect(parsed?.getTime()).toBe(new Date(1970, 0, 1).getTime());
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(parsed?.getSeconds()).toBe(0);
    expect(parsed?.getMilliseconds()).toBe(0);
    expect(parsed?.getDate()).toBe(1);
  });
});

describe('isWithinDateRange', () => {
  const start = new Date(2024, 0, 1);
  const end = new Date(2024, 11, 31);

  it('includes both endpoints', () => {
    expect(isWithinDateRange(start, start, end)).toBe(true);
    expect(isWithinDateRange(end, start, end)).toBe(true);
  });

  it('excludes dates just outside the range', () => {
    const before = new Date(2023, 11, 31);
    const after = new Date(2025, 0, 1);
    expect(isWithinDateRange(before, start, end)).toBe(false);
    expect(isWithinDateRange(after, start, end)).toBe(false);
  });

  it('includes dates strictly inside the range', () => {
    expect(isWithinDateRange(new Date(2024, 5, 15), start, end)).toBe(true);
  });

  it('returns false for reversed ranges, even when the date sits between them', () => {
    expect(isWithinDateRange(start, end, start)).toBe(false);
    expect(isWithinDateRange(end, end, start)).toBe(false);
    expect(isWithinDateRange(new Date(2024, 5, 15), end, start)).toBe(false);
    expect(isWithinDateRange(new Date(2025, 0, 1), end, start)).toBe(false);
  });

  it('returns true when start and end are the same timestamp', () => {
    expect(isWithinDateRange(start, start, start)).toBe(true);
    expect(isWithinDateRange(end, start, start)).toBe(false);
  });
});
