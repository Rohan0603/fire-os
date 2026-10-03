export interface ModalButton {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
}

let modalContainer: HTMLDialogElement | null = null;

export function initModalContainer(): void {
  if (modalContainer) return;

  modalContainer = document.createElement('dialog');
  modalContainer.id = 'modal-container';
  modalContainer.className = 'modal-dialog';
  modalContainer.addEventListener('click', (event) => {
    if (event.target === modalContainer) closeModal();
  });
  document.body.appendChild(modalContainer);
}

export function createModal(
  title: string,
  content: string,
  buttons: ModalButton[] = [],
): HTMLElement {
  if (!modalContainer) initModalContainer();

  const dialog = modalContainer!;
  const titleId = 'modal-title';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" type="button" aria-label="Close dialog">✕</button>
      <h2 class="modal-title" id="${titleId}"></h2>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>
  `;
  dialog.querySelector('.modal-title')!.textContent = title;
  dialog.querySelector('.modal-body')!.innerHTML = content;
  dialog.querySelector('.modal-close')!.addEventListener('click', closeModal);

  const actions = dialog.querySelector('.modal-actions')!;
  for (const definition of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = definition.label;
    button.className = `modal-button${definition.isPrimary ? ' modal-button-primary' : ''}`;
    button.addEventListener('click', definition.onClick);
    actions.appendChild(button);
  }

  if (!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLButtonElement>('.modal-close')?.focus();
  return dialog;
}

export function closeModal(): void {
  if (modalContainer?.open) modalContainer.close();
}

export function isModalVisible(): boolean {
  return modalContainer?.open ?? false;
}
