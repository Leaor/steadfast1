// Reads the preview fixtures (dev/preview/fixtures/*.json) so expectations are computed, never hard-coded
// (ARCHITECTURE §9). Also implements the §8.5 filter / sort / search semantics as a reference model.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..', '..');
export const FIXTURES_DIR = process.env.SF_FIXTURES || path.join(ROOT, 'dev', 'preview', 'fixtures');
export const THEME_DIR = path.join(ROOT, 'theme');

const cache = new Map();
function load(name, key) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(FIXTURES_DIR, name);
  if (!existsSync(file)) throw new Error(`Fixture missing: ${file} (HARNESS-SERVER has not written it yet)`);
  let data = JSON.parse(readFileSync(file, 'utf8'));
  // Fixture files are either a bare array or an object carrying "placeholder" + the array under a key.
  if (key && !Array.isArray(data)) data = data[key] ?? data.items ?? data.data ?? data;
  cache.set(name, data);
  return data;
}
export const fixturesReady = () => ['shop.json', 'products.json', 'collections.json', 'menus.json'].every((f) => existsSync(path.join(FIXTURES_DIR, f)));

export const shop = () => load('shop.json');
export const products = () => load('products.json', 'products');
export const collections = () => load('collections.json', 'collections');
export const menus = () => load('menus.json', 'menus');
export const pages = () => { try { return load('pages.json', 'pages'); } catch { return []; } };
export const blogs = () => { try { return load('blogs.json', 'blogs'); } catch { return []; } };
export const customer = () => { try { return load('customer.json', 'customer'); } catch { return null; } };
export const giftCard = () => { try { return load('gift_card.json', 'gift_card'); } catch { return null; } };

export const product = (handle) => {
  const p = products().find((x) => x.handle === handle);
  if (!p) throw new Error(`No fixture product ${handle}`);
  return p;
};

// ---------- menus ----------
export function menu(handle) {
  const m = menus();
  if (Array.isArray(m)) return m.find((x) => x.handle === handle);
  return m[handle] ? { handle, ...(Array.isArray(m[handle]) ? { links: m[handle] } : m[handle]) } : undefined;
}
export const menuLinks = (handle) => (menu(handle)?.links || menu(handle)?.items || []);

// ---------- options / variants ----------
export const optName = (o) => (typeof o === 'string' ? o : o.name);
export const valueName = (v) => (typeof v === 'string' ? v : v.name);
export const optionValues = (o) => (o.values || []).map(valueName);
const COLOR_NAMES = ['color', 'colour', 'colorway', 'colourway'];
export const isColorOption = (o) => COLOR_NAMES.includes(optName(o).toLowerCase());
export const colorOption = (p) => (p.options || []).find(isColorOption);
export const sizeOption = (p) => (p.options || []).find((o) => optName(o).toLowerCase() === 'size');
export const varyingOptions = (p) => (p.options || []).filter((o) => (o.values || []).length > 1);
export const hasOnlyDefaultVariant = (p) => p.variants.length === 1 && (!(p.options || []).length || optionValues(p.options[0])[0] === 'Default Title');
export const variantOptions = (v) => v.options || [v.option1, v.option2, v.option3].filter((x) => x != null);
export const availableVariants = (p) => p.variants.filter((v) => v.available !== false);
export const soldOutVariants = (p) => p.variants.filter((v) => v.available === false);
export const isAvailable = (p) => availableVariants(p).length > 0;
export const firstAvailable = (p) => availableVariants(p)[0] || p.variants[0];
export const priceMin = (p) => Math.min(...p.variants.map((v) => v.price));
export const priceMax = (p) => Math.max(...p.variants.map((v) => v.price));
export const productType = (p) => p.product_type ?? p.type ?? '';
export const handleize = (s) => String(s).toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A product exercising the inline size cells: exactly one varying option, ≤ 8 variants (§4.6). */
export const sizeCellProduct = () => products().find((p) => p.handle === 'zip-hoodie-washed-blue-grey' && varyingOptions(p).length === 1 && p.variants.length <= 8)
  || products().find((p) => isAvailable(p) && varyingOptions(p).length === 1 && p.variants.length <= 8);
/** A product with more than one varying option (card add → quick view with intent 'add'). */
export const multiOptionProduct = () => products().find((p) => p.handle === 'embossed-gothic-hoodie' && varyingOptions(p).length > 1 && isAvailable(p))
  || products().find((p) => isAvailable(p) && (varyingOptions(p).length > 1 || p.variants.length > 8));
export const colorwayProduct = () => products().find((p) => colorOption(p) && optionValues(colorOption(p)).length > 1);

