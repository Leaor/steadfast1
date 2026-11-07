// Performance budgets (BRIEF §9; ARCHITECTURE §9 row 16, §6.1 v1.2; ruling §15.10).
// Budgets are COMPRESSED (brotli q11, computed in-test with zlib, as the Shopify CDN serves text) and
// HTTP/2-aware (request counts are a ceiling on theme-owned requests, not a proxy for latency).
// Every page writes its measurement to the test attachments (`<kind>-measure.json`) so §6.1 can be
// re-derived from real numbers: budget = measured post-fix value + ~15 % (ARCHITECTURE §6.1).
import { test, expect, fx, gotoOk, fileOf, markIntroSeen, isMobile } from './helpers/base.mjs';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const KB = 1024;
const br = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const TEXT = /^(text\/|application\/(json|javascript)|image\/svg\+xml)/;

// requests: theme-owned requests before the first scroll (document + theme assets + media; no
// content_for_header platform requests, none exist on the preview). jsBr/cssBr: brotli totals.
// transfer: non-video bytes before the first scroll, compressed text + binary as served, mobile DPR 3.
// ARCHITECTURE §6.1 v1.2: measured on 2026-11-07 (this spec's own *-measure.json, max of the desktop and
// mobile projects, connection pinned to 4g) + ~15 % margin, rounded up. Re-derive them the same way.
const BUDGETS = {
  // Home row: revision round 1 (HOME's data-sf-module loader for five sections: 32 req desktop / 23.2 KB JS br).
  home: { requests: 37, jsBr: 27 * KB, cssBr: 28.5 * KB, transfer: 465 * KB },
  // Product row: revision round 1 (COMMERCE lazy rail media + related products; ARCHITECTURE §6.1 product row).
  product: { requests: 23, jsBr: 27.5 * KB, cssBr: 20.5 * KB, transfer: 285 * KB },
  collection: { requests: 26, jsBr: 24 * KB, cssBr: 20.5 * KB, transfer: 390 * KB },
  search: { requests: 23, jsBr: 24 * KB, cssBr: 22.5 * KB, transfer: 270 * KB },
  cart: { requests: 19, jsBr: 20.5 * KB, cssBr: 18.75 * KB, transfer: 117 * KB },
  content: { requests: 19, jsBr: 22 * KB, cssBr: 18.5 * KB, transfer: 118 * KB },
  customer: { requests: 20, jsBr: 22 * KB, cssBr: 20 * KB, transfer: 120 * KB },
};
// Render-blocking CSS, every template (§3.1: the three global files; measured 3 files, 12.2 KB br).
const BLOCKING = { count: 4, br: 14.5 * KB };
// Per-file caps for the always-loaded files (brotli q11; sf-core also a raw ceiling). sf-core.js is capped
// at its measured size (ruling §15.14): new core features beyond it ship as on-demand modules.
const FILE_CAPS = {
  'sf-core.js': { br: 8 * KB, raw: 33 * KB },
  'sf-header.js': { br: 4 * KB },
  'sf-header.css': { br: 4.5 * KB },
  'sf-product-card.css': { br: 2.5 * KB },
  'sf-product-card.js': { br: 1.75 * KB },
  'sf-cart.js': { br: 5.125 * KB },
  'sf-base.css': { br: 6.5 * KB },
};
const ROUTES = () => [
  ['home', '/'], ['product', `/products/${fx.products()[0].handle}`], ['collection', '/collections/all'],
  ['search', '/search?q=hoodie'], ['cart', '/cart'], ['content', '/pages/contact'], ['customer', '/account/login'],
];
const isGsap = (u) => /\/(gsap|ScrollTrigger)\.min\.js/.test(u);

