import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export * from '@playwright/test';
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [async ({ browser }, use) => {
    // Use parallelIndex as a unique identifier for each worker.
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);

    if (fs.existsSync(fileName)) {
      // Reuse existing authentication state if any.
      await use(fileName);
      return;
    }

    // Important: make sure we authenticate in a clean environment by unsetting storage state.
    const page = await browser.newPage({ storageState: undefined });

    const account = await acquireAccount(id);

    // Perform authentication steps. Replace these actions with your own.
    await page.goto('https://enotes.pointschool.ru/login');

    await fillLoginFormInput(page, '#loginform-username', account.username);
    await fillLoginFormInput(page, '#loginform-password', account.password);
    await page.getByRole('button', { name: 'Вход' }).click();

    // Wait until the page receives the cookies.
    //
    // Sometimes login flow sets cookies in the process of several redirects.
    // Wait for the final URL to ensure that the cookies are actually set.
    await page.waitForURL('https://enotes.pointschool.ru/');
    
    // End of authentication steps.

    await page.context().storageState({ path: fileName });
    await page.close();
    await use(fileName);
  }, { scope: 'worker' }],
});

async function acquireAccount(id: number) {
  // NOTE: Use `id` for account when issue with shared server state and different logins will be resolved.
  // For now, just ignore and use the same creds.
  return {
    username: 'test',
    password: 'test',
  };
}

async function fillLoginFormInput(page, locatorString: string, value: string) {
  const locator = page.locator(locatorString);
  await locator.click();
  for (const it of value) {
    await page.keyboard.type(it);
  }
  await expect(locator).toHaveValue(value);
}
