#!/usr/bin/env node
// Builds dev/preview/fixtures/products.json and collections.json from the product
// definitions below plus media/processed/manifest.json (MEDIA's `fixtures` array).
// Product media is taken ONLY from the manifest, so no garment view is ever invented.
// Every value here is a PLACEHOLDER (prices, sizes, inventory, dates); see "_note".
// Usage: node dev/preview/tools/build-fixtures.mjs   (idempotent)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const fixturesDir = path.resolve(here, '../fixtures');
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'media/processed/manifest.json'), 'utf8'));

const NOTE = 'Sample data derived only from the garments visible in the supplied client assets (CONTEXT.md). ' +
  'Prices, sizes, inventory, SKUs and dates are placeholders, not STEADFAST data.';
const DESCRIPTION = '<p>Placeholder description. Product details to be confirmed by STEADFAST.</p>';

// Views in display order per handle, with neutral, visible-only alt text.
// Review r1 item 5: the zip hoodie gallery is front, back + three 4:5 details (chest logo, neck label with zip,
// sleeve label); MEDIA no longer publishes front-alt / zip / shoulder / hem views.
const VIEW_ALTS = {
  front: 'front', back: 'back', lifestyle: 'worn, night photograph',
  'back-charcoal': 'back, washed charcoal', 'back-grey': 'back, washed grey',
  'detail-chest-logo': 'detail, chest logo', 'detail-neck-label': 'detail, neck label and zip',
  'detail-cuff-label': 'detail, sleeve label',
};
const VIEW_ORDER = ['front', 'back', 'back-charcoal', 'back-grey', 'lifestyle', 'detail-chest-logo',
  'detail-neck-label', 'detail-cuff-label'];

// size, available?, inventory
const SIZES = (soldOut = [], low = {}) => ['S', 'M', 'L', 'XL'].map((s) => ({
  size: s, inventory: soldOut.includes(s) ? 0 : (low[s] ?? 6),
}));

const PRODUCTS = [
  {
    id: 1001, handle: 'zip-hoodie-washed-blue-grey', title: 'Zip hoodie, washed blue-grey', product_type: 'Hoodies',
    tags: ['hoodie', 'zip-up'], created_at: '2026-10-28T10:00:00Z', best_selling_rank: 1, price: 18000,
    colors: [{ name: 'Washed blue-grey', swatch: '#6f7e8c' }], sizes: SIZES(['XL'], { M: 2 }),
  },
  {
    id: 1002, handle: 'reflective-piping-tracksuit-black-speckle', title: 'Piped tracksuit, black speckle', product_type: 'Tracksuits',
    tags: ['tracksuit'], created_at: '2026-10-14T10:00:00Z', best_selling_rank: 3, price: 26000,
    colors: [{ name: 'Black speckle', swatch: '#141619' }], sizes: SIZES(['S']),
  },
  {
    id: 1003, handle: 'embossed-gothic-tracksuit-stone', title: 'Gothic-arch tracksuit, stone', product_type: 'Tracksuits',
    tags: ['tracksuit'], created_at: '2026-10-08T10:00:00Z', best_selling_rank: 2, price: 28000,
    colors: [{ name: 'Stone', swatch: '#cfc6b4' }], sizes: SIZES(['XL']),
  },
  {
    id: 1004, handle: 'embossed-gothic-hoodie', title: 'Gothic hoodie', product_type: 'Hoodies',
    tags: ['hoodie'], created_at: '2026-10-26T10:00:00Z', best_selling_rank: 4, price: 17000,
    colors: [
      { name: 'Washed charcoal', swatch: '#3a3c40', view: 'back-charcoal' },
      { name: 'Washed grey', swatch: '#8b9096', view: 'back-grey' },
    ],
    sizes: ['S', 'M', 'L'].map((s) => ({ size: s, inventory: 6 })),
    soldOutCombos: [['L', 'Washed grey']],
  },
  {
    id: 1005, handle: 'heavyweight-zip-hoodie-black', title: 'Zip hoodie, black', product_type: 'Hoodies',
    tags: ['hoodie', 'zip-up'], created_at: '2026-09-30T10:00:00Z', best_selling_rank: 5, price: 16000,
    colors: [{ name: 'Black', swatch: '#000000' }], sizes: SIZES(['S']),
  },
  {
    id: 1006, handle: 'wide-sweatpants-black', title: 'Wide sweatpants, black', product_type: 'Bottoms',
    tags: ['sweatpants'], created_at: '2026-09-24T10:00:00Z', best_selling_rank: 6, price: 12000,
    colors: [{ name: 'Black', swatch: '#000000' }], sizes: SIZES(['XL']),
  },
];

