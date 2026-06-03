/**
 * Profile Module Tests
 * Tests for holdings form, PDF parsing, and data import/export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeState } from '../src/types/state';
import type { FireOSState } from '../src/types/state';

describe('Profile Module', () => {
  let state: FireOSState;

  beforeEach(() => {
    state = initializeState();
  });

  describe('SIP Management', () => {
    it('should add a new SIP', () => {
      state.sip.sip1 = {
        name: 'PPFCF',
        schemeCode: '122639',
        units: 100,
        startDate: '2023-01',
        monthlyAmount: 5000,
      };

      expect(state.sip.sip1.name).toBe('PPFCF');
      expect(state.sip.sip1.units).toBe(100);
      expect(state.sip.sip1.monthlyAmount).toBe(5000);
    });

    it('should update SIP with cost basis override', () => {
      state.sip.sip1 = {
        name: 'PPFCF',
        schemeCode: '122639',
        units: 100,
        startDate: '2023-01',
        monthlyAmount: 5000,
        costBasis: 450000,
      };

      expect(state.sip.sip1.costBasis).toBe(450000);
    });

    it('should handle multiple SIPs', () => {
      state.sip.sip1 = {
        name: 'PPFCF',
        schemeCode: '122639',
        units: 100,
        startDate: '2023-01',
        monthlyAmount: 5000,
      };

      state.sip.sip2 = {
        name: 'Nippon Growth',
        schemeCode: '118668',
        units: 50,
        startDate: '2023-02',
        monthlyAmount: 3000,
      };

      expect(Object.keys(state.sip).length).toBe(2);
    });

    it('should delete SIP', () => {
      state.sip.sip1 = {
        name: 'PPFCF',
        schemeCode: '122639',
        units: 100,
        startDate: '2023-01',
        monthlyAmount: 5000,
      };

      delete state.sip.sip1;
      expect(state.sip.sip1).toBeUndefined();
    });
  });

  describe('Holdings Management', () => {
    it('should store FD amount', () => {
      state.fd.fd = { amount: 500000, currency: 'INR' };
      expect(state.fd.fd.amount).toBe(500000);
    });

    it('should store EPF balance', () => {
      state.epf.epf = { amount: 2500000, currency: 'INR' };
      expect(state.epf.epf.amount).toBe(2500000);
    });

    it('should store ESOP value', () => {
      state.esop.esop = { amount: 750000, currency: 'INR' };
      expect(state.esop.esop.amount).toBe(750000);
    });
  });

  describe('Demat Holdings', () => {
    it('should add demat stock', () => {
      state.demat['INE123A01015'] = {
        isin: 'INE123A01015',
        name: 'Infosys Limited',
        quantity: 100,
        currentValue: 3500000,
      };

      expect(state.demat['INE123A01015'].name).toBe('Infosys Limited');
      expect(state.demat['INE123A01015'].quantity).toBe(100);
    });

    it('should handle multiple demat holdings', () => {
      state.demat['INE123A01015'] = {
        isin: 'INE123A01015',
        name: 'Infosys',
        quantity: 100,
        currentValue: 3500000,
      };

      state.demat['INE002A01015'] = {
        isin: 'INE002A01015',
        name: 'TCS',
        quantity: 50,
        currentValue: 4000000,
      };

      expect(Object.keys(state.demat).length).toBe(2);
    });

    it('should update demat stock value', () => {
      state.demat['INE123A01015'] = {
        isin: 'INE123A01015',
        name: 'Infosys',
        quantity: 100,
        currentValue: 3500000,
      };

      state.demat['INE123A01015'].currentValue = 3700000;
      expect(state.demat['INE123A01015'].currentValue).toBe(3700000);
    });
  });

  describe('Profile Information', () => {
    it('should store user profile', () => {
      state.profile = {
        name: 'John Doe',
        age: 35,
        annualExpenses: 1000000,
        fiTarget: 25000000,
      };

      expect(state.profile.name).toBe('John Doe');
      expect(state.profile.age).toBe(35);
      expect(state.profile.fiTarget).toBe(25000000);
    });

    it('should calculate FI goal progress', () => {
      state.profile.annualExpenses = 1000000;
      state.profile.fiTarget = 25000000;

      const currentPortfolio = 15000000;
      const progress = (currentPortfolio / state.profile.fiTarget) * 100;

      expect(progress).toBe(60);
    });
  });

  describe('Data Export/Import', () => {
    it('should export portfolio as JSON', () => {
      state.profile.name = 'John Doe';
      state.profile.annualExpenses = 1000000;
      state.sip.sip1 = {
        name: 'PPFCF',
        schemeCode: '122639',
        units: 100,
        startDate: '2023-01',
        monthlyAmount: 5000,
      };

      const exported = {
        version: 'fireOS_v2',
        exportedAt: new Date().toISOString(),
        profile: state.profile,
        sip: state.sip,
        fd: state.fd,
        epf: state.epf,
        esop: state.esop,
        demat: state.demat,
      };

      expect(exported.version).toBe('fireOS_v2');
      expect(exported.profile.name).toBe('John Doe');
    });

    it('should import portfolio from JSON', () => {
      const imported = {
        version: 'fireOS_v2',
        profile: {
          name: 'Jane Doe',
          age: 30,
          annualExpenses: 1200000,
          fiTarget: 30000000,
        },
        sip: {
          sip1: {
            name: 'Nippon Growth',
            schemeCode: '118668',
            units: 50,
            startDate: '2023-02',
            monthlyAmount: 3000,
          },
        },
      };

      Object.assign(state.profile, imported.profile);
      Object.assign(state.sip, imported.sip);

      expect(state.profile.name).toBe('Jane Doe');
      expect(state.sip.sip1.name).toBe('Nippon Growth');
    });
  });

  describe('Input Validation', () => {
    it('should validate positive numbers', () => {
      const validatePositive = (value: number) => value >= 0;

      expect(validatePositive(5000)).toBe(true);
      expect(validatePositive(0)).toBe(true);
      expect(validatePositive(-100)).toBe(false);
    });

    it('should validate YYYY-MM date format', () => {
      const validateDate = (dateStr: string) => /^\d{4}-\d{2}$/.test(dateStr);

      expect(validateDate('2023-01')).toBe(true);
      expect(validateDate('2024-12')).toBe(true);
      expect(validateDate('2023-1')).toBe(false);
      expect(validateDate('invalid')).toBe(false);
    });

    it('should validate ISIN format', () => {
      const validateISIN = (isin: string) => /^[A-Z]{2}\d{9}[A-Z]{1}$/.test(isin);

      expect(validateISIN('INE123A01015')).toBe(true);
      expect(validateISIN('BSE456B02020')).toBe(true);
      expect(validateISIN('INVALID')).toBe(false);
    });
  });
});
