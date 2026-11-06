// Collection/search filtering, sorting, search matching and pagination helpers (ARCHITECTURE §8.5).

export const handleize = (s) => String(s ?? '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const COLLECTION_SORT_OPTIONS = [
  { value: 'manual', name: 'Featured' },
  { value: 'best-selling', name: 'Best selling' },
  { value: 'title-ascending', name: 'Alphabetically, A-Z' },
  { value: 'title-descending', name: 'Alphabetically, Z-A' },
  { value: 'price-ascending', name: 'Price, low to high' },
  { value: 'price-descending', name: 'Price, high to low' },
  { value: 'created-ascending', name: 'Date, old to new' },
  { value: 'created-descending', name: 'Date, new to old' },
];
export const SEARCH_SORT_OPTIONS = [
  { value: 'relevance', name: 'Relevance' },
  { value: 'price-ascending', name: 'Price, low to high' },
  { value: 'price-descending', name: 'Price, high to low' },
];

const priceMin = (p) => Math.min(...p.variants.map((v) => v.price));
const byTitle = (a, b) => a.title.localeCompare(b.title);

export function sortProducts(list, sortBy, manualOrder) {
  const idx = (p) => (manualOrder ? manualOrder.indexOf(p.handle) : 0);
  const arr = list.slice();
  switch (sortBy) {
    case 'best-selling': return arr.sort((a, b) => (a.best_selling_rank ?? 1e9) - (b.best_selling_rank ?? 1e9) || idx(a) - idx(b));
    case 'title-ascending': return arr.sort(byTitle);
    case 'title-descending': return arr.sort((a, b) => byTitle(b, a));
    case 'price-ascending': return arr.sort((a, b) => priceMin(a) - priceMin(b) || byTitle(a, b));
    case 'price-descending': return arr.sort((a, b) => priceMin(b) - priceMin(a) || byTitle(a, b));
    case 'created-ascending': return arr.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    case 'created-descending': return arr.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    case 'manual': default: return manualOrder ? arr.sort((a, b) => idx(a) - idx(b)) : arr;
  }
}

/** Read active filters from URLSearchParams. */
export function parseActiveFilters(params) {
  const active = { availability: new Set(), price: { gte: null, lte: null }, options: {}, productType: new Set() };
  for (const [k, v] of params) {
    if (v === '') continue;
    if (k === 'filter.v.availability') active.availability.add(v);
    else if (k === 'filter.v.price.gte') { const n = parseFloat(v); if (!Number.isNaN(n)) active.price.gte = Math.round(n * 100); }
    else if (k === 'filter.v.price.lte') { const n = parseFloat(v); if (!Number.isNaN(n)) active.price.lte = Math.round(n * 100); }
    else if (k.startsWith('filter.v.option.')) {
      const h = k.slice('filter.v.option.'.length);
      (active.options[h] ||= new Set()).add(v);
    } else if (k === 'filter.p.product_type') active.productType.add(v);
  }
  return active;
}

function cloneActive(a) {
  return {
    availability: new Set(a.availability), price: { ...a.price },
    options: Object.fromEntries(Object.entries(a.options).map(([k, s]) => [k, new Set(s)])),
    productType: new Set(a.productType),
  };
}

export function productMatches(p, active) {
  if (active.productType.size && !active.productType.has(p.product_type)) return false;
  const optionNames = p.options.map((o) => handleize(o.name));
  // variant-level filters must hold for the same variant
  return p.variants.some((v) => {
    if (active.availability.size && !active.availability.has(v.available ? '1' : '0')) return false;
    if (active.price.gte != null && v.price < active.price.gte) return false;
    if (active.price.lte != null && v.price > active.price.lte) return false;
    for (const [h, set] of Object.entries(active.options)) {
      if (!set.size) continue;
      const i = optionNames.indexOf(h);
      if (i < 0) return false;
      if (!set.has(v.options[i])) return false;
    }
    return true;
  });
}

export function applyFilters(list, active) {
  return list.filter((p) => productMatches(p, active));
}

/** Build URL search string from params minus page, with an edit fn. */
function urlWith(basePath, params, edit) {
  const p = new URLSearchParams();
  for (const [k, v] of params) { if (k !== 'page' && k !== 'section_id' && k !== 'sections') p.append(k, v); }
  edit(p);
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}
const removePair = (p, key, value) => {
  const all = p.getAll(key).filter((x) => x !== value);
  p.delete(key);
  for (const x of all) p.append(key, x);
};

/**
 * Generate Shopify-like filter objects for a base product set.
 * Returns plain objects; drops.mjs wraps them.
 */
