/**
 * Toast Component - Toast notification system
 * Displays temporary notifications at bottom-right with auto-dismiss
 */

export type ToastType = 'info' | 'success' | 'error' | 'warning';

let toastContainer: HTMLElement | null = null;
const activeToasts: Map<string, { element: HTMLElement; timeout: number }> = new Map();
let toastCounter = 0;

/**
 * Initialize toast container (called once on app startup)
 */
export function initToastContainer(): void {
  if (toastContainer) return;

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
  if (!toastContainer) {
    initToastContainer();
  }

  const toastId = `toast-${toastCounter++}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const { bgColor, borderColor, icon } = getToastColors(type);

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
  messageEl.textContent = message;
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
    dismissToast(toastId);
  });

  toast.appendChild(iconEl);
  toast.appendChild(messageEl);
  toast.appendChild(closeBtn);

  toastContainer!.appendChild(toast);

  // Auto-dismiss
  let timeout: number;
  if (duration > 0) {
    timeout = window.setTimeout(() => {
      dismissToast(toastId);
    }, duration);
  } else {
    timeout = -1;
  }

  activeToasts.set(toastId, { element: toast, timeout });

  return toastId;
}

/**
 * Dismiss a specific toast by ID
 * @param toastId Toast ID from showToast return
 */
export function dismissToast(toastId: string): void {
  const toastData = activeToasts.get(toastId);
  if (!toastData) return;

  const { element, timeout } = toastData;

  // Clear timeout if set
  if (timeout > 0) {
    clearTimeout(timeout);
  }

  // Animate out
  element.style.animation = 'toastSlideOut 300ms ease';
  setTimeout(() => {
    element.remove();
    activeToasts.delete(toastId);
  }, 300);
}

/**
 * Clear all active toasts
 */
export function clearAllToasts(): void {
  Array.from(activeToasts.keys()).forEach((toastId) => {
    dismissToast(toastId);
  });
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
