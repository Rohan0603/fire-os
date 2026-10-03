import { expect, test, type Page } from '@playwright/test';

const CONSENT_FLAGS = [
  'readPortfolio',
  'suggestChanges',
  'applyChanges',
  'sendExactBalances',
] as const;

function consentBox(page: Page, flag: string) {
  return page.locator(`input[data-consent="${flag}"]`);
}

async function enableReadAndSuggest(page: Page): Promise<void> {
  await consentBox(page, 'readPortfolio').check();
  await consentBox(page, 'suggestChanges').check();
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
  await page.locator('#question-input').fill(text);
  await page.locator('#send-question').click();
}

async function readAnonymousState(page: Page): Promise<Record<string, unknown> | null> {
  const raw = await page.evaluate(() => localStorage.getItem('fireOS_v2:anonymous'));
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

test('consent starts all-off and readPortfolio gates the chat panel', async ({ page }) => {
  await page.goto('/assistant');

  await expect(page.locator('.assistant-consent')).toBeVisible();
  await expect(page.locator('input[data-consent]')).toHaveCount(4);
  for (const flag of CONSENT_FLAGS) {
    await expect(consentBox(page, flag)).not.toBeChecked();
  }

  await expect(page.locator('.assistant-chat')).toBeHidden();
  await expect(page.locator('.consent-note')).toBeVisible();
  await expect(page.locator('#assistant-audit')).toBeHidden();

  await consentBox(page, 'readPortfolio').check();
  await expect(page.locator('.assistant-chat')).toBeVisible();
  await expect(page.locator('.consent-note')).toBeHidden();

  await consentBox(page, 'readPortfolio').uncheck();
  await expect(page.locator('.assistant-chat')).toBeHidden();

  await consentBox(page, 'readPortfolio').check();
  await page.reload();
  await expect(consentBox(page, 'readPortfolio')).toBeChecked();
  await expect(consentBox(page, 'suggestChanges')).not.toBeChecked();
  await expect(page.locator('.assistant-chat')).toBeVisible();
});

test('read-only query renders the reply and a proposal diff', async ({ page }) => {
  await mockQuery(page, {
    reply: 'Consider raising your FI target to build a buffer.',
    proposedChanges: { profile: { fiTarget: 500000 } },
  });
  await page.goto('/assistant');
  await enableReadAndSuggest(page);

  await askQuestion(page, 'Bump my FI target');
  await expect(page.locator('.assistant-reply')).toContainText('Consider raising your FI target');
  await expect(page.locator('.assistant-proposal')).toBeVisible();
  await expect(page.locator('.assistant-proposal-summary')).toContainText('1 field');
  await expect(page.locator('.assistant-proposal-diff code').first()).toContainText(
    'profile.fiTarget',
  );
  await expect(page.locator('.diff-after').first()).toContainText('5,00,000');
  await expect(page.locator('.btn-confirm')).toBeEnabled();
  await expect(page.locator('.btn-reject')).toBeEnabled();
});

test('rejecting a proposal changes nothing and records a local audit entry', async ({ page }) => {
  await mockQuery(page, {
    reply: 'Proposal attached.',
    proposedChanges: { profile: { fiTarget: 500000 } },
  });
  await page.goto('/assistant');
  await enableReadAndSuggest(page);

  await askQuestion(page, 'Bump my FI target');
  await expect(page.locator('.assistant-proposal')).toBeVisible();
  await page.locator('.btn-reject').click();

  await expect(page.locator('.assistant-note')).toContainText('Proposal rejected');
  await expect(page.locator('#assistant-audit')).toBeVisible();
  await expect(page.locator('.audit-badge').first()).toContainText('rejected');
  await expect(page.locator('#undo-assistant-btn')).toBeDisabled();

  const state = await readAnonymousState(page);
  if (state?.profile) {
    expect((state.profile as Record<string, unknown>).fiTarget).toBe(0);
  }
});

test('confirming a non-destructive proposal persists locally and undo restores it', async ({
  page,
}) => {
  await mockQuery(page, {
    reply: 'Proposal attached.',
    proposedChanges: { profile: { fiTarget: 500000 } },
  });
  await page.goto('/assistant');
  await enableReadAndSuggest(page);

  await askQuestion(page, 'Set my FI target to 5 lakhs');
  await expect(page.locator('.assistant-proposal')).toBeVisible();
  await page.locator('.btn-confirm').click();

  await expect(page.locator('.assistant-success')).toContainText('saved locally');
  await expect
    .poll(async () => {
      const state = await readAnonymousState(page);
      return (state?.profile as Record<string, unknown> | undefined)?.fiTarget;
    })
    .toBe(500000);

  await expect(page.locator('.audit-badge').first()).toContainText('confirmed');
  await expect(page.locator('#undo-assistant-btn')).toBeEnabled();

  await page.locator('#undo-assistant-btn').click();
  await expect
    .poll(async () => {
      const state = await readAnonymousState(page);
      return (state?.profile as Record<string, unknown> | undefined)?.fiTarget;
    })
    .toBe(0);
});

test('destructive proposals require a typed confirmation for guests', async ({ page }) => {
  await mockQuery(page, {
    reply: 'Proposal attached.',
    proposedChanges: { profile: { fiTarget: 2000000 } },
  });
  await page.goto('/assistant');
  await enableReadAndSuggest(page);

  await askQuestion(page, 'Set my FI target to 20 lakhs');
  await expect(page.locator('.assistant-proposal')).toBeVisible();
  await expect(page.locator('.assistant-proposal-warning')).toContainText(
    'Re-authentication required',
  );

  await page.locator('.btn-confirm').click();
  await expect(page.getByRole('heading', { name: 'Confirm destructive change' })).toBeVisible();

  // Wrong phrase keeps the proposal but logs the attempt
  await page.locator('#reauth-phrase').fill('nope');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.audit-badge').first()).toContainText('reauth-required');
  await expect(page.locator('.btn-confirm')).toBeEnabled();

  // Correct phrase applies the change
  await page.locator('.btn-confirm').click();
  await page.locator('#reauth-phrase').fill('CONFIRM');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(page.locator('.assistant-success')).toBeVisible();
  await expect
    .poll(async () => {
      const state = await readAnonymousState(page);
      return (state?.profile as Record<string, unknown> | undefined)?.fiTarget;
    })
    .toBe(2000000);
});

test('assistant request failures surface an inline error', async ({ page }) => {
  await mockQuery(page, { error: 'Assistant unavailable' }, 500);
  await page.goto('/assistant');
  await consentBox(page, 'readPortfolio').check();

  await askQuestion(page, 'Hello?');
  await expect(page.locator('.assistant-error')).toContainText('Assistant unavailable');
  await expect(page.locator('.assistant-reply')).toHaveCount(0);
  await expect(page.locator('.assistant-proposal')).toHaveCount(0);
});
