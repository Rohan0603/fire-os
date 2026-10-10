import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToastItem } from './Toast';

/**
 * The Toast module keeps module-level state (stream + timers), and Vitest runs
 * in a node environment where there is no `document`, so the DOM fallback path
 * is skipped. The bridge contract — imperative API feeding the subscription
 * snapshot the React `<Toaster>` renders from — is fully testable here.
 */

function freshModule() {
  return import('./Toast');
}

async function snapshots(): Promise<ToastItem[][]> {
  const { subscribeToasts } = await freshModule();
  const seen: ToastItem[][] = [];
  subscribeToasts((items) => seen.push(items));
  return seen;
}

describe('Toast bridge', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('starts with an empty stream', async () => {
    const { subscribeToasts } = await freshModule();
    const seen: ToastItem[][] = [];
    subscribeToasts((items) => seen.push(items));
    expect(seen).toEqual([[]]);
  });

  it('showToast pushes a toast with defaults into the snapshot', async () => {
    const { showToast } = await freshModule();
    const seen = await snapshots();

    const id = showToast('Saved');
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual([{ id, message: 'Saved', type: 'info', duration: 3000 }]);
  });

  it('showToast forwards explicit duration and type', async () => {
    const { showToast } = await freshModule();
    const seen = await snapshots();

    const id = showToast('Write access enabled', 5000, 'success');
    expect(seen[1]).toEqual([{ id, message: 'Write access enabled', type: 'success', duration: 5000 }]);
  });

  it('keeps toasts in insertion order', async () => {
    const { showToast } = await freshModule();
    const seen = await snapshots();

    showToast('first', 0);
    showToast('second', 0);
    expect(seen[seen.length - 1].map((item) => item.message)).toEqual(['first', 'second']);
  });

  it('dismissToast removes the toast from the snapshot', async () => {
    const { dismissToast, showToast } = await freshModule();
    const seen = await snapshots();

    const id = showToast('Gone soon', 0);
    dismissToast(id);
    expect(seen[seen.length - 1]).toEqual([]);
  });

  it('dismissToast on an unknown id is a no-op', async () => {
    const { dismissToast, showToast } = await freshModule();
    const seen = await snapshots();

    showToast('Stays', 0);
    dismissToast('toast-999');
    expect(seen[seen.length - 1]).toHaveLength(1);
  });

  it('a sticky toast (duration 0) stays until dismissed', async () => {
    const { showToast } = await freshModule();
    const seen = await snapshots();

    const id = showToast('Sticky', 0);
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    expect(seen[seen.length - 1].map((item) => item.id)).toEqual([id]);
  });

  it('auto-dismisses a timed toast after its duration', async () => {
    vi.useFakeTimers();
    const { showToast } = await freshModule();
    const seen = await snapshots();

    showToast('Transient', 100);
    expect(seen[seen.length - 1]).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(seen[seen.length - 1]).toEqual([]);
  });

  it('unsubscribing stops updates and later subscribers get the current snapshot', async () => {
    const { showToast, subscribeToasts } = await freshModule();

    const first: ToastItem[][] = [];
    const unsubscribe = subscribeToasts((items) => first.push(items));
    showToast('Once', 0);

    // A later subscriber immediately receives the current snapshot.
    const second: ToastItem[][] = [];
    subscribeToasts((items) => second.push(items));
    expect(second[0]).toHaveLength(1);

    unsubscribe();
    const before = first.length;
    showToast('After unsubscribe', 0);
    expect(first).toHaveLength(before); // no further updates
  });
});