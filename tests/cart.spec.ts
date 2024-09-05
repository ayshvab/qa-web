import { test, expect, Locator, Page } from '../playwright/fixtures';

function parsePrice(text: string): number {
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

class Locators {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // TODO
}


class App {
  readonly page: Page;
  cart: Cart;
  products: Map<string, Product>;
  locators: Locators;

  constructor(page: Page) {
    this.page = page;
    this.cart = new Cart();
    this.products = new Map();
    this.locators = new Locators(page); // TODO ??
  }

  userDropdown = (): Locator => this.page.locator('#dropdownUser');

  logoutButton = (): Locator => this.page.locator('#navbarNav > ul > li.nav-item.dropdown.show > div > form > button');

  cartItemsCountSpan = (): Locator => this.page.locator('#basketContainer > span.basket-count-items')

  cartDropdown = (): Locator => this.page.locator('#dropdownBasket');

  resetCartButton = (): Locator => this.page.getByRole("button", { name: /очистить корзину/i });

  serverError = (): Locator => this.page.getByText('Server Error');

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

  async checkCartSpanCountHas(count: number) {
    await expect(this.cartItemsCountSpan()).toContainText(count.toString());
  }

  async checkCartIsEmpty(): Promise<void> {
    //await expect(this.cartItemsCountSpan()).toContainText('0');
    await this.checkCartSpanCountHas(0);
  }

  async clickCart(): Promise<void> {
    await this.cartDropdown().click();
  }

  async makeProduct(item: Locator): Promise<Product> {
    const name = await item.locator("div.product_name").innerText();

    // const priceLocator = item.getByText(/Цена/i);
    const spanPrice = item.locator("span.product_price");
    const priceText = await spanPrice.innerText();
    const price = parsePrice(priceText);
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
      // console.log('PRODUCT', product)
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

  async resetCart(): Promise<void> {
    const countSpan = this.cartItemsCountSpan();
    if (await countSpan.isVisible()) {
      const countValue = await countSpan.innerText();
      if (countValue.startsWith('0')) return;
    }
    await this.clickCartDropdown();
    await this.clickResetCartButton();
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

  async waitForCartPage(): Promise<void> {
    await this.page.waitForURL('**/basket');
  }

  async checkCartPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/basket/);
  }

  async checkNoSiteError(): Promise<void> {
    const error = this.page.getByText('Server Error');
    await expect(error).toHaveCount(0);
  }

  async checkCartPanel() {
    await expect(this.cartPanel()).toBeVisible();

    const cartItems = await this.cartPanelItemList().all();

    console.log('CHECKCARTPANEL', this.cart.products);
    console.log('CARTITEMS', cartItems);

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

// 'displaying the quantity of goods next to the cart icon'
test.describe('Test Cart', () => {
  let app: App;

  test.beforeEach(async ({ page }) => {
    await page.goto('https://enotes.pointschool.ru');

    app = new App(page);

    await app.loadPageProducts();

    await app.resetCart();
  });

  // test('Go to empty cart', async ({ page }) => {
  //   await app.checkLoggedIn();
  //   await app.checkCartIsEmpty();

  //   await app.clickCartDropdown();
  //   await app.clickGoToCart();

  //   await app.waitForCartPage();
  //   await app.checkNoSiteError();
  //   await app.checkCartPage();
  // });

  test('Go to cart with 1 normal price product', async ({ page }) => {
    await app.checkLoggedIn();
    await app.checkCartIsEmpty();

    await app.buyFirstNormalPriceProduct();

    await app.checkCartSpanCountHas(1);

    await app.clickCartDropdown();
    await app.checkCartPanel();
    await app.clickGoToCart();

    await app.waitForCartPage();
    await app.checkNoSiteError();
    await app.checkCartPage();
  });
});


