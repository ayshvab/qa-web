import { test } from '../playwright/fixtures';
import { API } from './API';
import { URLs } from './config';
import { CartPage } from './model/cart-page';
import { RootPage } from './model/root-page';

test.describe('Test Cart', () => {
  let api: API;
  let rootPage: RootPage;
  let cartPage: CartPage;

  test.beforeEach(async ({ page }) => {
    await page.goto(URLs.root);

    api = new API(URLs, page);
    rootPage = new RootPage(page, api);
    cartPage = new CartPage(page);

    await rootPage.loadPageProducts();
    await rootPage.resetCart();
  });

  test('Go to empty cart', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });

  test('Go to cart with 1 normal price product', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.buyFirstNormalPriceProduct();
    await rootPage.checkcartItemCountDisplayHas(1);

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });

  test('Go to cart with 1 discount price product', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.buyFirstDiscountPriceProduct();
    await rootPage.checkcartItemCountDisplayHas(1);

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });

  test('Go to cart with 9 different products', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.buyFirstDiscountPriceProduct();
    await rootPage.checkcartItemCountDisplayHas(1);

    await rootPage.buyProducts(8);
    await rootPage.checkcartItemCountDisplayHas(9);

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });

  test('Go to cart with 9 of the same products', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.buySameProduct(9);
    await rootPage.checkcartItemCountDisplayHas(9);

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });

  test('Go to cart with 10 of the same products', async ({ page }) => {
    await rootPage.checkLoggedIn();
    await rootPage.checkCartIsEmpty();

    await rootPage.buySameProduct(10);
    await rootPage.checkcartItemCountDisplayHas(10);

    await rootPage.clickCartDropdown();
    await rootPage.checkCartPanel();

    await rootPage.clickGoToCart();
    await cartPage.checkPage();
  });
});



