/** Goals is the first fully-migrated route, so these specs double as the
 * contract for how a migrated route should behave: kit components, labelled
 * fields, and inline validation rather than native bubbles.
 */
test.describe('goals route', () => {
  test('empty state offers the action, not just prose', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByRole('heading', { name: 'No goals yet' })).toBeVisible();
    await page.getByRole('button', { name: 'Add your first goal' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('every field is labelled and invalid input reports inline', async ({ page }) => {
    await page.goto('/goals');
    await page.getByRole('button', { name: 'Add goal' }).click();

    const dialog = page.getByRole('dialog');
    for (const label of [
      'Goal name',
      'Goal type',
      'Target amount (₹)',
      'Target date',
      'Monthly contribution (optional)',
      'Priority',
      'Risk bucket',
    ]) {
      await expect(
        dialog.getByLabel(label, { exact: label !== 'Goal type' && label !== 'Risk bucket' }),
      ).toBeVisible();
    }

    // Submitting empty must surface persistent inline messages, not a native bubble.
    await dialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(
      dialog.getByText('Give the goal a name so you can recognise it later.'),
    ).toBeVisible();
    await expect(dialog.getByText('Enter a target above ₹10')).toBeVisible();
    await expect(dialog.getByText('Pick a target month.')).toBeVisible();
  });

  test('a saved goal renders as a data row with progress, not a prose list', async ({ page }) => {
    await page.goto('/goals');
    await page.getByRole('button', { name: 'Add goal' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Goal name').fill('Coorg house');
    await dialog.getByLabel('Target amount (₹)').fill('20000000');
    await dialog.getByLabel('Target date').fill('2035-06');
    await dialog.getByLabel('Monthly contribution (optional)').fill('50000');
    await dialog.getByRole('button', { name: 'Create goal' }).click();

    await expect(page.getByRole('heading', { name: 'No goals yet' })).toHaveCount(0);
    const row = page.getByRole('row', { name: /Coorg house/ });
    await expect(row).toBeVisible();

    // Figures render through the Indian ₹ formatter (crore above 10M), not raw
    // toLocaleString. Target and Shortfall are both ₹12Cr, so scope to the column.
    await expect(row.getByRole('cell', { name: '₹12Cr', exact: true }).first()).toBeVisible();
    await expect(row.getByRole('cell', { name: '₹10', exact: true })).toBeVisible();
    await expect(
      row.getByRole('progressbar', { name: 'Coorg house funding progress' }),
    ).toHaveAttribute('aria-valuenow', '0');
    await expect(row.getByText('Shortfall', { exact: false })).toHaveCount(0);
  });
});
