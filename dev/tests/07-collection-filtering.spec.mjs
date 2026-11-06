// Collection filtering, sorting, pagination (BRIEF §5, §12; ARCHITECTURE §9 row 07, §4.7 <sf-facets>, §8.5; DESIGN §7.9).
import { test, expect, fx, gotoOk, projectContext, expectDialogOpen, isMobile } from './helpers/base.mjs';

const ready = fx.fixturesReady();
const URL_ALL = '/collections/all';
const cards = (page) => page.locator('[data-sf-facets-results] sf-product-card');
const handles = (page) => cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-product-handle')));
const params = (page) => new URL(page.url()).searchParams;

async function openFilters(page) {
  const trigger = page.locator('[data-sf-facets-toolbar] [data-sf-open^="facets-drawer"], main [data-sf-open^="facets-drawer"]').first();
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText(/filter/i);
  const id = `sf-${await trigger.getAttribute('data-sf-open')}`;
  await trigger.click();
  await expectDialogOpen(page, id);
  return { trigger, id, dlg: page.locator(`[id="${id}"] dialog`) };
}
/** Applies a change inside the filter drawer: live on desktop, submit ("SHOW n RESULTS") on mobile. */
async function applyInDrawer(page, testInfo, change, expectParam) {
  await page.evaluate(() => { window.__sfNoReload = true; });
  const { id, dlg } = await openFilters(page);
  await change(dlg);
  if (isMobile(testInfo)) {
    await dlg.locator('button[type="submit"]').filter({ hasText: /show/i }).first().click();
  }
  await expect.poll(() => params(page).toString(), { message: `URL gets ${expectParam}` }).toContain(expectParam);
  if (await page.locator(`[id="${id}"] dialog`).evaluate((d) => d.open).catch(() => false)) {
    await page.keyboard.press('Escape');
    await expectDialogOpen(page, id, false);
  }
  expect(await page.evaluate(() => window.__sfNoReload === true), 'applied without a reload').toBe(true);
}
const checkbox = (dlg, name, value) => dlg.locator(`input[type="checkbox"][name="${name}"][value="${value}"]`).first();
async function tick(dlg, name, value) {
  const cb = checkbox(dlg, name, value);
  const details = cb.locator('xpath=ancestor::details[1]');
  if (await details.count() && !(await details.evaluate((d) => d.open))) await details.locator('summary').click();
  const id = await cb.getAttribute('id');
  if (id && await dlg.locator(`label[for="${id}"]`).count()) await dlg.locator(`label[for="${id}"]`).first().click();
  else await cb.check();
}

