import { expect, test, type Page } from '@playwright/test';

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

async function readAnonymousState(page: Page): Promise<Record<string, unknown> | null> {
  const raw = await page.evaluate(() => localStorage.getItem('fireOS_v2:anonymous'));
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
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

test('read-only query renders the reply and a proposal diff', async ({ page }) => {
  await mockQuery(page, {
    reply: 'Consider raising your FI target to build a buffer.',
    proposedChanges: { profile: { fiTarget: 500000 } },
  });
  await page.goto('/assistant');
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
  await expect(page.locator('.btn-confirm')).toBeEnabled();
  await expect(page.locator('.btn-reject')).toBeEnabled();
});

test('rejecting a proposal changes nothing and records a local audit entry', async ({ page }) => {
  await mockQuery(page, {
    reply: 'Proposal attached.',
    proposedChanges: { profile: { fiTarget: 500000 } },
  });
  await page.goto('/assistant');
  await enableWrites(page);

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
  await enableWrites(page);

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
  await enableWrites(page);

  await askQuestion(page, 'Set my FI target to 20 lakhs');
  await expect(page.locator('.assistant-proposal')).toBeVisible();
  await expect(page.locator('.assistant-proposal-warning')).toContainText(
    'Re-authentication required',
  );

  await page.locator('.btn-confirm').click();
  await expect(page.locator('.modal h2')).toContainText('Confirm destructive change');

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
  await askQuestion(page, 'Hello?');
  await expect(page.locator('.assistant-error')).toContainText('Assistant unavailable');
  await expect(page.locator('deep-chat').getByText('Assistant unavailable')).toHaveCount(0);
  await expect(page.locator('.assistant-proposal')).toHaveCount(0);
});
