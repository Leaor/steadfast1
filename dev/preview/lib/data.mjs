// Fixture loading (dev/preview/fixtures/*.json), re-read when files change.
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['shop', 'products', 'collections', 'menus', 'pages', 'blogs', 'customer', 'gift_card'];

let cache = null;
let cacheKey = '';

function stamp(dir, repo) {
  const parts = FILES.map((f) => {
    try { return fs.statSync(path.join(dir, `${f}.json`)).mtimeMs; } catch { return 0; }
  });
  try { parts.push(fs.statSync(path.join(repo, 'media/processed/manifest.json')).mtimeMs); } catch { parts.push(0); }
  return parts.join(':');
}

function stillRef(manifest, base, alt) {
  const files = (manifest?.theme_assets || []).filter((a) => a.base === base && /\.(webp|jpg)$/.test(a.file));
  if (!files.length) return null;
  const webp = files.filter((f) => f.file.endsWith('.webp')).sort((a, b) => a.width - b.width);
  const pick = webp.length ? webp : files.sort((a, b) => a.width - b.width);
  const largest = pick[pick.length - 1];
  return {
    base: largest.path.replace(/^media\/processed\//, '').replace(/-\d+\.(webp|jpg)$/, ''),
    ext: largest.file.split('.').pop(), widths: pick.map((f) => f.width), width: largest.width, height: largest.height, alt,
  };
}

export function loadData(fixturesDir, repoRoot) {
  const key = stamp(fixturesDir, repoRoot);
  if (cache && key === cacheKey) return cache;
  const read = (f) => {
    try { return JSON.parse(fs.readFileSync(path.join(fixturesDir, `${f}.json`), 'utf8')); }
    catch (e) { console.error(`[preview] fixture ${f}.json unreadable: ${e.message}`); return {}; }
  };
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'media/processed/manifest.json'), 'utf8')); } catch { /* optional */ }
  const shop = read('shop');
  const products = read('products').products || [];
  const collections = read('collections').collections || [];
  const menus = read('menus').menus || [];
  const pages = read('pages').pages || [];
  const blogs = read('blogs').blogs || [];
  const customer = read('customer').customer || null;
  const giftCard = read('gift_card').gift_card || null;

  let imageId = 100001;
  const assignImageId = (img) => { if (img && !img.id) img.id = imageId++; return img; };
  for (const p of products) for (const m of p.media || []) { assignImageId(m.image); }
  for (const c of collections) assignImageId(c.image);
  for (const b of blogs) {
    for (const a of b.articles || []) {
      if (a.image && a.image.still) a.image = stillRef(manifest, a.image.still, a.image.alt);
      assignImageId(a.image);
    }
  }

  const variantIndex = new Map();
  for (const p of products) for (const v of p.variants) variantIndex.set(v.id, { product: p, variant: v });

  cache = {
    shop, products, collections, menus, pages, blogs, customer, giftCard, manifest, variantIndex,
    productByHandle: new Map(products.map((p) => [p.handle, p])),
    productById: new Map(products.map((p) => [p.id, p])),
    collectionByHandle: new Map(collections.map((c) => [c.handle, c])),
  };
  cacheKey = key;
  return cache;
}
