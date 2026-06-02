/**
 * Modal Component - Generic modal overlay
 * Provides a reusable modal dialog with title, content, and actions
 */

export interface ModalButton {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
}

let modalContainer: HTMLElement | null = null;
let isModalOpen = false;

/**
 * Initialize modal container (called once on app startup)
 */
export function initModalContainer(): void {
  if (modalContainer) return;

  modalContainer = document.createElement('div');
  modalContainer.id = 'modal-container';
  modalContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;
  document.body.appendChild(modalContainer);

  // Close on background click
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen) {
      closeModal();
    }
  });
}

/**
 * Create and display a modal
 * @param title Modal title
 * @param content HTML content or plain text
 * @param buttons Array of button definitions
 */
export function createModal(
  title: string,
  content: string,
  buttons: ModalButton[] = []
): HTMLElement {
  if (!modalContainer) {
    initModalContainer();
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    background: #242424;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    border: 1px solid #3a3a3a;
    animation: modalSlideIn 300ms ease;
  `;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: #a0a0a0;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 200ms ease;
  `;
  closeBtn.onmouseover = () => (closeBtn.style.color = '#ffd700');
  closeBtn.onmouseout = () => (closeBtn.style.color = '#a0a0a0');
  closeBtn.addEventListener('click', closeModal);

  // Title
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    color: #ffffff;
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  `;

  // Content
  const contentEl = document.createElement('div');
  contentEl.innerHTML = content;
  contentEl.style.cssText = `
    color: #d0d0d0;
    margin-bottom: 2rem;
    line-height: 1.6;
    font-size: 0.95rem;
  `;

  // Buttons container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  `;

  // Create buttons
  buttons.forEach((btnDef) => {
    const btn = document.createElement('button');
    btn.textContent = btnDef.label;
    btn.style.cssText = `
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 200ms ease;
      font-size: 0.95rem;
      ${
        btnDef.isPrimary
          ? `
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        color: #1a1a1a;
      `
          : `
        background: #333333;
        color: #ffffff;
        border: 1px solid #3a3a3a;
      `
      }
    `;

    btn.addEventListener('click', () => {
      btnDef.onClick();
    });

    btn.addEventListener('mouseenter', () => {
      if (btnDef.isPrimary) {
        btn.style.boxShadow = '0 8px 20px rgba(255, 215, 0, 0.3)';
        btn.style.transform = 'translateY(-2px)';
      } else {
        btn.style.background = '#3a3a3a';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (btnDef.isPrimary) {
        btn.style.boxShadow = 'none';
        btn.style.transform = 'translateY(0)';
      } else {
        btn.style.background = '#333333';
      }
    });

    buttonContainer.appendChild(btn);
  });

  // Assemble modal
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    position: relative;
  `;
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(titleEl);
  modalContent.appendChild(contentEl);
  modalContent.appendChild(buttonContainer);

  modal.appendChild(modalContent);
  modalContainer!.innerHTML = '';
  modalContainer!.appendChild(modal);

  // Show modal
  modalContainer!.style.display = 'flex';
  isModalOpen = true;

  return modal;
}

/**
 * Close the modal
 */
export function closeModal(): void {
  if (modalContainer) {
    modalContainer.style.display = 'none';
    isModalOpen = false;
  }
}

/**
 * Check if modal is currently open
 */
export function isModalVisible(): boolean {
  return isModalOpen;
}
