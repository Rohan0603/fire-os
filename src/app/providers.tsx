import { createContext, createElement, useContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { portfolioSavedStore } from '../core/stores';
import { useStore } from './hooks/use-store';

/**
 * Publishes the portfolio save counter to React components.
 *
 * `portfolioSavedStore` is a monotonic invalidation token, not portfolio data.
 * Components that need to re-read derived portfolio state subscribe to this
 * counter via `usePortfolioSaved()`.
 */
const PortfolioSavedContext = createContext(0);

export function PortfolioSavedProvider({ children }: { children: ReactNode }): ReactElement {
  const savedCount = useStore(portfolioSavedStore);
  const value = useMemo(() => savedCount, [savedCount]);
  return createElement(PortfolioSavedContext.Provider, { value }, children);
}

/** Current portfolio save counter. Increments on every local save. */
export function usePortfolioSaved(): number {
  return useContext(PortfolioSavedContext);
}
