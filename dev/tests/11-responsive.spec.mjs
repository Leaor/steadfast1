// Responsive layouts (BRIEF §8, §12; ARCHITECTURE §9 row 11, §6.1 CLS, §7.12 targets).
import { test, expect, fx, gotoOk, assertNoTemplateErrors, markIntroSeen, screenshotPath } from './helpers/base.mjs';

const VIEWPORTS = {
  desktop: [[360, 780], [390, 844], [834, 1112], [1280, 800], [1440, 900], [1920, 1080]],
  mobile: [[360, 780], [390, 844]],
};
const routes = () => ['/', '/collections/all', `/products/${fx.products()[0].handle}`, '/cart', '/search?q=hoodie', '/pages/contact', '/account/login'];
const ROUTE_NAMES = ['home', 'collection-all', 'product', 'cart', 'search-hoodie', 'contact', 'login'];

for (const project of ['desktop', 'mobile']) {
  for (const [w, h] of VIEWPORTS[project]) {
    for (const [ri, name] of ROUTE_NAMES.entries()) {
      test(`[${project}] ${w}x${h} ${name}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== project, `runs in the ${project} project`);
        const url = routes()[ri];
        await page.setViewportSize({ width: w, height: h });
        await gotoOk(page, url);
        await assertNoTemplateErrors(page);
        await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

        const cls = await page.evaluate(() => (window.__sfLayoutShifts || []).reduce((a, s) => a + s.value, 0));
        expect(cls, `CLS during load on ${url}`).toBeLessThan(0.05);

        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && el.getClientRects().length && !el.closest('[data-sf-rail], .sf-rail, [class*="rail"], [class*="__track"], dialog'); }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}`) }));
        expect(overflow.sw, `no horizontal overflow (${overflow.wide.join('; ')})`).toBeLessThanOrEqual(overflow.iw);

        if (w < 990) {
          const targets = page.locator('[data-sf-header] [data-sf-open="menu"], [data-sf-header] [data-sf-open="cart"], [data-sf-header] [data-sf-open="search"], main sf-product-form button[type="submit"]');
          for (const t of await targets.all()) {
            if (!(await t.isVisible())) continue;
            const b = await t.boundingBox();
            const label = await t.evaluate((el) => el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30));
            expect(b.width, `${label} width ≥ 44`).toBeGreaterThanOrEqual(44);
            expect(b.height, `${label} height ≥ 44`).toBeGreaterThanOrEqual(44);
          }
        }
        if (url === '/') {
          // Settle the hero into its rest state so the full-page capture shows the shopping UI.
          await page.locator('sf-hero-film [data-sf-hero-control]').first().click().catch(() => {});
        }
        // Walk the page once so lazy images load and one-time reveals settle, then capture from the top.
        await page.evaluate(async () => {
          const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) { window.scrollTo({ top: y, behavior: 'instant' }); await raf(); }
          window.scrollTo({ top: 0, behavior: 'instant' }); await raf();
          await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })));
        });
        await page.screenshot({ path: screenshotPath(testInfo, `${name}-${w}x${h}`), fullPage: true, animations: 'disabled' });
      });
    }
  }
}

test('home with intro already seen: no overflow at 360px', async ({ page }) => {
  await markIntroSeen(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await gotoOk(page, '/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
