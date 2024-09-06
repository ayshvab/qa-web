import { test, expect, Locator, Page } from '../playwright/fixtures';

function parseProductPrice(text: string): number {
  const result = Number.parseInt(text);
  if (Number.isSafeInteger(result)) {
    return result;
  }
  throw new Error('Failed to parse price');
}

function parseProductCount(text: string): number {
  const result = Number.parseInt(text);
  if (Number.isSafeInteger(result)) {
    return result;
  }
  throw new Error('Failed to parse product count');
}

type CartItem = { name: string, totalPrice: number, count: number };
class Cart {
  products: Map<string, CartItem>;

  constructor() {
    this.products = new Map<string, CartItem>();
  }

  addProduct(product: Product) {
    if (!this.products.has(product.id)) {
      this.products.set(product.id, { name: product.name, totalPrice: 0, count: 0 });
    }
    const state = this.products.get(product.id);
    if (!state) throw new Error('Product id not found');
    state.totalPrice += product.price;
    state.count += 1;
  }

  get totalPrice() {
    return [...this.products.values()].reduce((acc, it) => acc + it.totalPrice, 0);
  }

  reset() {
    this.products.clear();
  }
}

class Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly totalCount: number;
  readonly hasDiscount: boolean;
  locator: Locator;
  cart: Cart;

  constructor(cart: Cart, productId: string, name: string, price: number, totalCount: number, hasDiscount: boolean, locator: Locator) {
    this.cart = cart;
    this.id = productId;
    this.name = name;
    this.price = price;
    this.totalCount = totalCount;
    this.hasDiscount = hasDiscount;
    this.locator = locator;
  }

  async clickBuy() {
    const buyButton = this.locator.getByRole("button", { name: /купить/i });
    await expect(buyButton).toBeVisible();
    await buyButton.click();

    this.cart.addProduct(this);
  }
}

const CLASS_NAMES = {
  hasDiscount: 'hasDiscount'
};


async function productHasDiscount(item: Locator) {
  const result = await item.getAttribute('class');
  if (result) {
    return result.includes(CLASS_NAMES.hasDiscount);
  }
  return false;
}

class RootLocators {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  userDropdown() {
    return this.page.locator('#dropdownUser');
  }

  logoutButton() {
    return this.page.locator('#navbarNav > ul > li.nav-item.dropdown.show > div > form > button');
  }

  cartItemCountDisplay() {
    return this.page.locator('#basketContainer > span.basket-count-items');
  }

  cartDropdown() {
    return this.page.locator('#dropdownBasket');
  }


}

class CartPanelLocators {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  resetCartButton() {
    return this.page.getByRole("button", { name: /очистить корзину/i });
  }
};


class App {
  static readonly URLs = {
    root: 'https://enotes.pointschool.ru',
    basket: 'https://enotes.pointschool.ru/basket',
    basketClear: 'https://enotes.pointschool.ru/basket/clear'
  };
  readonly page: Page;
  cart: Cart;
  products: Map<string, Product>;
  locators: Locators;

  constructor(page: Page) {
    this.page = page;
    this.cart = new Cart();
    this.products = new Map();
    this.locators = new RootLocators(page); // TODO ??
  }

  userDropdown = (): Locator => this.page.locator('#dropdownUser');

  logoutButton = (): Locator => this.page.locator('#navbarNav > ul > li.nav-item.dropdown.show > div > form > button');

  // TODO rename to cartItemCountDisplay
  cartItemsCountSpan = (): Locator => this.page.locator('#basketContainer > span.basket-count-items')

  cartDropdown = (): Locator => this.page.locator('#dropdownBasket');

  resetCartButton = (): Locator => this.page.getByRole("button", { name: /очистить корзину/i });

  productsContainer = (): Locator => this.page.locator('body > div > div.container > div > div.note-list.row > div');
  productList  = (): Locator => this.productsContainer().locator('div.note-item');
  normalPriceProductList = (): Locator => this.productsContainer().locator('div.note-item:not(.hasDiscount)');
  discountPriceProductList = (): Locator => this.productsContainer().locator('div.note-item.hasDiscount');

  goToCartButton = (): Locator => this.page.getByRole("button", { name: /перейти в корзину/i });

  // Cart
  cartPanel = (): Locator => this.page.locator('#basketContainer > div.dropdown-menu.dropdown-menu-right');
  cartPanelItemList = (): Locator => this.cartPanel().locator('li.basket-item');
  //   cartPanelItemTitle = (): Locator => this.cartPanel().locator('span.basket-item-title
  cartPanelTotalPrice = (): Locator => this.cartPanel().locator('span.basket_price');

  async checkLoggedIn(): Promise<void> {
    await expect(this.userDropdown()).toBeVisible();
  }

  async checkCartItemsCountSpanHas(count: number) {
    await expect(this.cartItemsCountSpan()).toContainText(count.toString());
  }

  async checkCartIsEmpty(): Promise<void> {
    //await expect(this.cartItemsCountSpan()).toContainText('0');
    await this.checkCartItemsCountSpanHas(0);
  }

  async clickCart(): Promise<void> {
    await this.cartDropdown().click();
  }

