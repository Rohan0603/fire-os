import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('prefers the saved theme over the OS preference', () => {
    expect(resolveInitialTheme('dark', false)).toBe(true);
    expect(resolveInitialTheme('light', true)).toBe(false);
  });

  it('falls back to the OS preference when nothing is saved', () => {
    expect(resolveInitialTheme(null, true)).toBe(true);
    expect(resolveInitialTheme(null, false)).toBe(false);
  });

  it('treats an unknown saved value as light', () => {
    expect(resolveInitialTheme('blue', true)).toBe(false);
  });
});
