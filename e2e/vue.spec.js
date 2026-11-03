import { test, expect } from '@playwright/test';

test.describe('CEOS-ARD Editor', () => {
  test('visits the home page and displays the title', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('CEOS-ARD Editor');
    await expect(page.locator('h1')).toHaveText('CEOS-ARD Editor');
  });

  test('home page offers the GitHub login', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Sign in to get started')).toBeVisible();
    await expect(page.getByRole('button', { name: /GitHub/ })).toBeVisible();
  });
});
