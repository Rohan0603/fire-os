/**
 * Form Component - Form field and form group helpers
 * Provides reusable form field creation with validation and error display
 */

export interface FormFieldDef {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'month' | 'textarea';
  value: string | number;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  required?: boolean;
}

/**
 * Create a single form field
 * @param label Field label
 * @param type Input type
 * @param value Current value
 * @param onChange Callback on change
 * @param options Additional options
 */
export function createFormField(
  label: string,
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'month' | 'textarea' = 'text',
  value: string | number = '',
  onChange?: (value: string) => void,
  options: {
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
  } = {}
): HTMLElement {
  const { placeholder = '', required = false, disabled = false } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-field-wrapper';
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  `;

  // Label
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-size: 0.9rem;
    font-weight: 500;
    color: #e0e0e0;
  `;
  if (required) {
    const required_mark = document.createElement('span');
    required_mark.textContent = ' *';
    required_mark.style.color = '#dc3545';
    labelEl.appendChild(required_mark);
  }

  // Input element
  const input = document.createElement(type === 'textarea' ? 'textarea' : 'input') as
    | HTMLInputElement
    | HTMLTextAreaElement;

  if (type !== 'textarea') {
    (input as HTMLInputElement).type = type;
  }

  input.value = String(value);
  input.placeholder = placeholder;
  input.disabled = disabled;
  input.style.cssText = `
    padding: 0.875rem 1rem;
    background: #2d2d2d;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    font-size: 1rem;
    color: #ffffff;
    font-family: inherit;
    transition: all 200ms ease;
    outline: none;
  `;

  if (type === 'textarea') {
    (input as HTMLTextAreaElement).rows = 3;
    input.style.resize = 'vertical';
  }

  input.addEventListener('focus', () => {
    input.style.background = '#333333';
    input.style.borderColor = '#ffd700';
    input.style.boxShadow = '0 0 0 3px rgba(255, 215, 0, 0.1)';
  });

  input.addEventListener('blur', () => {
    input.style.background = '#2d2d2d';
    input.style.borderColor = '#3a3a3a';
    input.style.boxShadow = 'none';
  });

  input.addEventListener('change', () => {
    if (onChange) onChange(input.value);
  });

  // Error message element
  const errorEl = document.createElement('div');
  errorEl.className = 'form-field-error';
  errorEl.style.cssText = `
    font-size: 0.8rem;
    color: #dc3545;
    min-height: 1.2rem;
    margin-top: -0.3rem;
    display: none;
  `;

  wrapper.appendChild(labelEl);
  wrapper.appendChild(input);
  wrapper.appendChild(errorEl);

  // Attach error display function
  (wrapper as any).showError = (message: string) => {
    input.style.borderColor = '#dc3545';
    input.style.background = 'rgba(220, 53, 69, 0.05)';
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  };

  (wrapper as any).clearError = () => {
    input.style.borderColor = '#3a3a3a';
    input.style.background = '#2d2d2d';
    errorEl.style.display = 'none';
  };

  (wrapper as any).getValue = () => input.value;
  (wrapper as any).setValue = (newValue: string) => {
    input.value = newValue;
  };
  (wrapper as any).getInput = () => input;

  return wrapper;
}

/**
 * Create a form group with multiple fields
 * @param fields Array of field definitions
 * @param onSubmit Optional submit callback
 */
export function createForm(
  fields: FormFieldDef[],
  onSubmit?: (values: Record<string, string>) => void
): HTMLElement {
  const form = document.createElement('div');
  form.className = 'form-group';
  form.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  `;

  const fieldElements: Record<string, HTMLElement> = {};

  // Create fields
  fields.forEach((fieldDef) => {
    const field = createFormField(
      fieldDef.label,
      fieldDef.type,
      fieldDef.value,
      fieldDef.onChange,
      {
        placeholder: fieldDef.placeholder,
        required: fieldDef.required,
      }
    );
    fieldElements[fieldDef.name] = field;
    form.appendChild(field);
  });

  // Handle Enter key to submit
  form.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && onSubmit) {
      const values: Record<string, string> = {};
      Object.entries(fieldElements).forEach(([name, el]) => {
        values[name] = (el as any).getValue();
      });
      onSubmit(values);
    }
  });

  // Attach helper methods
  (form as any).getValues = () => {
    const values: Record<string, string> = {};
    Object.entries(fieldElements).forEach(([name, el]) => {
      values[name] = (el as any).getValue();
    });
    return values;
  };

  (form as any).setValues = (values: Record<string, string>) => {
    Object.entries(values).forEach(([name, value]) => {
      if (fieldElements[name]) {
        (fieldElements[name] as any).setValue(value);
      }
    });
  };

  (form as any).getField = (name: string) => fieldElements[name];

  (form as any).clearErrors = () => {
    Object.values(fieldElements).forEach((el) => {
      if ((el as any).clearError) {
        (el as any).clearError();
      }
    });
  };

  (form as any).showFieldError = (fieldName: string, message: string) => {
    if (fieldElements[fieldName] && (fieldElements[fieldName] as any).showError) {
      (fieldElements[fieldName] as any).showError(message);
    }
  };

  return form;
}

/**
 * Display error message for a form field
 * @param fieldElement The field element (from createFormField)
 * @param error Error message
 */
export function displayFormError(fieldElement: HTMLElement, error: string): void {
  const input = fieldElement.querySelector('input, textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement;
  const errorEl = fieldElement.querySelector('.form-field-error') as HTMLElement;

  if (input && errorEl) {
    input.style.borderColor = '#dc3545';
    input.style.background = 'rgba(220, 53, 69, 0.05)';
    errorEl.textContent = error;
    errorEl.style.display = 'block';
  }
}

/**
 * Clear error message for a form field
 * @param fieldElement The field element
 */
export function clearFormError(fieldElement: HTMLElement): void {
  const input = fieldElement.querySelector('input, textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement;
  const errorEl = fieldElement.querySelector('.form-field-error') as HTMLElement;

  if (input && errorEl) {
    input.style.borderColor = '#3a3a3a';
    input.style.background = '#2d2d2d';
    errorEl.style.display = 'none';
  }
}

/**
 * Get value from a form field
 * @param fieldElement The field element
 */
export function getFormFieldValue(fieldElement: HTMLElement): string {
  const input = fieldElement.querySelector('input, textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement;
  return input ? input.value : '';
}

/**
 * Set value on a form field
 * @param fieldElement The field element
 * @param value New value
 */
export function setFormFieldValue(fieldElement: HTMLElement, value: string): void {
  const input = fieldElement.querySelector('input, textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement;
  if (input) {
    input.value = value;
  }
}
