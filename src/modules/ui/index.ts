/**
 * UI Module - Shared UI Components
 * Exports Modal, Card, Form, and Toast components for use across the app
 */

// Import all styles
import './styles.css';

// Export all components
export {
  createModal,
  closeModal,
  isModalVisible,
  initModalContainer,
  type ModalButton,
} from './Modal';

export {
  createCard,
  createMetricCard,
  type CardMetric,
} from './Card';

export {
  createFormField,
  createForm,
  displayFormError,
  clearFormError,
  getFormFieldValue,
  setFormFieldValue,
  type FormFieldDef,
} from './Form';

export {
  showToast,
  dismissToast,
  clearAllToasts,
  initToastContainer,
  type ToastType,
} from './Toast';

/**
 * Initialize the UI module
 * Call this once from main.ts to set up modal and toast containers
 */
export function initUIModule(): void {
  const { initModalContainer } = require('./Modal');
  const { initToastContainer } = require('./Toast');

  initModalContainer();
  initToastContainer();
}
