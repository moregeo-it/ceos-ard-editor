import { test, expect, OGC_DOCUMENTS, WORKSPACE_EVENTS } from './support/mock-api';
import { optionTexts } from './support/ui';

const CORE = 'core/standard/20-004.adoc';
const FACETS = 'extensions/facets/document.adoc';

function documentSelect(page) {
  return page.locator('.v-select').filter({ hasText: 'Select a document for the preview' });
}

test.describe('OGC', () => {
  test.beforeEach(async ({ api }) => {
    api.useOgc();
  });

  test('a new workspace chooses a repository and optionally a branch', async ({ page, api }) => {
    await page.goto('/workspaces');
    await expect(page.locator('.v-skeleton-loader')).toHaveCount(0);
    await page.getByRole('button', { name: 'Create Workspace' }).first().click();
    const dialog = page.locator('.v-dialog .v-card');
    const typeSelect = dialog.locator('.v-select').filter({ hasText: 'What do you want to edit?' });
    await typeSelect.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'OGC' }).click();

    // Required before anything is created
    await dialog.getByLabel('Workspace Title').fill('GeoParquet review');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toContainText('Select a repository');

    const repository = dialog.locator('.v-autocomplete').filter({ hasText: 'Repository' });
    await repository.click();
    await expect(page.locator('.v-overlay--active .v-list-item-title')).toHaveText([
      'ogcapi-records',
      'geoparquet',
    ]);
    // Long descriptions are cut instead of widening the menu
    const fieldWidth = (await repository.locator('.v-field').boundingBox()).width;
    const menuWidth = (await page.locator('.v-overlay--active .v-list').boundingBox()).width;
    expect(Math.abs(menuWidth - fieldWidth)).toBeLessThan(2);
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'geoparquet' }).click();
    await expect(dialog.getByLabel('Branch (Optional)')).toHaveAttribute('placeholder', 'main');
    await expect(dialog).toContainText('creates a copy (fork) of the geoparquet repository');
    await dialog.getByLabel('Branch (Optional)').fill('ogc-template');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces');
    expect(JSON.parse(post.body)).toEqual({
      type: 'ogc',
      title: 'GeoParquet review',
      description: null,
      repository: 'geoparquet',
      branch: 'ogc-template',
    });
  });

  test('the workspace names its repository', async ({ page }) => {
    await page.goto('/workspaces');

    await expect(page.locator('.v-card').filter({ hasText: 'Records review' })).toContainText(
      'ogcapi-records',
    );
  });

  test('the first document is previewed when the owner opens a workspace without one', async ({
    page,
    api,
  }) => {
    await page.goto('/workspaces/ws-1');

    await expect(
      page.frameLocator('.preview-iframe').getByRole('heading', { name: 'Part 1: Core' }),
    ).toBeVisible();
    await expect(documentSelect(page)).toContainText('OGC API - Records - Part 1: Core');
    const patch = api.requests.find((r) => r.method === 'PATCH' && r.path === '/workspaces/ws-1');
    expect(JSON.parse(patch.body)).toEqual({ selection: [CORE] });
    expect(
      api.requests.some((r) => r.method === 'POST' && r.path === '/workspaces/ws-1/previews'),
    ).toBe(true);

    // The files the document includes have Edit buttons
    await page.frameLocator('.preview-iframe').getByRole('link', { name: 'Edit' }).click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText(
      'clause_1_scope.adoc',
    );
  });

  test('the owner selects the document to preview', async ({ page, api }) => {
    Object.assign(api.workspaces[0], { selection: [CORE] });
    await page.goto('/workspaces/ws-1');
    await expect(
      page.frameLocator('.preview-iframe').getByRole('heading', { name: 'Part 1: Core' }),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'PDF', exact: true })).toHaveCount(0);
    const select = documentSelect(page);
    expect(await optionTexts(page, select)).toEqual([
      `OGC API - Records - Part 1: Core ${CORE}`,
      `OGC API - Records - Part 2: Facets ${FACETS}`,
    ]);
    // Generated for the selected document only
    api.previewHtml = api.previewHtml.replace('Part 1: Core', 'Part 2: Facets');
    await select.click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: 'Part 2: Facets' })
      .click();

    await expect(
      page.frameLocator('.preview-iframe').getByRole('heading', { name: 'Part 2: Facets' }),
    ).toBeVisible();
    const patches = api.requests.filter(
      (r) => r.method === 'PATCH' && r.path === '/workspaces/ws-1',
    );
    expect(patches.map((r) => JSON.parse(r.body))).toEqual([{ selection: [FACETS] }]);
  });

  test('nothing is selected without documents, or for viewers', async ({ page, api }) => {
    api.documents = [];
    await page.goto('/workspaces/ws-1');
    await expect(page.getByText('Select a document from the list above')).toBeVisible();

    api.documents = OGC_DOCUMENTS;
    api.workspaces[0].viewer_role = 'readonly';
    await page.reload();
    await expect(page.getByText('The owner has not generated a preview yet.')).toBeVisible();
    await expect(documentSelect(page).locator('input')).toHaveAttribute('readonly');
    expect(api.requests.some((r) => r.method === 'PATCH')).toBe(false);
  });

  test("viewers follow the owner's document", async ({ page, api }) => {
    Object.assign(api.workspaces[0], { viewer_role: 'readonly', selection: [CORE] });
    await page.goto('/workspaces/ws-1');

    await expect(
      page.frameLocator('.preview-iframe').getByRole('heading', { name: 'Part 1: Core' }),
    ).toBeVisible();
    await expect(documentSelect(page)).toContainText('OGC API - Records - Part 1: Core');
    await expect(documentSelect(page).locator('input')).toHaveAttribute('readonly');
    expect(api.requests.some((r) => r.method === 'POST' && r.path.endsWith('/previews'))).toBe(
      false,
    );
    expect(api.requests.some((r) => r.path === '/workspaces/ws-1/previews/current')).toBe(true);
  });

  test('a new document file updates the documents', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    await page.goto('/workspaces/ws-1');
    await expect(documentSelect(page)).toBeVisible();
    await expect.poll(() => socket).toBeTruthy();
    const before = api.requests.filter(
      (r) => r.path === '/workspaces/ws-1/selection-options',
    ).length;

    socket.send(
      JSON.stringify({
        type: 'file.created',
        ts: new Date().toISOString(),
        actor_user_id: 'user-2',
        path: '/extensions/search/document.adoc',
        file: {
          path: '/extensions/search/document.adoc',
          name: 'document.adoc',
          is_directory: false,
        },
      }),
    );

    await expect
      .poll(
        () => api.requests.filter((r) => r.path === '/workspaces/ws-1/selection-options').length,
      )
      .toBeGreaterThan(before);
  });

  test('texts name the repository instead of the type', async ({ page, api }) => {
    api.upstream = { behind_commits: 2, conflicting_files: [] };
    await page.goto('/workspaces/ws-1');

    await expect(page.getByRole('button', { name: 'Behind ogcapi-records' })).toBeVisible();
  });
});
