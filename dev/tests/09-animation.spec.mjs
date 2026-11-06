// Animation behaviour (BRIEF §6, §12; ARCHITECTURE §9 row 09, §4.5; DESIGN §8).
import { test, expect, fx, gotoOk, markIntroSeen, isMobile, expectDialogOpen, settleAnimations, focusIsInside } from './helpers/base.mjs';

const isGsap = (u) => /\/(gsap|ScrollTrigger)\.min\.js/.test(u);
function trackGsap(page) {
  const list = [];
  page.on('request', (r) => { if (isGsap(r.url())) list.push(r.url()); });
  return list;
}
const sig = (page) => page.locator('[data-sf-section="signature-showcase"]').first();
async function scrollThrough(page, { step = 500, to } = {}) {
  const total = to ?? await page.evaluate(() => document.documentElement.scrollHeight);
  await page.mouse.move(300, 300);
  for (let y = 0; y < total; y += step) {
    await page.mouse.wheel(0, step);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
}
/** Animations (WAAPI/CSS) or GSAP tweens that target filter / backdrop-filter. */
async function filterAnimations(page) {
  return page.evaluate(() => {
    const out = [];
    for (const a of document.getAnimations()) {
      const kfs = a.effect?.getKeyframes?.() || [];
      if (kfs.some((k) => 'filter' in k || 'backdropFilter' in k)) out.push(`waapi ${a.effect.target?.className}`);
      if (a.transitionProperty && /filter/.test(a.transitionProperty)) out.push(`transition ${a.transitionProperty} ${a.effect.target?.className}`);
    }
    const g = window.gsap;
    if (g?.globalTimeline) {
      for (const t of g.globalTimeline.getChildren(true, true, false)) {
        const keys = Object.keys(t.vars || {});
        if (keys.some((k) => /filter/i.test(k)) || JSON.stringify(t.vars?.css || {}).match(/filter/i)) out.push(`gsap ${keys.join(',')}`);
      }
    }
    return out;
  });
}

test('GSAP is not requested on product/collection pages or on the initial home load', async ({ page }) => {
  const gs = trackGsap(page);
  await gotoOk(page, `/products/${fx.products()[0].handle}`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await gotoOk(page, '/collections/all');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  expect(gs, 'no GSAP on PDP / collection').toEqual([]);
  await markIntroSeen(page);
  await gotoOk(page, '/');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  expect(gs, 'no GSAP before scrolling the home page').toEqual([]);
});

test('GSAP loads when scrolling toward the signature section; pin on desktop only; ≤ 10 ScrollTriggers', async ({ page }, testInfo) => {
  await markIntroSeen(page);
  const gs = trackGsap(page);
  await gotoOk(page, '/');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  expect(gs.filter((u) => /gsap\.min/.test(u)), 'no GSAP before the first scroll').toEqual([]);
  await sig(page).scrollIntoViewIfNeeded();
  if (isMobile(testInfo)) {
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
  } else {
    await expect.poll(() => gs.some((u) => /gsap\.min/.test(u)), { timeout: 8000, message: 'gsap requested' }).toBe(true);
    await expect.poll(() => page.evaluate(() => !!document.querySelector('[data-sf-section="signature-showcase"]')?.closest('.pin-spacer') || !!document.querySelector('[data-sf-section="signature-showcase"] .pin-spacer')), { timeout: 8000, message: 'signature pin-spacer' }).toBe(true);
    await expect(page.locator('.pin-spacer'), 'exactly one pin').toHaveCount(1);
  }
  await scrollThrough(page);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const n = await page.evaluate(() => (window.ScrollTrigger?.getAll?.() || []).length);
  expect(n, 'ScrollTriggers on the homepage').toBeLessThanOrEqual(10);
  expect(await filterAnimations(page), 'no animation targets filter').toEqual([]);
});

test('reveals get .is-revealed after scrolling; no long task > 200 ms while scrolling; no filter animations', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/');
  await page.waitForLoadState('load');
  const t0 = await page.evaluate(() => performance.now());
  const samples = [];
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.mouse.move(300, 300);
  for (let y = 0; y < total; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (samples.length < 40) samples.push(...(await filterAnimations(page)));
  }
  expect(samples, 'no animation targets filter during scroll').toEqual([]);
  const reveals = page.locator('[data-sf-reveal]');
  const count = await reveals.count();
  for (let i = 0; i < count; i++) {
    const el = reveals.nth(i);
    if (!(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded();
    await expect(el, `reveal #${i}`).toHaveClass(/is-revealed/, { timeout: 4000 });
  }
  const long = await page.evaluate((start) => (window.__sfLongTasks || []).filter((t) => t.start >= start && t.duration > 200), t0);
  expect(long, 'long tasks > 200 ms while scrolling').toEqual([]);
});

test('shopify:section:unload on the signature section removes its pin and ScrollTriggers', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'the pin exists on desktop only');
  await markIntroSeen(page);
  await gotoOk(page, '/');
  await sig(page).scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.pin-spacer').count(), { timeout: 8000 }).toBe(1);
  const before = await page.evaluate(() => window.ScrollTrigger.getAll().length);
  await page.evaluate(() => {
    const s = document.querySelector('[data-sf-section="signature-showcase"]');
    const wrapper = s.closest('.shopify-section');
    const sectionId = wrapper.id.replace(/^shopify-section-/, '');
    wrapper.dispatchEvent(new CustomEvent('shopify:section:unload', { bubbles: true, detail: { sectionId } }));
  });
  await expect.poll(() => page.locator('.pin-spacer').count()).toBe(0);
  const after = await page.evaluate(() => window.ScrollTrigger.getAll().length);
  expect(after).toBeLessThan(before);
});

test('cart drawer open/close transition settles; focus moves in and returns', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const trigger = page.locator('[data-sf-header] [data-sf-open="cart"]').first();
  await trigger.click();
  await expectDialogOpen(page, 'sf-cart-drawer');
  await settleAnimations(page, '#sf-cart-drawer');
  expect(await focusIsInside(page, '#sf-cart-drawer'), 'focus in drawer').toBe(true);
  const box = await page.locator('#sf-cart-drawer dialog').boundingBox();
  const vw = page.viewportSize().width - 16; // allow a classic scrollbar gutter (scrollbar-gutter: stable)
  expect(Math.round(box.x + box.width), 'drawer at the right edge').toBeGreaterThanOrEqual(vw - 1);
  await expect(page.locator('#sf-cart-drawer.is-opening, #sf-cart-drawer .is-opening')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expectDialogOpen(page, 'sf-cart-drawer', false);
  await settleAnimations(page, '#sf-cart-drawer');
  await expect(page.locator('#sf-cart-drawer.is-closing, #sf-cart-drawer .is-closing')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
