import * as RadixToast from '@radix-ui/react-toast';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastType,
} from '../../modules/ui/Toast';
import { Button } from './Button';
import { cn } from './cn';

/**
 * Toaster over Radix. The imperative `showToast`/`dismissToast` API in
 * `src/modules/ui/Toast.ts` remains the source of truth for every caller (40
 * call sites go through the `showToast` feature port); this component
 * subscribes to that stream and renders it with Radix primitives, which bring
 * the swipe-to-dismiss gesture, focus management and `aria-live` wiring. Mount
 * it once at the app root — dismissal timing still belongs to the imperative
 * module, so this stays a view over the existing API and call-site behaviour
 * is unchanged.
 *
 * The legacy DOM fallback renderer handles the window before React mounts;
 * subscribing switches that off (see `subscribeToasts`).
 */

/** Matches the `toastSlideOut` keyframe duration in `modules/ui/styles.css`. */
const EXIT_ANIMATION_MS = 300;

const TYPE_STYLES: Record<ToastType, { accent: string; icon: ReactNode }> = {
  success: {
    accent: 'text-(--color-accent)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    accent: 'text-(--color-destructive)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    ),
  },
  warning: {
    accent: 'text-(--color-warning)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9v4" strokeLinecap="round" />
        <path d="M12 17h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  info: {
    accent: 'text-(--color-primary)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" strokeLinecap="round" />
        <path d="M12 8h.01" strokeLinecap="round" />
      </svg>
    ),
  },
};

function ToastCard({
  item,
  onDismiss,
  open = true,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  open?: boolean;
}) {
  const { accent, icon } = TYPE_STYLES[item.type];
  return (
    <RadixToast.Root
      type="foreground"
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss(item.id);
      }}
      // Dismissal timing is owned by the imperative module (`showToast`'s
      // duration); Radix must not auto-dismiss on its own timer.
      duration={Infinity}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-(--color-border)',
        'bg-(--color-surface) p-3 shadow-lg',
        'data-[state=open]:animate-[toastSlideIn_300ms_ease]',
        'data-[state=closed]:animate-[toastSlideOut_300ms_ease]',
        'motion-reduce:animate-none',
      )}
    >
      <span aria-hidden className={cn('mt-0.5 shrink-0', accent)}>
        {icon}
      </span>
      <RadixToast.Title className="flex-1 text-sm font-medium text-(--color-foreground)">
        {item.message}
      </RadixToast.Title>
      <RadixToast.Close asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss notification"
          className="shrink-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3 w-3"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </Button>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /** Items already dismissed, kept mounted so the exit animation can play. */
  const [closing, setClosing] = useState<ToastItem[]>([]);
  const currentRef = useRef<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((items) => {
      const gone = currentRef.current.filter(
        (existing) => !items.some((item) => item.id === existing.id),
      );
      currentRef.current = items;
      setToasts(items);

      if (gone.length > 0) {
        setClosing((previous) => [...previous, ...gone]);
        setTimeout(() => {
          setClosing((previous) =>
            previous.filter((item) => !gone.some((goneItem) => goneItem.id === item.id)),
          );
        }, EXIT_ANIMATION_MS);
      }
    });
  }, []);

  return (
    <RadixToast.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={dismissToast} />
      ))}
      {closing.map((item) => (
        <ToastCard key={`closing-${item.id}`} item={item} open={false} onDismiss={dismissToast} />
      ))}
      <RadixToast.Viewport
        // Matches the legacy #toast-container position and stacking (z-index
        // 1500) so the handoff between the two renderers is seamless.
        className="pointer-events-none fixed right-4 bottom-4 z-[1500] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      />
    </RadixToast.Provider>
  );
}