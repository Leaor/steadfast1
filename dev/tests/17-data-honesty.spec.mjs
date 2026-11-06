// Data honesty (BRIEF §4–§7, §10; ARCHITECTURE §0.4–§0.5, §9 row 17; CONTEXT decision 6).
import { test, expect, fx, visibleText, ariaLabels, markIntroSeen } from './helpers/base.mjs';
import { htmlRoutes } from './helpers/routes.mjs';

// ARCH §9 pattern. "review" is matched only as a word start so the ribbon's "PREVIEW" is never the match.
const FORBIDDEN = /(?<![a-z])review|rating|★|only \d+ left|selling fast|limited stock|360°|in stock: \d+|campaign film|shot by|directed by|appliqu|embroider|\bbag\b/gi;
const routes = fx.fixturesReady() ? htmlRoutes().filter((r) => !r.auth) : [];

for (const r of routes) {
  test(`honest copy on ${r.path}`, async ({ page, guard }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' && !['/', '/collections/all', `/products/${fx.products()[0].handle}`].includes(r.path), 'desktop (key routes on mobile)');
    if (r.status === 404) guard.allow(/status of 404/);
    await markIntroSeen(page);
    const res = await page.goto(r.path);
    expect(res.status()).toBe(r.status);
    await expect(page.locator('#sf-preview-ribbon'), 'ribbon on every HTML page').toHaveCount(1);
    const text = await visibleText(page);
    expect(text.match(FORBIDDEN), `forbidden visible text on ${r.path}`).toBeNull();
    const labels = (await ariaLabels(page)).filter((l) => l && l.match(FORBIDDEN));
    expect(labels, `forbidden aria-labels on ${r.path}`).toEqual([]);
    const html = await page.content();
    expect(html.includes('inventory_quantity'), 'no inventory_quantity in markup / JSON').toBe(false);
    // No inventory numbers next to stock wording.
    expect(text.match(/\b\d+\s+(left|in stock|remaining|available)\b/gi), 'no inventory counts').toBeNull();
  });
}

test('PDP never renders a fixture inventory number as stock', async ({ page }) => {
  for (const p of fx.products()) {
    await page.goto(`/products/${p.handle}`);
    const text = await visibleText(page);
    for (const v of p.variants) {
      if (!v.inventory_quantity) continue;
      expect(text.match(new RegExp(`\\b${v.inventory_quantity}\\s*(left|in stock|pcs|pieces|available)`, 'i')), `${p.handle} variant ${v.id}`).toBeNull();
    }
  }
});

test('opened drawers and dialogs stay honest too', async ({ page }) => {
  await markIntroSeen(page);
  const p = fx.sizeCellProduct();
  await page.goto(`/products/${p.handle}`);
  await page.locator('main sf-product-form button[type="submit"]').first().click();
  await expect.poll(() => page.locator('#sf-cart-drawer dialog').evaluate((d) => d.open)).toBe(true);
  const text = await page.locator('#sf-cart-drawer dialog').innerText();
  expect(text.match(FORBIDDEN)).toBeNull();
  const live = (await page.locator('#sf-live-polite, #sf-live-assertive').allTextContents()).join(' ');
  expect(live.match(FORBIDDEN)).toBeNull();
});
