import { useCallback, useSyncExternalStore } from 'react';
import type { ReadableAtom } from 'nanostores';

/**
 * Subscribe a component to a nanostore atom.
 *
 * The third `useSyncExternalStore` argument is the server snapshot; this is a
 * client-only app, so returning the current value keeps the signature honest
 * without pretending to render on a server.
 */
export function useStore<T>(store: ReadableAtom<T>): T {
  const subscribe = useCallback((onStoreChange: () => void) => store.subscribe(onStoreChange), [store]);
  const getSnapshot = useCallback(() => store.get(), [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
