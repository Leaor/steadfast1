// Mobile navigation (BRIEF §12; ARCHITECTURE §9 row 03, §4.2 <sf-menu-drawer>; DESIGN §7.3, §8.3).
import { test, expect, fx, gotoOk, expectDialogOpen, focusIsInside, markIntroSeen } from './helpers/base.mjs';

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'mobile', 'mobile project only'));

const menuBtn = (page) => page.locator('[data-sf-header] [data-sf-open="menu"]').first();
const MENU = '#sf-menu-drawer';

test('desktop nav hidden, menu button visible and ≥ 44px', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  await expect(page.getByRole('navigation', { name: /^primary$/i })).toBeHidden();
  const btn = menuBtn(page);
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(btn).toHaveAttribute('aria-controls', 'sf-menu-drawer');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('menu opens fullscreen, repeats the header row, focus inside, settles within 560 ms, scroll locked', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const btn = menuBtn(page);
  const btnBox = await btn.boundingBox();
  // Click from inside the page so the open timing is measured from the same clock as the animations.
  const settleMs = await page.evaluate(async () => {
    const b = document.querySelector('[data-sf-header] [data-sf-open="menu"]');
    const t0 = performance.now();
    b.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const root = document.querySelector('#sf-menu-drawer');
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    let running;
    do {
      running = root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity);
      await Promise.all(running.map((a) => a.finished.catch(() => {})));
      await raf();
    } while (running.length);
    return performance.now() - t0;
  });
  await expectDialogOpen(page, 'sf-menu-drawer');
  expect(settleMs, 'open sequence settles within 560 ms (+ frame slack)').toBeLessThanOrEqual(560 + 60);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');

  const dlg = page.locator(`${MENU} dialog`);
  const box = await dlg.boundingBox();
  const vp = page.viewportSize();
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(vp.width - 1);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(vp.height - 1);

  const close = dlg.getByRole('button', { name: /close/i }).first();
  await expect(close).toBeVisible();
  const cb = await close.boundingBox();
  expect(Math.abs(cb.x - btnBox.x), 'close button x matches the menu button').toBeLessThanOrEqual(4);
  expect(Math.abs(cb.y - btnBox.y), 'close button y matches the menu button').toBeLessThanOrEqual(4);
  // The repeated row also carries the wordmark and search/cart icons.
  await expect(dlg.locator('a[href="/"], a[href="' + new URL('/', page.url()).href + '"]').first()).toBeVisible();
  await expect(dlg.locator('a[href$="/search"]').first()).toBeVisible();
  await expect(dlg.locator('a[href$="/cart"]').first()).toBeVisible();

  expect(await focusIsInside(page, MENU), 'focus inside the menu').toBe(true);
  await expect(dlg.getByRole('navigation', { name: /mobile/i })).toBeVisible();

  const locked = await page.evaluate(() => ['overflow', 'overflowY'].some((p) => getComputedStyle(document.documentElement)[p] === 'hidden' || getComputedStyle(document.body)[p] === 'hidden'));
  expect(locked, 'page scroll locked').toBe(true);
});

test('submenu slides over with a back button; a link navigates', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/');
  const parent = fx.menuLinks('main-menu').find((l) => (l.links || []).length);
  test.skip(!parent, 'no nested menu in fixtures');
  await menuBtn(page).click();
  await expectDialogOpen(page, 'sf-menu-drawer');
  const dlg = page.locator(`${MENU} dialog`);
  const opener = dlg.locator('summary, button[aria-expanded]').filter({ hasText: new RegExp(`^\\s*${parent.title}`, 'i') }).first();
  await expect(opener).toBeVisible();
  await opener.click();
  const back = dlg.getByRole('button', { name: new RegExp(`back|${parent.title}`, 'i') }).filter({ hasNot: page.locator('[data-sf-close]') });
  await expect(back.first()).toBeVisible();
  const child = parent.links[0];
  const a = dlg.getByRole('link', { name: new RegExp(`^\\s*${child.title}\\s*$`, 'i') }).first();
  await expect(a).toBeVisible();
  // back returns to the first level
  await back.first().click();
  await expect(opener).toBeVisible();
  await expect(a, 'back hides the submenu').toBeHidden();
  await expect(dlg.locator('details[open]')).toHaveCount(0);
  await opener.click();
  await expect(a).toBeVisible();
  await Promise.all([page.waitForURL((u) => u.pathname === new URL(child.url, 'http://x').pathname), a.click()]);
});

test('Esc and the close button close it; focus returns to the menu button', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const btn = menuBtn(page);
  await btn.click();
  await expectDialogOpen(page, 'sf-menu-drawer');
  await page.keyboard.press('Escape');
  await expectDialogOpen(page, 'sf-menu-drawer', false);
  await expect(btn).toBeFocused();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');

  await btn.click();
  await expectDialogOpen(page, 'sf-menu-drawer');
  await page.locator(`${MENU} dialog`).getByRole('button', { name: /close/i }).first().click();
  await expectDialogOpen(page, 'sf-menu-drawer', false);
  await expect(btn).toBeFocused();
  const unlocked = await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden' && getComputedStyle(document.body).overflow !== 'hidden');
  expect(unlocked, 'scroll lock released').toBe(true);
});

test('localization select is present in the menu (show_currency_selector default)', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  await menuBtn(page).click();
  await expectDialogOpen(page, 'sf-menu-drawer');
  const sel = page.locator(`${MENU} select[name="country_code"]`);
  await expect(sel).toHaveCount(1);
  await expect(sel.locator('option')).toHaveCount(fx.shop().countries.length);
  // it has an accessible label
  const named = await sel.evaluate((s) => !!(s.labels?.length || s.getAttribute('aria-label') || s.getAttribute('aria-labelledby')));
  expect(named).toBe(true);
});