test.describe('collection filtering', () => {
  test.skip(!ready, 'fixtures missing');
  const all = () => fx.collectionProducts('all');

  test('grid and count match the fixtures', async ({ page }) => {
    await gotoOk(page, URL_ALL);
    await expect(page.locator('h1')).toHaveText('Products');
    await expect(cards(page)).toHaveCount(Math.min(24, all().length));
    await expect(page.locator('[data-sf-facets-count]').first()).toContainText(String(all().length));
    for (const [i, c] of (await cards(page).all()).slice(0, 4).entries()) {
      await expect(c.locator('img').first()).toHaveAttribute('loading', 'eager');
      if (i === 0) await expect(c.locator('img').first()).toHaveAttribute('fetchpriority', 'high');
    }
  });

  const cases = [
    {
      name: 'size (option)', build: () => {
        const vals = fx.optionValuesIn(all(), 'size');
        const value = vals.find((v) => fx.applyFilters(all(), { options: { size: [v] } }).length < all().length) || vals[0];
        return { param: 'filter.v.option.size', value, expected: fx.applyFilters(all(), { options: { size: [value] } }) };
      },
    },
    {
      name: 'colour (option)', build: () => {
        const name = fx.colorOption(all().find(fx.colorOption)) ? fx.optName(fx.colorOption(all().find(fx.colorOption))) : 'Color';
        const value = fx.optionValuesIn(all(), name)[0];
        return { param: `filter.v.option.${fx.handleize(name)}`, value, expected: fx.applyFilters(all(), { options: { [name]: [value] } }) };
      },
    },
    { name: 'availability', build: () => ({ param: 'filter.v.availability', value: '0', label: 'Out of stock', expected: fx.applyFilters(all(), { availability: ['0'] }) }) },
    {
      name: 'product type', build: () => {
        const types = [...new Set(all().map(fx.productType))];
        const value = types.find((t) => fx.applyFilters(all(), { types: [t] }).length < all().length) || types[0];
        return { param: 'filter.p.product_type', value, expected: fx.applyFilters(all(), { types: [value] }) };
      },
    },
  ];
  for (const c of cases) {
    test(`filter: ${c.name} updates URL and results without reload`, async ({ page }, testInfo) => {
      const { param, value, expected, label } = c.build();
      expect(value, 'fixture value').toBeTruthy();
      await gotoOk(page, URL_ALL);
      await applyInDrawer(page, testInfo, (dlg) => tick(dlg, param, value), param);
      expect(params(page).getAll(param)).toEqual([value]);
      await expect(cards(page)).toHaveCount(expected.length);
      expect((await handles(page)).sort()).toEqual(expected.map((p) => p.handle).sort());
      await expect(page.locator('[data-sf-facets-count]').first()).toContainText(String(expected.length));
      await expect(page.locator('[data-sf-active-facets]').first()).toContainText(label || value);
    });
  }

  test('filter: price range (major units)', async ({ page }, testInfo) => {
    const prices = all().map(fx.priceMin).sort((a, b) => a - b);
    const lte = Math.floor(prices[0] / 100);
    const gte = 0;
    const expected = fx.applyFilters(all(), { gte, lte });
    await gotoOk(page, URL_ALL);
    await applyInDrawer(page, testInfo, async (dlg) => {
      const details = dlg.locator('input[name="filter.v.price.lte"]').locator('xpath=ancestor::details[1]');
      if (await details.count() && !(await details.evaluate((d) => d.open))) await details.locator('summary').click();
      await dlg.locator('input[name="filter.v.price.gte"]').fill(String(gte));
      await dlg.locator('input[name="filter.v.price.lte"]').fill(String(lte));
      await dlg.locator('input[name="filter.v.price.lte"]').press('Tab');
    }, 'filter.v.price.lte');
    expect(params(page).get('filter.v.price.lte')).toBe(String(lte));
    await expect(cards(page)).toHaveCount(expected.length);
  });

  test('active facet remove and clear all', async ({ page }, testInfo) => {
    const size = cases[0].build();
    const type = cases[3].build();
    await gotoOk(page, `${URL_ALL}?${size.param}=${encodeURIComponent(size.value)}&${type.param}=${encodeURIComponent(type.value)}`);
    const both = fx.applyFilters(all(), { options: { size: [size.value] }, types: [type.value] });
    await expect(cards(page)).toHaveCount(both.length);
    await page.evaluate(() => { window.__sfNoReload = true; });
    const chips = page.locator('[data-sf-active-facets] a[href]').filter({ hasText: size.value });
    await chips.first().click();
    await expect.poll(() => params(page).getAll(size.param)).toEqual([]);
    expect(params(page).getAll(type.param)).toEqual([type.value]);
    await expect(cards(page)).toHaveCount(fx.applyFilters(all(), { types: [type.value] }).length);
    await page.locator('[data-sf-active-facets] a[href]').filter({ hasText: /clear all/i }).first().click();
    await expect.poll(() => [...params(page).keys()].filter((k) => k.startsWith('filter.'))).toEqual([]);
    await expect(cards(page)).toHaveCount(all().length);
    expect(await page.evaluate(() => window.__sfNoReload === true), 'no reload').toBe(true);
  });

  test('back/forward restores filter state', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'live-apply history is desktop behaviour');
    const size = cases[0].build();
    const type = cases[3].build();
    await gotoOk(page, URL_ALL);
    await applyInDrawer(page, testInfo, (dlg) => tick(dlg, size.param, size.value), size.param);
    await applyInDrawer(page, testInfo, (dlg) => tick(dlg, type.param, type.value), type.param);
    const both = fx.applyFilters(all(), { options: { size: [size.value] }, types: [type.value] });
    await expect(cards(page)).toHaveCount(both.length);
    await page.goBack();
    await expect.poll(() => params(page).getAll(type.param)).toEqual([]);
    await expect(cards(page)).toHaveCount(size.expected.length);
    await page.goForward();
    await expect.poll(() => params(page).getAll(type.param)).toEqual([type.value]);
    await expect(cards(page)).toHaveCount(both.length);
  });

  test('no-JS: the filter form submits (GET) and the server applies it', async ({ browser, baseURL }, testInfo) => {
    const size = cases[0].build();
    const ctx = await browser.newContext(projectContext(testInfo, baseURL, { javaScriptEnabled: false }));
    const page = await ctx.newPage();
    await page.goto(URL_ALL);
    const cb = page.locator(`input[type="checkbox"][name="${size.param}"][value="${size.value}"]`).first();
    const trigger = page.locator('[data-sf-open^="facets-drawer"]').first();
    if (!(await cb.isVisible()) && await trigger.isVisible()) await trigger.click();
    await expect(cb, 'filter controls reachable without JS (§7.15)').toBeVisible();
    await cb.check();
    await page.locator('[data-sf-facets-form] button[type="submit"]').first().click();
    await page.waitForURL((u) => u.searchParams.get(size.param) === size.value);
    await expect(page.locator('[data-sf-facets-results] sf-product-card')).toHaveCount(size.expected.length);
    await ctx.close();
  });

  for (const sortBy of ['price-ascending', 'price-descending', 'title-ascending']) {
    test(`sort: ${sortBy}`, async ({ page }, testInfo) => {
      test.skip(isMobile(testInfo), 'sort order checked on desktop');
      await gotoOk(page, URL_ALL);
      const select = page.locator('select[name="sort_by"]').first();
      await expect(select).toBeVisible();
      await select.selectOption(sortBy);
      await expect.poll(() => params(page).get('sort_by')).toBe(sortBy);
      const want = fx.sortProducts(all(), sortBy).map((p) => p.handle);
      await expect.poll(() => handles(page)).toEqual(want);
    });
  }

  test('pagination with products_per_page = 4', async ({ page }) => {
    const ps = encodeURIComponent(JSON.stringify({ main: { products_per_page: 4 } }));
    await gotoOk(page, `${URL_ALL}?preview_sections=${ps}`);
    const n = all().length;
    test.skip(n <= 4, 'needs > 4 products');
    await expect(cards(page)).toHaveCount(4);
    const first = await handles(page);
    const next = page.locator('main a[href*="page=2"]').first();
    await expect(next).toBeVisible();
    await next.click();
    await page.waitForURL(/page=2/);
    await expect(cards(page)).toHaveCount(Math.min(4, n - 4));
    const second = await handles(page);
    expect([...first, ...second].length).toBe(new Set([...first, ...second]).size);
    expect([...first, ...second]).toEqual(fx.sortProducts(all(), 'created-descending').map((p) => p.handle).slice(0, first.length + second.length));
  });

  test('empty states: tops collection and filters with no match', async ({ page }) => {
    const tops = fx.collection('tops');
    test.skip(!tops, 'no tops collection');
    expect(fx.collectionProducts('tops').length).toBe(0);
    await gotoOk(page, '/collections/tops');
    await expect(page.locator('main sf-product-card')).toHaveCount(0);
    await expect(page.locator('main')).toContainText(/empty/i);
    await gotoOk(page, `${URL_ALL}?filter.v.price.lte=0`);
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator('main')).toContainText('No pieces match these filters.');
  });
});
