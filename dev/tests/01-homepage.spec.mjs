// Homepage load (BRIEF §12; ARCHITECTURE §9 row 01, §2.5, §5.2, §7.3).
import { test, expect, fx, gotoOk, assertNoTemplateErrors, markIntroSeen } from './helpers/base.mjs';

const ORDER = ['hero-film', 'featured-collection', 'signature-showcase', 'campaign-editorial', 'category-grid', 'brand-story'];

test.describe('homepage', () => {
  test('loads with sections A–G in order, one h1, ribbon, no errors', async ({ page, guard }) => {
    await gotoOk(page, '/');
    await assertNoTemplateErrors(page);

    const seq = await page.locator('[data-sf-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sf-section')));
    expect(seq.filter((s) => ORDER.includes(s)), 'A–F order').toEqual(ORDER);

    // G: newsletter band (footer group, id="newsletter", exactly once) + footer landmark.
    await expect(page.locator('#newsletter')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    const newsletterAfterStory = await page.evaluate(() => {
      const story = document.querySelector('[data-sf-section="brand-story"]');
      const nl = document.getElementById('newsletter');
      return !!(story && nl && (story.compareDocumentPosition(nl) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(newsletterAfterStory, 'newsletter follows the brand story').toBe(true);

    // Exactly one h1, containing the hero wordmark image; accessible name = shop name.
    await expect(page.locator('h1')).toHaveCount(1);
    const h1 = page.locator('h1');
    await expect(h1.locator('img')).not.toHaveCount(0);
    expect(await h1.evaluate((el) => !!el.closest('[data-sf-section="hero-film"]')), 'h1 is in the hero').toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(new RegExp(`^\\s*${fx.shop().name}\\s*$`, 'i'));

    await expect(page.locator('#sf-preview-ribbon')).toBeVisible();
    await expect(page.locator('#sf-preview-ribbon')).toHaveText(/PREVIEW · SAMPLE DATA/);

    // No 4xx/5xx subresources.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    expect(guard.httpErrors(), '4xx/5xx subresources').toEqual([]);
    expect(guard.failedRequests(), 'failed requests').toEqual([]);
  });

  test('hero CTAs: EXPLORE COLLECTION → collection, VIEW THE CAMPAIGN → #campaign on Section D', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const hero = page.locator('[data-sf-section="hero-film"]');
    const primary = hero.getByRole('link', { name: /explore collection/i });
    await expect(primary).toHaveCount(1);
    expect(await primary.getAttribute('href')).toMatch(/\/collections(\/|$)/);
    await expect(primary).toHaveText(/explore collection/i);
    expect(await primary.evaluate((el) => el.innerText.trim()), 'rendered uppercase').toBe('EXPLORE COLLECTION');

    const secondary = hero.getByRole('link', { name: /view the campaign/i });
    await expect(secondary).toHaveCount(1);
    expect(await secondary.getAttribute('href')).toMatch(/#campaign$/);
    expect(await secondary.evaluate((el) => el.innerText.trim())).toBe('VIEW THE CAMPAIGN');

    const campaign = page.locator('#campaign');
    await expect(campaign).toHaveCount(1);
    expect(await campaign.evaluate((el) => el.matches('[data-sf-section="campaign-editorial"]') || !!el.closest('[data-sf-section="campaign-editorial"]') || !!el.querySelector('[data-sf-section="campaign-editorial"]')),
      '#campaign is Section D').toBe(true);
  });

  test('Section D is editorial only (no lookbook, no product cards)', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const d = page.locator('[data-sf-section="campaign-editorial"]');
    await expect(d).toHaveCount(1);
    await expect(d.locator('[class*="lookbook"], [class*="__look"], [data-sf-look]')).toHaveCount(0);
    await expect(d.locator('sf-product-card')).toHaveCount(0);
  });

  // Review r2 item 1: the blue-grey zip hoodie is the hero garment of the featured rail and the signature showcase
  // only; the Hoodies tile (category stage + header mega tile) is the Hoodies collection image, a different garment.
  test('the blue-grey zip hoodie appears only in the featured rail and the signature showcase', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const hoodies = fx.collection('hoodies');
    expect(hoodies && hoodies.image, 'hoodies collection has an image').toBeTruthy();
    expect(hoodies.image.base, 'Hoodies image is not the zip hoodie').not.toMatch(/zip-hoodie-washed-blue-grey/);
    const imgs = await page.locator('img').evaluateAll((els) => els.map((i) => ({
      urls: [i.currentSrc, i.getAttribute('src'), i.getAttribute('srcset'), ...[...(i.closest('picture')?.querySelectorAll('source') || [])].map((s) => s.getAttribute('srcset'))].filter(Boolean).join(' '),
      section: i.closest('[data-sf-section]')?.getAttribute('data-sf-section') || (i.closest('header, .sf-header') ? 'header' : 'other'),
      hoodiesTile: !!i.closest('[data-sf-section="category-grid"] [data-sf-cat-item="0"], [data-sf-section="category-grid"] [data-sf-cat-slide="0"]'),
    })));
    const zip = imgs.filter((i) => /zip-hoodie-washed-blue-grey/.test(i.urls));
    expect(zip.length, 'the zip hoodie is in the featured rail').toBeGreaterThan(0);
    expect(zip.filter((i) => !['featured-collection', 'signature-showcase'].includes(i.section)).map((i) => i.section),
      'zip hoodie images outside the featured rail / signature showcase').toEqual([]);
    const tiles = imgs.filter((i) => i.hoodiesTile);
    expect(tiles.length, 'Hoodies tile images in the category stage').toBeGreaterThan(0);
    for (const t of tiles) expect(t.urls, 'Hoodies tile shows the Hoodies collection image').toContain(hoodies.image.base);
  });

  test('Section E: index list of 5 category links with a visually hidden h2', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const e = page.locator('[data-sf-section="category-grid"]');
    const h2 = e.locator('h2');
    await expect(h2).toHaveCount(1);
    const hidden = await h2.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (r.width <= 1 && r.height <= 1) || cs.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(cs.clipPath);
    });
    expect(hidden, 'Section E h2 is visually hidden').toBe(true);
    // The index list: one real link per category name (5 preset blocks), each pointing into /collections.
    for (const name of ['Hoodies', 'Tracksuits', 'Tops', 'Bottoms', 'New arrivals']) {
      const links = e.getByRole('link', { name: new RegExp(`^\\s*${name}\\b`, 'i') });
      expect(await links.count(), `link for ${name}`).toBeGreaterThanOrEqual(1);
      expect(await links.first().getAttribute('href'), `${name} href`).toMatch(/^\/collections(\/|$)/);
    }
    const listLinks = await e.locator('a[href]').evaluateAll((as) => as.filter((a) => a.getClientRects().length && getComputedStyle(a).visibility !== 'hidden').length);
    expect(listLinks, 'visible category links').toBeGreaterThanOrEqual(5);
  });

  test('featured collection: card count, names, prices and colorways from fixtures', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const b = page.locator('[data-sf-section="featured-collection"]');
    const all = fx.collectionProducts('all');
    const expected = Math.min(8, all.length);
    const cards = b.locator('sf-product-card');
    await expect(cards).toHaveCount(expected);
    for (let i = 0; i < expected; i++) {
      const card = cards.nth(i);
      const handle = await card.getAttribute('data-product-handle');
      const p = fx.product(handle);
      await expect(card.locator('.sf-card__title')).toHaveText(p.title);
      await expect(card.locator('[data-sf-price]')).toContainText(fx.formatMoney(fx.priceMin(p)));
      if (fx.colorOption(p)) await expect(card.locator('.sf-colorways'), `colorways on ${handle}`).toHaveCount(1);
      else await expect(card.locator('.sf-colorways')).toHaveCount(0);
    }
  });
});
