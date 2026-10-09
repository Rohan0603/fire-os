import * as RadixSelect from '@radix-ui/react-select';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Select over Radix. A native `<select>` is the lazier option and would be fine
 * for most needs, but the modules being ported next (tax slabs, insurance
 * providers) need grouped options and a placeholder, which native cannot do
 * accessibly without extra work. Radix is already a dependency.
 */

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name. Prefer a visible label wired to `Select.Label`. */
  'aria-label'?: string;
  placeholder?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Select({
  children,
  className,
  placeholder = 'Select…',
  disabled,
  ...rest
}: SelectProps) {
  return (
    <RadixSelect.Root {...rest} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn(
          'inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-md',
          'border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm',
          'text-(--color-foreground) transition-colors duration-200 motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <CaretDownIcon aria-hidden size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={cn(
            'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md',
            'border border-(--color-border) bg-(--color-surface) shadow-lg',
          )}
        >
          <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectItem({
  className,
  children,
  ...rest
}: RadixSelect.SelectItemProps) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-3 text-sm',
        'text-(--color-foreground) outline-none select-none',
        'data-[highlighted]:bg-(--color-muted)',
        className,
      )}
      {...rest}
    >
      <SelectItemIndicator />
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

function SelectItemIndicator() {
  return (
    <RadixSelect.ItemIndicator className="absolute right-2">
      <CheckIcon aria-hidden size={14} />
    </RadixSelect.ItemIndicator>
  );
}

export function SelectGroup({ children, ...rest }: RadixSelect.SelectGroupProps) {
  return <RadixSelect.Group {...rest}>{children}</RadixSelect.Group>;
}

export function SelectLabel({ className, ...rest }: RadixSelect.SelectLabelProps) {
  return (
    <RadixSelect.Label
      className={cn('px-3 py-1.5 text-xs font-semibold text-(--color-muted-foreground)', className)}
      {...rest}
    />
  );
}
