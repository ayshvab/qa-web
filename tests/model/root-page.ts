import { expect, Page, Locator } from "@playwright/test";
import { API } from "../API";

class Cart {
  readonly products: Map<string, { name: string, totalPrice: number, count: number }>;

  constructor() {
    this.products = new Map();
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
  readonly locator: Locator;
  readonly cart: Cart;

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

  static async makeProduct(cart: Cart, item: Locator) {
    const name = await Product.helpers.name(item);
    const price = await Product.helpers.price(item);
    const hasDiscount = await Product.helpers.hasDiscount(item);
    const productCount = await Product.helpers.count(item);
    const id = await Product.helpers.id(item);

    const product = new Product(cart, id, name, price, productCount, hasDiscount, item);
    return product;
  }

  static helpers = {
    locators: {
      name:  (item: Locator) => item.locator("div.product_name"),
      price: (item: Locator)  => item.locator("span.product_price"),
      count: (item: Locator)  => item.locator(".product_count"),
    },

    parseProductCount(text: string): number {
      const result = Number.parseInt(text);
      if (Number.isSafeInteger(result)) {
        return result;
      }
      throw new Error('Failed to parse product count');
    },
    parseProductPrice(text: string): number {
      const result = Number.parseInt(text);
      if (Number.isSafeInteger(result)) {
        return result;
      }
      throw new Error('Failed to parse price');
    },

    async name(item: Locator): Promise<string> {
      return await this.locators.name(item).innerText();
    },

    async price(item: Locator): Promise<number> {
      const priceText = await this.locators.price(item).innerText();
      return this.parseProductPrice(priceText);
    },

    async hasDiscount(item: Locator): Promise<boolean> {
      const hasDiscountClassName = 'hasDiscount';
      const result = await item.getAttribute('class');
      if (result) {
        return result.includes(hasDiscountClassName);
      }
      return false;
    },

    async count(item: Locator): Promise<number> {
      const countText = await this.locators.count(item).innerText();
      return this.parseProductCount(countText);
    },

    async id(item: Locator): Promise<string> {
      const id = await item.getAttribute("data-product");
      if (!id) {
        throw new Error('data-product not found');
      }
      return id;
    }
  };
}

class RootPage {
  readonly page: Page;
  readonly cart: Cart;
  readonly api: API;
  readonly products: Map<string, Product>;

  constructor(page: Page, api: API) {
    this.page = page;
    this.api = api;
    this.cart = new Cart();
    this.products = new Map();
  }

  locators = {
    userDropdown:             () => this.page.locator('#dropdownUser'),
    logoutButton:             () => this.page.locator('#navbarNav > ul > li.nav-item.dropdown.show > div > form > button'),
    cartItemCountDisplay:     () => this.page.locator('#basketContainer > span.basket-count-items'),
    cartDropdown:             () => this.page.locator('#dropdownBasket'),
    productsContainer:        () => this.page.locator('body > div > div.container > div > div.note-list.row > div'),
    productList:              () => this.locators.productsContainer().locator('div.note-item'),
    normalPriceProductList:   () => this.locators.productsContainer().locator('div.note-item:not(.hasDiscount)'),
    discountPriceProductList: () => this.locators.productsContainer().locator('div.note-item.hasDiscount'),
    cartPanel: {
      panel:           () => this.page.locator('#basketContainer > div.dropdown-menu.dropdown-menu-right'),
      itemList:        () => this.locators.cartPanel.panel().locator('li.basket-item'),
      itemName:        (item: Locator) => item.locator('span.basket-item-title'),
      itemPrice:       (item: Locator) => item.locator('span.basket-item-price'),
      itemCount:       (item: Locator) => item.locator('span.basket-item-count'),
      totalPrice:      () => this.locators.cartPanel.panel().locator('span.basket_price'),
      resetCartButton: () => this.page.getByRole("button", { name: /очистить корзину/i }),
      goToCartButton:  () => this.page.getByRole("button", { name: /перейти в корзину/i }),
    },
  };

  // Actions

  async resetCart() {
    this.cart.reset();
    const response = await this.api.clearCart();
    expect(response.ok()).toBe(true);
    await this.page.reload();
  }

  async loadPageProducts() {
    await expect(this.locators.productList()).not.toHaveCount(0);
    const productItems = await this.locators.productList().all();
    for (const item of productItems) {
      const product = await Product.makeProduct(this.cart, item);
      this.products.set(product.id, product);
    }
  }

  async clickCart(): Promise<void> {
    await this.locators.cartDropdown().click();
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

  async clickCartDropdown(): Promise<void> {
    await expect(this.locators.cartDropdown()).toBeVisible();
    await this.locators.cartDropdown().click();
  }

  async clickResetCartButton(): Promise<void> {
    await expect(this.locators.cartPanel.resetCartButton()).toBeVisible();
    await this.locators.cartPanel.resetCartButton().click();
  }

  async clickGoToCart(): Promise<void> {
    await expect(this.locators.cartPanel.goToCartButton()).toBeVisible();
    await this.locators.cartPanel.goToCartButton().click();
  }

  // Assertions

  async checkLoggedIn(): Promise<void> {
    await expect(this.locators.userDropdown()).toBeVisible();
  }

  async checkcartItemCountDisplayHas(count: number) {
    await expect(this.locators.cartItemCountDisplay()).toContainText(count.toString());
  }

  async checkCartIsEmpty(): Promise<void> {
    await this.checkcartItemCountDisplayHas(0);
  }

  async checkCartPanel() {
    await expect(this.locators.cartPanel.panel()).toBeVisible();

    const cartItems = await this.locators.cartPanel.itemList().all();
    expect(this.cart.products.size).toEqual(cartItems.length);

    const expectedCartItems = [...this.cart.products.values()];
    for (let i=0; i < cartItems.length; i++) {
      const it = cartItems[i];
      const expectedItem = expectedCartItems[i];
      await expect(this.locators.cartPanel.itemName(it)).toHaveText(expectedItem.name);
      await expect(this.locators.cartPanel.itemPrice(it)).toHaveText(`- ${expectedItem.totalPrice} р.`);
      await expect(this.locators.cartPanel.itemCount(it)).toHaveText(expectedItem.count.toString());
    }
    await expect(this.locators.cartPanel.totalPrice()).toHaveText(this.cart.totalPrice.toString());
  }
}

export { RootPage };