import { test, expect, USER_EVENTS } from './support/mock-api';
import { optionTexts } from './support/ui';

async function openWorkspaces(page) {
  await page.goto('/workspaces');
  // The dialog reads whether the user has workspaces already when it opens
  await expect(page.locator('.v-skeleton-loader')).toHaveCount(0);
}

async function openCreateDialog(page) {
  await openWorkspaces(page);
  await page.getByRole('button', { name: 'Create Workspace' }).first().click();
  const dialog = page.locator('.v-dialog .v-card');
  await expect(dialog.getByLabel('Workspace Title')).toBeVisible();
  return dialog;
}

async function selectPfs(page, dialog, id) {
  await dialog.locator('.v-select').filter({ hasText: 'Product Format Specification' }).click();
  await page
    .locator('.v-overlay .v-list-item')
    .filter({ hasText: new RegExp(`^${id}$`) })
    .click();
  await page.keyboard.press('Escape');
}

test.describe('Workspaces', () => {
  test('lists the workspaces with their PFS', async ({ page, api }) => {
    await openWorkspaces(page);

    await expect(page.locator('h1')).toHaveText('My PFS Workspaces');
    const card = page.locator('.v-card').filter({ hasText: 'NRB review' });
    await expect(card).toBeVisible();
    await expect(card.locator('.v-chip').filter({ hasText: /^NRB$/ })).toBeVisible();
    await expect(card).toContainText('Created:');
    await expect(card).toContainText('Updated:');
    await expect(card).not.toContainText('n/a');

    api.workspaces[0].pfs = null;
    await page.reload();
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review' })).toContainText(
      'No PFS assigned',
    );
  });

  test('offers the PFS of CEOS-ARD', async ({ page }) => {
    const dialog = await openCreateDialog(page);

    const select = dialog.locator('.v-select').filter({ hasText: 'Product Format Specification' });
    expect(await optionTexts(page, select)).toEqual(['NRB', 'SR', 'AR']);
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
    expect(JSON.parse(post.body)).toEqual({
      type: 'ceos-ard',
      title: 'SR review',
      description: null,
      pfs: ['SR'],
    });
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

test.describe('Workspace types', () => {
  const OTHER_TYPE = {
    id: 'other',
    title: 'Other Specification',
    description: 'A repository without PFS',
    available: true,
    color: '#00796b',
    upstream: { owner: 'ceos-org', repo: 'other', branch: 'main', url: '' },
    pfs: false,
    labels: {},
    editors: [],
    actions: [],
    file_menu: [],
  };

  test('settings wait for the types before loading the PFS of the workspace', async ({
    page,
    api,
  }) => {
    await page.route('http://localhost:8099/types', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fallback();
    });
    await page.goto('/workspaces');
    await page.locator('.v-card').filter({ hasText: 'NRB review' }).getByText('Settings').click();

    await expect(page.locator('.v-dialog .v-card')).toBeVisible();
    await expect.poll(() => api.requests.some((r) => r.path === '/workspaces/ws-1/pfs')).toBe(true);
  });

  test('types that are not available are not offered', async ({ page, api }) => {
    api.types.push({ ...OTHER_TYPE, available: false });
    api.workspaces.push({ ...api.workspaces[0], id: 'ws-2', title: 'Old review', type: 'other' });
    const dialog = await openCreateDialog(page);

    await expect(dialog.getByLabel('What do you want to edit?')).toHaveCount(0);
    await expect(dialog).toContainText('Product Format Specification');
    await expect(page.locator('.v-card').filter({ hasText: 'Old review' })).toBeVisible();
  });

  test('a single type is not shown', async ({ page }) => {
    const dialog = await openCreateDialog(page);

    await expect(dialog.getByLabel('What do you want to edit?')).toHaveCount(0);
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review' })).not.toContainText(
      'CEOS-ARD',
    );
  });

  test('the dialog waits for the types before choosing one', async ({ page, api }) => {
    api.types = [OTHER_TYPE];
    await page.route('http://localhost:8099/types', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fallback();
    });
    await page.goto('/workspaces');
    await page.getByRole('button', { name: 'Create Workspace' }).first().click();

    const dialog = page.locator('.v-dialog .v-card');
    await dialog.getByLabel('Workspace Title').fill('Other review');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces');
    expect(JSON.parse(post.body).type).toBe('other');
  });

  test('with several types, workspaces show and choose their type', async ({ page, api }) => {
    api.types.push(OTHER_TYPE);
    const dialog = await openCreateDialog(page);

    const badge = page
      .locator('.v-card')
      .filter({ hasText: 'NRB review' })
      .locator('.v-chip')
      .filter({ hasText: 'CEOS-ARD' });
    await expect(badge).toHaveCSS('background-color', 'rgb(62, 82, 101)');
    const typeSelect = dialog.locator('.v-select').filter({ hasText: 'What do you want to edit?' });
    expect(await optionTexts(page, typeSelect)).toEqual([
      'CEOS-ARD Product Family Specifications for CEOS Analysis Ready Data',
      'Other Specification A repository without PFS',
    ]);
    await typeSelect.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Other' }).click();

    await expect(dialog.getByText('Product Format Specification')).toHaveCount(0);
    await expect(dialog).toContainText(
      'creates a copy (fork) of the Other Specification repository',
    );
    await dialog.getByLabel('Workspace Title').fill('Other review');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/workspaces\/ws-2$/);
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces');
    expect(JSON.parse(post.body)).toEqual({
      type: 'other',
      title: 'Other review',
      description: null,
    });
  });
});

