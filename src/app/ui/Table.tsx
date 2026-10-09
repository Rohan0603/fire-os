import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Table primitives.
 *
 * Built on a single `Table` root with optional header/footer wrappers rather
 * than a data-grid abstraction: the modules that need sorting or selection are
 * not ported yet, and guessing their API now would just be wrong later.
 *
 * A caption is required for accessibility. It is not visually hidden by default
 * because every current consumer is a holdings or transaction table where the
 * heading is genuinely useful.
 */

export function Table({ className, ...rest }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-sm text-(--color-foreground)',
          // Density 9/10: tight rows, no vertical cell padding doubling up.
          '[&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
          className,
        )}
        {...rest}
      />
    </div>
  );
}

export function TableCaption({ className, ...rest }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('pb-2 text-left text-xs font-semibold text-(--color-muted-foreground)', className)}
      {...rest}
    />
  );
}

export function TableHead({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-(--color-border)', className)} {...rest} />;
}

export function TableBody({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}

export function TableRow({ className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-(--color-border) transition-colors duration-150 motion-reduce:transition-none',
        'last:border-b-0 hover:bg-(--color-muted)',
        className,
      )}
      {...rest}
    />
  );
}

/**
 * `scope` defaults to `col` because every current usage is a column header.
 * A row header should pass `scope="row"` explicitly.
 */
export function TableHeaderCell({
  className,
  scope = 'col',
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        'text-left align-bottom text-xs font-semibold tracking-wide text-(--color-muted-foreground) uppercase',
        className,
      )}
      {...rest}
    />
  );
}

export function TableCell({ className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('align-middle', className)} {...rest} />;
}

/** Money is right-aligned and tabular so columns of figures line up. */
export function TableNumericCell({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={cn('text-right tabular-nums', className)} {...rest}>
      {children}
    </td>
  );
}
