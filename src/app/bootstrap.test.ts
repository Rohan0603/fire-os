import { describe, expect, it, vi } from 'vitest';
import { createBootstrap } from './bootstrap';

/** Structural stand-in for an HTMLElement: this project runs Vitest without jsdom. */
function createContainerStub(): HTMLElement {
  return { nodeType: 1 } as HTMLElement;
}

describe('bootstrap seam', () => {
  it('mounts React only after the first session resolves', async () => {
    const start = vi.fn();
    const mountReact = vi.fn();
    const bootstrap = createBootstrap({
      startAuthSession: start,
      createReactMount: (container) => mountReact(container),
    });

    const pending = bootstrap();
    expect(mountReact).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    const result = await pending;
    expect(result.mode).toBe('guest');

    const container = createContainerStub();
    result.mountReact(container);
    expect(mountReact).toHaveBeenCalledWith(container);
  });

  it('ignores repeated mountReact calls', async () => {
    const mountReact = vi.fn();
    const bootstrap = createBootstrap({
      startAuthSession: vi.fn(),
      createReactMount: (container) => mountReact(container),
    });
    const result = await bootstrap();
    result.mountReact(createContainerStub());
    result.mountReact(createContainerStub());
    expect(mountReact).toHaveBeenCalledOnce();
  });

  it('reports the authenticated mode from the resolver', async () => {
    const bootstrap = createBootstrap({
      startAuthSession: vi.fn(),
      createReactMount: () => vi.fn(),
      resolveMode: () => 'authenticated',
    });
    await expect(bootstrap()).resolves.toMatchObject({ mode: 'authenticated', ready: true });
  });
});
