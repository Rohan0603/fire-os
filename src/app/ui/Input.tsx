import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from './cn';

/** See Button.tsx for the shared kit conventions. */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  /** Validation message. Sets `aria-invalid` and is announced via `aria-describedby`. */
  error?: ReactNode;
  hint?: ReactNode;
}

export function Input({ label, error, hint, className, id, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error ?? hint);

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-(--color-muted-foreground)"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={cn(
          'w-full rounded-md border bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground)',
          'transition-colors duration-200 motion-reduce:transition-none',
          'placeholder:text-(--color-muted-foreground)',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)',
          error ? 'border-(--color-destructive)' : 'border-(--color-border)',
          className,
        )}
        {...rest}
      />
      {hasMessage ? (
        <p
          id={messageId}
          className={cn(
            'text-xs',
            error ? 'text-(--color-destructive)' : 'text-(--color-muted-foreground)',
          )}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

/** Native `label` with the kit's typography, for use with non-Input controls. */
export function FieldLabel({
  className,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-semibold text-(--color-muted-foreground)', className)}
      {...rest}
    />
  );
}
