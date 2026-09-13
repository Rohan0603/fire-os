import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monitorNiftyLevel } from './nifty-monitor';
import { fetchNifty } from './nifty';

vi.mock('./nifty', () => ({ fetchNifty: vi.fn() }));

describe('Nifty monitor lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses an in-flight callback after cleanup', async () => {
    let resolveFetch: ((value: { level: number; high52w: number; source: string }) => void) | undefined;
    vi.mocked(fetchNifty).mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    const callback = vi.fn();
    const stop = monitorNiftyLevel(callback);

    stop();
    resolveFetch?.({ level: 20000, high52w: 25000, source: 'test' });
    await Promise.resolve();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
  });
});