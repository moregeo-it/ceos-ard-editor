import { test, expect, thread } from './support/mock-api';

const FILE = '/glossary/accuracy.yaml';
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

  test('only the first and the last comment can be deleted', async ({ page, api }) => {
    const base = thread({ path: FILE, body: 'First' });
    const reply = (n) => ({ ...base.comments[0], id: `c${n}`, body: `Reply ${n}` });
    api.threads = [{ ...base, comments: [base.comments[0], reply(2), reply(3)] }];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    const actionsOf = async (index) => {
      await threads(page)
        .getByRole('button', { name: 'Actions for the comment of jdoe' })
        .nth(index)
        .click();
      const items = page.locator('.v-overlay--active .v-list-item-title');
      await expect(items.first()).toBeVisible();
      const titles = (await items.allTextContents()).map((title) => title.trim());
      await page.keyboard.press('Escape');
      await expect(items).toHaveCount(0);
      return titles;
    };
    expect(await actionsOf(0)).toEqual(['Edit', 'Delete']);
    expect(await actionsOf(1)).toEqual(['Edit']);
    expect(await actionsOf(2)).toEqual(['Edit', 'Delete']);

    // The first comment leaves a placeholder, and the replies stay
    await threads(page)
      .getByRole('button', { name: 'Actions for the comment of jdoe' })
      .first()
      .click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Delete' }).click();
    await expect(page.getByText('The replies stay')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(threads(page).getByText('Comment deleted')).toBeVisible();
    await expect(threads(page)).toContainText('Reply 2');
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

  test('comments are sanitized', async ({ page, api }) => {
    api.threads = [
      thread({
        path: FILE,
        body: '<img src="x" onerror="window.hacked = true"> [link](javascript:window.hacked=true)',
      }),
    ];
    await openWorkspace(page);
    await page.getByRole('tab', { name: /Comments/ }).click();

    await expect(threads(page)).toHaveCount(1);
    await expect(threads(page).locator('.comment-body [onerror]')).toHaveCount(0);
    await expect(threads(page).locator('.comment-body a[href^="javascript"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });
});
