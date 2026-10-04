import { describe, expect, it } from 'vitest';
import { calculateAgeFromDateOfBirth } from './portfolio';

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

describe('calculateAgeFromDateOfBirth', () => {
  it('returns the age before and after the birthday', () => {
    expect(calculateAgeFromDateOfBirth('1990-05-15', utc(2026, 5, 15))).toBe(36);
    expect(calculateAgeFromDateOfBirth('1990-05-15', utc(2026, 5, 14))).toBe(35);
  });

  it('accepts valid leap-day births and rejects impossible leap days', () => {
    expect(calculateAgeFromDateOfBirth('2020-02-29', utc(2026, 2, 28))).toBe(5);
    expect(calculateAgeFromDateOfBirth('2020-02-29', utc(2026, 3, 1))).toBe(6);
    expect(calculateAgeFromDateOfBirth('2020-02-29', utc(2028, 2, 29))).toBe(8);
    expect(calculateAgeFromDateOfBirth('2000-02-29', utc(2026, 3, 1))).toBe(26);
    expect(calculateAgeFromDateOfBirth('2021-02-29')).toBeNull();
    expect(calculateAgeFromDateOfBirth('1900-02-29')).toBeNull();
    expect(calculateAgeFromDateOfBirth('2020-02-30')).toBeNull();
    expect(calculateAgeFromDateOfBirth('2020-04-31')).toBeNull();
  });

  it('rejects malformed and out-of-range dates', () => {
    for (const dateOfBirth of [
      '',
      '1990-5-5',
      '1990/05/15',
      '1990-05-15T00:00:00Z',
      '1990-13-01',
      '1990-00-10',
      '1990-05-00',
      ' 1990-05-15',
      'abc',
    ]) {
      expect(calculateAgeFromDateOfBirth(dateOfBirth)).toBeNull();
    }
  });

  it('keeps the legacy Date.UTC windowing boundary for years 0000-0099', () => {
    expect(calculateAgeFromDateOfBirth('0000-01-01')).toBeNull();
    expect(calculateAgeFromDateOfBirth('0050-01-01')).toBeNull();
    expect(calculateAgeFromDateOfBirth('0100-01-01', utc(2026, 1, 1))).toBe(1926);
  });

  it('rejects future dates and returns 0 on the birth day', () => {
    const today = utc(2026, 10, 3);
    expect(calculateAgeFromDateOfBirth('2030-01-01', today)).toBeNull();
    expect(calculateAgeFromDateOfBirth('2026-10-04', today)).toBeNull();
    expect(calculateAgeFromDateOfBirth('2026-10-03', today)).toBe(0);
    expect(calculateAgeFromDateOfBirth('1990-10-03', new Date('1990-10-02T23:59:59.999Z'))).toBeNull();
    expect(calculateAgeFromDateOfBirth('1990-10-03', new Date('1990-10-03T00:00:00.000Z'))).toBe(0);
  });

  it('counts the birthday at exactly the midnight-UTC rollover', () => {
    expect(calculateAgeFromDateOfBirth('1990-10-03', new Date('2026-10-03T00:00:00.000Z'))).toBe(36);
    expect(calculateAgeFromDateOfBirth('1990-10-03', new Date('2026-10-02T23:59:59.999Z'))).toBe(35);
  });

  it('uses the UTC calendar day of `today`, not the host-local one', () => {
    const beforeUtcBirthday = new Date('2026-10-03T02:30:00+05:30'); // 2026-10-02T21:00:00Z
    expect(calculateAgeFromDateOfBirth('1990-10-03', beforeUtcBirthday)).toBe(35);

    const afterUtcBirthday = new Date('2026-10-03T17:30:00-05:00'); // 2026-10-03T22:30:00Z
    expect(calculateAgeFromDateOfBirth('1990-10-03', afterUtcBirthday)).toBe(36);
  });

  it('uses the UTC calendar day when the host zone puts the local day on the other side', () => {
    // 2026-03-15T20:00:00Z is Mar 15 in UTC but Mar 16 01:30 in this host's zone
    // (IST, +05:30), so host-local field math would report the birthday (26) instead
    // of 25. Discriminates on any host whose offset is east of UTC.
    expect(calculateAgeFromDateOfBirth('2000-03-16', new Date('2026-03-15T20:00:00Z'))).toBe(25);

    const originalTz = process.env.TZ;
    const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      process.env.TZ = 'America/New_York';
      // Prove the pin took effect: 2026-03-16T02:00:00Z is Mar 15 22:00 EDT (-04:00),
      // not this host's +05:30. Without the pin this test would not discriminate.
      expect(new Date('2026-03-16T02:00:00Z').getTimezoneOffset()).toBe(240);
      // UTC day Mar 16 (the birthday) vs NY-local day Mar 15: only UTC math yields 26,
      // host-local math yields 25. Host-independent because the zone is pinned.
      expect(calculateAgeFromDateOfBirth('2000-03-16', new Date('2026-03-16T02:00:00Z'))).toBe(26);
    } finally {
      // `delete process.env.TZ` does not restore the system zone on this host
      // (the last assignment sticks), so re-assign the original zone explicitly.
      process.env.TZ = originalTz ?? hostZone;
    }
  });
});
