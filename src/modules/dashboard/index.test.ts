import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { activeScopeStore, marketRefreshStatusStore, syncStatusStore } from '../../core/stores';
import { initializeState } from '../../types/state';
import { initDashboardModule, renderDashboard, teardownDashboard } from './index';

interface FakeLabel {
  readonly writes: number;
  textContent: string;
}

function createLabel(): FakeLabel {
  let value = '';
  let writes = 0;
  return {
    get writes() {
      return writes;
    },
    get textContent() {
      return value;
    },
    set textContent(next: string) {
      value = next;
      writes += 1;
    },
  };
}

function createFakeDocument() {
  const container = { innerHTML: '' };
  const labels = new Map<string, FakeLabel>();
  const getElementById = (id: string): unknown => {
    if (id === 'dashboard') return container;
    if (!container.innerHTML.includes(`id="${id}"`)) return null;
    if (!labels.has(id)) labels.set(id, createLabel());
    return labels.get(id);
  };
  return { container, labels, getElementById };
}

type FakeDocument = ReturnType<typeof createFakeDocument>;

function labelOf(doc: FakeDocument, id: string): FakeLabel | undefined {
  return doc.labels.get(id);
}

describe('dashboard reactive status consumers', () => {
  let doc: FakeDocument;
  let context: FeatureContext;

  beforeEach(() => {
    doc = createFakeDocument();
    vi.stubGlobal('document', { getElementById: (id: string) => doc.getElementById(id) });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    syncStatusStore.set('idle');
    marketRefreshStatusStore.set('idle');
    activeScopeStore.set('local');
    context = createFeatureContext(initializeState());
    initDashboardModule('dashboard', context);
  });

  afterEach(() => {
    teardownDashboard();
    vi.unstubAllGlobals();
  });

  it('renders sync, market refresh and scope statuses into the trust panel', async () => {
    syncStatusStore.set('offline');

    await renderDashboard();

    expect(doc.container.innerHTML).toContain('id="sync-status-value"');
    expect(doc.container.innerHTML).toContain('id="market-refresh-value"');
    expect(doc.container.innerHTML).toContain('id="scope-mode-label"');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Offline');
    expect(labelOf(doc, 'scope-mode-label')?.textContent).toBe('Local-only mode');
    expect(marketRefreshStatusStore.get()).toBe('success');
    expect(labelOf(doc, 'market-refresh-value')?.textContent).toBe('Up to date');
  });

  it('drives offline, pending, syncing, error and synced renders from status changes', async () => {
    await renderDashboard();

    syncStatusStore.set('offline');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Offline');
    syncStatusStore.set('pending');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Pending changes');
    syncStatusStore.set('syncing');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Syncing');
    syncStatusStore.set('error');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Sync error');
    syncStatusStore.set('idle');
    expect(labelOf(doc, 'sync-status-value')?.textContent).toBe('Synced');

    marketRefreshStatusStore.set('refreshing');
    expect(labelOf(doc, 'market-refresh-value')?.textContent).toBe('Refreshing');
    marketRefreshStatusStore.set('error');
    expect(labelOf(doc, 'market-refresh-value')?.textContent).toBe('Refresh failed');
    marketRefreshStatusStore.set('success');
    expect(labelOf(doc, 'market-refresh-value')?.textContent).toBe('Up to date');

    activeScopeStore.set('cloud');
    expect(labelOf(doc, 'scope-mode-label')?.textContent).toBe('Cloud sync enabled');
    activeScopeStore.set('local');
    expect(labelOf(doc, 'scope-mode-label')?.textContent).toBe('Local-only mode');
  });

  it('unsubscribes status signals on module teardown', async () => {
    await renderDashboard();
    syncStatusStore.set('pending');
    const syncLabel = labelOf(doc, 'sync-status-value');
    const marketLabel = labelOf(doc, 'market-refresh-value');
    const scopeLabel = labelOf(doc, 'scope-mode-label');
    expect(syncLabel?.textContent).toBe('Pending changes');
    const syncWrites = syncLabel?.writes ?? 0;
    const marketWrites = marketLabel?.writes ?? 0;
    const scopeWrites = scopeLabel?.writes ?? 0;

    teardownDashboard();

    syncStatusStore.set('error');
    marketRefreshStatusStore.set('error');
    activeScopeStore.set('cloud');
    expect(syncLabel?.writes).toBe(syncWrites);
    expect(marketLabel?.writes).toBe(marketWrites);
    expect(scopeLabel?.writes).toBe(scopeWrites);
    expect(syncLabel?.textContent).toBe('Pending changes');
  });

  it('leaks no callbacks across repeated dashboard mount and unmount', async () => {
    for (let i = 0; i < 10; i += 1) {
      await renderDashboard();
      teardownDashboard();
    }
    const syncLabel = labelOf(doc, 'sync-status-value')!;
    const whileUnmounted = syncLabel.writes;

    syncStatusStore.set('syncing');
    expect(syncLabel.writes).toBe(whileUnmounted);

    await renderDashboard();
    const afterMount = syncLabel.writes;

    syncStatusStore.set('pending');
    expect(syncLabel.writes).toBe(afterMount + 1);
  });

  it('does not re-attach status signals when a render finishes after teardown', async () => {
    const inFlight = renderDashboard();
    teardownDashboard();
    await inFlight;

    expect(doc.container.innerHTML).toBe('');
    const before = labelOf(doc, 'sync-status-value')?.writes ?? 0;
    syncStatusStore.set('error');
    expect(labelOf(doc, 'sync-status-value')?.writes ?? 0).toBe(before);
  });
});
