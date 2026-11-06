// Reduced motion (BRIEF §6, §12; ARCHITECTURE §9 row 10, §3.4, §4.3, §5.3; DESIGN §8.5).
import { test, expect, gotoOk, effectiveOpacity, fileOf, expectDialogOpen, waitForEvent } from './helpers/base.mjs';

const hero = (page) => page.locator('sf-hero-film').first();
const control = (page) => page.locator('sf-hero-film [data-sf-hero-control]').first();
function trackMp4(page) {
  const list = [];
  page.on('request', (r) => { if (/\.mp4(\?|$)/.test(r.url())) list.push(fileOf(r.url())); });
  return list;
}
async function maxDialogAnimationMs(page, id) {
  return page.evaluate(async (sel) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const root = document.querySelector(sel);
    const anims = root.getAnimations({ subtree: true });
    return Math.max(0, ...anims.map((a) => { const t = a.effect?.getComputedTiming(); return t && t.endTime !== Infinity ? t.endTime : 0; }));
  }, `#${id}`);
}
async function assertReducedHome(page) {
  await expect(page.locator('html')).toHaveAttribute('data-sf-motion', 'reduced');
  await expect.poll(() => hero(page).getAttribute('data-state')).toBe('static');
  expect((await waitForEvent(page, 'hero:intro-end')).detail.reason).toBe('reduced');
  expect(await effectiveOpacity(page.locator('sf-hero-film h1').first()), 'wordmark at rest').toBeGreaterThan(0.99);
  expect(await effectiveOpacity(page.locator('sf-hero-film .sf-hero__ctas').first()), 'UI at rest').toBeGreaterThan(0.99);
  // every reveal is visible immediately, without scrolling
  const hidden = await page.locator('[data-sf-reveal]').evaluateAll((els) => els.filter((el) => {
    let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o < 0.99 && el.getClientRects().length > 0;
  }).map((el) => el.className));
  expect(hidden, 'reveal content visible immediately').toEqual([]);
}

test.describe('OS prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hero static, no mp4 until PLAY (then only the loop), no pin, brand-story wordmark visible', async ({ page }, testInfo) => {
    const mp4 = trackMp4(page);
    await gotoOk(page, '/');
    await assertReducedHome(page);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    expect(mp4, 'no video before PLAY').toEqual([]);
    await expect(control(page)).toHaveText(/play/i);
    await control(page).click();
    const loopFile = testInfo.project.name === 'mobile' ? 'sf-film-loop-mobile.mp4' : 'sf-film-loop-desktop.mp4';
    await expect.poll(() => mp4.includes(loopFile), { timeout: 6000 }).toBe(true);
    expect([...new Set(mp4)], 'only the loop file').toEqual([loopFile]);
    await expect(control(page)).toHaveText(/pause/i);

    await page.locator('[data-sf-section="signature-showcase"]').scrollIntoViewIfNeeded();
    await page.locator('[data-sf-section="brand-story"]').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    const logo = page.locator('[data-sf-section="brand-story"] .sf-logo').first();
    await expect(logo).toBeVisible();
    expect(await effectiveOpacity(logo), 'Section F wordmark fully visible').toBeGreaterThan(0.99);
  });

  test('drawer animations are ≤ 150 ms', async ({ page }) => {
    await gotoOk(page, '/collections/all');
    await page.locator('[data-sf-header] [data-sf-open="cart"]').first().click();
    await expectDialogOpen(page, 'sf-cart-drawer');
    expect(await maxDialogAnimationMs(page, 'sf-cart-drawer')).toBeLessThanOrEqual(150);
  });
});

test('footer visitor toggle sets reduced and persists across reloads', async ({ page }) => {
  await gotoOk(page, '/collections/all');
  const before = await page.locator('html').getAttribute('data-sf-motion');
  expect(before).not.toBe('reduced');
  const toggle = page.locator('footer [data-sf-motion-toggle]').first();
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-sf-motion', 'reduced');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect((await waitForEvent(page, 'motion:change')).detail.level).toBe('reduced');
  expect(await page.evaluate(() => localStorage.getItem('sf:motion'))).toBe('reduced');
  await gotoOk(page, '/');
  await assertReducedHome(page);
  await expect(page.locator('footer [data-sf-motion-toggle]').first()).toHaveAttribute('aria-pressed', 'true');
  // toggling back restores the setting's level
  await page.locator('footer [data-sf-motion-toggle]').first().click();
  await expect(page.locator('html')).not.toHaveAttribute('data-sf-motion', 'reduced');
  expect(await page.evaluate(() => localStorage.getItem('sf:motion'))).toBeNull();
});

test('preview_settings motion_level=reduced does the same without the OS preference', async ({ page }) => {
  const mp4 = trackMp4(page);
  await gotoOk(page, `/?preview_settings=${encodeURIComponent(JSON.stringify({ motion_level: 'reduced' }))}`);
  await assertReducedHome(page);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  expect(mp4).toEqual([]);
  await page.locator('[data-sf-section="signature-showcase"]').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await page.goto('/?preview_settings=reset');
});
