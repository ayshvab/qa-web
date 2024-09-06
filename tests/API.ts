import { APIResponse, Page } from "@playwright/test";
import { type URLs } from './config';

class API {
  readonly page: Page;
  readonly urls: URLs;

  constructor(urls: URLs, page: Page) {
    this.page = page;
    this.urls = urls;
  }

  async csrfToken(): Promise<string> {
    let x_csrf_token: string | null = null;
    for (const metaTag of await this.page.locator('head > meta').all()) {
      const nameAttr = await metaTag.getAttribute('name');
      if (nameAttr && nameAttr === 'csrf-token') {
        x_csrf_token = await metaTag.getAttribute('content');
      }
    }
    if (!x_csrf_token) {
      throw new Error('No csrf_token found on page');
    }
    return x_csrf_token;
  }

  async cookies(): Promise<string> {
    const cookies = await this.page.context().cookies([this.urls.root]);
    return cookies.map(({ name, value }) => ([name, value].join('='))).join('; ');
  }

  async commonRequestHeaders() {
    return {
      'Cookie': await this.cookies(),
      'X-CSRF-Token': await this.csrfToken(),
    };
  }

  async clearCart(): Promise<APIResponse> {
    const headers = await this.commonRequestHeaders();
    const response = await this.page.context().request.post(this.urls.basketClear, { headers });
    return response;
  }
}

export { API };