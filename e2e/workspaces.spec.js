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
  await dialog.locator('.v-select').filter({ hasText: 'PFS' }).click();
  await page
    .locator('.v-overlay .v-list-item')
    .filter({ hasText: new RegExp(`^${id}$`) })
    .click();
  await page.keyboard.press('Escape');
}

test.describe('Workspaces', () => {
  test('the user menu shows the GitHub avatar', async ({ page }) => {
    await page.goto('/workspaces');
    const menu = page.getByRole('button', { name: 'jdoe' });
    await expect(menu.locator('.v-avatar img')).toHaveAttribute(
      'src',
      'https://avatars.githubusercontent.com/u/4242?s=48',
    );
  });

  test('an older stored session gets the avatar once confirmed', async ({ page, api }) => {
    // Stored by an editor that didn't know the GitHub ID yet
    await page.addInitScript(() => {
      const session = JSON.parse(localStorage.getItem('ceos_ard_editor_session'));
      delete session.githubId;
      localStorage.setItem('ceos_ard_editor_session', JSON.stringify(session));
    });
    let confirm;
    const confirmed = new Promise((resolve) => (confirm = resolve));
    await page.route('**/auth/user', async (route) => {
      await confirmed;
      return api.handle(route);
    });
    await page.goto('/workspaces');
    const menu = page.getByRole('button', { name: 'jdoe' });
    await expect(menu.locator('.v-avatar')).toHaveCount(0);

    confirm();
    await expect(menu.locator('.v-avatar img')).toHaveAttribute('src', /\/u\/4242\?/);
  });

  test('lists the workspaces with their PFS', async ({ page, api }) => {
    await openWorkspaces(page);

    await expect(page.locator('h1')).toHaveText('My PFS Workspaces');
    const card = page.locator('.v-card').filter({ hasText: 'NRB review' });
    await expect(card).toBeVisible();
    await expect(card.locator('.v-chip').filter({ hasText: /^NRB$/ })).toBeVisible();
    await expect(card).toContainText('Created:');
    await expect(card).toContainText('Updated:');
    await expect(card).not.toContainText('n/a');

    api.workspaces[0].selection = null;
    await page.reload();
    await expect(page.locator('.v-card').filter({ hasText: 'NRB review' })).toContainText(
      'No PFS assigned',
    );
  });

  test('a workspace opens from the keyboard and by clicking its card', async ({ page, api }) => {
    await openWorkspaces(page);
    const id = api.workspaces[0].id;
    const title = page.getByRole('link', { name: 'NRB review' });
    await expect(title).toHaveAttribute('href', `/workspaces/${id}`);

    await title.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/workspaces/${id}`);

    await openWorkspaces(page);
    await page.locator('.v-card').filter({ hasText: 'NRB review' }).getByText('Created:').click();
    await expect(page).toHaveURL(`/workspaces/${id}`);
  });

  test('offers the PFS of CEOS-ARD', async ({ page }) => {
    const dialog = await openCreateDialog(page);

    const select = dialog.locator('.v-select').filter({ hasText: 'PFS' });
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
      selection: ['SR'],
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

  test('a failed load does not welcome the user as new', async ({ page }) => {
    const failing = (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ detail: 'Database unavailable' }),
      });
    await page.route('http://localhost:8099/workspaces', failing);
    await openWorkspaces(page);

    await expect(page.getByText('No active workspaces')).toBeVisible();
    await expect(page.getByText('Create your first workspace')).toHaveCount(0);
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
    preview: 'file',
    downloads: [],
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
    await expect
      .poll(() => api.requests.some((r) => r.path === '/workspaces/ws-1/selection-options'))
      .toBe(true);
  });

  test('types that are not available are not offered', async ({ page, api }) => {
    api.types.push({ ...OTHER_TYPE, available: false });
    api.workspaces.push({ ...api.workspaces[0], id: 'ws-2', title: 'Old review', type: 'other' });
    const dialog = await openCreateDialog(page);

    await expect(dialog.getByLabel('What do you want to edit?')).toHaveCount(0);
    await expect(dialog.locator('.v-select').filter({ hasText: 'PFS' })).toBeVisible();
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

    await expect(dialog.locator('.v-select').filter({ hasText: 'PFS' })).toHaveCount(0);
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

  test('switching the type clears the selection of the previous type', async ({ page, api }) => {
    api.types.push({
      ...OTHER_TYPE,
      preview: 'build',
      selection: { label: 'Part', multiple: false, on_create: true },
    });
    await page.route('http://localhost:8099/types/other/selection-options', (route) =>
      route.fulfill({ json: { options: [{ id: 'P1', title: 'Part 1', path: null }] } }),
    );
    const dialog = await openCreateDialog(page);
    await dialog.getByLabel('Workspace Title').fill('Other review');
    await selectPfs(page, dialog, 'NRB');

    const typeSelect = dialog.locator('.v-select').filter({ hasText: 'What do you want to edit?' });
    await typeSelect.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Other' }).click();
    await expect(dialog.locator('.v-select').filter({ hasText: 'Part' })).not.toContainText('NRB');

    await dialog.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(dialog).toContainText('Select a Part');
    expect(api.requests.some((r) => r.method === 'POST' && r.path === '/workspaces')).toBe(false);
  });

  test('a failure for the previous type does not show for the chosen one', async ({
    page,
    api,
  }) => {
    api.types.push({
      ...OTHER_TYPE,
      selection: { label: 'Part', multiple: false, on_create: true },
    });
    let fail;
    const failing = new Promise((resolve) => (fail = resolve));
    await page.route('http://localhost:8099/types/ceos-ard/selection-options', async (route) => {
      await failing;
      await route.fulfill({ status: 500, json: { detail: 'Server error' } });
    });
    const answered = page.waitForResponse((response) =>
      response.url().endsWith('/types/ceos-ard/selection-options'),
    );
    const dialog = await openCreateDialog(page);

    const typeSelect = dialog.locator('.v-select').filter({ hasText: 'What do you want to edit?' });
    await typeSelect.click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Other' }).click();
    const select = dialog.locator('.v-select').filter({ hasText: 'Part' });
    expect(await optionTexts(page, select)).toEqual(['NRB', 'SR', 'AR']);

    fail();
    await answered;
    await expect(dialog.getByText("Couldn't load the Part")).toHaveCount(0);
    expect(await optionTexts(page, select)).toEqual(['NRB', 'SR', 'AR']);
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