  async makeProduct(item: Locator): Promise<Product> {
    const name = await item.locator("div.product_name").innerText();
    const priceText = await item.locator("span.product_price").innerText();
    const price = parseProductPrice(priceText);
    const hasDiscount = await productHasDiscount(item);
    const countText = await item.locator(".product_count").innerText();
    const productCount = parseProductCount(countText);

    const id = await item.getAttribute("data-product");
    if (!id) {
      throw new Error("Data product id not found");
    }
    const product = new Product(this.cart, id, name, price, productCount, hasDiscount, item);
    return product;
  }

  async loadPageProducts() {
    await expect(this.productList()).not.toHaveCount(0);
    const products = await this.productList().all();
    for (const item of products) {
      const product = await this.makeProduct(item);
      this.products.set(product.id, product);
    }
  }

  async buyFirstNormalPriceProduct(): Promise<void> {
    const normalPriceProduct = [...this.products.values()].find(it => !it.hasDiscount);
    if (!normalPriceProduct) {
      throw new Error("Not found product with normal price");
    }
    await normalPriceProduct.clickBuy();
  }

  async buyFirstDiscountPriceProduct(): Promise<void> {
    const discountPriceProduct = [...this.products.values()].find(it => it.hasDiscount);
    if (!discountPriceProduct) {
      throw new Error("Not found product with discount price");
    }
    await discountPriceProduct.clickBuy();
  }

  async buyProducts(count: number): Promise<void> {
    const products = [...this.products.values()];
    for (let i=0; i < count; i++) {
      const next = i % products.length;
      await products[next].clickBuy();
    }
  }

  async buySameProduct(count: number): Promise<void> {
    const product = [...this.products.values()].find(it => it.totalCount >= count);
    if (!product) {
      throw new Error(`Failed to find product with enough count: ${count}`);
    }
    for (let i=0; i<count; i++) {
      await product.clickBuy();
    }
  }

  async resetCart(): Promise<void> {
    this.cart.reset();
    const cookies = await this.page.context().cookies([App.URLs.root]);
    const Cookie = cookies.map(({ name, value }) => ([name, value].join('='))).join('; ');
    const headers = {
      Cookie,
    };

    for (const metaTag of await this.page.locator('head > meta').all()) {
      const nameAttr = await metaTag.getAttribute('name');
      if (nameAttr && nameAttr === 'csrf-token') {
        const x_csrf_token = await metaTag.getAttribute('content');
        if (!x_csrf_token) {
          throw new Error('No csrf_token in meta tag');
        }
        headers['X-CSRF-Token'] = x_csrf_token;
      }
    }
    const response = await this.page.context().request.post(App.URLs.basketClear, { headers });
    expect(response.ok()).toBe(true);
    await this.page.reload();
  }

  async clickCartDropdown(): Promise<void> {
    await expect(this.cartDropdown()).toBeVisible();
    await this.cartDropdown().click();
  }

  async clickResetCartButton(): Promise<void> {
    await expect(this.resetCartButton()).toBeVisible();
    await this.resetCartButton().click();
  }

  async clickGoToCart(): Promise<void> {
    await expect(this.goToCartButton()).toBeVisible();
    await this.goToCartButton().click();
  }

  async checkCartPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/basket/);
    await this.checkNoSiteError();
  }

  async checkNoSiteError(): Promise<void> {
    const error = this.page.getByText('Server Error');
    await expect(error).toHaveCount(0);
  }

  async checkCartPanel() {
    await expect(this.cartPanel()).toBeVisible();
    const cartItems = await this.cartPanelItemList().all();

    expect(this.cart.products.size).toEqual(cartItems.length);

    const expectedCartItems = [...this.cart.products.values()];
    for (let i=0; i < cartItems.length; i++) {
      const it = cartItems[i];
      const expectedItem = expectedCartItems[i];
      await expect(it.locator('span.basket-item-title')).toHaveText(expectedItem.name);
      await expect(it.locator('span.basket-item-price')).toHaveText(`- ${expectedItem.totalPrice} р.`);
      await expect(it.locator('span.basket-item-count')).toHaveText(expectedItem.count.toString());
    }

    await expect(this.cartPanel().locator('span.basket_price')).toHaveText(this.cart.totalPrice.toString());
  }
}

test.describe('Test Cart', () => {
  let app: App;

  test.beforeEach(async ({ page }) => {
    await page.goto('https://enotes.pointschool.ru');
    app = new App(page);
    await app.loadPageProducts();
    await app.resetCart();
  });

  test('Go to empty cart', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });

  test('Go to cart with 1 normal price product', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buyFirstNormalPriceProduct();
    await app.checkCartItemsCountSpanHas(1);

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });

  test('Go to cart with 1 discount price product', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buyFirstDiscountPriceProduct();
    await app.checkCartItemsCountSpanHas(1);

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });

  test('Go to cart with 9 different products', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buyFirstDiscountPriceProduct();
    await app.checkCartItemsCountSpanHas(1);

    await app.buyProducts(8);
    await app.checkCartItemsCountSpanHas(9);

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });

  test('Go to cart with 9 of the same products', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buySameProduct(9);
    await app.checkCartItemsCountSpanHas(9);

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });

  test('Go to cart with 10 of the same products', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buySameProduct(10);
    await app.checkCartItemsCountSpanHas(10);

    await app.clickCartDropdown();
    await app.checkCartPanel();

    await app.clickGoToCart();
    await app.checkCartPage();
  });
});



