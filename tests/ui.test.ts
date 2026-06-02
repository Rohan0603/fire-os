/**
 * UI Components Test Suite
 * Tests Modal, Card, Form, and Toast components
 */

import { test, expect } from '@playwright/test';
import {
  createModal,
  closeModal,
  isModalVisible,
  initModalContainer,
} from '../src/modules/ui/Modal';
import { createCard, createMetricCard } from '../src/modules/ui/Card';
import {
  createFormField,
  createForm,
  displayFormError,
  clearFormError,
} from '../src/modules/ui/Form';
import { showToast, dismissToast, clearAllToasts, initToastContainer } from '../src/modules/ui/Toast';

// Modal Component Tests
test('Modal: should initialize modal container', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('modal-container');
  if (container) container.remove();

  initModalContainer();
  const newContainer = document.getElementById('modal-container');
  expect(newContainer).toBeTruthy();
});

test('Modal: should create and display modal', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('modal-container');
  if (container) container.remove();

  initModalContainer();
  const modal = createModal('Test Modal', 'This is test content', [
    { label: 'OK', onClick: () => {}, isPrimary: true },
  ]);

  expect(modal).toBeTruthy();
  expect(modal.textContent).toContain('Test Modal');
  expect(modal.textContent).toContain('This is test content');
  expect(isModalVisible()).toBe(true);
});

test('Modal: should close modal on button click', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('modal-container');
  if (container) container.remove();

  initModalContainer();
  createModal('Test', 'Content', []);

  expect(isModalVisible()).toBe(true);

  closeModal();
  expect(isModalVisible()).toBe(false);
});

test('Modal: should close modal on Escape key', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('modal-container');
  if (container) container.remove();

  initModalContainer();
  createModal('Test', 'Content', []);

  expect(isModalVisible()).toBe(true);

  const event = new KeyboardEvent('keydown', { key: 'Escape' });
  document.dispatchEvent(event);

  expect(isModalVisible()).toBe(false);
});

// Card Component Tests
test('Card: should create card with title and metrics', () => {
  document.body.innerHTML = '';

  const card = createCard('Portfolio', {
    'Total Value': '₹10,00,000',
    'P&L': '₹1,50,000',
  });

  expect(card).toBeTruthy();
  expect(card.textContent).toContain('Portfolio');
  expect(card.textContent).toContain('Total Value');
});

test('Card: should create metric card with value', () => {
  document.body.innerHTML = '';

  const card = createMetricCard('Net Worth', '₹50,00,000', 'As of today');

  expect(card).toBeTruthy();
  expect(card.textContent).toContain('Net Worth');
  expect(card.textContent).toContain('₹50,00,000');
  expect(card.textContent).toContain('As of today');
});

test('Card: should apply accent color to card', () => {
  document.body.innerHTML = '';

  const card = createCard('Test', { value: '100' }, { accentColor: '#ff0000' });

  expect(card.style.borderColor).toBeTruthy();
});

// Form Component Tests
test('Form: should create form field', () => {
  document.body.innerHTML = '';

  const field = createFormField('Email', 'email', 'test@example.com');

  expect(field).toBeTruthy();
  expect(field.textContent).toContain('Email');

  const input = field.querySelector('input') as HTMLInputElement;
  expect(input.type).toBe('email');
  expect(input.value).toBe('test@example.com');
});

test('Form: should create form with multiple fields', () => {
  document.body.innerHTML = '';

  const form = createForm([
    { name: 'email', label: 'Email', type: 'email', value: '' },
    { name: 'password', label: 'Password', type: 'password', value: '' },
  ]);

  expect(form).toBeTruthy();
  expect(form.textContent).toContain('Email');
  expect(form.textContent).toContain('Password');
});

test('Form: should display form error', () => {
  document.body.innerHTML = '';

  const field = createFormField('Name', 'text', 'John');
  const input = field.querySelector('input') as HTMLInputElement;

  displayFormError(field, 'This field is required');

  const errorEl = field.querySelector('.form-field-error') as HTMLElement;
  expect(errorEl.textContent).toBe('This field is required');
  expect(errorEl.style.display).not.toBe('none');
  expect(input.style.borderColor).toBeTruthy();
});

test('Form: should clear form error', () => {
  document.body.innerHTML = '';

  const field = createFormField('Name', 'text', 'John');

  displayFormError(field, 'Error message');
  clearFormError(field);

  const errorEl = field.querySelector('.form-field-error') as HTMLElement;
  expect(errorEl.style.display).toBe('none');
});

test('Form: should get form values', () => {
  document.body.innerHTML = '';

  const form = createForm([
    { name: 'email', label: 'Email', type: 'email', value: 'test@example.com' },
    { name: 'username', label: 'Username', type: 'text', value: 'testuser' },
  ]) as any;

  const values = form.getValues();
  expect(values.email).toBe('test@example.com');
  expect(values.username).toBe('testuser');
});

test('Form: should set form values', () => {
  document.body.innerHTML = '';

  const form = createForm([
    { name: 'email', label: 'Email', type: 'email', value: '' },
  ]) as any;

  form.setValues({ email: 'new@example.com' });

  const values = form.getValues();
  expect(values.email).toBe('new@example.com');
});

// Toast Component Tests
test('Toast: should initialize toast container', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();
  const newContainer = document.getElementById('toast-container');
  expect(newContainer).toBeTruthy();
});

test('Toast: should show success toast', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();
  const toastId = showToast('Success message', 5000, 'success');

  expect(toastId).toBeTruthy();
  const toast = document.getElementById(toastId);
  expect(toast).toBeTruthy();
  expect(toast?.textContent).toContain('Success message');
});

test('Toast: should show error toast', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();
  const toastId = showToast('Error occurred', 5000, 'error');

  const toast = document.getElementById(toastId);
  expect(toast?.textContent).toContain('Error occurred');
});

test('Toast: should show warning toast', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();
  const toastId = showToast('Warning', 5000, 'warning');

  const toast = document.getElementById(toastId);
  expect(toast).toBeTruthy();
});

test('Toast: should show info toast', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();
  const toastId = showToast('Info message', 5000, 'info');

  const toast = document.getElementById(toastId);
  expect(toast).toBeTruthy();
});

test('Toast: should stack multiple toasts', () => {
  document.body.innerHTML = '';
  const container = document.getElementById('toast-container');
  if (container) container.remove();

  initToastContainer();

  const id1 = showToast('Toast 1', 5000, 'success');
  const id2 = showToast('Toast 2', 5000, 'error');
  const id3 = showToast('Toast 3', 5000, 'warning');

  const toast1 = document.getElementById(id1);
  const toast2 = document.getElementById(id2);
  const toast3 = document.getElementById(id3);

  expect(toast1).toBeTruthy();
  expect(toast2).toBeTruthy();
  expect(toast3).toBeTruthy();

  clearAllToasts();
});
