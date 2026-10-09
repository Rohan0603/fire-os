import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';
import { Input } from './Input';
import { Card, CardTitle } from './Card';
import { cn } from './cn';

/**
 * Vitest runs without jsdom here, so these assert on serialised markup rather
 * than computed style. That is enough to pin the two things that silently broke
 * during the migration: a variant dropping its token class, and a focus ring
 * disappearing. Actual cascade behaviour is covered by e2e/design-system.spec.ts.
 */
describe('cn', () => {
  it('joins truthy parts and drops falsy ones', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    expect(cn()).toBe('');
  });
});

describe('Button', () => {
  it('defaults to type=button so it never submits a form by accident', () => {
    expect(renderToStaticMarkup(<Button>x</Button>)).toContain('type="button"');
  });

  it('always carries a visible focus ring and pointer cursor', () => {
    const html = renderToStaticMarkup(<Button>x</Button>);
    expect(html).toContain('focus-visible:outline-2');
    expect(html).toContain('cursor-pointer');
  });

  it('uses Tailwind v4 var syntax, never the v3 shorthand', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">x</Button>);
    expect(html).toContain('border-(--color-primary)');
    expect(html).not.toContain('[--color-');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders the %s variant without empty classes',
    (variant) => {
      const html = renderToStaticMarkup(<Button variant={variant}>x</Button>);
      expect(html).not.toMatch(/class="[\s"]*"/);
      expect(html).toContain('class="');
    },
  );

  it('neutralises transitions under prefers-reduced-motion', () => {
    expect(renderToStaticMarkup(<Button>x</Button>)).toContain('motion-reduce:transition-none');
  });

  it('forwards native button attributes', () => {
    const html = renderToStaticMarkup(
      <Button id="save" data-testid="save-btn" disabled>
        Save
      </Button>,
    );
    expect(html).toContain('id="save"');
    expect(html).toContain('data-testid="save-btn"');
    expect(html).toContain('disabled');
  });
});

describe('Input', () => {
  it('links its label to the input and wires the error message', () => {
    const html = renderToStaticMarkup(<Input label="Name" error="Required" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<label[^>]*for="[^"]+"/);
    expect(html).toContain('Required');
  });

  it('omits aria-describedby when there is no message', () => {
    expect(renderToStaticMarkup(<Input label="Name" />)).not.toContain('aria-describedby');
  });

  it('does not mark aria-invalid for a hint', () => {
    const html = renderToStaticMarkup(<Input label="Name" hint="Optional" />);
    expect(html).not.toContain('aria-invalid');
    expect(html).toContain('aria-describedby');
  });

  it('respects an explicit id', () => {
    expect(renderToStaticMarkup(<Input id="dob" />)).toContain('id="dob"');
  });
});

describe('Card', () => {
  it('is static by default and interactive on request', () => {
    expect(renderToStaticMarkup(<Card>a</Card>)).not.toContain('cursor-pointer');
    expect(renderToStaticMarkup(<Card interactive>a</Card>)).toContain('cursor-pointer');
  });

  it('keeps the hover lift disabled under reduced motion', () => {
    const html = renderToStaticMarkup(<Card interactive>a</Card>);
    expect(html).toContain('motion-reduce:hover:translate-y-0');
  });

  it('renders nested structure', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardTitle>Net worth</CardTitle>
      </Card>,
    );
    expect(html).toContain('<h3');
    expect(html).toContain('Net worth');
  });
});