test.describe('Live updates', () => {
  async function userStream(page) {
    let socket;
    await page.routeWebSocket(USER_EVENTS, (ws) => (socket = ws));
    return {
      connected: () => expect.poll(() => socket).toBeTruthy(),
      send: (event) =>
        socket.send(
          JSON.stringify({ ts: new Date().toISOString(), actor_user_id: 'user-2', ...event }),
        ),
    };
  }

  // With the list loaded, so a change can only arrive through the stream
  async function openList(page, stream) {
    await openWorkspaces(page);
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review' })).toBeVisible();
    await stream.connected();
  }

  function share(api) {
    api.workspaces.push({
      ...api.workspaces[0],
      id: 'ws-2',
      title: 'SR review',
      viewer_role: 'readonly',
      owner_username: 'mmustermann',
    });
  }

  test('a workspace shared with the user appears and goes again', async ({ page, api }) => {
    const stream = await userStream(page);
    await openList(page, stream);
    await page.getByRole('button', { name: /^Shared/ }).click();

    share(api);
    stream.send({
      type: 'collaborator.added',
      workspace_id: 'ws-2',
      target_user_id: 'user-1',
      mode: 'readonly',
    });
    const card = page.locator('.v-card').filter({ hasText: 'SR review' });
    await expect(card).toBeVisible();
    await expect(page.locator('.v-snackbar')).toContainText('"SR review" was shared with you.');

    stream.send({ type: 'collaborator.revoked', workspace_id: 'ws-2', target_user_id: 'user-1' });
    await expect(card).toHaveCount(0);
  });

  test('a workspace renamed in another tab is updated', async ({ page, api }) => {
    const stream = await userStream(page);
    await openList(page, stream);

    api.workspaces[0].title = 'NRB review 2';
    stream.send({ type: 'workspace.updated', workspace_id: 'ws-1', fields: ['title'] });
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review 2' })).toBeVisible();
  });

  test('only list events reach the list', async ({ page, api }) => {
    const stream = await userStream(page);
    await openList(page, stream);

    // e.g. a notification a later version sends
    stream.send({ type: 'comment.created', workspace_id: 'ws-1' });
    api.workspaces[0].title = 'NRB review 2';
    stream.send({ type: 'workspace.updated', workspace_id: 'ws-1', fields: ['title'] });
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review 2' })).toBeVisible();
    const fetches = api.requests.filter((r) => r.method === 'GET' && r.path === '/workspaces/ws-1');
    expect(fetches).toHaveLength(1);
  });

  test('events about other workspaces leave the open one alone', async ({ page, api }) => {
    const stream = await userStream(page);
    await page.goto('/workspaces/ws-1');
    await expect(page.locator('.file-tree-row').first()).toBeVisible();
    await stream.connected();

    share(api);
    stream.send({ type: 'workspace.deleted', workspace_id: 'ws-3' });
    stream.send({
      type: 'collaborator.added',
      workspace_id: 'ws-2',
      target_user_id: 'user-1',
      mode: 'readonly',
    });
    await expect(page.locator('.v-snackbar')).toContainText('"SR review" was shared with you.');
    await expect(page).toHaveURL(/\/workspaces\/ws-1$/);
  });
});
