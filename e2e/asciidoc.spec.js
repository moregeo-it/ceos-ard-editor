import { test, expect } from './support/mock-api';

const DOCUMENT = '/sections/document.adoc';
const SCOPE = '/sections/scope.adoc';

async function openFile(page, ...names) {
  for (const name of names) {
    await page
      .locator('.file-tree-row')
      .filter({ has: page.locator('.file-tree-name').getByText(name, { exact: true }) })
      .click();
  }
}

test.describe('AsciiDoc', () => {
  test.beforeEach(async ({ api }) => {
    api.files.set(DOCUMENT, {
      content: '= OGC API - Records - Part 1: Core\n\ninclude::scope.adoc[]\n',
    });
    api.files.set(SCOPE, { content: '== Scope\n\nThe scope of the standard.\n\nMore text.\n' });
  });

  test('AsciiDoc files are edited visually', async ({ page, api }) => {
    await page.goto('/workspaces/ws-1');
    await openFile(page, 'sections', 'scope.adoc');

    const frame = page.frameLocator('.asciidoc-editor iframe');
    await expect(frame.getByRole('heading', { name: 'Scope' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    const paragraph = frame.getByText('The scope of the standard.');
    // In Firefox, the first click only focuses the frame
    await expect(async () => {
      await paragraph.click();
      await expect(paragraph).toBeFocused({ timeout: 500 });
    }).toPass();
    await page.keyboard.press('End');
    await page.keyboard.type(' Edited.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Only the edited line changes
    await expect
      .poll(() => api.files.get(SCOPE).content)
      .toBe('== Scope\n\nThe scope of the standard. Edited.\n\nMore text.\n');
  });

  test('AsciiDoc files are highlighted in the source code editor', async ({ page }) => {
    await page.goto('/workspaces/ws-1');
    await openFile(page, 'sections');
    await page.getByRole('button', { name: 'Actions for document.adoc', exact: true }).click();
    await page
      .locator('.v-overlay--active .v-list-item')
      .filter({ hasText: 'Open in Source Code Editor' })
      .click();

    const content = page.locator('.v-window-item--active .cm-content');
    await expect(content.locator('span', { hasText: 'Part 1: Core' })).toHaveCSS(
      'font-weight',
      '700',
    );
    await expect(content.locator('span', { hasText: 'include::' })).not.toHaveCSS(
      'font-weight',
      '700',
    );
  });

  test('viewers read AsciiDoc files in the source code editor', async ({ page, api }) => {
    api.workspaces[0].viewer_role = 'readonly';
    await page.goto('/workspaces/ws-1');
    await openFile(page, 'sections', 'document.adoc');

    await expect(page.locator('.v-window-item--active .cm-content')).toContainText('Part 1: Core');
    await expect(page.locator('.asciidoc-editor')).toHaveCount(0);
  });
});
