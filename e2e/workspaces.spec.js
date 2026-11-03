import { test, expect } from './support/mock-api';

async function openCreateDialog(page) {
  await page.goto('/workspaces');
  await page.getByRole('button', { name: 'Create Workspace' }).first().click();
  const dialog = page.locator('.v-dialog .v-card');
  await expect(dialog.getByLabel('Workspace Title')).toBeVisible();
  return dialog;
}

async function selectPfs(page, dialog, id) {
  await dialog.locator('.v-select').filter({ hasText: 'Product Format Specification' }).click();
  await page
    .locator('.v-overlay .v-list-item')
    .filter({ hasText: `${id}:` })
    .click();
  await page.keyboard.press('Escape');
}

test.describe('Workspaces', () => {
  test('lists the workspaces with their PFS', async ({ page, api }) => {
    await page.goto('/workspaces');

    await expect(page.locator('h1')).toHaveText('My PFS Workspaces');
    const card = page.locator('.v-card').filter({ hasText: 'NRB review' });
    await expect(card).toBeVisible();
    await expect(card.locator('.v-chip').filter({ hasText: /^NRB$/ })).toBeVisible();

    api.workspaces[0].pfs = null;
    await page.reload();
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review' })).toContainText(
      'No PFS assigned',
    );
  });

  test('creating a workspace requires a PFS', async ({ page, api }) => {
    const dialog = await openCreateDialog(page);

    await dialog.getByLabel('Workspace Title').fill('SR review');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByText('Select at least one PFS')).toBeVisible();
    expect(api.requests.some((r) => r.method === 'POST' && r.path === '/workspaces')).toBe(false);

    await selectPfs(page, dialog, 'SR');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces');
    expect(JSON.parse(post.body)).toEqual({ title: 'SR review', description: null, pfs: ['SR'] });
    await expect(
      page.getByText('Workspace created successfully in your CEOS-ARD repository jdoe/ceos-ard'),
    ).toBeVisible();
  });

  test('the first workspace discloses the CEOS-ARD fork', async ({ page, api }) => {
    api.workspaces = [];
    const dialog = await openCreateDialog(page);

    await expect(dialog).toContainText(
      'Creating your first workspace also creates a copy (fork) of the CEOS-ARD repository',
    );

    await dialog.getByLabel('Workspace Title').fill('First workspace');
    await selectPfs(page, dialog, 'NRB');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page.locator('.v-dialog .v-card-title')).toHaveText(
      'A CEOS-ARD repository was created on your GitHub account',
    );
  });

  test('later workspaces do not mention the fork', async ({ page }) => {
    const dialog = await openCreateDialog(page);

    await expect(dialog).not.toContainText('creates a copy (fork)');
  });
});
