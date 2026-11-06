// Cart operations (BRIEF §5, §12; ARCHITECTURE §9 row 06, §4.6, §4.7 Steadfast.cart, §8.4).
import { test, expect, fx, gotoOk, projectContext, cartJSON, apiAdd, expectDialogOpen, openCartFromHeader, chooseOption, visibleText, ariaLabels, markIntroSeen } from './helpers/base.mjs';

const ready = fx.fixturesReady();
const drawer = (page) => page.locator('#sf-cart-drawer dialog');
const headerCount = (page) => page.locator('[data-sf-header] sf-cart-count').first();
const BAG = /\bbag\b/i;

async function expectNoBag(page) {
  const text = await visibleText(page);
  expect(text.match(BAG), 'no visible "bag"').toBeNull();
  const labels = (await ariaLabels(page)).filter((l) => BAG.test(l));
  expect(labels, 'no aria-label "bag"').toEqual([]);
  const live = await page.locator('#sf-live-polite, #sf-live-assertive').allTextContents();
  expect(live.join(' ').match(BAG), 'no announced "bag"').toBeNull();
}

/** Reveals a card's size cells (hover on desktop, the "Add to cart" toggle on touch) and returns the cell. */
async function sizeCell(page, card, value) {
  const cell = card.locator('form[data-sf-quick-add] button[type="submit"]', { hasText: new RegExp(`^\\s*${value}(\\s|$)`) }).first();
  if (!(await cell.isVisible())) {
    await card.hover().catch(() => {});
    if (!(await cell.isVisible())) {
      const toggle = card.locator('.sf-card__actions button[aria-expanded]').first();
      if (await toggle.count()) { await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true'); }
    }
  }
  await expect(cell).toBeVisible();
  return cell;
}

test.describe('cart', () => {
  test.skip(!ready, 'fixtures missing');

  test('add from the PDP opens the drawer, count = 1, live region announces; +/−/remove work', async ({ page }) => {
    const p = fx.sizeCellProduct();
    const v = fx.firstAvailable(p);
    await gotoOk(page, `/products/${p.handle}`);
    await page.locator('main sf-product-form button[type="submit"]').first().click();
    await expectDialogOpen(page, 'sf-cart-drawer');
    await expect(drawer(page).locator('.sf-cart-line')).toHaveCount(1);
    await expect(headerCount(page)).toHaveAttribute('data-count', '1');
    await expect(page.locator('#sf-live-polite')).toContainText(/added to cart/i);
    await expect(page.locator('#sf-live-polite')).toContainText(p.title);
    expect((await cartJSON(page)).items[0].variant_id).toBe(v.id);
    await expectNoBag(page);

    const line = drawer(page).locator('.sf-cart-line').first();
    await line.locator('[data-sf-qty-plus], button[aria-label*="ncrease" i]').first().click();
    await expect.poll(async () => (await cartJSON(page)).item_count).toBe(2);
    await expect(headerCount(page)).toHaveAttribute('data-count', '2');
    await expect(drawer(page).locator('.sf-cart-line input[name="updates[]"]').first()).toHaveValue('2');
    await drawer(page).locator('.sf-cart-line [data-sf-qty-minus], .sf-cart-line button[aria-label*="ecrease" i]').first().click();
    await expect.poll(async () => (await cartJSON(page)).item_count).toBe(1);
    await drawer(page).locator('.sf-cart-line [data-sf-cart-remove]').first().click();
    await expect.poll(async () => (await cartJSON(page)).item_count).toBe(0);
    await expect(drawer(page)).toContainText('Your cart is empty.');
    await expect(headerCount(page)).toHaveAttribute('data-count', '0');
    await expect(page.locator('#sf-live-polite')).toContainText(/removed from cart/i);
    await expectDialogOpen(page, 'sf-cart-drawer'); // the dialog stays open while its body is swapped
  });

  test('exceeding fixture inventory shows the 422 message inline', async ({ page, guard }) => {
    guard.allow(/status of 422/);
    const cand = fx.products().flatMap((p) => p.variants.map((v) => ({ p, v })))
      .find(({ v }) => v.available !== false && v.inventory_management === 'shopify' && v.inventory_policy === 'deny' && v.inventory_quantity > 0 && v.inventory_quantity < 50);
    test.skip(!cand, 'no inventory-limited variant');
    const { p, v } = cand;
    await gotoOk(page, `/products/${p.handle}?variant=${v.id}`);
    expect((await apiAdd(page, v.id, v.inventory_quantity)).ok()).toBeTruthy();
    await page.reload();
    await openCartFromHeader(page);
    const input = drawer(page).locator('.sf-cart-line input[name="updates[]"]').first();
    await expect(input).toHaveValue(String(v.inventory_quantity));
    const resp = page.waitForResponse((r) => /\/cart\/(change|update)(\.js)?/.test(r.url()) && r.request().method() === 'POST');
    await drawer(page).locator('.sf-cart-line [data-sf-qty-plus]').first().click();
    expect((await resp).status()).toBe(422);
    const err = drawer(page).locator('.sf-cart-line [data-sf-line-error], .sf-cart-line [role="alert"], .sf-cart-line .sf-form-error').first();
    await expect(err).toBeVisible();
    await expect(err).toContainText(/only add/i);
    expect((await cartJSON(page)).item_count).toBe(v.inventory_quantity);
  });

  test('empty state renders in the drawer and on /cart', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/collections/all');
    await openCartFromHeader(page);
    await expect(drawer(page)).toContainText('Your cart is empty.');
    await expect(drawer(page).getByRole('link', { name: /explore collection/i })).toBeVisible();
    await gotoOk(page, '/cart');
    await expect(page.locator('main')).toContainText('Your cart is empty.');
  });

  test('card size cells: one form per variant, sold out disabled, a click adds that size and opens the drawer', async ({ page }) => {
    const p = fx.sizeCellProduct();
    const si = p.options.findIndex((o) => fx.optName(o).toLowerCase() === 'size');
    await gotoOk(page, '/collections/all');
    const card = page.locator(`main sf-product-card[data-product-handle="${p.handle}"]`).first();
    await expect(card.locator('form[action$="/cart/add"]')).toHaveCount(p.variants.length);
    for (const v of fx.soldOutVariants(p)) {
      const cell = card.locator(`form[data-sf-quick-add]:has(input[name="id"][value="${v.id}"]) button`);
      const off = await cell.evaluate((b) => b.disabled || b.getAttribute('aria-disabled') === 'true');
      expect(off, `sold-out size ${fx.variantOptions(v)[si]} disabled`).toBe(true);
      await expect(cell).toContainText(/sold out/i);
    }
    const v = fx.availableVariants(p)[0];
    const size = fx.variantOptions(v)[si];
    const cell = await sizeCell(page, card, size);
    await expect(cell).toHaveAttribute('aria-label', `Add size ${size} to cart`);
    await cell.click();
    await expectDialogOpen(page, 'sf-cart-drawer');
    const cart = await cartJSON(page);
    expect(cart.items.map((i) => i.variant_id)).toEqual([v.id]);
    await expect(page.locator('#sf-live-polite')).toContainText(/added to cart/i);
    await expectNoBag(page);
  });

  test('card size cell without JS posts to /cart/add and lands on /cart with the line', async ({ browser, baseURL }, testInfo) => {
    const p = fx.sizeCellProduct();
    const si = p.options.findIndex((o) => fx.optName(o).toLowerCase() === 'size');
    const v = fx.availableVariants(p)[0];
    const ctx = await browser.newContext(projectContext(testInfo, baseURL, { javaScriptEnabled: false }));
    const page = await ctx.newPage();
    await page.goto('/collections/all');
    const card = page.locator(`main sf-product-card[data-product-handle="${p.handle}"]`).first();
    const cell = card.locator(`form[data-sf-quick-add]:has(input[name="id"][value="${v.id}"]) button[type="submit"]`);
    await expect(cell).toHaveText(new RegExp(fx.variantOptions(v)[si]));
    // Keyboard activation of the cell's submit button (cells are in the tab order on every pointer type).
    await cell.focus();
    await expect(cell).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/cart$/);
    await expect(page.locator('main')).toContainText(p.title);
    await ctx.close();
  });

  test('multi-option card "Add to cart" opens quick view (intent add); quick view add works', async ({ page }) => {
    const p = fx.multiOptionProduct();
    test.skip(!p, 'no multi-option fixture');
    await gotoOk(page, '/collections/all');
    const card = page.locator(`main sf-product-card[data-product-handle="${p.handle}"]`).first();
    const add = card.locator('a[data-sf-quick-view][data-intent="add"]').first();
    await card.hover().catch(() => {});
    const qvReq = page.waitForRequest((r) => r.url().includes('section_id=sf-quick-view'));
    await add.click();
    await qvReq;
    await expectDialogOpen(page, 'sf-quick-view');
    const qv = page.locator('#sf-quick-view dialog');
    await expect(qv.locator('sf-variant-picker')).toHaveCount(1);
    const quickOpen = (await page.evaluate(() => window.__sfEvents.filter((e) => e.name === 'quickview:open'))).pop();
    expect(quickOpen?.detail?.intent).toBe('add');
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#sf-quick-view fieldset')), { message: 'focus on the first option fieldset' }).toBe(true);
    const v = fx.availableVariants(p)[0];
    for (const [i, opt] of p.options.entries()) if ((opt.values || []).length > 1) await chooseOption(qv, fx.optName(opt), fx.variantOptions(v)[i]);
    await expect(qv.locator('input[name="id"]').first()).toHaveValue(String(v.id));
    await qv.locator('sf-product-form button[type="submit"]').first().click();
    await expectDialogOpen(page, 'sf-quick-view', false);
    await expectDialogOpen(page, 'sf-cart-drawer');
    expect((await cartJSON(page)).items.map((i) => i.variant_id)).toContain(v.id);
    await expect(page.locator('#sf-live-polite')).toContainText(/added to cart/i);
    await expectNoBag(page);
  });

  test('/cart page update works with JS', async ({ page }) => {
    const v = fx.firstAvailable(fx.sizeCellProduct());
    await page.goto('/__preview/health');
    expect((await apiAdd(page, v.id, 1)).ok()).toBeTruthy();
    await gotoOk(page, '/cart');
    const main = page.locator('[data-sf-main-cart]');
    await expect(main.locator('.sf-cart-line')).toHaveCount(1);
    await main.locator('.sf-cart-line [data-sf-qty-plus]').first().click();
    await expect.poll(async () => (await cartJSON(page)).item_count).toBe(2);
    await expect(main.locator('.sf-cart-line input[name="updates[]"]').first()).toHaveValue('2');
    await main.locator('.sf-cart-line [data-sf-cart-remove]').first().click();
    await expect.poll(async () => (await cartJSON(page)).item_count).toBe(0);
    await expect(main).toContainText('Your cart is empty.');
  });

  test('/cart page update works without JS; checkout POSTs to /cart → /checkout notice', async ({ browser, baseURL }, testInfo) => {
    const v = fx.firstAvailable(fx.sizeCellProduct());
    const ctx = await browser.newContext(projectContext(testInfo, baseURL, { javaScriptEnabled: false }));
    const page = await ctx.newPage();
    await page.goto('/__preview/health');
    expect((await page.request.post('/cart/add.js', { data: { items: [{ id: v.id, quantity: 1 }] } })).ok()).toBeTruthy();
    await page.goto('/cart');
    const input = page.locator('#sf-cart-form input[name="updates[]"], input[name="updates[]"][form="sf-cart-form"]').first();
    await input.fill('3');
    await page.locator('button[type="submit"][name="update"]').first().click();
    await page.waitForURL(/\/cart$/);
    expect((await (await page.request.get('/cart.js')).json()).item_count).toBe(3);
    await expect(page.locator('input[name="updates[]"]').first()).toHaveValue('3');
    await page.locator('button[name="checkout"]').first().click();
    await page.waitForURL(/\/checkout$/);
    await expect(page.locator('body')).toContainText('Checkout is provided by Shopify and is not available in this preview.');
    await ctx.close();
  });

  test('drawer checkout POSTs to /cart → /checkout notice', async ({ page }) => {
    const v = fx.firstAvailable(fx.sizeCellProduct());
    await page.goto('/__preview/health');
    await apiAdd(page, v.id, 1);
    await gotoOk(page, '/collections/all');
    await openCartFromHeader(page);
    const checkout = drawer(page).locator('button[name="checkout"]').first();
    await expect(checkout).toHaveText(/checkout/i);
    const form = await checkout.evaluate((b) => ({ action: new URL(b.form.action).pathname, method: b.form.method }));
    expect(form).toEqual({ action: '/cart', method: 'post' });
    await checkout.click();
    await page.waitForURL(/\/checkout$/);
    await expect(page.locator('body')).toContainText('Checkout is provided by Shopify');
  });

  test('cart_type page: add navigates to /cart', async ({ page }) => {
    const p = fx.sizeCellProduct();
    await gotoOk(page, `/products/${p.handle}?preview_settings=${encodeURIComponent(JSON.stringify({ cart_type: 'page' }))}`);
    await expect(page.locator('[data-sf-header] a[href$="/cart"]').first()).not.toHaveAttribute('data-sf-open', 'cart');
    await page.locator('main sf-product-form button[type="submit"]').first().click();
    await page.waitForURL(/\/cart(\?|$)/);
    await expect(page.locator('main')).toContainText(p.title);
    await page.goto('/?preview_settings=reset');
  });
});