function meter(page) {
  const m = { js: 0, jsBr: 0, css: 0, cssBr: 0, gsap: 0, transfer: 0, urls: new Set(), files: [], pending: [] };
  page.on('response', (r) => {
    const url = r.url();
    if (url.startsWith('data:')) return;
    m.urls.add(url.split('#')[0]);
    const type = r.request().resourceType();
    if (type === 'media' || /\.mp4(\?|$)/.test(url)) return; // video budgets are §6.1's asset rows
    m.pending.push((async () => {
      let body = null;
      try { body = await r.body(); } catch { /* redirects, aborted */ }
      const size = body ? body.length : Number(r.headers()['content-length'] || 0);
      const ctype = r.headers()['content-type'] || '';
      const sizeBr = body && TEXT.test(ctype) && size > 512 ? br(body) : size;
      m.transfer += sizeBr;
      if (type === 'script' || type === 'stylesheet') {
        if (isGsap(url)) m.gsap += size;
        else if (type === 'script') { m.js += size; m.jsBr += sizeBr; } else { m.css += size; m.cssBr += sizeBr; }
      }
      m.files.push({ type, file: fileOf(url), raw: size, br: sizeBr });
    })());
  });
  return m;
}
// Pin the effective connection type to 4g (Chromium's lazy-load distance is 1250 px on 4g, 3000 px when
// unknown), so "before first scroll" means the same set of lazy images on every run (PERF-07).
async function emulate4g(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 20, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 9 * 1024 * 1024 / 8, connectionType: 'cellular4g',
  });
  return cdp;
}
const settle = async (m) => { let n = -1; while (n !== m.pending.length) { n = m.pending.length; await Promise.all(m.pending); } };

for (const [i, kind] of ['home', 'product', 'collection', 'search', 'cart', 'content', 'customer'].entries()) {
  test(`budget: ${kind}`, async ({ page }, testInfo) => {
    const [, url] = ROUTES()[i];
    await emulate4g(page);
    const m = meter(page);
    await gotoOk(page, url);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await settle(m);
    const blocking = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter((e) => e.renderBlockingStatus === 'blocking' && e.initiatorType === 'link').map((e) => e.name.split('/').pop().split('?')[0]));
    const blockingBr = m.files.filter((f) => f.type === 'stylesheet' && blocking.includes(f.file)).reduce((a, f) => a + f.br, 0);
    const b = BUDGETS[kind];
    const measure = {
      project: testInfo.project.name, url, requests: m.urls.size, jsRaw: m.js, jsBr: m.jsBr, cssRaw: m.css, cssBr: m.cssBr,
      transferBr: m.transfer, blockingCss: blocking, blockingBr, files: m.files.sort((a, z) => z.br - a.br),
    };
    await testInfo.attach(`${kind}-measure.json`, { body: JSON.stringify(measure, null, 2), contentType: 'application/json' });
    expect(m.gsap, `GSAP bytes before scroll on ${url}`).toBe(0);
    expect(m.urls.size, `theme-owned requests before first scroll on ${url}`).toBeLessThanOrEqual(b.requests);
    expect(m.jsBr, `theme JS (brotli) on ${url}`).toBeLessThanOrEqual(b.jsBr);
    expect(m.cssBr, `CSS (brotli) on ${url}`).toBeLessThanOrEqual(b.cssBr);
    expect(blocking.length, `render-blocking stylesheets on ${url}: ${blocking.join(', ')}`).toBeLessThanOrEqual(BLOCKING.count);
    expect(blockingBr, `render-blocking CSS (brotli) on ${url}`).toBeLessThanOrEqual(BLOCKING.br);
    // The transfer budget is defined at mobile DPR 3 (the heaviest image density).
    if (isMobile(testInfo)) expect(m.transfer, `non-video transfer before first scroll on ${url} (mobile DPR 3, compressed)`).toBeLessThanOrEqual(b.transfer);
  });
}

