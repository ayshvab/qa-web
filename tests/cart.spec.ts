import { test, expect } from '../playwright/fixtures';


test.beforeEach(async ({ page }) => {
  await page.goto('https://enotes.pointschool.ru');
});


test.describe('displaying the quantity of goods next to the cart icon', () => {
  test.afterEach(async ({ page }) => {
    // Clean up state
  });

  test('First', async ({ page }) => {
    await expect(page.locator('#dropdownUser > div.text-uppercase')).toBeVisible();
    await expect(page.locator('#dropdownUser > div.text-uppercase')).toContainText('test');
  });
});


