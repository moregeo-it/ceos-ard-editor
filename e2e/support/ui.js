import { expect } from '@playwright/test';

// Data that reached the page without being turned into text, e.g. an object as a select option
export const RAW_DATA = /\[object Object\]|\{"|"\}|\bundefined\b|\bNaN\b/;

/** Fails if the text shown in the page, or in an open menu, contains raw data. */
export async function expectNoRawData(page) {
  const text = await page.locator('body').innerText();
  expect(text, 'raw data shown in the page').not.toMatch(RAW_DATA);
}

/** The texts of the options a select offers, read from its open menu. */
export async function optionTexts(page, select) {
  await select.click();
  const items = page.locator('.v-overlay--active .v-list-item');
  await expect(items.first()).toBeVisible();
  await expectNoRawData(page);
  const texts = (await items.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
  await page.keyboard.press('Escape');
  await expect(items).toHaveCount(0);
  return texts;
}

/** The labels of the form fields, in order. */
export async function fieldLabels(form) {
  await expect(form.locator('.v-field').first()).toBeVisible();
  // A filled field shows its label only in the floating copy, so read both regardless of visibility
  const labels = await form.locator('.v-field-label:not(.v-field-label--floating)').allTextContents();
  return labels.map((label) => label.trim());
}
