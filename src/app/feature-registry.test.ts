import { describe, expect, it, vi } from 'vitest';
import { createFeatureContext, type FeatureContext } from '../core/feature-context';
import { FeatureRegistry, type FeatureModule } from './feature-registry';
import { initializeState } from '../types/state';

function createContext(): FeatureContext {
  return createFeatureContext(initializeState(), {
    load: () => null,
    save: vi.fn(),
  });
}

function createContainer(): HTMLElement {
  return {} as HTMLElement;
}

describe('FeatureRegistry', () => {
  it('registers modules and passes the shared context to mount', async () => {
    const context = createContext();
    const container = createContainer();
    const mount = vi.fn();
    const module: FeatureModule = { id: 'reports', label: 'Reports', mount };
    const registry = new FeatureRegistry(context);

    registry.register(module);
    await registry.mount('reports', container);

    expect(registry.get('reports')).toBe(module);
    expect(mount).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledWith(container, context);
  });

  it('rejects duplicate and unknown module IDs', async () => {
    const registry = new FeatureRegistry(createContext());
    const module: FeatureModule = {
      id: 'reports',
      label: 'Reports',
      mount: vi.fn(),
    };

    registry.register(module);

    expect(() => registry.register(module)).toThrow('Feature already registered: reports');
    await expect(registry.mount('missing', createContainer())).rejects.toThrow(
      'Unknown feature: missing',
    );
  });

  it('dispatches optional unmount and treats missing unmount as a no-op', async () => {
    const context = createContext();
    const container = createContainer();
    const unmount = vi.fn();
    const registry = new FeatureRegistry(context);

    registry.register({ id: 'reports', label: 'Reports', mount: vi.fn(), unmount });
    registry.register({ id: 'settings', label: 'Settings', mount: vi.fn() });

    await registry.unmount('reports', container);
    await registry.unmount('settings', container);
    await registry.unmount('missing', container);

    expect(unmount).toHaveBeenCalledWith(container, context);
  });
});

describe('createFeatureContext', () => {
  it('preserves explicitly injected state and repository dependencies', () => {
    const state = initializeState();
    const portfolio = { load: () => state, save: vi.fn() };

    const context = createFeatureContext(state, portfolio);

    expect(context.state).toBe(state);
    expect(context.portfolio).toBe(portfolio);
  });
});