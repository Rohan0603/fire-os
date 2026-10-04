import { format, isValid, parse } from 'date-fns';

const REFERENCE_DATE = new Date(2000, 0, 1);

export function parseYearMonth(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const parsed = parse(value, 'yyyy-MM', REFERENCE_DATE);
  if (!isValid(parsed) || format(parsed, 'yyyy-MM') !== value) return null;
  return parsed;
}

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parse(value, 'yyyy-MM-dd', REFERENCE_DATE);
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== value) return null;
  return parsed;
}

export function isWithinDateRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}
