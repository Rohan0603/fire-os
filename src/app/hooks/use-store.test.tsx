import { atom } from 'nanostores';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useStore } from './use-store';

/** Renders the hook in a real React render context (this project has no jsdom). */
function renderValue<T>(store: Parameters<typeof useStore<T>>[0]): string {
  function Probe(): React.ReactElement {
    return <span>{String(useStore<T>(store))}</span>;
  }
  return renderToStaticMarkup(<Probe />);
}

describe('useStore', () => {
  it('renders the current atom value', () => {
    expect(renderValue(atom('idle'))).toBe('<span>idle</span>');
  });

  it('re-reads the value on the next render after a notification', () => {
    const store = atom(1);
    expect(renderValue(store)).toBe('<span>1</span>');
    store.set(2);
    expect(renderValue(store)).toBe('<span>2</span>');
  });

  it('renders falsey values unchanged', () => {
    expect(renderValue(atom(0))).toBe('<span>0</span>');
    expect(renderValue(atom(''))).toBe('<span></span>');
    expect(renderValue(atom(false))).toBe('<span>false</span>');
  });
});