function imageRefFromFiles(files, alt) {
  const webp = files.filter((f) => f.format === 'webp').sort((a, b) => a.width - b.width);
  const pick = webp.length ? webp : files.slice().sort((a, b) => a.width - b.width);
  const largest = pick[pick.length - 1];
  const base = largest.file.replace(/^media\/processed\//, '').replace(/-\d+\.(webp|jpg|png)$/, '');
  return {
    base, ext: largest.format === 'jpg' ? 'jpg' : largest.format, widths: pick.map((f) => f.width),
    width: largest.width, height: largest.height, alt,
  };
}

let mediaId = 3001;
let variantId = 2001;
let valueId = 5001;
const products = PRODUCTS.map((def) => {
  const entries = manifest.fixtures.filter((f) => f.handle === def.handle);
  const views = [...new Set(entries.map((f) => f.view))].sort((a, b) => {
    const ia = VIEW_ORDER.indexOf(a); const ib = VIEW_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const media = views.map((view, i) => ({
    id: mediaId++, media_type: 'image', position: i + 1,
    alt: `${def.title}, ${VIEW_ALTS[view] || view.replace(/-/g, ' ')}`,
    view,
    image: imageRefFromFiles(entries.filter((f) => f.view === view), `${def.title}, ${VIEW_ALTS[view] || view}`),
  }));
  const sizeValues = def.sizes.map((s) => ({ id: valueId++, name: s.size }));
  const colorValues = def.colors.map((c) => ({ id: valueId++, name: c.name, swatch: { color: c.swatch } }));
  const variants = [];
  for (const c of def.colors) {
    const colorMedia = c.view ? media.find((m) => m.view === c.view) : media[0];
    for (const s of def.sizes) {
      const comboSoldOut = (def.soldOutCombos || []).some(([sz, cl]) => sz === s.size && cl === c.name);
      const inventory = comboSoldOut ? 0 : s.inventory;
      variants.push({
        id: variantId++, options: [s.size, c.name], price: def.price, compare_at_price: null, sku: null,
        available: inventory > 0, inventory_management: 'shopify', inventory_policy: 'deny',
        inventory_quantity: inventory, quantity_rule: { min: 1, max: null, increment: 1 },
        featured_media_id: colorMedia ? colorMedia.id : null,
      });
    }
  }
  for (const m of media) delete m.view;
  return {
    id: def.id, handle: def.handle, title: def.title, product_type: def.product_type, vendor: 'STEADFAST',
    description_html: DESCRIPTION, tags: def.tags, created_at: def.created_at, published_at: def.created_at,
    best_selling_rank: def.best_selling_rank,
    options: [{ name: 'Size', values: sizeValues }, { name: 'Color', values: colorValues }],
    variants, media,
    placeholder: true, placeholder_fields: ['price', 'variants', 'inventory', 'description', 'created_at', 'sku'],
  };
});

const missing = PRODUCTS.filter((p) => !products.find((x) => x.handle === p.handle)?.media.length).map((p) => p.handle);
if (missing.length) console.warn('[build-fixtures] no manifest media yet for:', missing.join(', '));

function stillRef(base, alt) {
  const files = manifest.theme_assets.filter((a) => a.base === base).map((a) => ({
    file: a.path, width: a.width, height: a.height, format: a.file.split('.').pop(),
  }));
  return files.length ? imageRefFromFiles(files, alt) : null;
}

// A product fixture view as a collection image (4:5, from MEDIA's manifest fixtures, largest WebP + widths).
function fixtureRef(handle, view, alt) {
  const files = manifest.fixtures.filter((f) => f.handle === handle && f.view === view);
  return files.length ? imageRefFromFiles(files, alt) : null;
}

// A MEDIA still that is not a theme asset (manifest stills.files), e.g. a collection-only image.
function processedRef(base, alt) {
  const files = ((manifest.stills || {}).files || []).filter((r) => r.base === base).map((r) => ({
    file: r.path, width: r.width, height: r.height, format: r.format === 'jpeg' ? 'jpg' : r.format,
  }));
  return files.length ? imageRefFromFiles(files, alt) : null;
}

// Review r2 item 1: the Hoodies collection image (collection banner, and the category grid / mega-menu tile when
// their own image is blank) is the retouched night back view of the embossed gothic hoodie (the back-grey plate,
// MEDIA's stills/sf-collection-hoodies at 540/900/1080). It is a hoodie, it is no product card's lead image
// (the gothic hoodie's cards lead with back-charcoal) and it is not the blue-grey zip hoodie, which the homepage
// keeps for the featured rail and the signature showcase only.
const collections = [
  { id: 4001, handle: 'hoodies', title: 'Hoodies', products: [1001, 1004, 1005], image: processedRef('sf-collection-hoodies', 'Hoodies') },
  { id: 4002, handle: 'tracksuits', title: 'Tracksuits', products: [1002, 1003], image: stillRef('sf-category-tracksuits', 'Tracksuits') },
  { id: 4003, handle: 'tops', title: 'Tops', products: [], image: null },
  { id: 4004, handle: 'bottoms', title: 'Bottoms', products: [1006], image: stillRef('sf-category-bottoms', 'Bottoms') },
  { id: 4005, handle: 'new-arrivals', title: 'New arrivals', products: [1001, 1004, 1002], image: stillRef('sf-category-new-arrivals', 'New arrivals') },
  { id: 4006, handle: 'zip-ups', title: 'Zip-ups', products: [1001, 1005], image: null },
].map((c) => ({
  id: c.id, handle: c.handle, title: c.title, description_html: '',
  image: c.image, product_handles: c.products.map((id) => products.find((p) => p.id === id).handle),
  default_sort_by: 'manual', placeholder: true,
}));

const write = (name, data) => {
  fs.writeFileSync(path.join(fixturesDir, name), JSON.stringify(data, null, 2) + '\n');
  console.log('[build-fixtures] wrote', name);
};
write('products.json', { placeholder: true, _note: NOTE, products });
write('collections.json', { placeholder: true, _note: NOTE, collections });
