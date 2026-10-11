import { expect, test, type Page } from '@playwright/test';

const E2E_REQUIRED = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;

async function enableWrites(page: Page): Promise<void> {
  await page.locator('#assistant-write-consent').click();
}

function mockQuery(page: Page, body: Record<string, unknown>, status = 200): Promise<void> {
  return page.route('**/api/assistant/query', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

async function askQuestion(page: Page, text: string): Promise<void> {
  await page.locator('deep-chat').evaluate((element, message) => {
    (
      element as HTMLElement & { submitUserMessage: (value: { text: string }) => void }
    ).submitUserMessage({ text: message });
  }, text);
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#auth-screen-root')).toBeVisible();
  await page.locator('#login-email').fill(process.env.E2E_EMAIL!);
  await page.locator('#login-password').fill(process.env.E2E_PASSWORD!);
  await page.locator('#login-submit').click();
  await expect(page.locator('#auth-screen-root')).toBeHidden({ timeout: 20_000 });
}

/**
 * Transition to the assistant inside the SPA. A full reload re-boots Firebase
 * auth asynchronously, and a question asked before session restore completes
 * would hit the sign-in gate; a client-side route change keeps the live session.
 */
async function goToAssistant(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Assistant' }).click();
  await expect(page.locator('#assistant.active')).toBeVisible();
}

// Each test gets a fresh browser context, so exactly one user-scoped key exists.
async function readPersistedState(page: Page): Promise<Record<string, unknown> | null> {
  const raw = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^fireOS_v2:user:[^:]+$/.test(k));
    return key ? localStorage.getItem(key) : null;
  });
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

async function persistedFiTarget(page: Page): Promise<number | undefined> {
  const state = await readPersistedState(page);
  return (state?.profile as Record<string, unknown> | undefined)?.fiTarget as number | undefined;
}

test('consent enables reads by default and keeps writes opt-in', async ({ page }) => {
  await page.goto('/assistant');

  await expect(page.locator('.assistant-consent')).toBeVisible();
  await expect(page.locator('#assistant-write-consent')).toContainText('Agree to write access');
  await expect(page.locator('.assistant-chat')).toBeVisible();
  await expect(page.locator('#assistant-audit')).toBeHidden();

  await enableWrites(page);
  await page.reload();
  await expect(page.locator('#assistant-write-consent')).toContainText('Revoke write access');
  await expect(page.locator('.assistant-chat')).toBeVisible();
});

test('signed-out users get a sign-in prompt and no request is sent', async ({ page }) => {
  let queryRequests = 0;
  await page.route('**/api/assistant/query', (route) => {
    queryRequests += 1;
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/assistant');

  await askQuestion(page, 'Hello?');

  await expect(page.locator('.assistant-error')).toContainText('Please sign in');
  expect(queryRequests).toBe(0);
});

test.describe('signed-in assistant flows', () => {
  test.skip(!E2E_REQUIRED, 'E2E credentials not configured');

  test('read-only query renders the reply and a proposal diff', async ({ page }) => {
    await mockQuery(page, {
      reply: 'Consider raising your FI target to build a buffer.',
      proposedChanges: { profile: { fiTarget: 500000 } },
    });
    await signIn(page);
    await goToAssistant(page);
    await enableWrites(page);

    await askQuestion(page, 'Bump my FI target');
    await expect(
      page.locator('deep-chat').getByText('Consider raising your FI target'),
    ).toBeVisible();
    await expect(page.locator('.assistant-proposal')).toBeVisible();
    await expect(page.locator('.assistant-proposal-summary')).toContainText('1 field');
    await expect(page.locator('.assistant-proposal-diff code').first()).toContainText(
      'profile.fiTarget',
    );
    await expect(page.locator('.diff-after').first()).toContainText('5,00,000');
    await expect(page.locator('.assistant-proposal-assumptions-title')).toHaveText('Assumptions');
    await expect(page.locator('.assistant-proposal-assumptions-list dt')).toHaveCount(7);
    await expect(page.locator('.assistant-proposal-assumptions-list')).toContainText('FI target');
    await expect(page.locator('.btn-confirm')).toBeEnabled();
    await expect(page.locator('.btn-reject')).toBeEnabled();
  });

  test('rejecting a proposal records an audit entry and changes no persisted value', async ({
    page,
  }) => {
    await mockQuery(page, {
      reply: 'Proposal attached.',
      proposedChanges: { profile: { fiTarget: 500000 } },
    });
    await signIn(page);
    await goToAssistant(page);
    await enableWrites(page);

    const before = await persistedFiTarget(page);

    await askQuestion(page, 'Bump my FI target');
    await expect(page.locator('.assistant-proposal')).toBeVisible();
    await page.locator('.btn-reject').click();

    await expect(page.locator('.assistant-note')).toContainText('Proposal rejected');
    await expect(page.locator('#assistant-audit')).toBeVisible();
    await expect(page.locator('.audit-badge').first()).toContainText('rejected');
    await expect(page.locator('#undo-assistant-btn')).toBeDisabled();

    expect(await persistedFiTarget(page)).toBe(before);
  });

  test('assistant request failures surface an inline error', async ({ page }) => {
    await mockQuery(page, { error: 'Assistant unavailable' }, 500);
    await signIn(page);
    await goToAssistant(page);

    await askQuestion(page, 'Hello?');
    await expect(page.locator('.assistant-error')).toContainText('Assistant unavailable');
    await expect(page.locator('deep-chat').getByText('Assistant unavailable')).toHaveCount(0);
    await expect(page.locator('.assistant-proposal')).toHaveCount(0);
  });
});
