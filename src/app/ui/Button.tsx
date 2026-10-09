import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Shared UI kit.
 *
 * Every component here draws its colours from the `@theme` tokens in
 * `src/styles/app.css` using Tailwind v4's `bg-(--color-x)` syntax. Never use
 * the v3 `bg-[--color-x]` shorthand: it silently generates nothing.
 *
 * Two rules from design-system/fire-os/MASTER.md are enforced structurally
 * rather than per call site, so a caller cannot forget them:
 *   - every clickable element gets `cursor-pointer` and a visible focus ring;
 *   - transitions are declared, and `motion-reduce:` neutralises them, which
 *     covers the `prefers-reduced-motion` checklist item.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-(--color-primary) text-(--color-on-primary) hover:opacity-90',
  secondary:
    'bg-transparent text-(--color-primary) border-2 border-(--color-primary) hover:bg-(--color-primary) hover:text-(--color-on-primary)',
  ghost: 'bg-transparent text-(--color-foreground) hover:bg-(--color-muted)',
  danger: 'bg-(--color-destructive) text-(--color-on-destructive) hover:opacity-90',
};

const SIZES: Record<ButtonSize, string> = {
  // The design system is density 9/10, so padding stays tight.
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-semibold ' +
  'transition-[opacity,background-color,color] duration-200 motion-reduce:transition-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring) ' +
  'disabled:pointer-events-none disabled:opacity-50';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    />
  );
}
