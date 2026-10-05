import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import type { PortfolioRepository } from '../../core/persistence/portfolio-repository';
import { initializeState } from '../../types/state';
import { initEsopModule } from './index';

const NODE_IDS = [
  'trigger-marriage',
  'trigger-child',
  'trigger-job',
  'trigger-coorg',
  'calc-shares',
  'calc-fmv',
  'calc-price',
  'calc-slab',
  'esop-refresh-btn',
  'res-gross',
  'res-perq',
  'res-ltcg',
  'res-net',
  'deployment-plan-list',
] as const;

interface FakeNode {
  value: string;
  checked: boolean;
  textContent: string;
  nextElementSibling: null;
  parentNode: null;
  classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean };
  addEventListener(type: string, handler: () => void): void;
  fire(type: string): void;
}

function createNode(): FakeNode {
  const listeners = new Map<string, (() => void)[]>();
  const classes = new Set<string>();
  return {
    value: '',
    checked: false,
    textContent: '',
    nextElementSibling: null,
    parentNode: null,
    classList: {
      add: (c) => void classes.add(c),
      remove: (c) => void classes.delete(c),
      contains: (c) => classes.has(c),
    },
    addEventListener(type, handler) {
      const existing = listeners.get(type) ?? [];
      existing.push(handler);
      listeners.set(type, existing);
    },
    fire(type) {
      for (const handler of listeners.get(type) ?? []) handler();
    },
  };
}

function createHarness() {
  const container = { innerHTML: '' };
  const nodes = new Map<string, FakeNode>();
  for (const id of NODE_IDS) nodes.set(id, createNode());
  return {
    container,
    nodes,
    node: (id: string) => nodes.get(id) as FakeNode,
    getElementById: (id: string): unknown => (id === 'esop' ? container : nodes.get(id) ?? null),
  };
}

/**
 * `renderEsop` paints a loading placeholder and only renders the real template
 * (which is what attaches the input handlers) once the valuation fetch
 * settles, so every test has to flush that promise before interacting.
 */
async function renderSettledEsop(
  harness: ReturnType<typeof createHarness>,
  context: FeatureContext,
): Promise<void> {
  initEsopModule('esop', context);
  await vi.waitFor(() => {
    expect(harness.node('calc-shares').textContent).not.toBeUndefined();
    expect(harness.container.innerHTML.length).toBeGreaterThan(1000);
  });
}

describe('esop tax calculator re-render behaviour', () => {
  let harness: ReturnType<typeof createHarness>;
  let context: FeatureContext;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
    vi.stubGlobal('document', { getElementById: harness.getElementById });
    save = vi.fn();
    context = createFeatureContext(initializeState(), { save } as unknown as PortfolioRepository);
    context.ports.marketData.fetchEsopValuations = vi.fn(async () => []);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('updates the tax results on every keystroke without rebuilding the container', async () => {
    const shares = harness.node('calc-shares');
    shares.value = '100';
    harness.node('calc-fmv').value = '50';
    harness.node('calc-price').value = '1000';
    harness.node('calc-slab').value = '30';

    await renderSettledEsop(harness, context);
    const renderedMarkup = harness.container.innerHTML;
    harness.node('res-gross').textContent = '';

    shares.fire('input');
    vi.advanceTimersByTime(500);

    // A re-render here would replace the input being typed into and drop focus.
    expect(harness.container.innerHTML).toBe(renderedMarkup);
    expect(harness.node('res-gross').textContent).not.toBe('');
    expect(save).toHaveBeenCalled();
  });

  it('still re-renders when a trigger toggle changes the trigger-status list', async () => {
    const marriage = harness.node('trigger-marriage');
    harness.node('calc-shares').value = '0';
    harness.node('calc-fmv').value = '0';
    harness.node('calc-price').value = '0';
    harness.node('calc-slab').value = '30';

    await renderSettledEsop(harness, context);
    const beforeToggle = harness.container.innerHTML;
    expect(beforeToggle).not.toContain('Marriage Goal');

    marriage.checked = true;
    marriage.fire('change');
    vi.advanceTimersByTime(500);

    expect(harness.container.innerHTML).not.toBe(beforeToggle);
    expect(harness.container.innerHTML).toContain('Marriage Goal');
  });
});