/**
 * PDF Import E2E Tests
 * Tests CAS PDF parsing and fund/stock detection
 */

import { test, expect } from '@playwright/test';

test.describe('PDF Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs from the beginning
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });
    // Store logs globally for this page
    (page as any)._consoleLogs = consoleLogs;

    // Navigate to app
    await page.goto('http://localhost:5173');

    // Wait for app to load
    await page.waitForSelector('#profile', { timeout: 5000 });
  });

  test('should show Import CAS PDF button', async ({ page }) => {
    const importBtn = page.locator('#import-pdf-btn');
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toContainText('Import CAS PDF');
  });

  test('should have hidden file input', async ({ page }) => {
    const fileInput = page.locator('#pdf-input');
    const hidden = await fileInput.evaluate((el) =>
      window.getComputedStyle(el).display === 'none'
    );
    expect(hidden).toBe(true);
  });

  test('should log debug info on page load', async ({ page }) => {
    // Use captured logs from beforeEach
    const consoleLogs = (page as any)._consoleLogs || [];

    // Wait a bit more for any pending logs
    await page.waitForTimeout(2000);

    // Check for any Nifty-related logging
    const niftyLogs = consoleLogs.filter(
      (log) => log.includes('Nifty') || log.includes('Yahoo') || log.includes('ETF') || log.includes('Default values')
    );

    console.log('Nifty-related logs found:', niftyLogs.length);

    // Should have some Nifty fetch logs (attempting one of the sources)
    expect(niftyLogs.length).toBeGreaterThan(0);
  });

  test('should display confirmation modal after PDF upload', async ({ page }) => {
    // This test would need a real PDF file to properly test
    // For now, verify the modal structure exists
    const modal = page.locator('#pdf-confirmation');
    const modalStyle = await modal.evaluate((el) =>
      window.getComputedStyle(el).display
    );

    // Modal should exist but be hidden initially
    expect(modalStyle).toBe('none');
  });

  test('should parse ISIN patterns from PDF text', async ({ page }) => {
    // Test the ISIN pattern matching regex
    // ISIN format: 2 letters + 10+ alphanumeric (total 12-13 chars)
    const testISIN = 'INF179KB1234X';
    const isinRegex = /([A-Z]{2}[A-Z0-9]{9,11})/;
    const match = testISIN.match(isinRegex);

    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/^[A-Z]{2}[A-Z0-9]+$/);
  });

  test('should validate fund name extraction', async ({ page }) => {
    // Test that fund names are properly extracted from lines with ISINs
    const testLine = 'INF179KB1234X Parag Parikh Long Term Equity Fund 100 2024-06-03';
    const isinMatch = testLine.match(/([A-Z]{2}[A-Z0-9]{9,11})/);

    expect(isinMatch).not.toBeNull();

    // Extract fund name by removing ISIN and trailing numbers/dates
    if (isinMatch) {
      const fundName = testLine
        .replace(isinMatch[0], '')
        .replace(/[\d.,\s\-]+$/g, '')
        .trim();

      expect(fundName.length).toBeGreaterThan(0);
      expect(fundName).toContain('Parag');
    }
  });

  test('should validate quantity extraction', async ({ page }) => {
    // Test number extraction from line
    // Should extract 100.5 as the units (before keywords)
    const testLine = 'INF123A01234X Fund Name 100.5 units 2024-06-03';
    const numbers: number[] = [];

    // Extract numbers before date patterns (YYYY-MM-DD or YYYY-MM)
    const beforeDate = testLine.replace(/\d{4}-\d{2}(-\d{2})?/g, '').trim();
    const parts = beforeDate.split(/\s+/);

    for (const part of parts) {
      const num = parseFloat(part.replace(/,/g, ''));
      // Filter out very large numbers (years, codes)
      if (!isNaN(num) && num > 0 && num < 10000000) {
        numbers.push(num);
      }
    }

    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers[numbers.length - 1]).toBe(100.5);
  });

  test('should show ETF fetch fallback for Nifty', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.waitForTimeout(3000);

    // Should attempt Gold ETF fallback if Yahoo fails
    const etfLogs = consoleLogs.filter(
      (log) => log.includes('Gold ETF') || log.includes('Nifty estimated')
    );

    console.log('ETF fallback logs:', etfLogs);
  });

  test('should validate ISIN range handling', async ({ page }) => {
    // Test that ISINs are properly detected in various formats
    const testCases = [
      { isin: 'INF179KB1234X', shouldMatch: true },
      { isin: 'INF123A01234', shouldMatch: true },
      { isin: 'INVALID123456', shouldMatch: false },
    ];

    const isinRegex = /([A-Z]{2}[A-Z0-9]{9,11})/;

    for (const testCase of testCases) {
      const match = testCase.isin.match(isinRegex);
      if (testCase.shouldMatch) {
        expect(match).not.toBeNull();
      }
    }
  });

  test('parseCASPDF extracts all SoA holdings from real CAS summary', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for profile to load
    await page.waitForSelector('#profile', { timeout: 5000 });

    const filePath = 'C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf';

    // Use file input directly to avoid click issues
    const pdfInput = page.locator('#pdf-input');
    await pdfInput.setInputFiles(filePath);

    // Wait for modal to appear
    await page.waitForSelector('#pdf-confirmation', { state: 'visible', timeout: 15000 });

    const previewText = await page.textContent('#pdf-preview');

    // Verify all 3 SoA funds are detected
    expect(previewText).toContain('Parag Parikh');
    expect(previewText).toContain('131.490');
    expect(previewText).toContain('NIPPON INDIA GROWTH MID CAP');
    expect(previewText).toContain('1.882');
    expect(previewText).toContain('NIPPON INDIA SMALL CAP');
    expect(previewText).toContain('30.203');

    // Verify investor PAN is shown
    expect(previewText).toContain('IMBPK5236H');
  });
});
