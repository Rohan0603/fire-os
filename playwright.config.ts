import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const e2eEnvKeys = new Set(['E2E_EMAIL', 'E2E_PASSWORD']);
const envFilePath = new URL('./.env', import.meta.url);

if (existsSync(envFilePath)) {
  for (const line of readFileSync(envFilePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || !e2eEnvKeys.has(match[1]) || process.env[match[1]] !== undefined) {
      continue;
    }

    const rawValue = match[2];
    process.env[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

const requestedChannel = process.env.PLAYWRIGHT_CHANNEL;
const browserChannel =
  requestedChannel === 'chromium'
    ? undefined
    : (requestedChannel ?? (process.platform === 'win32' ? 'chrome' : undefined));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
      },
    },
  ],
});