test('per-file caps (brotli) for the always-loaded core files', async ({}, testInfo) => {
  test.skip(isMobile(testInfo), 'file-system check, once');
  const rows = [];
  for (const [f, cap] of Object.entries(FILE_CAPS)) {
    const buf = readFileSync(path.join(fx.THEME_DIR, 'assets', f));
    const row = { f, raw: buf.length, br: br(buf) };
    rows.push(row);
    expect(row.br, `${f} brotli ≤ ${cap.br} B`).toBeLessThanOrEqual(cap.br);
    if (cap.raw) expect(row.raw, `${f} raw ceiling ≤ ${cap.raw} B`).toBeLessThanOrEqual(cap.raw);
  }
  await testInfo.attach('file-caps.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
});

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
  // Chromium's lazy-load distance depends on the effective connection type (unknown/offline 3000 px,
  // 2g 8000, 3g 2500, 4g 1250). Pin the connection to 4g so the threshold is deterministic (PERF-07).
  const LAZY_DISTANCE_4G = 1250;
  await emulate4g(page);
  const imgs = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') imgs.push(fileOf(r.url())); });
  await gotoOk(page, '/');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const ect = await page.evaluate(() => navigator.connection?.effectiveType || 'unknown');
  expect(ect, 'emulated effective connection type').toBe('4g');
  // Margin: 250 px so an image right at the line (rounding, late layout) is not a false positive.
  const far = await page.evaluate((d) => [...document.querySelectorAll('img[loading="lazy"]')]
    .filter((i) => i.getBoundingClientRect().top > window.innerHeight + d)
    .map((i) => (i.currentSrc || i.src).split('/').pop().split('?')[0].replace(/-\d+\.(webp|jpg|png)$/, '')), LAZY_DISTANCE_4G + 250);
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
  // PLAT-09: once the layout emits the font preloads with `preload_tag` (Shopify semantics), the same URLs
  // must also be in the document's HTTP Link header, exactly like on Shopify.
  const layout = readFileSync(path.join(fx.THEME_DIR, 'layout/theme.liquid'), 'utf8');
  const viaPreloadTag = /sf-font-[\w-]+\.woff2'\s*\|\s*asset_url\s*\|\s*preload_tag/.test(layout);
  for (const url of ['/', '/collections/all']) {
    const res = await gotoOk(page, url);
    const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((ls) => ls.map((l) => ({ f: l.href.split('/').pop().split('?')[0], type: l.type, co: l.hasAttribute('crossorigin') })));
    expect(preloads.map((p) => p.f).sort()).toEqual(['sf-font-label-500.woff2', 'sf-font-text-400.woff2']);
    for (const p of preloads) { expect(p.type).toBe('font/woff2'); expect(p.co).toBe(true); }
    if (viaPreloadTag) {
      const link = res.headers().link || '';
      const fontsInHeader = [...link.matchAll(/<[^>]*\/(sf-font-[\w-]+\.woff2)\?[^>]*>;\s*rel=preload;\s*as=font/g)].map((m) => m[1]).sort();
      expect(fontsInHeader, `Link header of ${url}`).toEqual(['sf-font-label-500.woff2', 'sf-font-text-400.woff2']);
    }
  }
});

test('harness: preload_tag mirrors Shopify (PLAT-09: as required, attributes in order, rel last, Link header, Shopify-hosted URLs only)', async () => {
  const { Liquid } = await import('liquidjs');
  const { registerFilters, RQ } = await import('../preview/lib/filters.mjs');
  const engine = new Liquid({ strictFilters: true });
  registerFilters(engine, { themeDir: fx.THEME_DIR });
  const rq = { warn: () => {} };
  const render = (src) => engine.parseAndRender(src, {}, { globals: { [RQ]: rq } });
  const font = await render("{{ 'sf-font-text-400.woff2' | asset_url | preload_tag: as: 'font', type: 'font/woff2', crossorigin: true }}");
  expect(font).toMatch(/^<link href="\/cdn\/shop\/t\/preview\/assets\/sf-font-text-400\.woff2\?v=\d+" as="font" type="font\/woff2" crossorigin rel="preload">$/);
  // shopify.dev example 2: custom attributes keep their order, rel="preload" comes last
  expect(await render("{{ 'sf-cart.js' | asset_url | preload_tag: as: 'script', type: 'text/javascript' }}"))
    .toMatch(/^<link href="[^"]+\/sf-cart\.js\?v=\d+" as="script" type="text\/javascript" rel="preload">$/);
  expect(rq.preloadLinks).toEqual([
    expect.stringMatching(/^<\/cdn\/shop\/t\/preview\/assets\/sf-font-text-400\.woff2\?v=\d+>; rel=preload; as=font; crossorigin; type="font\/woff2"$/),
    expect.stringMatching(/^<[^>]+\/sf-cart\.js\?v=\d+>; rel=preload; as=script; type="text\/javascript"$/),
  ]);
  await expect(render("{{ 'sf-cart.js' | asset_url | preload_tag }}")).rejects.toThrow(/"as" parameter is required/);
  await expect(render("{{ 'https://example.com/x.js' | preload_tag: as: 'script' }}")).rejects.toThrow(/asset_url or shopify_asset_url/);
});

test('theme folder ≤ 40 MB', async () => {
  let total = 0;
  const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else total += s.size; } };
  walk(fx.THEME_DIR);
  expect(total).toBeLessThanOrEqual(40 * 1024 * 1024);
});
