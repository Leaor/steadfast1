// Search (BRIEF §5; ARCHITECTURE §9 row 13, §4.7 <sf-predictive-search>, §8.5 search; DESIGN §7.4).
import { test, expect, fx, gotoOk, expectDialogOpen, markIntroSeen } from './helpers/base.mjs';

const ready = fx.fixturesReady();
async function openSearch(page) {
  await page.locator('[data-sf-header] [data-sf-open="search"]').first().click();
  await expectDialogOpen(page, 'sf-search-overlay');
  const input = page.locator('#sf-search-overlay input[name="q"]').first();
  await expect(input).toBeFocused();
  return input;
}

test.describe('search', () => {
  test.skip(!ready, 'fixtures missing');
  const expected = () => fx.searchProducts('hoodie');

  test('predictive results for "hoodie": products, combobox semantics, arrow keys', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/collections/all');
    const input = await openSearch(page);
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-controls', 'sf-predictive-results');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    const resp = page.waitForResponse((r) => r.url().includes('/search/suggest') && r.url().includes('section_id=sf-predictive-search'));
    await input.pressSequentially('hoodie', { delay: 20 });
    expect((await resp).status()).toBe(200);
    const body = page.locator('#sf-search-overlay [data-sf-predictive-body]');
    const productLinks = body.locator('a[href*="/products/"]');
    await expect.poll(async () => new Set(await productLinks.evaluateAll((as) => as.map((a) => new URL(a.href).pathname))).size)
      .toBe(Math.min(4, expected().length));
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const options = body.locator('[role="option"]');
    expect(await options.count()).toBeGreaterThan(0);
    await expect(page.locator('#sf-live-polite')).toContainText(/\d/);
    await page.keyboard.press('ArrowDown');
    const firstSelected = await page.evaluate(() => {
      const i = document.querySelector('#sf-search-overlay input[name="q"]');
      const ad = i.getAttribute('aria-activedescendant');
      const sel = document.querySelector('#sf-search-overlay [role="option"][aria-selected="true"]');
      return ad ? ad : sel ? sel.id || 'selected' : null;
    });
    expect(firstSelected, 'ArrowDown selects the first option').toBeTruthy();
    await page.keyboard.press('ArrowDown');
    const second = await page.evaluate(() => document.querySelector('#sf-search-overlay input[name="q"]').getAttribute('aria-activedescendant')
      || document.querySelector('#sf-search-overlay [role="option"][aria-selected="true"]')?.id || 'selected');
    if (await options.count() > 1) expect(second).not.toBe(firstSelected);
  });

  test('predictive overlay never shows more results than the request allows (limit / limit_scope, PLAT-08)', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/collections/all');
    const input = await openSearch(page);
    const respP = page.waitForResponse((r) => r.url().includes('/search/suggest') && r.url().includes('section_id=sf-predictive-search'));
    await input.pressSequentially('hoodie', { delay: 20 });
    const resp = await respP;
    const u = new URL(resp.url());
    const limit = Number(u.searchParams.get('resources[limit]') || 10);
    const scope = u.searchParams.get('resources[limit_scope]') === 'each' ? 'each' : 'all';
    const types = (u.searchParams.get('resources[type]') || 'query,product,collection,page,article').split(',');
    const body = page.locator('#sf-search-overlay [data-sf-predictive-body]');
    await body.locator('a[href*="/products/"]').first().waitFor();
    const counts = await body.evaluate((root) => {
      const uniq = (sel) => new Set([...root.querySelectorAll(sel)].map((a) => new URL(a.href).pathname + new URL(a.href).search.replace(/[?&]_pos=.*$/, ''))).size;
      return {
        product: uniq('a[href*="/products/"]'), collection: uniq('a[href*="/collections/"]'),
        page: uniq('a[href*="/pages/"]'), article: uniq('a[href*="/blogs/"]'), query: uniq('a[href*="/search?q="][href*="_psq="]'), // suggestions only, not the "search for" link
      };
    });
    const total = types.reduce((a, t) => a + (counts[t] || 0), 0);
    if (scope === 'each') for (const t of types) expect(counts[t] || 0, `${t} results ≤ limit ${limit} (each)`).toBeLessThanOrEqual(limit);
    else expect(total, `total results ≤ limit ${limit} (all)`).toBeLessThanOrEqual(limit);
    // The mock enforces the same rule as Shopify: the suggest endpoint itself never returns more.
    const html = await (await page.request.get(`${u.pathname}${u.search}`)).text();
    const n = (re) => new Set(html.match(re) || []).size;
    const served = { product: n(/href="\/products\/[a-z0-9-]+/g), collection: n(/href="\/collections\/[a-z0-9-]+/g) };
    if (scope === 'each') { expect(served.product).toBeLessThanOrEqual(limit); expect(served.collection).toBeLessThanOrEqual(limit); }
    else expect(served.product + served.collection).toBeLessThanOrEqual(limit);
  });

  test('Enter submits to /search?q=hoodie', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/collections/all');
    const input = await openSearch(page);
    await input.fill('hoodie');
    await input.press('Enter');
    await page.waitForURL((u) => u.pathname === '/search' && u.searchParams.get('q') === 'hoodie');
  });

  test('results page shows counts and filters; no-results state', async ({ page }) => {
    await gotoOk(page, '/search?q=hoodie');
    await expect(page.locator('h1')).toHaveCount(1);
    const cards = page.locator('main sf-product-card');
    await expect(cards).toHaveCount(Math.min(24, expected().length));
    const hs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-product-handle')));
    expect(hs.sort()).toEqual(expected().map((p) => p.handle).sort());
    await expect(page.locator('main [data-sf-facets-count]').first()).toContainText(String(expected().length));
    await expect(page.locator('main sf-facets, main [data-sf-facets-form]').first()).toBeAttached();
    await expect(page.locator('main input[name="q"][type="hidden"], [data-sf-facets-form] input[name="q"]').first()).toHaveValue('hoodie');

    await gotoOk(page, '/search?q=zzqxnomatch');
    await expect(page.locator('main sf-product-card')).toHaveCount(0);
    await expect(page.locator('main')).toContainText('No results for “zzqxnomatch”.');
  });
});
