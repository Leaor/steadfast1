// Keyboard accessibility + axe (BRIEF §12; ARCHITECTURE §9 row 12, §7; WCAG 2.2 AA).
import { test, expect, fx, gotoOk, markIntroSeen, isMobile, expectDialogOpen, focusIsInside, optionFieldset } from './helpers/base.mjs';
import { axeSeriousViolations } from './helpers/a11y.mjs';

// Native modal <dialog> (showModal) semantics: Tab cycles through the dialog and may pass through the
// browser chrome (activeElement = body) before wrapping; it must never land on page content behind it.
async function expectTrapped(page, rootSel, presses = 14) {
  let insideCount = 0;
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
    const where = await page.evaluate((sel) => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return 'chrome';
      return document.querySelector(sel)?.contains(a) ? 'inside' : `outside: ${a.tagName.toLowerCase()}.${String(a.className).slice(0, 50)}`;
    }, rootSel);
    expect(where, `focus never escapes to the page behind ${rootSel} (press ${i + 1})`).toMatch(/^(inside|chrome)$/);
    if (where === 'inside') insideCount++;
  }
  expect(insideCount, 'Tab cycles back into the dialog').toBeGreaterThanOrEqual(Math.floor(presses / 3));
}
async function focusRing(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a);
    return { el: `${a.tagName.toLowerCase()}.${String(a.className).slice(0, 40)}`, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), offset: parseFloat(cs.outlineOffset), visible: a.matches(':focus-visible') };
  });
}

test('skip link is the first Tab stop and focuses #MainContent', async ({ page }) => {
  await markIntroSeen(page);
  for (const url of ['/', '/collections/all']) {
    await gotoOk(page, url);
    await page.keyboard.press('Tab');
    const skip = page.locator('a[href="#MainContent"]').first();
    await expect(skip).toBeFocused();
    await expect(skip).toHaveText(/skip to content/i);
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#MainContent')).toBeFocused();
    await expect(page.locator('main#MainContent')).toHaveAttribute('tabindex', '-1');
  }
});

test('focus indicators are visible (2px outline) on the first Tab stops', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'keyboard focus ring checked on desktop');
  await gotoOk(page, `/products/${fx.products()[0].handle}`);
  const bad = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const r = await focusRing(page);
    if (!r) continue;
    if (r.el.startsWith('main')) continue;
    if (r.style === 'none' || !(r.width >= 2)) bad.push(r);
  }
  expect(bad, 'focused elements without a visible ≥ 2px outline').toEqual([]);
});

