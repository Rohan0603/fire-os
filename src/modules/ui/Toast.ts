/**
 * Toast Component - Toast notification system
 * Displays temporary notifications at bottom-right with auto-dismiss
 *
 * The imperative `showToast`/`dismissToast` API is the single source of truth
 * and keeps its long-standing signature: 40 call sites go through the
 * `showToast` feature port. Rendering is delegated to whichever consumer is
 * mounted: the React `Toaster` in `src/app/ui` subscribes via
 * `subscribeToasts()` and renders through Radix; until that happens toasts are
 * rendered imperatively into `#toast-container`, so notifications fired before
 * the React tree mounts (session bootstrap, early errors) are not lost.
 */

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  /** Auto-dismiss delay in ms; <= 0 keeps the toast until manually dismissed. */
  duration: number;
}

type ToastListener = (items: ToastItem[]) => void;

const listeners = new Set<ToastListener>();
let toastItems: ToastItem[] = [];
/** Auto-dismiss timers, kept in every rendering mode so dismiss clears them. */
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
let toastContainer: HTMLElement | null = null;
/** DOM fallback instances; active only until a React Toaster subscribes. */
const domElements = new Map<string, HTMLElement>();
let toastCounter = 0;
let domActive = true;

/**
 * Initialize toast container (called once on app startup)
 */
export function initToastContainer(): void {
  if (toastContainer || typeof document === 'undefined') return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    z-index: 1500;
    pointer-events: none;
    max-width: 400px;
  `;
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 * @param message Toast message
 * @param duration Auto-dismiss duration in milliseconds (default 3000)
 * @param type Toast type: 'info' | 'success' | 'error' | 'warning'
 */
export function showToast(
  message: string,
  duration: number = 3000,
  type: ToastType = 'info'
): string {
  const item: ToastItem = {
    id: `toast-${toastCounter++}`,
    message,
    type,
    duration,
  };
  toastItems = [...toastItems, item];

  if (domActive) renderDomToast(item);
  if (duration > 0) {
    timeouts.set(item.id, setTimeout(() => dismissToast(item.id), duration));
  }
  emitToastChange();

  return item.id;
}

/**
 * Dismiss a specific toast by ID
 * @param toastId Toast ID from showToast return
 */
export function dismissToast(toastId: string): void {
  if (!toastItems.some((item) => item.id === toastId)) return;
  toastItems = toastItems.filter((item) => item.id !== toastId);

  const timeout = timeouts.get(toastId);
  if (timeout !== undefined) {
    clearTimeout(timeout);
    timeouts.delete(toastId);
  }

  if (domActive) {
    const element = domElements.get(toastId);
    if (element) {
      // Animate out
      element.style.animation = 'toastSlideOut 300ms ease';
      setTimeout(() => {
        element.remove();
        domElements.delete(toastId);
      }, 300);
    }
  }
  emitToastChange();
}

/**
 * Subscribe to the toast stream. The React `<Toaster>` calls this once on
 * mount; it receives an array snapshot on every change and an immediate
 * snapshot of the current toasts. While subscribed, the DOM fallback renderer
 * is disabled and toasts render only through the subscriber.
 *
 * @returns An unsubscribe function; when the last subscriber leaves, pending
 * toasts resume rendering through the DOM fallback.
 */
export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  if (domActive) {
    domActive = false;
    // Hand rendered toasts over to the subscriber, which renders the snapshot.
    for (const element of domElements.values()) element.remove();
    domElements.clear();
  }
  listener(toastItems);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      domActive = true;
      for (const item of toastItems) renderDomToast(item);
    }
  };
}

function emitToastChange(): void {
  for (const listener of listeners) listener(toastItems);
}

/**
 * Imperative DOM fallback, used only until a React Toaster subscribes. Mirrors
 * the original `showToast` markup so the pre-React window behaves identically.
 */
function renderDomToast(item: ToastItem): void {
  if (typeof document === 'undefined') return;
  if (!toastContainer) initToastContainer();

  const toast = document.createElement('div');
  toast.id = item.id;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const { bgColor, borderColor, icon } = getToastColors(item.type);

  toast.style.cssText = `
    background: ${bgColor};
    border: 1px solid ${borderColor};
    border-radius: 8px;
    padding: 1rem 1.25rem;
    color: #ffffff;
    font-size: 0.95rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: toastSlideIn 300ms ease;
    pointer-events: auto;
    word-break: break-word;
    min-height: 2.5rem;
  `;

  // Icon
  const iconEl = document.createElement('span');
  iconEl.textContent = icon;
  iconEl.style.cssText = `
    font-size: 1.25rem;
    flex-shrink: 0;
  `;

  // Message
  const messageEl = document.createElement('span');
  messageEl.textContent = item.message;
  messageEl.style.cssText = `
    flex: 1;
  `;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1rem;
    flex-shrink: 0;
    transition: color 200ms ease;
  `;

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = '#ffffff';
  });

  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = 'rgba(255, 255, 255, 0.7)';
  });

  closeBtn.addEventListener('click', () => {
    dismissToast(item.id);
  });

  toast.appendChild(iconEl);
  toast.appendChild(messageEl);
  toast.appendChild(closeBtn);

  toastContainer!.appendChild(toast);
  domElements.set(item.id, toast);
}

/**
 * Get toast styling based on type
 */
function getToastColors(type: ToastType): {
  bgColor: string;
  borderColor: string;
  icon: string;
} {
  const colors: Record<ToastType, { bgColor: string; borderColor: string; icon: string }> = {
    success: {
      bgColor: '#1e4620',
      borderColor: '#28a745',
      icon: '✓',
    },
    error: {
      bgColor: '#4a1a1a',
      borderColor: '#dc3545',
      icon: '✕',
    },
    warning: {
      bgColor: '#4a3d1a',
      borderColor: '#ffc107',
      icon: '⚠',
    },
    info: {
      bgColor: '#1a3a52',
      borderColor: '#007bff',
      icon: 'ⓘ',
    },
  };

  return colors[type];
}