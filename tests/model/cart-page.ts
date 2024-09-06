import { expect, Page } from "@playwright/test";

class CartPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async checkNoSiteError(): Promise<void> {
    const error = this.page.getByText('Server Error');
    await expect(error).toHaveCount(0);
  }

  async checkPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/basket/);
    await this.checkNoSiteError();
  }
}

export { CartPage };