export function buildFilters(baseList, params, basePath) {
  const active = parseActiveFilters(params);
  const countWith = (mutate) => {
    const a = cloneActive(active);
    mutate(a);
    return baseList.filter((p) => productMatches(p, a)).length;
  };
  const filters = [];
  const listValue = (paramName, value, label, isActive, count, extra = {}) => ({
    value, label, param_name: paramName, active: isActive, count,
    url_to_add: urlWith(basePath, params, (p) => { if (!p.getAll(paramName).includes(value)) p.append(paramName, value); }),
    url_to_remove: urlWith(basePath, params, (p) => removePair(p, paramName, value)),
    swatch: null, image: null, ...extra,
  });
  const removeAll = (...names) => urlWith(basePath, params, (p) => { for (const n of names) p.delete(n); });

  // 1. availability
  {
    const pn = 'filter.v.availability';
    const values = [['1', 'In stock'], ['0', 'Out of stock']].map(([val, label]) => listValue(pn, val, label,
      active.availability.has(val), countWith((a) => a.availability.add(val))));
    filters.push({
      type: 'boolean', label: 'Availability', param_name: pn, operator: 'OR', presentation: 'text', values,
      true_value: values[0], false_value: values[1], url_to_remove: removeAll(pn),
    });
  }
  // 2. price range
  {
    const prices = baseList.flatMap((p) => p.variants.map((v) => v.price));
    const max = prices.length ? Math.max(...prices) : 0;
    filters.push({
      type: 'price_range', label: 'Price', param_name: 'filter.v.price', operator: 'OR', presentation: null,
      min_value: { param_name: 'filter.v.price.gte', value: active.price.gte },
      max_value: { param_name: 'filter.v.price.lte', value: active.price.lte },
      range_max: max, values: [],
      url_to_remove: removeAll('filter.v.price.gte', 'filter.v.price.lte'),
      active_price: active.price.gte != null || active.price.lte != null,
    });
  }
  // 3. one list filter per option name
  const optionOrder = [];
  const optionValues = new Map();
  for (const p of baseList) {
    for (const o of p.options) {
      if (o.name === 'Title' && o.values.length === 1 && o.values[0].name === 'Default Title') continue;
      if (!optionValues.has(o.name)) { optionOrder.push(o.name); optionValues.set(o.name, []); }
      const arr = optionValues.get(o.name);
      for (const v of o.values) if (!arr.find((x) => x.name === v.name)) arr.push(v);
    }
  }
  for (const name of optionOrder) {
    const h = handleize(name);
    const pn = `filter.v.option.${h}`;
    const isColor = ['color', 'colour', 'colorway', 'colourway'].includes(name.toLowerCase());
    const vals = optionValues.get(name);
    const hasSwatch = isColor && vals.some((v) => v.swatch?.color);
    const values = vals.map((v) => listValue(pn, v.name, v.name, !!active.options[h]?.has(v.name),
      countWith((a) => (a.options[h] ||= new Set()).add(v.name)),
      { swatch: v.swatch?.color ? { color: v.swatch.color, image: null } : null }));
    filters.push({
      type: 'list', label: name, param_name: pn, operator: 'OR', presentation: hasSwatch ? 'swatch' : 'text', values,
      url_to_remove: removeAll(pn),
    });
  }
  // 4. product type
  {
    const pn = 'filter.p.product_type';
    const types = [...new Set(baseList.map((p) => p.product_type).filter(Boolean))];
    const values = types.map((t) => listValue(pn, t, t, active.productType.has(t), countWith((a) => a.productType.add(t))));
    filters.push({ type: 'list', label: 'Product type', param_name: pn, operator: 'OR', presentation: 'text', values, url_to_remove: removeAll(pn) });
  }
  for (const f of filters) {
    f.active_values = f.values.filter((v) => v.active);
    f.inactive_values = f.values.filter((v) => !v.active);
  }
  return filters;
}

// ---- search ---------------------------------------------------------------
const words = (s) => String(s ?? '').toLowerCase().replace(/<[^>]+>/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
export const tokenize = (q) => words(q);

function tokenMatches(token, fieldWords, prefix) {
  return fieldWords.some((w) => w === token || w === `${token}s` || `${w}s` === token || (token.length > 3 && w === `${token}es`)
    || (prefix && w.startsWith(token)));
}

export function textMatches(q, fields, prefixLast) {
  const toks = tokenize(q);
  if (!toks.length) return false;
  const fw = fields.flatMap(words);
  return toks.every((t, i) => tokenMatches(t, fw, prefixLast && i === toks.length - 1));
}

export const productSearchFields = (p) => [p.title, p.product_type, (p.tags || []).join(' '), p.vendor];

// ---- pagination -------------------------------------------------------------
export function paginateInfo(total, pageSize, currentPage, basePath, params) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, currentPage), Math.max(pages, 1));
  const url = (n) => {
    const p = new URLSearchParams();
    for (const [k, v] of params) if (k !== 'page' && k !== 'section_id' && k !== 'sections') p.append(k, v);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const parts = [];
  if (pages > 1) {
    const show = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages));
    let prev = 0;
    for (let n = 1; n <= pages; n++) {
      if (!show.has(n)) continue;
      if (prev && n - prev > 1) parts.push({ title: '…', url: '', is_link: false });
      parts.push(n === current ? { title: String(n), url: '', is_link: false } : { title: String(n), url: url(n), is_link: true });
      prev = n;
    }
  }
  return {
    current_page: current, current_offset: (current - 1) * pageSize, items: total, pages, page_size: pageSize,
    previous: current > 1 ? { title: '« Previous', url: url(current - 1), is_link: true } : null,
    next: current < pages ? { title: 'Next »', url: url(current + 1), is_link: true } : null,
    parts,
  };
}
