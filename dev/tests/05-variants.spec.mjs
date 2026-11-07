// Variant selection (BRIEF §12; ARCHITECTURE §9 row 05, §4.7 <sf-variant-picker>/<sf-product-form>, §7.6).
import { test, expect, fx, gotoOk, chooseOption, optionFieldset, chooseSizeIfRequired } from './helpers/base.mjs';

const ready = fx.fixturesReady();
const idInput = (page) => page.locator('main sf-product-form input[name="id"]').first();
const buyBtn = (page) => page.locator('main sf-product-form button[type="submit"]').first();
const variantParam = (page) => new URL(page.url()).searchParams.get('variant');

/** Checks the §4.7 availability marker of every value against the reference model. */
async function expectAvailabilityMarkers(page, p, selected) {
  const main = page.locator('main');
  for (const [oi, opt] of (p.options || []).entries()) {
    if ((opt.values || []).length < 2) continue;
    const fs = optionFieldset(main, fx.optName(opt));
    for (const value of fx.optionValues(opt)) {
      const want = fx.valueAvailable(p, oi, value, selected);
      const marked = await fs.locator(`input[value="${value}"]`).first().evaluate((input) => {
        const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : input.closest('label');
        return [input, label, input.parentElement].some((n) => n && n.classList.contains('is-unavailable'));
      });
      expect(marked, `${fx.optName(opt)}=${value} .is-unavailable (selection ${selected.join('/')})`).toBe(!want);
      if (!want) {
        const txt = await fs.locator(`input[value="${value}"]`).first().evaluate((input) => {
          const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : input.closest('label');
          return (label?.textContent || '') + ' ' + (input.getAttribute('aria-label') || '') + ' ' + (input.parentElement?.textContent || '');
        });
        expect(txt, 'unavailable value announced via text').toMatch(/sold out|unavailable/i);
      }
    }
  }
}

test('selecting a size updates the id input, ?variant= and the button; sold out disables it', async ({ page }) => {
  test.skip(!ready, 'fixtures missing');
  const p = fx.sizeCellProduct();
  const sizeIdx = p.options.findIndex((o) => fx.optName(o).toLowerCase() === 'size');
  const start = fx.firstAvailable(p);
  const target = fx.availableVariants(p).find((v) => v.id !== start.id);
  const sold = fx.soldOutVariants(p)[0];
  await gotoOk(page, `/products/${p.handle}`);
  await expect(idInput(page)).toHaveValue(String(start.id));

  if (target) {
    await chooseOption(page.locator('main'), 'size', fx.variantOptions(target)[sizeIdx]);
    await expect(idInput(page)).toHaveValue(String(target.id));
    await expect.poll(() => variantParam(page)).toBe(String(target.id));
    await expect(buyBtn(page)).toHaveText(/^\s*add to cart\s*$/i);
    await expect(buyBtn(page)).toBeEnabled();
    await expectAvailabilityMarkers(page, p, fx.variantOptions(target));
    const legend = optionFieldset(page.locator('main'), 'size').locator('legend');
    await expect(legend).toContainText(fx.variantOptions(target)[sizeIdx]);
  }
  expect(sold, 'fixtures have a sold-out size').toBeTruthy();
  await chooseOption(page.locator('main'), 'size', fx.variantOptions(sold)[sizeIdx]);
  await expect(idInput(page)).toHaveValue(String(sold.id));
  await expect(buyBtn(page)).toHaveText(/^\s*sold out\s*$/i);
  await expect(buyBtn(page)).toBeDisabled();
  await expect.poll(() => variantParam(page)).toBe(String(sold.id));
  await expect(page.locator('#sf-live-polite')).toContainText(/sold out/i);
});

