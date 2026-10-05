import { describe, expect, it, vi } from 'vitest';
import { createFeatureContext } from '../core/feature-context';
import { initializeState } from '../types/state';
import { FeatureRegistry } from './feature-registry';
import { resolveTabTarget } from './tab-navigation';

function createRegistry(...ids: string[]): FeatureRegistry {
  const registry = new FeatureRegistry(createFeatureContext(initializeState()));
  for (const id of ids) {
    registry.register({ id, label: id, mount: vi.fn() });
  }
  return registry;
}

describe('resolveTabTarget', () => {
  const registry = createRegistry('profile', 'dashboard', 'plan');

  it('matches the pathname and ignores trailing slashes', () => {
    expect(resolveTabTarget(registry, '/dashboard', '')).toBe('dashboard');
    expect(resolveTabTarget(registry, '/dashboard/', '')).toBe('dashboard');
    expect(resolveTabTarget(registry, '/dashboard///', '#plan')).toBe('dashboard');
  });

  it('falls back to the hash when the pathname is unknown', () => {
    expect(resolveTabTarget(registry, '/missing', '#plan')).toBe('plan');
  });

  it('defaults to profile for the root and for unknown targets', () => {
    expect(resolveTabTarget(registry, '/', '')).toBe('profile');
    expect(resolveTabTarget(registry, '/missing', '#nope')).toBe('profile');
    expect(resolveTabTarget(registry, '', '#missing')).toBe('profile');
  });
});
