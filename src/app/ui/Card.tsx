import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** See Button.tsx for the shared kit conventions. */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Raises the card and shows a pointer, for cards that navigate or act. */
  interactive?: boolean;
}

export function Card({ interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-(--color-border) bg-(--color-surface) p-6',
        'transition-[box-shadow,transform] duration-200 motion-reduce:transition-none',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0',
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold text-(--color-foreground)', className)}
      {...rest}
    />
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm text-(--color-foreground)', className)} {...rest} />;
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cn('mt-4 flex items-center gap-2', className)} {...rest}>
      {children}
    </div>
  );
}
