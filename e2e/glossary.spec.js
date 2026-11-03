import { test, expect, GLOSSARY_FILES } from './support/mock-api';
import { fieldLabels, optionTexts } from './support/ui';

const TEAL = 'rgb(0, 121, 107)';

const row = (page, name) =>
  page
    .locator('.file-tree-row')
    .filter({ has: page.locator('.file-tree-name').getByText(name, { exact: true }) });

async function menuEntries(page, name) {
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
  const items = page.locator('.v-overlay--active .v-list-item-title');
  await expect(items.first()).toBeVisible();
  const entries = (await items.allTextContents()).map((entry) => entry.trim());
  await page.keyboard.press('Escape');
  return entries;
}

test.describe('CEOS EO Glossary', () => {
  test.beforeEach(async ({ api }) => {
    api.useGlossary();
  });

  test('workspaces show their type', async ({ page }) => {
    await page.goto('/workspaces');

    await expect(page.locator('h1')).toHaveText('My Workspaces');
    const badge = page
      .locator('.v-card')
      .filter({ hasText: 'Glossary review' })
      .locator('.v-chip')
      .filter({ hasText: 'CEOS EO Glossary' });
    await expect(badge).toHaveCSS('background-color', TEAL);
  });

  test('opens the terms folder and names the type in the header', async ({ page }) => {
    await page.goto('/workspaces/ws-1');

    await expect(page.locator('h1')).toContainText('CEOS EO Glossary');
    await expect(page.locator('.v-app-bar')).toHaveCSS('background-color', TEAL);
    await expect(row(page, 'accuracy.md')).toBeVisible();
    await expect(row(page, 'precision.md')).toBeVisible();
  });

  test('the term form shows the configured fields and the term', async ({ page }) => {
    await page.goto('/workspaces/ws-1');
    await row(page, 'accuracy.md').click();

    const form = page.locator('.v-window-item--active .json-schema-editor');
    expect(await fieldLabels(form)).toEqual([
      'Term*',
      'Summary',
      'Synonyms',
      'Definition',
      'Notes',
      'Examples',
      'Sources',
      'Other tags',
    ]);
    await expect(form.getByRole('textbox', { name: 'Summary', exact: true })).toHaveValue(
      'About accuracy.',
    );
    await expect(form.getByRole('textbox', { name: 'Definition', exact: true })).toHaveValue(
      'Closeness of agreement between a measured value and the true value.',
    );

    const chips = form.locator('.chips-control');
    await expect(chips.locator('.chips-control-label')).toHaveText([
      'Status*',
      'Class*',
      'Responsible groups',
    ]);
    await expect(chips.nth(0).locator('.v-chip')).toHaveText([
      'to be defined',
      'to be discussed',
      'to be approved',
      'approved',
    ]);
    await expect(chips.nth(1).locator('.v-chip')).toHaveText([
      'base',
      'core',
      'controversial',
      'high-impact',
    ]);
    await expect(chips.nth(2).locator('.v-chip')).toHaveText([
      'WGISS',
      'WGCV',
      'WGCapD',
      'LSI-VC',
      'WGClimate',
      'B-VC',
      'AC-VC',
    ]);
    // The tags of the term, as selected chips
    await expect(chips.locator('.v-chip.text-primary')).toHaveText(['approved', 'core', 'WGCV']);
  });

  test('terms open in the form and keep the file as it was', async ({ page, api }) => {
    await page.goto('/workspaces/ws-1');
    await row(page, 'accuracy.md').click();

    const form = page.locator('.v-window-item--active .json-schema-editor');
    await expect(form.getByRole('textbox', { name: 'Term*', exact: true })).toHaveValue('Accuracy');
    await form
      .locator('.chips-control .v-chip')
      .filter({ hasText: /^\s*to be approved\s*$/ })
      .click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect
      .poll(() => api.requests.find((r) => r.method === 'PUT' && r.path.endsWith('accuracy.md')))
      .toBeTruthy();
    const put = api.requests.find((r) => r.method === 'PUT' && r.path.endsWith('accuracy.md'));
    expect(put.body).toBe(
      GLOSSARY_FILES['/docs/terms/accuracy.md'].replace('  - approved\n', '  - to be approved\n'),
    );
  });

  test('previews the open term and opens linked terms', async ({ page }) => {
    await page.goto('/workspaces/ws-1');
    await row(page, 'accuracy.md').click();

    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('Accuracy');
    await expect(page.getByText('Select PFS for Preview')).toHaveCount(0);

    await frame.locator('a[data-open-file="/docs/terms/precision.md"]').click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('precision.md');
    await expect(frame.locator('h1')).toHaveText('Precision');
  });

  test('lists the terms linking to a term', async ({ page }) => {
    await page.goto('/workspaces/ws-1');
    await row(page, 'accuracy.md').click();

    const linkedFrom = page.getByRole('button', { name: /Linked from/ });
    await expect(linkedFrom).toHaveText(/Linked from\s*1/);
    await linkedFrom.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Precision' }).click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('precision.md');
  });

  test('creates new terms', async ({ page, api }) => {
    await page.goto('/workspaces/ws-1');

    expect(await menuEntries(page, 'terms')).toEqual(['New term']);
    await page.getByRole('button', { name: 'Actions for terms', exact: true }).click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'New term' }).click();
    const dialog = page.locator('.v-dialog .v-card');
    await expect(dialog.locator('.v-card-title')).toHaveText('New term');
    expect(await fieldLabels(dialog)).toEqual(['Term*']);
    await dialog.getByRole('textbox', { name: 'Term*', exact: true }).fill('Data Cube');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('data_cube.md');
    const post = api.requests.find((r) => r.path === '/workspaces/ws-1/actions/new-term');
    expect(JSON.parse(post.body)).toEqual({ title: 'Data Cube' });
  });

  test('terms can be deleted, but not renamed', async ({ page }) => {
    await page.goto('/workspaces/ws-1');

    expect(await menuEntries(page, 'precision.md')).toEqual([
      'Open in Source Code Editor',
      'Download',
      'Delete',
    ]);
  });

  test('filters terms by status', async ({ page, api }) => {
    await page.goto('/workspaces/ws-1');
    await expect(row(page, 'precision.md')).toBeVisible();

    await page.getByRole('button', { name: 'Show filters' }).click();
    const filter = (name) => page.locator('.v-select').filter({ hasText: name });
    expect(await optionTexts(page, filter('Class'))).toEqual([
      'base',
      'core',
      'controversial',
      'high-impact',
    ]);
    expect(await optionTexts(page, filter('Group'))).toEqual([
      'WGISS',
      'WGCV',
      'WGCapD',
      'LSI-VC',
      'WGClimate',
      'B-VC',
      'AC-VC',
    ]);
    expect(await optionTexts(page, filter('Status'))).toEqual([
      'to be defined',
      'to be discussed',
      'to be approved',
      'approved',
    ]);
    await page.locator('.v-select').filter({ hasText: 'Status' }).click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: /^approved$/ })
      .click();
    await page.keyboard.press('Escape');

    await expect(row(page, 'precision.md')).toHaveCount(0);
    await expect(row(page, 'accuracy.md')).toBeVisible();
    expect(api.requests.some((r) => r.search.includes('filter=status%3Aapproved'))).toBe(true);
  });
});
