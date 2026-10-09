import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

/**
 * Dialog over Radix, portalled to <body> so it is never clipped by a legacy
 * module's overflow or stacking context.
 *
 * Radix supplies the focus trap, Escape handling and `aria-modal` wiring, which
 * the hand-rolled `src/modules/ui/Modal.ts` cannot do. That module is replaced
 * when its consumers are ported; it is not imported here.
 *
 * `description` is wired to `Dialog.Description`, which Radix needs for correct
 * labelling. Pass a visually-hidden class if the design has no visible
 * description rather than omitting it.
 */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-none',
          )}
        />
        <RadixDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)',
            className,
          )}
        >
          <div className="mb-4 flex flex-col gap-1">
            <RadixDialog.Title className="text-base font-semibold text-(--color-foreground)">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="text-sm text-(--color-muted-foreground)">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          {children}
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
          <RadixDialog.Close asChild>
            <Button variant="ghost" size="sm" aria-label="Close" className="absolute top-4 right-4">
              <span aria-hidden>&times;</span>
            </Button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