/** §4.7 availability of an option value given the current selection. */
export function valueAvailable(p, optionIndex, value, selected) {
  return availableVariants(p).some((v) => {
    const o = variantOptions(v);
    if (o[optionIndex] !== value) return false;
    return selected.every((sel, i) => i === optionIndex || sel == null || o[i] === sel);
  });
}

// ---------- money ----------
export function formatMoney(cents, format = shop().money_format || '${{amount}}') {
  const n = Number(cents) / 100;
  const withComma = (fixed, sep = ',', dec = '.') => {
    const [i, d] = fixed.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? dec + d : '');
  };
  return format
    .replace(/\{\{\s*amount_no_decimals\s*\}\}/, withComma(n.toFixed(0)))
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, withComma(n.toFixed(2), '.', ','))
    .replace(/\{\{\s*amount\s*\}\}/, withComma(n.toFixed(2)));
}

// ---------- collections ----------
export function collection(handle) {
  if (handle === 'all') return { handle: 'all', title: 'Products', product_handles: allProductsSorted('created-descending').map((p) => p.handle), default_sort_by: 'created-descending' };
  return collections().find((c) => c.handle === handle);
}
export function collectionProducts(handle) {
  const c = collection(handle);
  if (!c) return [];
  const hs = c.product_handles || c.products || [];
  return hs.map((h) => products().find((p) => p.handle === (typeof h === 'string' ? h : h.handle))).filter(Boolean);
}
function allProductsSorted(sortBy) { return sortProducts(products(), sortBy); }

export function sortProducts(list, sortBy) {
  const arr = list.slice();
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const ts = (p) => new Date(p.created_at || 0).getTime();
  switch (sortBy) {
    case 'title-ascending': return arr.sort(byTitle);
    case 'title-descending': return arr.sort((a, b) => byTitle(b, a));
    case 'price-ascending': return arr.sort((a, b) => priceMin(a) - priceMin(b) || byTitle(a, b));
    case 'price-descending': return arr.sort((a, b) => priceMin(b) - priceMin(a) || byTitle(a, b));
    case 'created-ascending': return arr.sort((a, b) => ts(a) - ts(b));
    case 'created-descending': return arr.sort((a, b) => ts(b) - ts(a));
    case 'best-selling': return arr.sort((a, b) => (a.best_selling_rank ?? 1e9) - (b.best_selling_rank ?? 1e9));
    default: return arr;
  }
}

/**
 * §8.5 semantics. f = { options: { [optionName]: [values] }, availability: ['1'|'0'], gte, lte (major units), types: [..] }.
 * Values of one filter are OR'd, filters are AND'd, variant-level filters must hold for the same variant.
 */
export function applyFilters(list, f = {}) {
  return list.filter((p) => {
    if (f.types?.length && !f.types.includes(productType(p))) return false;
    return p.variants.some((v) => {
      const vo = variantOptions(v);
      for (const [name, vals] of Object.entries(f.options || {})) {
        if (!vals.length) continue;
        const idx = (p.options || []).findIndex((o) => handleize(optName(o)) === handleize(name));
        if (idx < 0 || !vals.includes(vo[idx])) return false;
      }
      if (f.availability?.length) {
        const a = v.available !== false ? '1' : '0';
        if (!f.availability.includes(a)) return false;
      }
      if (f.gte != null && v.price < f.gte * 100) return false;
      if (f.lte != null && v.price > f.lte * 100) return false;
      return true;
    });
  });
}

/** Option values present in a product list, in fixture order, for the option whose handle is `name`. */
export function optionValuesIn(list, name) {
  const out = [];
  for (const p of list) {
    const o = (p.options || []).find((x) => handleize(optName(x)) === handleize(name));
    if (o) for (const v of optionValues(o)) if (!out.includes(v)) out.push(v);
  }
  return out;
}

// ---------- search ----------
export function searchProducts(q, { prefix = 'last' } = {}) {
  const tokens = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return products().filter((p) => {
    const hay = [p.title, productType(p), ...(p.tags || []), p.vendor || ''].join(' ').toLowerCase();
    const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.every((t, i) => {
      const isLast = i === tokens.length - 1;
      if (prefix === 'last' && isLast) return words.some((w) => w.startsWith(t)) || hay.includes(t);
      return hay.includes(t);
    });
  });
}

// ---------- media ----------
export const productImages = (p) => (p.media || []).filter((m) => (m.media_type || 'image') === 'image' && m.image);
export const mediaBase = (m) => path.posix.basename(m.image?.base || m.preview_image?.base || '');
