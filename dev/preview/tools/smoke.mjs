#!/usr/bin/env node
// Smoke-check every preview route: status, Liquid errors, missing translations, ribbon,
// and that every /cdn/ subresource referenced by the HTML resolves (no 404s).
// Usage: node dev/preview/tools/smoke.mjs [--base http://127.0.0.1:9292] [--json]
const base = (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1]
  || (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://127.0.0.1:9292');
const asJSON = process.argv.includes('--json');

const ROUTES = [
  ['/', 200], ['/collections', 200], ['/collections/all', 200], ['/collections/hoodies', 200], ['/collections/tracksuits', 200],
  ['/collections/tops', 200], ['/collections/bottoms', 200], ['/collections/new-arrivals', 200], ['/collections/zip-ups', 200],
  ['/collections/all?sort_by=price-ascending', 200], ['/collections/all?filter.v.option.size=M&filter.v.availability=1', 200],
  ['/collections/all?filter.v.price.gte=100&filter.v.price.lte=200', 200], ['/collections/all?filter.p.product_type=Hoodies', 200],
  ['/collections/all?page=2&preview_sections=%7B%22main%22%3A%7B%22products_per_page%22%3A4%7D%7D', 200],
  ['/collections/nope', 404],
  ['/products/zip-hoodie-washed-blue-grey', 200], ['/products/zip-hoodie-washed-blue-grey?variant=2004', 200],
  ['/products/reflective-piping-tracksuit-black-speckle', 200], ['/products/embossed-gothic-tracksuit-stone', 200],
  ['/products/embossed-gothic-hoodie', 200], ['/products/embossed-gothic-hoodie?variant=2018', 200],
  ['/products/heavyweight-zip-hoodie-black', 200], ['/products/wide-sweatpants-black', 200],
  ['/collections/hoodies/products/zip-hoodie-washed-blue-grey', 200], ['/products/nope', 404],
  ['/search', 200], ['/search?q=hoodie', 200], ['/search?q=zzzz', 200], ['/search?q=hoodie&filter.v.option.color=Black', 200],
  ['/search/suggest?q=hoo&section_id=sf-predictive-search', 200],
  ['/recommendations/products?product_id=1001&limit=4&intent=related&section_id=template--preview__related', 200],
  ['/products/zip-hoodie-washed-blue-grey?section_id=sf-quick-view', 200],
  ['/cart', 200], ['/pages/contact', 200], ['/pages/size-guide', 200], ['/pages/shipping-returns', 200], ['/pages/nope', 404],
  ['/blogs/journal', 200], ['/blogs/journal/journal-entry-placeholder', 200], ['/policies/privacy-policy', 200],
  ['/policies/refund-policy', 200], ['/policies/shipping-policy', 200], ['/policies/terms-of-service', 200],
  ['/account/login', 200], ['/account/register', 200], ['/account/activate/1/abc', 200], ['/account/reset/1/abc', 200],
  ['/account', 302], ['/password', 200], ['/gift_cards/PREV-IEW0-0000', 200], ['/checkout', 200], ['/404', 404], ['/nowhere', 404],
];
const LOGGED_IN = [['/account', 200], ['/account/addresses', 200], ['/account/orders/1001', 200]];

const assetCache = new Map();
async function checkAsset(u) {
  if (assetCache.has(u)) return assetCache.get(u);
  const r = await fetch(new URL(u, base), { method: 'GET', headers: { Range: 'bytes=0-0' } });
  const ok = r.status === 200 || r.status === 206;
  assetCache.set(u, ok ? null : r.status);
  try { await r.arrayBuffer(); } catch { /* ignore */ }
  return assetCache.get(u);
}

async function run(path, expect, cookie) {
  const r = await fetch(new URL(path, base), { redirect: 'manual', headers: cookie ? { cookie } : {} });
  const text = await r.text();
  const res = { path, status: r.status, expect, ok: r.status === expect, errors: [], missing: [], brokenAssets: [] };
  if (!res.ok) res.errors.push(`status ${r.status} != ${expect}`);
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('text/html') && r.status !== 302) {
    for (const mm of text.matchAll(/Liquid error[^<]*/g)) res.errors.push(mm[0]);
    for (const mm of text.matchAll(/translation missing: [\w.-]+/g)) res.missing.push(mm[0]);
    const isSection = /section_id=|\/search\/suggest|\/recommendations/.test(path);
    if (!isSection && !text.includes('id="sf-preview-ribbon"')) res.errors.push('ribbon missing');
    const urls = new Set();
    for (const mm of text.matchAll(/(?:src|href|srcset|data-src|data-srcset|poster)="([^"]+)"/g)) {
      for (const part of mm[1].split(',')) {
        const u = part.trim().split(/\s+/)[0].replace(/&amp;/g, '&');
        if (u.startsWith('/cdn/') || u.startsWith('/assets/')) urls.add(u);
      }
    }
    for (const mm of text.matchAll(/url\((?:&quot;|["'])?(\/cdn\/[^)"'&]+)/g)) urls.add(mm[1]);
    for (const u of urls) { const s = await checkAsset(u); if (s) res.brokenAssets.push(`${s} ${u}`); }
  }
  return res;
}

const results = [];
for (const [p, e] of ROUTES) results.push(await run(p, e));
const login = await fetch(new URL('/account/login', base), {
  method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'form_type=customer_login&customer%5Bemail%5D=customer%40example.com&customer%5Bpassword%5D=x',
});
const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
for (const [p, e] of LOGGED_IN) results.push(await run(p, e, cookie));

if (asJSON) { console.log(JSON.stringify(results, null, 2)); process.exit(0); }
let bad = 0;
for (const r of results) {
  const problems = [...r.errors, ...[...new Set(r.missing)], ...r.brokenAssets];
  if (problems.length) bad++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.status} ${r.path}`);
  for (const pr of [...new Set(problems)].slice(0, 12)) console.log(`       - ${pr}`);
}
console.log(`\n${results.length - bad}/${results.length} routes clean`);
process.exit(bad ? 1 : 0);
