import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeState } from '../../types/state';
import {
  configurePortfolioStorageScope,
  configurePortfolioSync,
} from '../../lib/storage';
import { createPortfolioRepository } from './portfolio-repository';

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe('portfolio repository adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorage());
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
  });

  afterEach(() => {
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
    vi.unstubAllGlobals();
  });

  it('preserves local-first save and load behavior behind the repository port', () => {
    const repository = createPortfolioRepository();
    const state = initializeState();
    state.profile.name = 'Ada';

    repository.save(state, { sync: false });

    expect(repository.load()?.profile.name).toBe('Ada');
  });

  it('forwards sync options while keeping local persistence when cloud enqueue fails', async () => {
    const repository = createPortfolioRepository();
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    const coordinator = {
      markDirty: vi.fn(() => {
        throw new Error('offline');
      }),
    };

    configurePortfolioStorageScope('user-1');
    configurePortfolioSync(coordinator as never);

    repository.save(state);
    await Promise.resolve();

    expect(repository.load()).not.toBeNull();
    expect(coordinator.markDirty).toHaveBeenCalledOnce();
  });
});