test('colour change (garment 4) swaps the gallery to the variant media and updates the legend', async ({ page }, testInfo) => {
  test.skip(!ready, 'fixtures missing');
  const p = fx.colorwayProduct();
  test.skip(!p, 'no multi-colour fixture product');
  const ci = p.options.findIndex(fx.isColorOption);
  const start = fx.firstAvailable(p);
  const startColor = fx.variantOptions(start)[ci];
  const otherColor = fx.optionValues(p.options[ci]).find((c) => c !== startColor);
  await gotoOk(page, `/products/${p.handle}`);
  const main = page.locator('main');
  await chooseSizeIfRequired(main, p, start);   // a full variant needs a size (never pre-selected)
  await chooseOption(main, fx.optName(p.options[ci]), otherColor);
  const sel = fx.variantOptions(start).map((x, i) => (i === ci ? otherColor : x));
  const want = p.variants.find((v) => fx.variantOptions(v).every((x, i) => x === sel[i]));
  if (want) await expect(idInput(page)).toHaveValue(String(want.id));
  await expect(optionFieldset(main, fx.optName(p.options[ci])).locator('legend')).toContainText(otherColor);
  const variantWithMedia = p.variants.find((v) => fx.variantOptions(v)[ci] === otherColor && v.featured_media_id);
  expect(variantWithMedia, 'fixture colour has variant media').toBeTruthy();
  const media = p.media.find((m) => m.id === variantWithMedia.featured_media_id);
  const base = fx.mediaBase(media);
  const item = main.locator('sf-product-gallery').first().locator(`[data-media-id="${media.id}"]`).first();
  const target = (await item.count()) ? item : main.locator(`sf-product-gallery img[srcset*="${base}"], sf-product-gallery img[src*="${base}"]`).first();
  if (testInfo.project.name === 'mobile') {
    // Mobile: the snap rail scrolls horizontally to the variant media (the page itself is not moved).
    await expect.poll(() => target.evaluate((el) => {
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowX)) sc = sc.parentElement;
      if (!sc) return false;
      const r = el.getBoundingClientRect(); const c = sc.getBoundingClientRect();
      return r.left >= c.left - 2 && r.right <= c.right + 2;
    }), { message: `variant media ${base} active in the rail` }).toBe(true);
  } else {
    await expect(target, `variant media ${base} brought into view`).toBeInViewport({ ratio: 0.5 });
  }
  await expectAvailabilityMarkers(page, p, sel);
});

test('direct load of ?variant= preselects it', async ({ page }) => {
  test.skip(!ready, 'fixtures missing');
  for (const p of [fx.sizeCellProduct(), fx.multiOptionProduct()].filter(Boolean)) {
    const v = fx.availableVariants(p).slice(-1)[0];
    await gotoOk(page, `/products/${p.handle}?variant=${v.id}`);
    await expect(idInput(page)).toHaveValue(String(v.id));
    for (const [i, opt] of p.options.entries()) {
      if ((opt.values || []).length < 2) continue;
      const val = fx.variantOptions(v)[i];
      await expect(optionFieldset(page.locator('main'), fx.optName(opt)).locator(`input[value="${val}"]`).first()).toBeChecked();
    }
    await expect(buyBtn(page)).toHaveText(/^\s*add to cart\s*$/i);
  }
});

test('arrow keys move within the radio group', async ({ page }) => {
  test.skip(!ready, 'fixtures missing');
  const p = fx.sizeCellProduct();
  const sizeIdx = p.options.findIndex((o) => fx.optName(o).toLowerCase() === 'size');
  const sizes = fx.optionValues(p.options[sizeIdx]);
  await gotoOk(page, `/products/${p.handle}?variant=${p.variants.find((v) => fx.variantOptions(v)[sizeIdx] === sizes[0]).id}`);
  const fs = optionFieldset(page.locator('main'), 'size');
  await fs.locator(`input[value="${sizes[0]}"]`).focus();
  await page.keyboard.press('ArrowRight');
  await expect(fs.locator(`input[value="${sizes[1]}"]`)).toBeChecked();
  await expect(fs.locator(`input[value="${sizes[1]}"]`)).toBeFocused();
  const v1 = p.variants.find((v) => fx.variantOptions(v)[sizeIdx] === sizes[1]);
  await expect(idInput(page)).toHaveValue(String(v1.id));
  await page.keyboard.press('ArrowLeft');
  await expect(fs.locator(`input[value="${sizes[0]}"]`)).toBeChecked();
});
