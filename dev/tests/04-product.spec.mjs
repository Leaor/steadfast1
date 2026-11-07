// Product pages (BRIEF §7, §12; ARCHITECTURE §9 row 04, §2.4 sf-main-product, §4.7; DESIGN §7.8).
import { test, expect, fx, gotoOk, assertNoTemplateErrors, expectDialogOpen, visibleText, chooseSizeIfRequired } from './helpers/base.mjs';

const handles = fx.fixturesReady() ? fx.products().map((p) => p.handle) : [];
if (!handles.length) test('fixtures available', () => { throw new Error('dev/preview/fixtures/products.json missing'); });

for (const handle of handles) {
  test.describe(`PDP ${handle}`, () => {
    test('title, price, media, buy button, accordions, JSON-LD, honesty', async ({ page }) => {
      const p = fx.product(handle);
      await gotoOk(page, `/products/${handle}`);
      await assertNoTemplateErrors(page);
      const main = page.locator('main');

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(p.title);
      const v = fx.firstAvailable(p);
      await expect(main.locator('[data-sf-price]').first()).toContainText(fx.formatMoney(v.price));

      // Every fixture image is rendered (front/back/detail views as they exist), with width + height.
      const gallery = main.locator('sf-product-gallery').first();
      await expect(gallery).toHaveCount(1);
      const imgs = await gallery.locator('img').evaluateAll((els) => els.map((i) => ({ src: (i.currentSrc || i.getAttribute('src') || '') + ' ' + (i.getAttribute('srcset') || ''), w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.getAttribute('alt'), loading: i.getAttribute('loading') })));
      for (const m of fx.productImages(p)) {
        const base = fx.mediaBase(m);
        expect(imgs.some((i) => i.src.includes(base)), `media ${base} rendered`).toBe(true);
      }
      for (const i of imgs) {
        expect(Number(i.w), `img width attr ${i.src.slice(0, 80)}`).toBeGreaterThan(0);
        expect(Number(i.h), 'img height attr').toBeGreaterThan(0);
        expect(i.alt, 'img has alt').not.toBeNull();
        expect(i.loading, 'img has explicit loading').not.toBeNull();
      }
      const first = gallery.locator('img').first();
      await expect(first).toHaveAttribute('loading', 'eager');
      await expect(first).toHaveAttribute('fetchpriority', 'high');

      // Buy button: "Add to cart" (or "Sold out" when nothing is available); no dynamic checkout by default.
      const buy = main.locator('sf-product-form button[type="submit"]').first();
      // Size is never pre-selected: with several sizes the button first asks for one, then reads "Add to cart".
      if (fx.isAvailable(p) && (await buy.getAttribute('data-state')) === 'select') {
        await expect(buy).toHaveText(/^\s*select a size\s*$/i);
        await chooseSizeIfRequired(main, p);
      }
      await expect(buy).toHaveText(fx.isAvailable(p) ? /^\s*add to cart\s*$/i : /^\s*sold out\s*$/i);
      await expect(main.locator('.shopify-payment-button, [data-shopify="payment-button"], shopify-accelerated-checkout')).toHaveCount(0);

      // Accordions: SHIPPING & RETURNS present; empty SIZE & FIT / CARE are not rendered.
      const summaries = (await main.locator('details > summary').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
      expect(summaries.some((t) => /^shipping (&|and) returns/.test(t)), `summaries: ${summaries}`).toBe(true);
      expect(summaries.some((t) => /^size (&|and) fit$/.test(t)), 'no empty SIZE & FIT').toBe(false);
      expect(summaries.some((t) => /^care$/.test(t)), 'no empty CARE').toBe(false);
      const ship = main.locator('details', { has: page.locator('summary', { hasText: /shipping (&|and) returns/i }) }).first();
      await ship.locator('summary').click();
      await expect(ship).toContainText('Shipping and returns details to be confirmed.');

      // JSON-LD Product.
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      const parsed = ld.map((t) => { try { return JSON.parse(t); } catch { return { invalid: t.slice(0, 200) }; } });
      expect(parsed.filter((x) => x.invalid), 'JSON-LD parses').toEqual([]);
      const flat = parsed.flatMap((x) => (x['@graph'] ? x['@graph'] : [x]));
      const prod = flat.find((x) => x['@type'] === 'Product');
      expect(prod, 'Product JSON-LD').toBeTruthy();
      expect(prod.name).toBe(p.title);
      expect(prod.offers, 'offers').toBeTruthy();
      expect(JSON.stringify(prod)).not.toMatch(/aggregateRating|"review"/i);

      const text = await visibleText(page);
      expect(text.match(/(?<!p)review|rating|★|360/gi), 'no review/rating/★/360 strings').toBeNull();
    });

    test('zoom dialog opens and closes', async ({ page }) => {
      await gotoOk(page, `/products/${handle}`);
      const trigger = page.locator('sf-product-gallery [aria-haspopup="dialog"]').first();
      await expect(trigger).toHaveCount(1);
      const zoomId = await page.locator('sf-product-gallery').first().getAttribute('data-zoom-id') || (await page.locator('[id^="sf-zoom-"]').first().getAttribute('id'));
      await trigger.click();
      await expectDialogOpen(page, zoomId);
      const z = page.locator(`[id="${zoomId}"] dialog`);
      await expect(z.locator('img').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expectDialogOpen(page, zoomId, false);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expectDialogOpen(page, zoomId);
      await z.getByRole('button', { name: /close/i }).first().click();
      await expectDialogOpen(page, zoomId, false);
    });

    test('size guide drawer shows the fallback copy', async ({ page }) => {
      const p = fx.product(handle);
      test.skip(!fx.sizeOption(p), 'no size option');
      await gotoOk(page, `/products/${handle}`);
      const link = page.locator('main [data-sf-open^="size-guide-"]').first();
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/size guide/i);
      const id = `sf-${await link.getAttribute('data-sf-open')}`;
      await link.click();
      await expectDialogOpen(page, id);
      await expect(page.locator(`[id="${id}"] dialog`)).toContainText('Sizing information to be confirmed.');
      await page.keyboard.press('Escape');
      await expectDialogOpen(page, id, false);
      await expect(link).toBeFocused();
    });

    test('related products load via /recommendations/products', async ({ page }) => {
      const others = fx.products().length - 1;
      const respP = page.waitForResponse((r) => r.url().includes('/recommendations/products'), { timeout: 15_000 });
      await gotoOk(page, `/products/${handle}`);
      await page.evaluate(() => document.querySelector('sf-related-products')?.closest('.shopify-section')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const resp = await respP;
      expect(resp.status()).toBe(200);
      const body = page.locator('sf-related-products [data-sf-related-body]').first();
      const expected = Math.min(4, others);
      if (expected > 0) {
        await expect(body.locator('sf-product-card')).toHaveCount(expected);
        const hs = await body.locator('sf-product-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-product-handle')));
        expect(hs, 'current product excluded').not.toContain(handle);
        await expect(page.locator('sf-related-products').first()).toContainText(/you may also like/i);
      }
    });
  });
}

// Ruling §15.11: dynamic checkout is opt-in (show_dynamic_checkout, default false) and, on the preview,
// renders only the harness's inert payment_button placeholder: never a working or fake checkout.
test('dynamic checkout: off by default; when enabled renders one inert payment_button container in the product form', async ({ page }) => {
  const handle = fx.sizeCellProduct().handle;
  await gotoOk(page, `/products/${handle}`);
  await expect(page.locator('main [data-shopify="payment-button"]'), 'default: no dynamic checkout').toHaveCount(0);
  const ps = encodeURIComponent(JSON.stringify({ main: { blocks: { buy_buttons: { show_dynamic_checkout: true } } } }));
  await gotoOk(page, `/products/${handle}?preview_sections=${ps}`);
  await assertNoTemplateErrors(page);
  const pb = page.locator('main sf-product-form [data-shopify="payment-button"], main form[action$="/cart/add"] [data-shopify="payment-button"]');
  await expect(pb, 'show_dynamic_checkout → {{ form | payment_button }} inside the product form').toHaveCount(1);
  await expect(pb.locator('button')).toBeDisabled();
});
