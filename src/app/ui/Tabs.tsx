import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Tabs over Radix, so keyboard semantics (arrow keys, Home/End) and the
 * `aria-controls` wiring come from the primitive rather than being re-derived.
 *
 * `value`/`defaultValue`/`onValueChange` pass straight through, so a consumer
 * that needs a controlled tab set (plan, tax) can drive it from app state.
 */

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ children, className, ...rest }: TabsProps) {
  return (
    <RadixTabs.Root {...rest} className={cn('flex flex-col gap-3', className)}>
      {children}
    </RadixTabs.Root>
  );
}

export function TabsList({ className, ...rest }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn(
        'flex flex-wrap gap-1 border-b border-(--color-border)',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'cursor-pointer rounded-t-md px-3 py-1.5 text-sm font-semibold text-(--color-muted-foreground)',
        'transition-colors duration-200 motion-reduce:transition-none',
        'hover:text-(--color-foreground)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)',
        'data-[state=active]:bg-(--color-surface-raised) data-[state=active]:text-(--color-primary)',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: RadixTabs.TabsContentProps) {
  return <RadixTabs.Content className={cn('outline-none', className)} {...rest} />;
}
