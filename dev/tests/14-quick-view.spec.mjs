// Quick view (BRIEF §4B; ARCHITECTURE §9 row 14, §4.6, §4.7 Steadfast.quickView; DESIGN §7.6).
import { test, expect, fx, gotoOk, expectDialogOpen, chooseOption, cartJSON, isMobile } from './helpers/base.mjs';

test('opens from a card, loads the section, picker works, add closes it and opens the drawer', async ({ page }, testInfo) => {
  const p = fx.multiOptionProduct();
  await gotoOk(page, '/collections/all');
  const card = page.locator(`main sf-product-card[data-product-handle="${p.handle}"]`).first();
  const trigger = card.locator('a[data-sf-quick-view][data-intent="view"]').first();
  if (!isMobile(testInfo)) await card.hover();
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText(/quick view/i);
  const req = page.waitForRequest((r) => r.url().includes('section_id=sf-quick-view') && r.url().includes(`/products/${p.handle}`));
  await trigger.click();
  await req;
  await expectDialogOpen(page, 'sf-quick-view');
  const qv = page.locator('#sf-quick-view dialog');
  await expect(qv.locator('[data-sf-quick-view-body]')).toContainText(p.title);
  await expect(qv.getByRole('link', { name: /view full details/i })).toHaveAttribute('href', new RegExp(`/products/${p.handle}`));
  await expect.poll(() => page.evaluate(() => window.__sfEvents.some((e) => e.name === 'quickview:loaded'))).toBe(true);
  const picker = qv.locator('sf-variant-picker').first();
  await expect(picker).toHaveAttribute('data-update-url', 'false');
  const urlBefore = page.url();
  const v = fx.availableVariants(p).slice(-1)[0];
  for (const [i, opt] of p.options.entries()) if ((opt.values || []).length > 1) await chooseOption(qv, fx.optName(opt), fx.variantOptions(v)[i]);
  await expect(qv.locator('input[name="id"]').first()).toHaveValue(String(v.id));
  expect(page.url(), 'quick view does not change the URL').toBe(urlBefore);
  await qv.locator('sf-product-form button[type="submit"]').first().click();
  await expectDialogOpen(page, 'sf-quick-view', false);
  await expectDialogOpen(page, 'sf-cart-drawer');
  expect((await cartJSON(page)).items.map((i) => i.variant_id)).toEqual([v.id]);
});

test('Esc closes quick view and restores focus to the card trigger', async ({ page }, testInfo) => {
  await gotoOk(page, '/collections/all');
  const card = page.locator('main sf-product-card').first();
  const trigger = card.locator('a[data-sf-quick-view][data-intent="view"]').first();
  if (!isMobile(testInfo)) await card.hover();
  await trigger.click();
  await expectDialogOpen(page, 'sf-quick-view');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#sf-quick-view'))).toBe(true);
  await page.keyboard.press('Escape');
  await expectDialogOpen(page, 'sf-quick-view', false);
  await expect(trigger).toBeFocused();
});
