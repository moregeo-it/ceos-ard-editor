import { test, expect } from '@playwright/test'

test.describe('CEOS-ARD Editor', () => {
  test('visits the home page and displays the title', async ({ page }) => {
    await page.goto('/')

    // Check that the app bar has the correct title
    await expect(page.locator('.v-app-bar-title')).toHaveText('CEOS-ARD Editor')

    // Check that the main heading is displayed
    await expect(page.locator('h1')).toHaveText('CEOS-ARD Editor')
  })

  test('home page content is centered', async ({ page }) => {
    await page.goto('/')

    // Check that the container and content exist
    await expect(page.locator('[class*="v-container"]')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('h1')).toHaveClass(/text-h2/)
  })
})
