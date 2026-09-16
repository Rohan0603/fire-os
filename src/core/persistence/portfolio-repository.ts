import {
  loadData,
  persistPortfolioState,
  type PersistPortfolioOptions,
} from '../../lib/storage';
import type { FireOSState } from '../../types/state';

export interface PortfolioRepository {
  load(): FireOSState | null;
  save(state: FireOSState, options?: PersistPortfolioOptions): void | Promise<void>;
}

export function createPortfolioRepository(): PortfolioRepository {
  return {
    load: loadData,
    save(state, options = {}) {
      if (options.awaitCloud) {
        return persistPortfolioState(state, { sync: options.sync, awaitCloud: true });
      }
      persistPortfolioState(state, { sync: options.sync, awaitCloud: false });
    },
  };
}