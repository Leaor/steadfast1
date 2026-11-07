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

// ---------- A11Y-09: the contact template (page.contact) really renders the form ----------
test('contact: /pages/contact renders form#contact_form and a failed submit focuses the error summary', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/pages/contact');
  const form = page.locator('main form#contact_form');
  await expect(form, 'page.contact renders the contact form (template_suffix honoured)').toHaveCount(1);
  await expect(form.locator('[name="contact[email]"]')).toHaveCount(1);
  await expect(form.locator('[name="contact[body]"]')).toHaveCount(1);
  // Bypass native constraint validation so the server-side error path (Shopify's form.errors) runs.
  await form.evaluate((f) => { f.noValidate = true; });
  await form.locator('[name="contact[email]"]').fill('');
  await Promise.all([page.waitForNavigation(), form.locator('button[type="submit"], input[type="submit"]').first().click()]);
  const summary = page.locator('main [data-sf-error-summary]').first();
  await expect(summary, 'error summary rendered after a failed submit').toBeVisible();
  await expect(summary, 'error summary receives focus (WCAG 3.3.1)').toBeFocused();
  await expect(page.locator('main #ContactForm-email')).toHaveAttribute('aria-invalid', 'true');
});

test('newsletter: a failed submit focuses the field error', async ({ page }) => {
  await markIntroSeen(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoOk(page, '/collections/all');
  const form = page.locator('form.sf-newsletter-form').first();
  await expect(form).toHaveCount(1);
  await form.evaluate((f) => { f.noValidate = true; });
  await form.locator('[name="contact[email]"]').fill('not-an-email');
  await Promise.all([page.waitForNavigation(), form.locator('button[type="submit"]').first().click()]);
  const input = page.locator('form.sf-newsletter-form [name="contact[email]"][aria-invalid="true"]').first();
  await expect(input, 'the email field is marked invalid').toHaveCount(1);
  const focused = await page.evaluate(() => {
    const a = document.activeElement;
    const f = a?.closest('form.sf-newsletter-form');
    return !!f && (a.matches('[name="contact[email]"], [data-sf-error-summary], .sf-field__error, [role="alert"]'));
  });
  expect(focused, 'focus moves to the invalid field or its error after the redirect').toBe(true);
});

// ---------- A11Y-15: axe in open states (each dialog scanned on its own) ----------
const OPEN_STATES = [
  { name: 'cart drawer (with a line)', url: '/collections/all', id: 'sf-cart-drawer',
    before: async (page) => { const p = fx.sizeCellProduct(); await page.request.post('/cart/add.js', { data: { items: [{ id: fx.firstAvailable(p).id, quantity: 1 }] } }); },
    open: async (page) => page.locator('[data-sf-header] [data-sf-open="cart"]').first().click(),
    ready: (page) => page.locator('#sf-cart-drawer dialog a[href*="/products/"]').first().waitFor() },
  { name: 'search overlay (with results)', url: '/collections/all', id: 'sf-search-overlay',
    open: async (page) => {
      await page.locator('[data-sf-header] [data-sf-open="search"]').first().click();
      await page.locator('#sf-search-overlay input[name="q"]').first().pressSequentially('hoodie', { delay: 20 });
    },
    ready: (page) => page.locator('#sf-search-overlay [data-sf-predictive-body] a[href*="/products/"]').first().waitFor() },
  { name: 'quick view', url: '/collections/all', id: 'sf-quick-view',
    open: async (page, testInfo) => {
      const t = page.locator('main sf-product-card a[data-sf-quick-view][data-intent="view"]').first();
      if (!isMobile(testInfo)) await t.locator('xpath=ancestor::sf-product-card[1]').hover();
      await t.click();
    },
    ready: (page) => page.locator('#sf-quick-view [data-sf-quick-view-body] sf-variant-picker, #sf-quick-view [data-sf-quick-view-body] h2').first().waitFor() },
  { name: 'product zoom', url: () => `/products/${fx.sizeCellProduct().handle}`, id: null,
    idFrom: (page) => page.locator('sf-product-gallery').first().getAttribute('data-zoom-id'),
    open: async (page) => page.locator('sf-product-gallery [aria-haspopup="dialog"]').first().click(),
    ready: (page) => page.locator('.sf-zoom img').first().waitFor() },
  { name: 'filter drawer', url: '/collections/all', id: null,
    idFrom: async (page) => `sf-${await page.locator('main [data-sf-open^="facets-drawer"]').first().getAttribute('data-sf-open')}`,
    open: async (page) => page.locator('main [data-sf-open^="facets-drawer"]').first().click() },
  { name: 'size guide', url: () => `/products/${fx.sizeCellProduct().handle}`, id: null,
    idFrom: async (page) => `sf-${await page.locator('main [data-sf-open^="size-guide-"]').first().getAttribute('data-sf-open')}`,
    open: async (page) => page.locator('main [data-sf-open^="size-guide-"]').first().click() },
  { name: 'menu drawer', url: '/collections/all', id: 'sf-menu-drawer', mobileOnly: true,
    open: async (page) => page.locator('[data-sf-header] [data-sf-open="menu"]').first().click() },
];
for (const s of OPEN_STATES) {
  test(`axe open state: ${s.name} has 0 serious/critical violations`, async ({ page }, testInfo) => {
    test.skip(s.mobileOnly && !isMobile(testInfo), 'mobile only');
    await markIntroSeen(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (s.before) await s.before(page);
    await gotoOk(page, typeof s.url === 'function' ? s.url() : s.url);
    const id = s.id || await s.idFrom(page);
    await s.open(page, testInfo);
    await expectDialogOpen(page, id);
    if (s.ready) await s.ready(page);
    await page.waitForTimeout(300);
    const bad = await axeSeriousViolations(page, testInfo, { name: `axe-open-${s.name}`, include: `[id="${id}"] dialog` });
    expect(bad, `axe serious/critical in ${s.name}`).toEqual([]);
  });
}
test('axe open state: desktop mega menu has 0 serious/critical violations', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'desktop mega menu');
  await markIntroSeen(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoOk(page, '/collections/all');
  const trig = page.locator('[data-sf-header] [data-sf-mega-trigger]').first();
  test.skip(!(await trig.count()), 'no mega trigger in this header');
  await trig.focus();
  await page.keyboard.press('Enter');
  await expect(trig).toHaveAttribute('aria-expanded', 'true');
  const panelId = await trig.getAttribute('aria-controls');
  await page.waitForTimeout(300);
  const bad = await axeSeriousViolations(page, testInfo, { name: 'axe-open-mega', include: panelId ? `[id="${panelId}"]` : '[data-sf-header]' });
  expect(bad, 'axe serious/critical in the open mega menu').toEqual([]);
});

// ---------- A11Y-15: axe with motion ON, after a scroll-through (reveals, pins, exposure lifts run) ----------
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
  });
}
for (const [i, name] of ['home', 'product', 'collection', 'cart', 'search', 'login', 'contact'].entries()) {
  test(`axe (motion on, after scroll-through): ${name} has 0 serious/critical violations`, async ({ page }, testInfo) => {
    await markIntroSeen(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const url = AXE_ROUTES()[i];
    await gotoOk(page, url);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await scrollThrough(page);
    await page.waitForTimeout(600);
    const bad = await axeSeriousViolations(page, testInfo, { name: `axe-motion-${name}` });
    expect(bad, `axe serious/critical on ${url} with motion on`).toEqual([]);
  });
}

// ---------- A11Y-15: keyboard regressions with motion ON (2.4.7 visible focus, 2.4.11 not obscured) ----------
async function tabStopReport(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) return null;
    let o = 1;
    for (let n = a; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1');
    const r = a.getBoundingClientRect();
    const hdr = document.querySelector('.sf-header');
    let obscured = false;
    if (hdr && !hdr.contains(a) && !a.closest('dialog') && r.width > 0 && r.height > 0) {
      // 2.4.11: the focused control must not be ENTIRELY hidden by the sticky header.
      const pts = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
      const onScreen = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      obscured = onScreen.length > 0 && onScreen.every(([x, y]) => { const e = document.elementFromPoint(x, y); return e && hdr.contains(e); });
    }
    return { el: `${a.tagName.toLowerCase()}.${String(a.className).slice(0, 50)}`, text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40), opacity: o, obscured };
  });
}
test('keyboard (motion on): Tab reaches the signature CTA; every home Tab stop is visible and not under the header', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'keyboard traversal checked on desktop');
  test.setTimeout(120_000);
  await markIntroSeen(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gotoOk(page, '/');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const bad = [];
  let reachedCta = false;
  let inFooter = false;
  for (let i = 0; i < 160 && !inFooter; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(140);
    let r = await tabStopReport(page);
    if (!r) continue;
    // A reveal that starts on focus may still be at its first frame: judge the settled state.
    if (!(r.opacity > 0) || r.obscured) { await page.waitForTimeout(700); r = await tabStopReport(page); if (!r) continue; }
    if (r.el.includes('sf-signature-showcase__cta')) reachedCta = true;
    if (!(r.opacity > 0)) bad.push({ ...r, why: 'opacity 0 (2.4.7)' });
    if (r.obscured) bad.push({ ...r, why: 'entirely under .sf-header (2.4.11)' });
    inFooter = await page.evaluate(() => !!document.activeElement?.closest('footer, [role="contentinfo"]'));
  }
  expect(reachedCta, 'Tab reaches .sf-signature-showcase__cta with motion on').toBe(true);
  expect(bad, 'Tab stops that are invisible or hidden under the header').toEqual([]);
});
