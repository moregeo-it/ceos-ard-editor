import { test, expect, thread } from './support/mock-api';

const FILE = '/glossary/accuracy.yaml';
// As shown, without the leading slash
const SHOWN = 'glossary/accuracy.yaml';
const OTHER = { user_id: 'user-2', github_id: '5151', username: 'mmohr' };

const row = (page, name) =>
  page
    .locator('.file-tree-row')
    .filter({ has: page.locator('.file-tree-name').getByText(name, { exact: true }) });

const threads = (page) => page.locator('.comment-thread');

async function openWorkspace(page) {
  await page.goto('/workspaces/ws-1');
  await expect(row(page, 'glossary')).toBeVisible();
}

async function menuEntries(page, name) {
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
  const items = page.locator('.v-overlay--active .v-list-item-title');
  await expect(items.first()).toBeVisible();
  const entries = (await items.allTextContents()).map((entry) => entry.trim());
  await page.keyboard.press('Escape');
  return entries;
}

async function commentOnFile(page, name, text) {
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
  await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Comment' }).click();
  await page.getByLabel('Comment', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
}

test.describe('Comments', () => {
  test('the owner comments on a file from the file tree', async ({ page, api }) => {
    await openWorkspace(page);
    await row(page, 'glossary').click();

    await commentOnFile(page, 'accuracy.yaml', 'Is this **definition** right?');

    // The comments of the file are shown
    await expect(page.getByRole('tab', { name: /Comments/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(threads(page)).toHaveCount(1);
    await expect(threads(page).locator('strong')).toHaveText('definition');
    expect(api.threads[0].path).toBe(FILE);

    // The file tree counts the open thread
    await page.getByRole('tab', { name: 'Files' }).click();
    await expect(row(page, 'accuracy.yaml').locator('.comment-count')).toHaveText('1');
    await expect(row(page, 'glossary').locator('.comment-count')).toHaveCount(0);
  });

  test('reply, resolve and reopen a thread', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'Is this right?', author: OTHER })];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    await threads(page).getByPlaceholder('Reply…').fill('Yes, it is from ISO 19157.');
    await threads(page).getByRole('button', { name: 'Reply' }).click();
    await expect(threads(page)).toContainText('Yes, it is from ISO 19157.');

    await threads(page).getByRole('button', { name: 'Resolve thread' }).click();
    await expect(threads(page)).toHaveCount(0);
    await expect(page.getByText('No open comments.')).toBeVisible();

    await page.getByLabel('Resolved (1)').check();
    await expect(threads(page)).toContainText('Resolved by jdoe');
    await threads(page).getByRole('button', { name: 'Reopen thread' }).click();
    await expect(threads(page).getByText('Resolved', { exact: true })).toHaveCount(0);
  });

  test('authors edit and delete their own comments', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'A typo' })];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    await threads(page).getByRole('button', { name: 'Actions for the comment of jdoe' }).click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Edit' }).click();
    await threads(page).locator('textarea').first().fill('No typo after all');
    await threads(page).getByRole('button', { name: 'Save' }).click();
    await expect(threads(page)).toContainText('No typo after all');
    await expect(threads(page)).toContainText('(edited)');

    // The only comment goes with its thread
    await threads(page).getByRole('button', { name: 'Actions for the comment of jdoe' }).click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(threads(page)).toHaveCount(0);
    expect(api.threads).toEqual([]);
  });

  test('comments with replies after them become placeholders', async ({ page, api }) => {
    const base = thread({ path: FILE, body: 'First' });
    const reply = (n) => ({ ...base.comments[0], id: `c${n}`, body: `Reply ${n}` });
    api.threads = [{ ...base, comments: [base.comments[0], reply(2), reply(3)] }];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    const remove = async (text, outcome) => {
      await threads(page)
        .locator('.comment')
        .filter({ hasText: text })
        .getByRole('button', { name: 'Actions for the comment of jdoe' })
        .click();
      await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Delete' }).click();
      await expect(page.getByText(outcome)).toBeVisible();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
    };

    await remove('Reply 2', 'The replies stay');
    await expect(threads(page).getByText('Comment deleted')).toBeVisible();
    await expect(threads(page)).toContainText('Reply 3');

    // The last one goes with the placeholder before it
    await remove('Reply 3', 'It is removed.');
    await expect(threads(page).locator('.comment')).toHaveCount(1);

    await remove('First', 'It is removed, and the thread with it.');
    await expect(threads(page)).toHaveCount(0);
  });

  test('drafts survive switching to the files', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'Is this right?', author: OTHER })];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();
    await threads(page).getByPlaceholder('Reply…').fill('Half a reply');

    await page.getByRole('tab', { name: 'Files' }).click();
    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page).getByPlaceholder('Reply…')).toHaveValue('Half a reply');
  });

  test('the share dialog offers the modes the server enables', async ({ page, api }) => {
    api.shareModes = ['readonly'];
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Share' }).click();

    await page.locator('.v-dialog .v-select').filter({ hasText: 'Access' }).first().click();
    await expect(page.locator('.v-select__content .v-list-item')).toHaveText(['View only']);
  });

  test('the share dialog only grants enabled modes', async ({ page, api }) => {
    api.shareModes = ['comment'];
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Share' }).click();

    const dialog = page.locator('.v-dialog');
    await expect(dialog.locator('.v-select').filter({ hasText: 'Access' }).first()).toContainText(
      'Can comment',
    );
    await dialog.getByLabel('GitHub username(s)').fill('mmohr');
    await dialog.getByRole('button', { name: 'Invite' }).click();
    await expect
      .poll(() =>
        api.requests.find((r) => r.method === 'POST' && r.path.endsWith('/collaborators')),
      )
      .toBeTruthy();
    const invite = api.requests.find(
      (r) => r.method === 'POST' && r.path.endsWith('/collaborators'),
    );
    expect(JSON.parse(invite.body).mode).toBe('comment');
  });

  test('commenters comment, but neither edit files nor delete comments of others', async ({
    page,
    api,
  }) => {
    api.workspaces[0].viewer_role = 'comment';
    api.threads = [thread({ path: FILE, body: 'From the owner', author: OTHER })];
    await openWorkspace(page);
    await row(page, 'glossary').click();

    // Commenting, and what viewers can do too; nothing that changes the file
    expect(await menuEntries(page, 'accuracy.yaml')).toEqual([
      'Open in Source Code Editor',
      'Comment',
      'Download',
    ]);

    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page).getByPlaceholder('Reply…')).toBeVisible();
    await expect(
      threads(page).getByRole('button', { name: /Actions for the comment/ }),
    ).toHaveCount(0);
  });

  test('viewers only read the comments', async ({ page, api }) => {
    api.workspaces[0].viewer_role = 'readonly';
    api.threads = [thread({ path: FILE, body: 'Visible to viewers', author: OTHER })];
    await openWorkspace(page);
    await row(page, 'glossary').click();

    expect(await menuEntries(page, 'accuracy.yaml')).toEqual([
      'Open in Source Code Editor',
      'Download',
    ]);
    await row(page, 'accuracy.yaml').locator('.comment-count').click();
    await expect(threads(page)).toContainText('Visible to viewers');
    await expect(threads(page).getByPlaceholder('Reply…')).toHaveCount(0);
    await expect(threads(page).getByRole('button', { name: 'Resolve thread' })).toHaveCount(0);
  });

  test('shows the comments of others live', async ({ page }) => {
    let socket;
    await page.routeWebSocket(/^ws:\/\/localhost:8099\//, (ws) => (socket = ws));
    await openWorkspace(page);
    await row(page, 'glossary').click();

    await expect.poll(() => socket).toBeTruthy();
    socket.send(
      JSON.stringify({
        type: 'thread.created',
        ts: new Date().toISOString(),
        actor_user_id: OTHER.user_id,
        path: FILE,
        thread: thread({ path: FILE, body: 'Live from mmohr', author: OTHER }),
      }),
    );
    await expect(row(page, 'accuracy.yaml').locator('.comment-count')).toHaveText('1');

    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page)).toContainText('Live from mmohr');
  });

  test('late and stale updates never undo newer ones', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(/^ws:\/\/localhost:8099\//, (ws) => (socket = ws));
    const current = thread({ path: FILE, body: 'Current', updated_at: '2026-10-05T10:00:00Z' });
    api.threads = [current];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page)).toContainText('Current');
    await expect.poll(() => socket).toBeTruthy();

    const send = (type, fields) =>
      socket.send(
        JSON.stringify({
          type,
          ts: new Date().toISOString(),
          actor_user_id: OTHER.user_id,
          path: FILE,
          ...fields,
        }),
      );
    const older = thread({ path: FILE, body: 'Older', updated_at: '2026-10-04T10:00:00Z' });
    send('thread.updated', { thread: older });
    // Events are applied in order: once the marker shows, the older update was handled
    send('thread.created', { thread: thread({ id: 'marker', path: FILE, body: 'Marker' }) });
    await expect(threads(page)).toContainText(['Marker', 'Current']);
    await expect(threads(page).getByText('Older')).toHaveCount(0);

    send('thread.deleted', { thread_id: 'marker' });
    send('thread.deleted', { thread_id: current.id });
    await expect(threads(page)).toHaveCount(0);

    // A late update of the deleted thread doesn't bring it back
    send('thread.updated', { thread: { ...current, updated_at: '2026-10-06T10:00:00Z' } });
    await page.getByRole('tab', { name: 'Files' }).click();
    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page)).toHaveCount(0);
  });

  test('a missing file stays missing until a newer version or a reload', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(/^ws:\/\/localhost:8099\//, (ws) => (socket = ws));
    const missing = thread({ path: FILE, body: 'On accuracy', outdated: true });
    api.threads = [missing];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();
    await expect(threads(page).getByText('File missing')).toBeVisible();
    await expect.poll(() => socket).toBeTruthy();

    const send = (type, fields) =>
      socket.send(JSON.stringify({ type, ts: new Date().toISOString(), path: FILE, ...fields }));
    // The same version from before the file went: not applied
    send('thread.updated', {
      actor_user_id: OTHER.user_id,
      thread: { ...missing, outdated: false },
    });
    send('thread.created', {
      actor_user_id: OTHER.user_id,
      thread: thread({ id: 'marker', path: '/README.md', body: 'Marker' }),
    });
    await expect(threads(page)).toContainText(['Marker']);
    await expect(threads(page).getByText('File missing')).toBeVisible();

    // Saving the file restores it
    api.threads = [{ ...missing, outdated: false }];
    send('file.saved', {
      actor_user_id: 'user-1',
      file: { name: 'accuracy.yaml', path: FILE, is_directory: false, status: 'modified' },
    });
    await expect(threads(page).getByText('File missing')).toHaveCount(0);
  });

  test('the file filter follows a rename', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(/^ws:\/\/localhost:8099\//, (ws) => (socket = ws));
    api.threads = [thread({ path: FILE, body: 'On accuracy' })];
    await openWorkspace(page);
    await row(page, 'glossary').click();
    await row(page, 'accuracy.yaml').locator('.comment-count').click();
    await expect(page.locator('.comments-filter')).toContainText(SHOWN);

    await expect.poll(() => socket).toBeTruthy();
    const file = {
      name: 'precision.yaml',
      path: '/glossary/precision.yaml',
      is_directory: false,
      status: 'renamed',
    };
    socket.send(
      JSON.stringify({
        type: 'file.renamed',
        ts: new Date().toISOString(),
        actor_user_id: 'user-1',
        path: FILE,
        old_path: FILE,
        file,
      }),
    );
    await expect(page.locator('.comments-filter')).toContainText('glossary/precision.yaml');
  });

  test('comments show HTML as text, and no unsafe links', async ({ page, api }) => {
    api.threads = [
      thread({
        path: FILE,
        body: '<img src="x" onerror="window.hacked = true"> <b>not bold</b> **bold** [link](javascript:window.hacked=true)',
      }),
    ];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    await expect(threads(page)).toHaveCount(1);
    const body = threads(page).locator('.comment-body');
    await expect(body).toContainText(
      '<img src="x" onerror="window.hacked = true"> <b>not bold</b>',
    );
    await expect(body.locator('img, b')).toHaveCount(0);
    await expect(body.locator('strong')).toHaveText('bold');
    await expect(threads(page).locator('.comment-body a[href^="javascript"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });

  test('the comments filter names the file, and shows all again', async ({ page, api }) => {
    api.threads = [
      thread({ path: FILE, body: 'On accuracy' }),
      thread({ id: 'thread-2', path: '/README.md', body: 'On the readme' }),
    ];
    await openWorkspace(page);
    await row(page, 'glossary').click();
    await row(page, 'accuracy.yaml').locator('.comment-count').click();

    await expect(page.locator('.comments-filter')).toContainText(
      `Showing only comments on ${SHOWN} Show all`,
    );
    await expect(threads(page)).toHaveCount(1);
    // Threads are titled with the whole path
    const title = threads(page).getByRole('link', { name: SHOWN, exact: true });
    await title.hover();
    await expect(
      page.locator('.v-tooltip .v-overlay__content').filter({ hasText: 'Open in the editor' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('.comments-filter')).toHaveCount(0);
    await expect(threads(page)).toHaveCount(2);
  });

  test('the comment badge shows its own tooltip, not the path', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'On accuracy' })];
    await openWorkspace(page);
    await page.getByRole('textbox', { name: 'Search files and folders...' }).fill('accuracy');
    const result = page.locator('.file-tree-row').filter({ hasText: 'accuracy.yaml' });
    const tooltips = page.locator('.v-tooltip .v-overlay__content');

    // On the way from the name to the badge
    await result.locator('.file-tree-name').hover();
    await expect(tooltips.filter({ hasText: SHOWN })).toBeVisible();
    await result.locator('.comment-count').hover();
    await expect(tooltips.filter({ hasText: '1 open comment thread' })).toBeVisible();
    await expect(tooltips.filter({ hasText: SHOWN })).toBeHidden();
  });

  test('comment on a search result that the tree has not loaded', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'On accuracy' })];
    await openWorkspace(page);
    await page.getByRole('textbox', { name: 'Search files and folders...' }).fill('accuracy');
    await page
      .locator('.file-tree-row')
      .filter({ hasText: 'accuracy.yaml' })
      .locator('.comment-count')
      .click();

    await expect(page.locator('.comments-filter')).toContainText(SHOWN);
    await expect(page.getByRole('button', { name: 'Add Comment' })).toBeVisible();
  });

  test('comment on the open file from the editor', async ({ page, api }) => {
    api.threads = [thread({ path: '/README.md', body: 'On the readme' })];
    await openWorkspace(page);
    await row(page, 'glossary').click();
    await row(page, 'accuracy.yaml').click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('accuracy.yaml');

    // The tab tells the path
    await page.locator('.editor-tabs .v-tab--selected').hover();
    await expect(
      page
        .locator('.v-tooltip .v-overlay__content')
        .filter({ hasText: /^\s*glossary\/accuracy\.yaml\s*$/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: /^Comments/ }).click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: 'Add a comment' })
      .click();
    await page.getByLabel('Comment', { exact: true }).fill('From the editor');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(threads(page)).toHaveCount(1);
    expect(api.threads.find((t) => t.comments[0].body === 'From the editor').path).toBe(FILE);

    // The bar counts the open threads, and shows those of the file only
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(threads(page)).toHaveCount(2);
    await page.getByRole('button', { name: /^Comments 1/ }).click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: 'Show comments' })
      .click();
    await expect(page.locator('.comments-filter')).toContainText(SHOWN);
    await expect(threads(page)).toHaveCount(1);
  });

  test('the editor bar only shows comments that exist', async ({ page, api }) => {
    api.threads = [thread({ path: FILE, body: 'Resolved already', status: 'resolved' })];
    await openWorkspace(page);
    await row(page, 'README.md').click();
    const bar = page.getByRole('button', { name: /^Comments/ });
    await bar.click();
    await expect(page.locator('.v-overlay--active .v-list-item-title')).toHaveText([
      'Add a comment',
    ]);
    await page.keyboard.press('Escape');

    // Resolved threads count as comments to show
    await row(page, 'glossary').click();
    await row(page, 'accuracy.yaml').click();
    await bar.click();
    await expect(page.locator('.v-overlay--active .v-list-item-title')).toHaveText([
      'Add a comment',
      'Show comments',
    ]);
  });

  test('viewers can show the comments of the open file, not add one', async ({ page, api }) => {
    api.workspaces[0].viewer_role = 'readonly';
    api.threads = [thread({ path: FILE, body: 'On accuracy' })];
    await openWorkspace(page);
    await row(page, 'README.md').click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('README.md');
    await expect(page.getByRole('button', { name: /^Comments/ })).toHaveCount(0);

    await row(page, 'glossary').click();
    await row(page, 'accuracy.yaml').click();
    await page.getByRole('button', { name: /^Comments/ }).click();
    await expect(page.locator('.v-overlay--active .v-list-item-title')).toHaveText([
      'Show comments',
    ]);
  });

  test('the share page tells what the link allows', async ({ page, api }) => {
    api.sharePreviews.abc = {
      workspace_title: 'SR update',
      mode: 'comment',
      owner_display_name: 'jdoe',
    };
    await page.goto('/share/abc');

    await expect(page.getByText('Shared by jdoe')).toBeVisible();
    await expect(page.locator('.v-alert')).toContainText('You can view and comment');
    await expect(page.locator('.v-alert')).toContainText('Only the owner changes files.');
  });
});
