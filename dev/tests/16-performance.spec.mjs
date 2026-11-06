// Performance budgets (BRIEF §9; ARCHITECTURE §9 row 16, §6.1). Raw bytes as served by the preview.
import { test, expect, fx, gotoOk, fileOf, markIntroSeen } from './helpers/base.mjs';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const KB = 1024;
const BUDGETS = {
  home: { js: 130 * KB, css: 170 * KB, gsap: 0, requests: 25 },
  product: { js: 100 * KB, css: 120 * KB, gsap: 0, requests: 25 },
  collection: { js: 90 * KB, css: 110 * KB, gsap: 0, requests: 25 },
  search: { js: 90 * KB, css: 110 * KB, gsap: 0, requests: 25 },
  cart: { js: 80 * KB, css: 100 * KB, gsap: 0, requests: 20 },
  content: { js: 80 * KB, css: 100 * KB, gsap: 0, requests: 20 },
  customer: { js: 80 * KB, css: 100 * KB, gsap: 0, requests: 20 },
};
const ROUTES = () => [
  ['home', '/'], ['product', `/products/${fx.products()[0].handle}`], ['collection', '/collections/all'],
  ['search', '/search?q=hoodie'], ['cart', '/cart'], ['content', '/pages/contact'], ['customer', '/account/login'],
];
const isGsap = (u) => /\/(gsap|ScrollTrigger)\.min\.js/.test(u);

function meter(page) {
  const m = { js: 0, css: 0, gsap: 0, urls: new Set(), files: [] };
  page.on('response', async (r) => {
    const url = r.url();
    if (url.startsWith('data:')) return;
    m.urls.add(url.split('#')[0]);
    const type = r.request().resourceType();
    if (type !== 'script' && type !== 'stylesheet') return;
    let size = 0;
    try { size = (await r.body()).length; } catch { size = Number(r.headers()['content-length'] || 0); }
    if (isGsap(url)) m.gsap += size;
    else if (type === 'script') m.js += size;
    else m.css += size;
    m.files.push(`${type} ${fileOf(url)} ${size}`);
  });
  return m;
}

for (const [i, kind] of ['home', 'product', 'collection', 'search', 'cart', 'content', 'customer'].entries()) {
  test(`budget: ${kind}`, async ({ page }, testInfo) => {
    const [, url] = ROUTES()[i];
    const m = meter(page);
    await gotoOk(page, url);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const b = BUDGETS[kind];
    await testInfo.attach(`${kind}-resources.txt`, { body: [...m.files, `requests=${m.urls.size}`, ...m.urls].join('\n') });
    expect(m.js, `theme JS raw bytes on ${url}`).toBeLessThanOrEqual(b.js);
    expect(m.css, `CSS raw bytes on ${url}`).toBeLessThanOrEqual(b.css);
    expect(m.gsap, `GSAP bytes before scroll on ${url}`).toBe(0);
    expect(m.urls.size, `requests before first scroll on ${url}`).toBeLessThanOrEqual(b.requests);
  });
}

test('home: GSAP after scroll stays within 125 KB raw', async ({ page }) => {
  await markIntroSeen(page);
  const m = meter(page);
  await gotoOk(page, '/');
  await page.locator('[data-sf-section="signature-showcase"]').scrollIntoViewIfNeeded();
  await page.locator('[data-sf-section="brand-story"]').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  expect(m.gsap).toBeLessThanOrEqual(125 * KB);
});

test('home: below-the-fold lazy images are not requested before scrolling', async ({ page }) => {
  await markIntroSeen(page);
  const imgs = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') imgs.push(fileOf(r.url())); });
  await gotoOk(page, '/');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // Chromium starts lazy images up to 3000 px (unknown connection type) below the viewport; anything
  // further down must not be requested before the first scroll.
  const far = await page.evaluate(() => [...document.querySelectorAll('img[loading="lazy"]')]
    .filter((i) => i.getBoundingClientRect().top > window.innerHeight + 3000)
    .map((i) => (i.currentSrc || i.src).split('/').pop().split('?')[0].replace(/-\d+\.(webp|jpg|png)$/, '')));
  expect(far.length, 'there are lazy images far below the fold').toBeGreaterThan(0);
  const eagerBases = await page.evaluate(() => [...document.querySelectorAll('img:not([loading="lazy"])')]
    .map((i) => (i.currentSrc || i.src).split('/').pop().split('?')[0].replace(/-\d+\.(webp|jpg|png)$/, '')));
  const early = imgs.filter((f) => far.some((base) => f.startsWith(base) && !eagerBases.some((e) => f.startsWith(e))));
  expect(early, 'far-below-the-fold lazy images requested before scroll').toEqual([]);
  const lazyAttr = await page.locator('[data-sf-section="campaign-editorial"] img, [data-sf-section="category-grid"] img, [data-sf-section="brand-story"] img').evaluateAll((els) => els.map((e) => e.getAttribute('loading')));
  expect(lazyAttr.every((l) => l === 'lazy'), 'D/E/F images are loading="lazy"').toBe(true);
});

test('home: at most one intro and one loop file per visit', async ({ page }) => {
  const mp4 = [];
  page.on('request', (r) => { if (/\.mp4(\?|$)/.test(r.url())) mp4.push(fileOf(r.url())); });
  await gotoOk(page, '/');
  await expect.poll(() => page.locator('sf-hero-film').getAttribute('data-state'), { timeout: 10_000 }).toMatch(/playing|static|fallback/);
  await page.locator('sf-hero-film [data-sf-hero-control]').click().catch(() => {});
  await expect.poll(() => mp4.some((f) => f.includes('loop')), { timeout: 8000 }).toBe(true);
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const d = [...new Set(mp4)];
  expect(d.filter((f) => /^sf-film-(desktop|mobile)\.mp4$/.test(f)).length).toBeLessThanOrEqual(1);
  expect(d.filter((f) => /^sf-film-loop-/.test(f)).length).toBeLessThanOrEqual(1);
});

test('fonts: exactly the 5 DESIGN §3.1 files, each ≤ 40 KB; exactly 2 preloaded', async ({ page }) => {
  const dir = path.join(fx.THEME_DIR, 'assets');
  const fonts = readdirSync(dir).filter((f) => /\.(woff2?|ttf|otf)$/.test(f)).sort();
  expect(fonts).toEqual(['sf-font-display-300-italic.woff2', 'sf-font-display-300.woff2', 'sf-font-label-500.woff2', 'sf-font-text-400.woff2', 'sf-font-text-500.woff2']);
  for (const f of fonts) expect(statSync(path.join(dir, f)).size, `${f} ≤ 40 KB`).toBeLessThanOrEqual(40 * KB);
  for (const url of ['/', '/collections/all']) {
    await gotoOk(page, url);
    const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((ls) => ls.map((l) => ({ f: l.href.split('/').pop().split('?')[0], type: l.type, co: l.hasAttribute('crossorigin') })));
    expect(preloads.map((p) => p.f).sort()).toEqual(['sf-font-label-500.woff2', 'sf-font-text-400.woff2']);
    for (const p of preloads) { expect(p.type).toBe('font/woff2'); expect(p.co).toBe(true); }
  }
});

test('theme folder ≤ 40 MB', async () => {
  let total = 0;
  const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else total += s.size; } };
  walk(fx.THEME_DIR);
  expect(total).toBeLessThanOrEqual(40 * 1024 * 1024);
});
