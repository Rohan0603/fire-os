import { describe, expect, it } from 'vitest';

describe('React toolchain', () => {
  it('resolves react, react-dom and react-router-dom', async () => {
    const [react, dom, router] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('react-router-dom'),
    ]);
    expect(react.version).toMatch(/^19\.3\./);
    expect(typeof dom.createRoot).toBe('function');
    expect(typeof router.createBrowserRouter).toBe('function');
  });

  it('resolves the Tailwind v4 vite plugin', async () => {
    const plugin = await import('@tailwindcss/vite');
    expect(typeof plugin.default).toBe('function');
  });
});
