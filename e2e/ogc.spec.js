import { test, expect, OGC_DOCUMENTS, WORKSPACE_EVENTS } from './support/mock-api';
import { optionTexts } from './support/ui';

const CORE = 'core/standard/20-004.adoc';
const FACETS = 'extensions/facets/document.adoc';

async function openFile(page, ...names) {
  for (const name of names) {
    await page
      .locator('.file-tree-row')
      .filter({ has: page.locator('.file-tree-name').getByText(name, { exact: true }) })
      .click();
  }
}

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
    await expect(dialog.getByLabel('Start from (Optional)')).toHaveAttribute('placeholder', 'main');
    await expect(dialog).toContainText('creates a copy (fork) of the geoparquet repository');
    await dialog.getByLabel('Start from (Optional)').fill('ogc-template');
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

  async function openOgcDialog(page) {
    await page.goto('/workspaces');
    await expect(page.locator('.v-skeleton-loader')).toHaveCount(0);
    await page.getByRole('button', { name: 'Create Workspace' }).first().click();
    const dialog = page.locator('.v-dialog .v-card');
    await dialog.locator('.v-select').filter({ hasText: 'What do you want to edit?' }).click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'OGC' }).click();
    return dialog;
  }

  function createdWith(api) {
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces');
    return JSON.parse(post.body);
  }

  test('a new workspace can continue an open pull request', async ({ page, api }) => {
    const dialog = await openOgcDialog(page);
    const repository = dialog.locator('.v-autocomplete').filter({ hasText: 'Repository' });
    await repository.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'geoparquet' }).click();

    const startFrom = dialog.locator('.v-combobox').filter({ hasText: 'Start from' });
    expect(await optionTexts(page, startFrom)).toEqual([
      '#304 OGC Standard document for GeoParquet 2.0 (metanorma), aligned with the 2.0.0 release jatorre · jatorre:ogc-spec-alignment',
    ]);
    await startFrom.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: '#304' }).click();
    await expect(dialog).toContainText(
      'Continues pull request #304: changes are proposed to its branch jatorre:ogc-spec-alignment',
    );
    // The pull request's title, as long as titles may be
    await expect(dialog.getByLabel('Workspace Title')).toHaveValue(
      'OGC Standard document for GeoParquet 2.0 (metanorm',
    );
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    expect(createdWith(api)).toMatchObject({ repository: 'geoparquet', pull_request: 304 });
    expect(createdWith(api)).not.toHaveProperty('branch');
  });

  test('a link to a pull request chooses its repository and the pull request', async ({
    page,
    api,
  }) => {
    const dialog = await openOgcDialog(page);
    const repository = dialog.locator('.v-autocomplete').filter({ hasText: 'Repository' });
    await repository.locator('input').fill('https://github.com/opengeospatial/geoparquet/pull/304');

    await expect(dialog).toContainText('Continues pull request #304');
    await dialog.getByLabel('Workspace Title').fill('GeoParquet 2.0 review');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    expect(createdWith(api)).toMatchObject({
      title: 'GeoParquet 2.0 review',
      repository: 'geoparquet',
      pull_request: 304,
    });
  });

  test('a link pasted while the repositories load is used at once', async ({ page }) => {
    let release;
    const released = new Promise((resolve) => (release = resolve));
    await page.route('**/types/ogc/repositories', async (route) => {
      await released;
      await route.fallback();
    });
    const dialog = await openOgcDialog(page);
    await expect(dialog).toContainText('Loading the repositories of opengeospatial');
    const repository = dialog.locator('.v-autocomplete').filter({ hasText: 'Repository' });
    await repository.locator('input').fill('https://github.com/opengeospatial/geoparquet/pull/304');
    await expect(dialog).toContainText('Continues pull request #304');

    // Kept when leaving the field, and once the repositories are there
    await dialog.getByLabel('Workspace Title').click();
    release();
    await expect(dialog).not.toContainText('Loading the repositories');
    await expect(repository).toContainText('geoparquet');
    await expect(dialog).toContainText('Continues pull request #304');
  });

  test('a workspace continuing a pull request counts for the fork of its repository', async ({
    page,
    api,
  }) => {
    Object.assign(api.workspaces[0], {
      upstream_owner: 'jatorre',
      upstream_repo: 'geoparquet',
      upstream_branch: 'ogc-spec-alignment',
      fork_repo_name: 'geoparquet',
    });
    const dialog = await openOgcDialog(page);
    await dialog.locator('.v-autocomplete').filter({ hasText: 'Repository' }).click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'geoparquet' }).click();

    await expect(dialog.getByLabel('Start from (Optional)')).toHaveAttribute('placeholder', 'main');
    await expect(dialog).not.toContainText('creates a copy (fork)');
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

  test('requirements and tests open in a form', async ({ page, api }) => {
    const REQUIREMENT = '/core/standard/requirements/REQ_time-zone.adoc';
    const original = api.files.get(REQUIREMENT).content;
    Object.assign(api.workspaces[0], { selection: [CORE] });
    await page.goto('/workspaces/ws-1');
    await openFile(page, 'core', 'standard', 'requirements', 'REQ_time-zone.adoc');

    const form = page.locator('.v-window-item--active .json-schema-editor');
    await expect(form.getByRole('textbox', { name: 'Identifier*' })).toHaveValue(
      '/req/record-core/time-zone',
    );
    // Only the fields of a requirement
    await expect(form.getByRole('textbox', { name: 'Parts 2' })).toHaveValue(
      'Timestamps SHALL include seconds.',
    );
    await expect(form.getByRole('textbox', { name: 'Test method' })).toHaveCount(0);
    await expect(form.getByRole('combobox', { name: 'Inherits' })).toHaveCount(0);
    await form.getByRole('textbox', { name: 'Identifier*' }).fill('/req/record-core/utc');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect
      .poll(() => api.files.get(REQUIREMENT).content)
      .toBe(
        original.replace(
          'identifier:: /req/record-core/time-zone',
          'identifier:: /req/record-core/utc',
        ),
      );

    await openFile(page, 'abstract_tests', 'ATS_time-zone.adoc');
    await expect(form.getByRole('textbox', { name: 'Test method' })).toHaveValue(
      'Verify that all timestamps end with "Z".',
    );
    await expect(form.getByRole('textbox', { name: 'Parts 1' })).toHaveCount(0);
  });

  test('other AsciiDoc files open in the visual editor', async ({ page, api }) => {
    Object.assign(api.workspaces[0], { selection: [CORE] });
    await page.goto('/workspaces/ws-1');
    await openFile(page, 'core', 'standard', 'clause_1_scope.adoc');

    await expect(page.locator('.asciidoc-editor')).toBeVisible();
    await expect(page.locator('.json-schema-editor')).toHaveCount(0);
  });

  test('the search filters by the type of block', async ({ page, api }) => {
    Object.assign(api.workspaces[0], { selection: [CORE] });
    await page.goto('/workspaces/ws-1');

    await page.getByRole('button', { name: 'Show filters' }).click();
    const filter = page.locator('.v-select').filter({ hasText: 'Specification element' });
    expect(await optionTexts(page, filter)).toEqual([
      'requirement',
      'recommendation',
      'permission',
      'requirements class',
      'conformance class',
      'abstract test',
      'conformance test',
    ]);
    await filter.click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: /^abstract test$/ })
      .click();
    await page.keyboard.press('Escape');

    await expect(page.locator('.file-tree-name').getByText('ATS_time-zone.adoc')).toBeVisible();
    await expect(page.locator('.file-tree-name').getByText('REQ_time-zone.adoc')).toHaveCount(0);
    expect(api.requests.some((r) => r.search.includes('filter=block%3Aabstract+test'))).toBe(true);
  });
});