test('landmarks: one banner, one main, one contentinfo; navs are labelled', async ({ page }) => {
  await markIntroSeen(page);
  for (const url of ['/', `/products/${fx.products()[0].handle}`, '/collections/all', '/cart']) {
    await gotoOk(page, url);
    await expect(page.getByRole('banner'), `banner on ${url}`).toHaveCount(1);
    await expect(page.getByRole('main'), `main on ${url}`).toHaveCount(1);
    await expect(page.getByRole('contentinfo'), `contentinfo on ${url}`).toHaveCount(1);
    const unlabelled = await page.locator('nav').evaluateAll((ns) => ns.filter((n) => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')).map((n) => n.className));
    expect(unlabelled, 'unlabelled <nav>').toEqual([]);
    await expect(page.locator('footer nav[aria-label="Footer"], footer [role="navigation"][aria-label="Footer"]')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
  }
});

const DIALOGS = [
  { name: 'cart drawer', url: '/collections/all', id: 'sf-cart-drawer', open: (page) => page.locator('[data-sf-header] [data-sf-open="cart"]').first() },
  { name: 'search', url: '/collections/all', id: 'sf-search-overlay', open: (page) => page.locator('[data-sf-header] [data-sf-open="search"]').first() },
  { name: 'menu', url: '/collections/all', id: 'sf-menu-drawer', mobileOnly: true, open: (page) => page.locator('[data-sf-header] [data-sf-open="menu"]').first() },
  { name: 'size guide', url: () => `/products/${fx.sizeCellProduct().handle}`, id: null, open: (page) => page.locator('main [data-sf-open^="size-guide-"]').first() },
  { name: 'quick view', url: '/collections/all', id: 'sf-quick-view', open: (page) => page.locator('main sf-product-card a[data-sf-quick-view][data-intent="view"]').first() },
  { name: 'filter drawer', url: '/collections/all', id: null, open: (page) => page.locator('main [data-sf-open^="facets-drawer"]').first() },
];
for (const d of DIALOGS) {
  test(`${d.name}: keyboard opens, focus is trapped, Esc closes and restores focus`, async ({ page }, testInfo) => {
    test.skip(d.mobileOnly && !isMobile(testInfo), 'mobile only');
    await gotoOk(page, typeof d.url === 'function' ? d.url() : d.url);
    const trigger = d.open(page);
    if (d.name === 'quick view' && !isMobile(testInfo)) await trigger.locator('xpath=ancestor::sf-product-card[1]').hover();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    const id = d.id || `sf-${await trigger.getAttribute('data-sf-open')}`;
    await page.keyboard.press('Enter');
    await expectDialogOpen(page, id);
    if (d.name === 'quick view') await page.locator('#sf-quick-view [data-sf-quick-view-body] sf-variant-picker, #sf-quick-view [data-sf-quick-view-body] h2').first().waitFor();
    await expect.poll(() => focusIsInside(page, `[id="${id}"]`), { message: 'initial focus inside' }).toBe(true);
    await expect(page.locator(`[id="${id}"] dialog`).getByRole('button', { name: /close/i }).first()).toBeAttached();
    await expectTrapped(page, `[id="${id}"]`);
    await page.keyboard.press('Escape');
    await expectDialogOpen(page, id, false);
    await expect(trigger).toBeFocused();
  });
}

test('variant controls are keyboard operable', async ({ page }) => {
  const p = fx.sizeCellProduct();
  const si = p.options.findIndex((o) => fx.optName(o).toLowerCase() === 'size');
  const sizes = fx.optionValues(p.options[si]);
  await gotoOk(page, `/products/${p.handle}?variant=${p.variants.find((v) => fx.variantOptions(v)[si] === sizes[0]).id}`);
  const fs = optionFieldset(page.locator('main'), 'size');
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.matches('sf-variant-picker input[type="radio"]'));
  }
  expect(reached, 'Tab reaches the variant radios').toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(fs.locator('input:checked')).not.toHaveValue(sizes[0]);
  const id = await page.locator('main sf-product-form input[name="id"]').first().inputValue();
  expect(id).not.toBe(String(p.variants.find((v) => fx.variantOptions(v)[si] === sizes[0]).id));
});

test('facet controls are keyboard operable', async ({ page }, testInfo) => {
  await gotoOk(page, '/collections/all');
  const trigger = page.locator('main [data-sf-open^="facets-drawer"]').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const id = `sf-${await trigger.getAttribute('data-sf-open')}`;
  await expectDialogOpen(page, id);
  let onBox = false;
  for (let i = 0; i < 30 && !onBox; i++) {
    await page.keyboard.press('Tab');
    onBox = await page.evaluate(() => document.activeElement?.matches('input[type="checkbox"][name^="filter."]'));
  }
  expect(onBox, 'Tab reaches a filter checkbox').toBe(true);
  const name = await page.evaluate(() => document.activeElement.name);
  await page.keyboard.press('Space');
  if (isMobile(testInfo)) {
    await page.locator(`[id="${id}"] button[type="submit"]`).first().focus();
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => new URL(page.url()).searchParams.has(name), { message: `URL has ${name}` }).toBe(true);
});

const AXE_ROUTES = () => ['/', `/products/${fx.products()[0].handle}`, '/collections/all', '/cart', '/search?q=hoodie', '/account/login', '/pages/contact'];
for (const [i, name] of ['home', 'product', 'collection', 'cart', 'search', 'login', 'contact'].entries()) {
  test(`axe: ${name} has 0 serious/critical violations`, async ({ page }, testInfo) => {
    await markIntroSeen(page);
    // Audit the content at rest (reveals and exposure lifts finished): reduced motion renders the final state.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const url = AXE_ROUTES()[i];
    await gotoOk(page, url);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const bad = await axeSeriousViolations(page, testInfo, { name: `axe-${name}` });
    expect(bad, `axe serious/critical on ${url}`).toEqual([]);
  });
}
