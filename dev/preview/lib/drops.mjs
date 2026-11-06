// Shopify-like Liquid drops built from fixtures, one Store per request.
// Every drop keeps at least one own enumerable property so liquidjs `blank`/`empty`
// checks (Object.keys length) treat a present object as non-blank, like Shopify.
import { Drop } from 'liquidjs';
import {
  handleize, sortProducts, applyFilters, parseActiveFilters, buildFilters, COLLECTION_SORT_OPTIONS,
  SEARCH_SORT_OPTIONS, textMatches, productSearchFields, tokenize,
} from './catalog.mjs';

export const MEDIA_ROOT = '/cdn/preview-media';
const POLICY_BODY = '<p>Policy to be published by the store owner.</p>';

// ---------------------------------------------------------------------------
// images
export function pickWidth(ref, width) {
  const widths = (ref.widths && ref.widths.length ? ref.widths : [ref.width]).slice().sort((a, b) => a - b);
  if (!width) return widths[widths.length - 1];
  return widths.find((w) => w >= width) ?? widths[widths.length - 1];
}
export function imageFileUrl(ref, { width, height, crop } = {}) {
  if (ref.url) return ref.url; // absolute (external) image
  const w = pickWidth(ref, width);
  const q = [];
  if (width) q.push(`width=${width}`);
  if (height) q.push(`height=${height}`);
  if (crop) q.push(`crop=${crop}`);
  return `${MEDIA_ROOT}/${ref.base}-${w}.${ref.ext || 'webp'}${q.length ? `?${q.join('&')}` : ''}`;
}

export class ImageDrop extends Drop {
  constructor(ref, store) {
    super();
    this.__type = 'image';
    this._ref = ref;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._ref.id ?? null; }
  get src() { return imageFileUrl(this._ref); }
  get url() { return this.src; }
  get width() { return this._ref.width; }
  get height() { return this._ref.height; }
  get alt() { return this._ref.alt ?? ''; }
  get aspect_ratio() { return +(this._ref.width / this._ref.height).toFixed(4); }
  get presentation() { return { focal_point: '50.0% 50.0%' }; }
  get media_type() { return 'image'; }
  get attached_to_variant() { return false; }
  valueOf() { return this.src; }
  toString() { return this.src; }
  toShopifyJSON() { return { id: this.id, src: this.src, url: this.src, width: this.width, height: this.height, alt: this.alt, aspect_ratio: this.aspect_ratio }; }
}

export class MediaDrop extends Drop {
  constructor(m, store) {
    super();
    this.__type = 'media';
    this._m = m;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    this._img = m.image ? new ImageDrop({ ...m.image, alt: m.alt ?? m.image.alt, id: m.image.id }, store) : null;
  }
  get id() { return this._m.id; }
  get media_type() { return this._m.media_type || 'image'; }
  get alt() { return this._m.alt ?? ''; }
  get position() { return this._m.position; }
  get preview_image() { return this._img; }
  get image() { return this._img; }
  get width() { return this._img?.width; }
  get height() { return this._img?.height; }
  get aspect_ratio() { return this._img?.aspect_ratio; }
  get src() { return this._img?.src; }
  get sources() { return this._m.sources || []; }
  get duration() { return this._m.duration ?? null; }
  get host() { return this._m.host ?? null; }
  get external_id() { return this._m.external_id ?? null; }
  get presentation() { return { focal_point: '50.0% 50.0%' }; }
  toString() { return this.src || ''; }
  toShopifyJSON() {
    return {
      id: this.id, alt: this.alt, position: this.position, media_type: this.media_type, aspect_ratio: this.aspect_ratio,
      height: this.height, width: this.width, src: this.src,
      preview_image: this._img ? { aspect_ratio: this.aspect_ratio, height: this.height, width: this.width, src: this.src } : null,
    };
  }
}

// ---------------------------------------------------------------------------
// products
export class ProductDrop extends Drop {
  constructor(p, store) {
    super();
    this.__type = 'product';
    this._p = p;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._p.id; }
  get title() { return this._p.title; }
  get handle() { return this._p.handle; }
  get url() { return `/products/${this._p.handle}`; }
  get vendor() { return this._p.vendor; }
  get type() { return this._p.product_type; }
  get description() { return this._p.description_html || ''; }
  get content() { return this.description; }
  get tags() { return this._p.tags || []; }
  get template_suffix() { return this._p.template_suffix ?? null; }
  get created_at() { return this._p.created_at; }
  get published_at() { return this._p.published_at; }
  get object_type() { return 'product'; }
  get 'gift_card?'() { return false; }
  get requires_selling_plan() { return false; }
  get selling_plan_groups() { return []; }
  get 'quantity_price_breaks_configured?'() { return false; }
  get metafields() { return {}; }
  get media() {
    return (this._media ||= (this._p.media || []).slice().sort((a, b) => a.position - b.position).map((m) => new MediaDrop(m, this._store)));
  }
  get images() { return this.media.filter((m) => m.preview_image).map((m) => m.preview_image); }
  get featured_media() { return this.media[0] || null; }
  get featured_image() { return this.featured_media?.preview_image || null; }
  get variants() { return (this._variants ||= this._p.variants.map((v) => this._store.variant(v, this._p))); }
  get options() { return this._p.options.map((o) => o.name); }
  get options_with_values() {
    return (this._owv ||= this._p.options.map((o, i) => new ProductOptionDrop(this, o, i)));
  }
  get options_by_name() {
    const out = {};
    for (const o of this.options_with_values) out[o.name.toLowerCase()] = o;
    return out;
  }
  get has_only_default_variant() {
    const o = this._p.options;
    return o.length === 1 && o[0].values.length === 1 && o[0].values[0].name === 'Default Title';
  }
  get price() { return this.price_min; }
  get price_min() { return Math.min(...this._p.variants.map((v) => v.price)); }
  get price_max() { return Math.max(...this._p.variants.map((v) => v.price)); }
  get price_varies() { return this.price_min !== this.price_max; }
  get compare_at_price() { return this.compare_at_price_min; }
  get compare_at_price_min() {
    const c = this._p.variants.map((v) => v.compare_at_price).filter((x) => x != null);
    return c.length ? Math.min(...c) : null;
  }
  get compare_at_price_max() {
    const c = this._p.variants.map((v) => v.compare_at_price).filter((x) => x != null);
    return c.length ? Math.max(...c) : null;
  }
  get compare_at_price_varies() { return this.compare_at_price_min !== this.compare_at_price_max; }
  get available() { return this._p.variants.some((v) => v.available); }
  get first_available_variant() { return this.variants.find((v) => v.available) || null; }
  get selected_variant() {
    const id = this._store.selectedVariantId;
    return id ? this.variants.find((v) => v.id === id) || null : null;
  }
  get selected_or_first_available_variant() { return this.selected_variant || this.first_available_variant || this.variants[0] || null; }
  get collections() {
    return this._store.data.collections.filter((c) => c.product_handles.includes(this._p.handle)).map((c) => this._store.collection(c));
  }
  toShopifyJSON() {
    const p = this._p;
    return {
      id: p.id, title: p.title, handle: p.handle, description: this.description, published_at: p.published_at,
      created_at: p.created_at, vendor: p.vendor, type: p.product_type, tags: this.tags, price: this.price,
      price_min: this.price_min, price_max: this.price_max, available: this.available, price_varies: this.price_varies,
      compare_at_price: this.compare_at_price, compare_at_price_min: this.compare_at_price_min,
      compare_at_price_max: this.compare_at_price_max, compare_at_price_varies: this.compare_at_price_varies,
      variants: this.variants.map((v) => v.toShopifyJSON()), images: this.images.map((i) => i.src),
      featured_image: this.featured_image?.src ?? null, options: this.options_with_values.map((o) => ({ name: o.name, position: o.position, values: o.values.map(String) })),
      url: this.url, media: this.media.map((m) => m.toShopifyJSON()), requires_selling_plan: false, selling_plan_groups: [],
      content: this.description,
    };
  }
}

export class ProductOptionDrop extends Drop {
  constructor(product, o, i) {
    super();
    this.__type = 'product_option';
    this._o = o;
    this._i = i;
    Object.defineProperty(this, '_product', { value: product, enumerable: false });
  }
  get name() { return this._o.name; }
  get position() { return this._i + 1; }
  get values() { return (this._values ||= this._o.values.map((v) => new OptionValueDrop(this._product, this._i, v))); }
  get selected_value() { return this._product.selected_or_first_available_variant?.options[this._i] ?? null; }
  toString() { return this.name; }
}

export class OptionValueDrop extends Drop {
  constructor(product, index, v) {
    super();
    this.__type = 'product_option_value';
    this._v = v;
    this._index = index;
    Object.defineProperty(this, '_product', { value: product, enumerable: false });
  }
  get id() { return this._v.id; }
  get name() { return this._v.name; }
  get swatch() { return this._v.swatch?.color ? { color: this._v.swatch.color, image: null } : null; }
  _combo() {
    const sel = this._product.selected_or_first_available_variant;
    const opts = sel ? sel.options.slice() : [];
    opts[this._index] = this._v.name;
    return opts;
  }
  get selected() { return this._product.selected_or_first_available_variant?.options[this._index] === this._v.name; }
  get available() {
    const combo = this._combo();
    return this._product._p.variants.some((v) => v.available && v.options.every((o, i) => o === combo[i]));
  }
  get variant() {
    const combo = this._combo();
    const vs = this._product.variants;
    return vs.find((v) => v.options.every((o, i) => o === combo[i]))
      || vs.find((v) => v.available && v.options[this._index] === this._v.name)
      || vs.find((v) => v.options[this._index] === this._v.name) || null;
  }
  get product_url() { const v = this.variant; return v ? v.url : this._product.url; }
  get product() { return this._product; }
  valueOf() { return this._v.name; }
  toString() { return this._v.name; }
  toShopifyJSON() { return this._v.name; }
}

export class VariantDrop extends Drop {
  constructor(v, p, store) {
    super();
    this.__type = 'variant';
    this._v = v;
    Object.defineProperty(this, '_p', { value: p, enumerable: false });
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._v.id; }
  get product() { return this._store.product(this._p); }
  get options() { return this._v.options.slice(); }
  get option1() { return this._v.options[0] ?? null; }
  get option2() { return this._v.options[1] ?? null; }
  get option3() { return this._v.options[2] ?? null; }
  get title() { return this._v.options.join(' / '); }
  get name() { return `${this._p.title} - ${this.title}`; }
  get public_title() { return this.product.has_only_default_variant ? null : this.title; }
  get available() { return !!this._v.available; }
  get price() { return this._v.price; }
  get compare_at_price() { return this._v.compare_at_price ?? null; }
  get sku() { return this._v.sku ?? null; }
  get barcode() { return null; }
  get weight() { return 0; }
  get requires_shipping() { return true; }
  get taxable() { return true; }
  get inventory_management() { return this._v.inventory_management ?? null; }
  get inventory_policy() { return this._v.inventory_policy ?? 'deny'; }
  get inventory_quantity() { return this._v.inventory_quantity ?? 0; }
  get quantity_rule() { const q = this._v.quantity_rule || {}; return { min: q.min ?? 1, max: q.max ?? null, increment: q.increment ?? 1 }; }
  get requires_selling_plan() { return false; }
  get selling_plan_allocations() { return []; }
  get unit_price_measurement() { return null; }
  get url() { return `/products/${this._p.handle}?variant=${this._v.id}`; }
  get selected() { return this._store.selectedVariantId === this._v.id; }
  get featured_media() {
    if (!this._v.featured_media_id) return null;
    return this.product.media.find((m) => m.id === this._v.featured_media_id) || null;
  }
  get featured_image() { return this.featured_media?.preview_image || null; }
  get image() { return this.featured_image; }
  get matched() { return true; }
  get metafields() { return {}; }
  toShopifyJSON() {
    const fm = this.featured_media;
    return {
      id: this.id, title: this.title, option1: this.option1, option2: this.option2, option3: this.option3, sku: this.sku,
      requires_shipping: true, taxable: true, featured_image: fm ? { id: fm.preview_image.id, product_id: this._p.id, position: fm.position, alt: fm.alt, width: fm.width, height: fm.height, src: fm.src, variant_ids: [this.id] } : null,
      available: this.available, name: this.name, public_title: this.public_title, options: this.options, price: this.price,
      weight: 0, compare_at_price: this.compare_at_price, inventory_management: this.inventory_management, barcode: null,
      featured_media: fm ? { alt: fm.alt, id: fm.id, position: fm.position, preview_image: { aspect_ratio: fm.aspect_ratio, height: fm.height, width: fm.width, src: fm.src } } : null,
      requires_selling_plan: false, selling_plan_allocations: [], quantity_rule: this.quantity_rule,
    };
  }
}

// ---------------------------------------------------------------------------
// paginatable base
class PagedDrop extends Drop {
  constructor() { super(); Object.defineProperty(this, '_win', { value: {}, enumerable: false, writable: true }); }
  setPagination(prop, offset, limit) { this._win[prop] = { offset, limit }; }
  clearPagination(prop) { delete this._win[prop]; }
  _window(prop, arr, defaultLimit = 50) {
    const w = this._win[prop];
    if (w) return arr.slice(w.offset, w.offset + w.limit);
    return defaultLimit ? arr.slice(0, defaultLimit) : arr;
  }
}

export class CollectionDrop extends PagedDrop {
  constructor(c, store) {
    super();
    this.__type = 'collection';
    this._c = c;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._c.id; }
  get title() { return this._c.title; }
  get handle() { return this._c.handle; }
  get url() { return `/collections/${this._c.handle}`; }
  get description() { return this._c.description_html || ''; }
  get template_suffix() { return this._c.template_suffix ?? null; }
  get object_type() { return 'collection'; }
  get published_at() { return '2026-09-01T00:00:00Z'; }
  get metafields() { return {}; }
  get image() { return this._c.image ? new ImageDrop(this._c.image, this._store) : null; }
  get featured_image() { return this.image || this._baseList()[0] && this._store.product(this._baseList()[0]).featured_image || null; }
  get all_tags() { return [...new Set(this._baseList().flatMap((p) => p.tags || []))]; }
  get tags() { return this.all_tags; }
  get all_types() { return [...new Set(this._baseList().map((p) => p.product_type))]; }
  get all_vendors() { return [...new Set(this._baseList().map((p) => p.vendor))]; }
  get current_type() { return null; }
  get current_vendor() { return null; }
  _isCurrent() { return this._store.currentCollectionHandle === this._c.handle; }
  _baseList() {
    const d = this._store.data;
    if (this._c.handle === 'all' && this._c.synthetic) return d.products.slice();
    return this._c.product_handles.map((h) => d.productByHandle.get(h)).filter(Boolean);
  }
  get default_sort_by() { return this._c.default_sort_by || 'manual'; }
  get sort_by() {
    if (!this._isCurrent()) return this.default_sort_by;
    const s = this._store.query.get('sort_by');
    return COLLECTION_SORT_OPTIONS.some((o) => o.value === s) ? s : this.default_sort_by;
  }
  get sort_options() { return COLLECTION_SORT_OPTIONS.map((o) => ({ ...o })); }
  _filteredList() {
    if (this._cache) return this._cache;
    let list = this._baseList();
    if (this._isCurrent()) list = applyFilters(list, parseActiveFilters(this._store.query));
    const manual = this._c.product_handles || null;
    this._cache = sortProducts(list, this.sort_by, manual);
    return this._cache;
  }
  paginateSource(prop) { return prop === 'products' ? this._filteredList() : null; }
  get products() { return this._window('products', this._filteredList()).map((p) => this._store.product(p)); }
  get products_count() { return this._filteredList().length; }
  get all_products_count() { return this._baseList().length; }
  get filters() {
    if (!this._isCurrent()) return [];
    return (this._filters ||= buildFilters(this._baseList(), this._store.query, this._store.path).map((f) => new FilterDrop(f)));
  }
  get next_product() { return null; }
  get previous_product() { return null; }
}

export class FilterDrop extends Drop {
  constructor(f) {
    super();
    this.__type = 'filter';
    Object.assign(this, f);
    this.values = f.values.map((v) => new FilterValueDrop(v));
    this.active_values = this.values.filter((v) => v.active);
    this.inactive_values = this.values.filter((v) => !v.active);
    if (f.true_value) { this.true_value = this.values[0]; this.false_value = this.values[1]; }
  }
}
export class FilterValueDrop extends Drop {
  constructor(v) { super(); this.__type = 'filter_value'; Object.assign(this, v); }
  valueOf() { return this.value; }
  toString() { return this.value; }
}

// ---------------------------------------------------------------------------
// navigation
export class LinkDrop extends Drop {
  constructor(l, store, depth = 1) {
    super();
    this.__type = 'link';
    this._l = l;
    this._depth = depth;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get title() { return this._l.title; }
  get url() { return this._l.url; }
  get type() { return this._l.type || 'http_link'; }
  get handle() { return handleize(this._l.title); }
  get links() { return (this._links ||= (this._l.links || []).map((x) => new LinkDrop(x, this._store, this._depth + 1))); }
  get levels() { return this.links.length ? 1 + Math.max(0, ...this.links.map((l) => l.levels)) : 0; }
  get current() {
    const path = this._store.path;
    return this._l.url.split('#')[0].split('?')[0] === path && !this._l.url.includes('#');
  }
  get active() {
    const u = this._l.url.split('#')[0].split('?')[0];
    const path = this._store.path;
    if (this._l.url.includes('#')) return false;
    if (u === path) return true;
    if (u !== '/' && path.startsWith(`${u}/`)) return true;
    const m = /^\/collections\/([^/]+)$/.exec(u);
    if (m && this._store.currentProductHandle) {
      const c = this._store.data.collectionByHandle.get(m[1]);
      if (c && c.product_handles.includes(this._store.currentProductHandle)) return true;
    }
    return false;
  }
  get child_active() { return this.links.some((l) => l.active || l.child_active); }
  get child_current() { return this.links.some((l) => l.current || l.child_current); }
  get object() {
    const o = this._l.object;
    if (!o) return null;
    const [kind, h] = o.split(':');
    if (kind === 'collection') return this._store.collectionByHandle(h);
    if (kind === 'page') return this._store.pageByHandle(h);
    if (kind === 'product') return this._store.productByHandle(h);
    if (kind === 'blog') return this._store.blogByHandle(h);
    return null;
  }
}

export class LinklistDrop extends Drop {
  constructor(m, store) {
    super();
    this.__type = 'linklist';
    this._m = m;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get title() { return this._m.title; }
  get handle() { return this._m.handle; }
  get links() { return (this._links ||= (this._m.links || []).map((l) => new LinkDrop(l, this._store))); }
  get levels() { return this.links.length ? 1 + Math.max(0, ...this.links.map((l) => l.levels)) : 0; }
}

// ---------------------------------------------------------------------------
// content
export class PageDrop extends Drop {
  constructor(p, store) { super(); this.__type = 'page'; this._p = p; Object.defineProperty(this, '_store', { value: store, enumerable: false }); }
  get id() { return this._p.id; }
  get title() { return this._p.title; }
  get handle() { return this._p.handle; }
  get url() { return `/pages/${this._p.handle}`; }
  get content() { return this._p.content || ''; }
  get author() { return null; }
  get template_suffix() { return this._p.template_suffix ?? null; }
  get object_type() { return 'page'; }
  get published_at() { return '2026-09-01T00:00:00Z'; }
  get metafields() { return {}; }
}

export class ArticleDrop extends Drop {
  constructor(a, blog, store) {
    super(); this.__type = 'article'; this._a = a;
    Object.defineProperty(this, '_blog', { value: blog, enumerable: false });
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._a.id; }
  get title() { return this._a.title; }
  get handle() { return this._a.handle; }
  get url() { return `/blogs/${this._blog.handle}/${this._a.handle}`; }
  get content() { return this._a.content || ''; }
  get excerpt() { return this._a.excerpt || ''; }
  get excerpt_or_content() { return this._a.excerpt || this._a.content || ''; }
  get image() { return this._a.image ? new ImageDrop(this._a.image, this._store) : null; }
  get author() { return this._a.author || ''; }
  get published_at() { return this._a.published_at; }
  get created_at() { return this._a.published_at; }
  get tags() { return this._a.tags || []; }
  get comments() { return []; }
  get comments_count() { return 0; }
  get 'comments_enabled?'() { return !!this._blog.comments_enabled; }
  get comment_post_url() { return `${this.url}/comments`; }
  get blog() { return this._store.blog(this._blog); }
  get object_type() { return 'article'; }
  get metafields() { return {}; }
}

export class BlogDrop extends PagedDrop {
  constructor(b, store) { super(); this.__type = 'blog'; this._b = b; Object.defineProperty(this, '_store', { value: store, enumerable: false }); }
  get id() { return this._b.id; }
  get title() { return this._b.title; }
  get handle() { return this._b.handle; }
  get url() { return `/blogs/${this._b.handle}`; }
  _all() { return (this._b.articles || []).map((a) => this._store.article(a, this._b)); }
  paginateSource(prop) { return prop === 'articles' ? this._all() : null; }
  get articles() { return this._window('articles', this._all()); }
  get articles_count() { return (this._b.articles || []).length; }
  get 'comments_enabled?'() { return !!this._b.comments_enabled; }
  get all_tags() { return []; }
  get tags() { return []; }
  get template_suffix() { return null; }
}

// ---------------------------------------------------------------------------
// customer
export class AddressDrop extends Drop {
  constructor(a) { super(); this.__type = 'address'; Object.assign(this, { ...a }); }
  get name() { return [this.first_name, this.last_name].filter(Boolean).join(' '); }
  get street() { return [this.address1, this.address2].filter(Boolean).join(', '); }
  get url() { return `/account/addresses/${this.id}`; }
}

export class OrderDrop extends Drop {
  constructor(o, customer, store) {
    super(); this.__type = 'order'; this._o = o;
    Object.defineProperty(this, '_c', { value: customer, enumerable: false });
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
  }
  get id() { return this._o.id; }
  get name() { return this._o.name; }
  get order_number() { return parseInt(String(this._o.name).replace(/\D/g, ''), 10); }
  get created_at() { return this._o.created_at; }
  get financial_status() { return this._o.financial_status; }
  get financial_status_label() { return this._o.financial_status_label; }
  get fulfillment_status() { return this._o.fulfillment_status; }
  get fulfillment_status_label() { return this._o.fulfillment_status_label; }
  get cancelled() { return !!this._o.cancelled; }
  get cancelled_at() { return this._o.cancelled_at; }
  get cancel_reason() { return null; }
  get line_items() {
    return (this._lines ||= this._o.line_items.map((li) => {
      const hit = this._store.data.variantIndex.get(li.variant_id);
      return hit ? new LineItemDrop({ variant_id: li.variant_id, quantity: li.quantity, properties: {}, key: `${li.variant_id}:order` }, this._store) : null;
    }).filter(Boolean));
  }
  get subtotal_price() { return this.line_items.reduce((s, l) => s + l.final_line_price, 0); }
  get total_tax() { return this._o.total_tax || 0; }
  get shipping_price() { return this._o.shipping_price || 0; }
  get total_price() { return this.subtotal_price + this.total_tax + this.shipping_price; }
  get total_discounts() { return 0; }
  get discount_applications() { return []; }
  get tax_lines() { return []; }
  get shipping_methods() { return []; }
  _addr(id) { const a = this._c.addresses.find((x) => x.id === id); return a ? new AddressDrop(a) : null; }
  get shipping_address() { return this._addr(this._o.shipping_address_id); }
  get billing_address() { return this._addr(this._o.billing_address_id); }
  get customer_url() { return `/account/orders/${encodeURIComponent(this._o.name.replace('#', ''))}`; }
  get order_status_url() { return this.customer_url; }
  get email() { return this._c.email; }
  get item_count() { return this.line_items.reduce((s, l) => s + l.quantity, 0); }
}

export class CustomerDrop extends PagedDrop {
  constructor(c, store) { super(); this.__type = 'customer'; this._c = c; Object.defineProperty(this, '_store', { value: store, enumerable: false }); }
  get id() { return this._c.id; }
  get first_name() { return this._c.first_name; }
  get last_name() { return this._c.last_name; }
  get name() { return `${this._c.first_name} ${this._c.last_name}`.trim(); }
  get email() { return this._c.email; }
  get phone() { return null; }
  get has_account() { return true; }
  get accepts_marketing() { return false; }
  get tags() { return []; }
  _orders() { return (this._ordersAll ||= this._c.orders.map((o) => new OrderDrop(o, this._c, this._store))); }
  _addresses() { return (this._addrAll ||= this._c.addresses.map((a) => new AddressDrop(a))); }
  paginateSource(prop) { return prop === 'orders' ? this._orders() : prop === 'addresses' ? this._addresses() : null; }
  get orders() { return this._window('orders', this._orders()); }
  get orders_count() { return this._c.orders.length; }
  get total_spent() { return this._orders().reduce((s, o) => s + o.total_price, 0); }
  get addresses() { return this._window('addresses', this._addresses()); }
  get addresses_count() { return this._c.addresses.length; }
  get default_address() { return this._addresses()[0] || null; }
  get new_address() { return new AddressDrop({ id: null, first_name: '', last_name: '', company: '', address1: '', address2: '', city: '', province: '', province_code: '', country: '', country_code: '', zip: '', phone: '' }); }
}

// ---------------------------------------------------------------------------
// cart
export class LineItemDrop extends Drop {
  constructor(line, store) {
    super();
    this.__type = 'line_item';
    this._line = line;
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    const hit = store.data.variantIndex.get(line.variant_id);
    Object.defineProperty(this, '_hit', { value: hit, enumerable: false });
  }
  get key() { return this._line.key; }
  get id() { return this._line.variant_id; }
  get variant_id() { return this._line.variant_id; }
  get product_id() { return this._hit.product.id; }
  get variant() { return this._store.variant(this._hit.variant, this._hit.product); }
  get product() { return this._store.product(this._hit.product); }
  get quantity() { return this._line.quantity; }
  get title() { return this.product.has_only_default_variant ? this._hit.product.title : `${this._hit.product.title} - ${this.variant.title}`; }
  get product_title() { return this._hit.product.title; }
  get variant_title() { return this.product.has_only_default_variant ? null : this.variant.title; }
  get price() { return this._hit.variant.price; }
  get original_price() { return this.price; }
  get final_price() { return this.price; }
  get line_price() { return this.price * this.quantity; }
  get original_line_price() { return this.line_price; }
  get final_line_price() { return this.line_price; }
  get total_discount() { return 0; }
  get discounts() { return []; }
  get line_level_discount_allocations() { return []; }
  get line_level_total_discount() { return 0; }
  get properties() { return this._line.properties || {}; }
  get image() { return this.variant.featured_image || this.product.featured_image; }
  get url() { return this.variant.url; }
  get sku() { return this._hit.variant.sku ?? null; }
  get vendor() { return this._hit.product.vendor; }
  get options_with_values() {
    if (this.product.has_only_default_variant) return [];
    return this._hit.product.options.map((o, i) => ({ name: o.name, value: this._hit.variant.options[i] }));
  }
  get requires_shipping() { return true; }
  get gift_card() { return false; }
  get taxable() { return true; }
  get selling_plan_allocation() { return null; }
  get unit_price_measurement() { return null; }
  get message() { return ''; }
  get item_components() { return []; }
}

// ---------------------------------------------------------------------------
// global collections (`collections`, `pages`, `blogs`, `linklists`)
class HandleMapDrop extends Drop {
  constructor(kind, lookup, all) {
    super();
    this.__type = kind;
    Object.defineProperty(this, '_lookup', { value: lookup, enumerable: false });
    Object.defineProperty(this, '_all', { value: all, enumerable: false });
  }
  liquidMethodMissing(key) { return this._lookup(String(key)) ?? null; }
  get size() { return this._all().length; }
  valueOf() { return this._all(); }
}

export class Store {
  constructor(rq) {
    this.rq = rq;
    this.data = rq.data;
    this._products = new Map();
    this._variants = new Map();
    this._collections = new Map();
    this._pages = new Map();
    this._blogs = new Map();
    this._articles = new Map();
  }
  get query() { return this.rq.query; }
  get path() { return this.rq.path; }
  get selectedVariantId() { return this.rq.selectedVariantId; }
  get currentCollectionHandle() { return this.rq.currentCollectionHandle; }
  get currentProductHandle() { return this.rq.currentProductHandle; }

  product(p) { if (!p) return null; if (!this._products.has(p.id)) this._products.set(p.id, new ProductDrop(p, this)); return this._products.get(p.id); }
  productByHandle(h) { return this.product(this.data.productByHandle.get(String(h))); }
  variant(v, p) { if (!this._variants.has(v.id)) this._variants.set(v.id, new VariantDrop(v, p, this)); return this._variants.get(v.id); }
  allCollectionData() {
    return { id: 4000, handle: 'all', title: 'Products', description_html: '', image: null, synthetic: true,
      product_handles: this.data.products.map((p) => p.handle), default_sort_by: 'created-descending' };
  }
  collection(c) { if (!c) return null; if (!this._collections.has(c.handle)) this._collections.set(c.handle, new CollectionDrop(c, this)); return this._collections.get(c.handle); }
  collectionByHandle(h) {
    h = String(h);
    if (h === 'all' && !this.data.collectionByHandle.has('all')) return this.collection(this.allCollectionData());
    return this.collection(this.data.collectionByHandle.get(h));
  }
  pageByHandle(h) { const p = this.data.pages.find((x) => x.handle === String(h)); if (!p) return null; if (!this._pages.has(p.id)) this._pages.set(p.id, new PageDrop(p, this)); return this._pages.get(p.id); }
  blog(b) { if (!b) return null; if (!this._blogs.has(b.id)) this._blogs.set(b.id, new BlogDrop(b, this)); return this._blogs.get(b.id); }
  blogByHandle(h) { return this.blog(this.data.blogs.find((x) => x.handle === String(h))); }
  article(a, b) { if (!this._articles.has(a.id)) this._articles.set(a.id, new ArticleDrop(a, b, this)); return this._articles.get(a.id); }
  linklist(h) { const m = this.data.menus.find((x) => x.handle === String(h)); return m ? new LinklistDrop(m, this) : null; }

  collectionsDrop() {
    return new HandleMapDrop('collections', (h) => this.collectionByHandle(h), () => this.data.collections.map((c) => this.collection(c)));
  }
  pagesDrop() { return new HandleMapDrop('pages', (h) => this.pageByHandle(h), () => this.data.pages.map((p) => this.pageByHandle(p.handle))); }
  blogsDrop() { return new HandleMapDrop('blogs', (h) => this.blogByHandle(h), () => this.data.blogs.map((b) => this.blog(b))); }
  linklistsDrop() { return new HandleMapDrop('linklists', (h) => this.linklist(h), () => this.data.menus.map((m) => this.linklist(m.handle))); }
  allProductsDrop() { return new HandleMapDrop('all_products', (h) => this.productByHandle(h), () => this.data.products.map((p) => this.product(p))); }

  shop() {
    const s = this.data.shop;
    const policies = (s.policies || []).map((p) => ({ title: p.title, handle: p.handle, url: `/policies/${p.handle}`, body: POLICY_BODY, id: p.handle }));
    const by = (h) => policies.find((p) => p.handle === h) || null;
    const cur = this.rq.country.currency;
    return {
      __type: 'shop', name: s.name, url: this.rq.origin, secure_url: this.rq.origin, domain: s.domain, permanent_domain: s.domain,
      email: s.email, description: s.description ?? null, currency: s.currency, enabled_currencies: [cur],
      money_format: `${cur.symbol}{{amount}}`, money_with_currency_format: `${cur.symbol}{{amount}} ${cur.iso_code}`,
      customer_accounts_enabled: !!s.customer_accounts_enabled, customer_accounts_optional: !!s.customer_accounts_optional,
      password_message: s.password_message, policies, privacy_policy: by('privacy-policy'), refund_policy: by('refund-policy'),
      shipping_policy: by('shipping-policy'), terms_of_service: by('terms-of-service'), subscription_policy: null,
      brand: null, products_count: this.data.products.length, collections_count: this.data.collections.length,
      types: [...new Set(this.data.products.map((p) => p.product_type))], vendors: ['STEADFAST'],
      locale: 'en', metafields: {}, accepts_gift_cards: true,
    };
  }

  // search -------------------------------------------------------------------
  search() {
    const q = this.query.get('q');
    const type = (this.query.get('type') || 'product,page,article').split(',').map((s) => s.trim()).filter(Boolean);
    const prefix = this.query.get('options[prefix]') === 'last';
    return new SearchDrop(this, q, type, prefix);
  }
  predictiveSearch() { return new PredictiveSearchDrop(this); }
  recommendations() { return new RecommendationsDrop(this); }
}

export class SearchDrop extends PagedDrop {
  constructor(store, q, types, prefix) {
    super();
    this.__type = 'search';
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    this._q = q;
    this._types = types;
    this._prefix = prefix;
  }
  get performed() { return this._q != null && this._q.trim() !== ''; }
  get terms() { return this._q ?? ''; }
  get types() { return this._types; }
  get default_sort_by() { return 'relevance'; }
  get sort_by() { const s = this._store.query.get('sort_by'); return SEARCH_SORT_OPTIONS.some((o) => o.value === s) ? s : 'relevance'; }
  get sort_options() { return SEARCH_SORT_OPTIONS.map((o) => ({ ...o })); }
  _baseProducts() {
    if (!this.performed || !this._types.includes('product')) return [];
    return this._store.data.products.filter((p) => textMatches(this._q, productSearchFields(p), this._prefix));
  }
  _results() {
    if (this._cache) return this._cache;
    if (!this.performed) return (this._cache = []);
    let products = applyFilters(this._baseProducts(), parseActiveFilters(this._store.query));
    if (this.sort_by !== 'relevance') products = sortProducts(products, this.sort_by);
    const out = products.map((p) => this._store.product(p));
    if (this._types.includes('page')) {
      for (const p of this._store.data.pages) if (textMatches(this._q, [p.title, p.content], this._prefix)) out.push(this._store.pageByHandle(p.handle));
    }
    if (this._types.includes('article')) {
      for (const b of this._store.data.blogs) for (const a of b.articles || []) {
        if (textMatches(this._q, [a.title, a.content], this._prefix)) out.push(this._store.article(a, b));
      }
    }
    return (this._cache = out);
  }
  paginateSource(prop) { return prop === 'results' ? this._results() : null; }
  get results() { return this._window('results', this._results()); }
  get results_count() { return this._results().length; }
  get filters() {
    if (!this.performed) return [];
    return (this._filters ||= buildFilters(this._baseProducts(), this._store.query, this._store.path).map((f) => new FilterDrop(f)));
  }
}

export class PredictiveSearchDrop extends Drop {
  constructor(store) {
    super();
    this.__type = 'predictive_search';
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    const q = store.query;
    this._q = (q.get('q') || '').trim();
    this._types = (q.get('resources[type]') || 'query,product,collection,page,article').split(',').map((s) => s.trim());
    this._limit = Math.min(10, Math.max(1, parseInt(q.get('resources[limit]') || '10', 10) || 10));
    this._unavailableLast = (q.get('resources[options][unavailable_products]') || 'last') === 'last';
  }
  get performed() { return this._q !== ''; }
  get terms() { return this._q; }
  get types() { return this._types; }
  get resources() {
    if (this._res) return this._res;
    const s = this._store;
    const q = this._q;
    const on = (t) => this._types.includes(t) && this.performed;
    let products = on('product') ? s.data.products.filter((p) => textMatches(q, productSearchFields(p), true)) : [];
    if (this._unavailableLast) products = products.slice().sort((a, b) => Number(!a.variants.some((v) => v.available)) - Number(!b.variants.some((v) => v.available)));
    const collections = on('collection') ? s.data.collections.filter((c) => textMatches(q, [c.title], true)) : [];
    const pages = on('page') ? s.data.pages.filter((p) => textMatches(q, [p.title, p.content], true)) : [];
    const articles = on('article') ? s.data.blogs.flatMap((b) => (b.articles || []).filter((a) => textMatches(q, [a.title, a.content], true)).map((a) => [a, b])) : [];
    const queries = [];
    if (on('query')) {
      const seen = new Set();
      const lowerQ = q.toLowerCase();
      for (const p of s.data.products) {
        for (const text of [p.title.toLowerCase(), p.product_type.toLowerCase()]) {
          if (!text.includes(lowerQ) || seen.has(text)) continue;
          seen.add(text);
          const i = text.indexOf(lowerQ);
          const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
          const styled = `${i > 0 ? `<mark>${esc(text.slice(0, i))}</mark>` : ''}${esc(text.slice(i, i + lowerQ.length))}${text.length > i + lowerQ.length ? `<mark>${esc(text.slice(i + lowerQ.length))}</mark>` : ''}`;
          queries.push({ text, styled_text: styled, url: `/search?q=${encodeURIComponent(text)}&_pos=${queries.length + 1}&_psq=${encodeURIComponent(q)}&_ss=e&_v=1.0` });
        }
      }
    }
    const lim = (a) => a.slice(0, this._limit);
    this._res = {
      products: lim(products).map((p) => s.product(p)),
      collections: lim(collections).map((c) => s.collection(c)),
      pages: lim(pages).map((p) => s.pageByHandle(p.handle)),
      articles: lim(articles).map(([a, b]) => s.article(a, b)),
      queries: lim(queries),
    };
    return this._res;
  }
}

export class RecommendationsDrop extends Drop {
  constructor(store) {
    super();
    this.__type = 'recommendations';
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    const q = store.query;
    this._active = store.rq.pageType === 'recommendations';
    this._productId = parseInt(q.get('product_id') || '0', 10);
    this._limit = Math.min(10, Math.max(1, parseInt(q.get('limit') || '4', 10) || 4));
    this._intent = q.get('intent') === 'complementary' ? 'complementary' : 'related';
  }
  get performed() { return this._active; }
  get intent() { return this._intent; }
  get products() {
    if (!this._active) return [];
    if (this._list) return this._list;
    const d = this._store.data;
    const base = d.productById.get(this._productId);
    if (!base || this._intent === 'complementary') return (this._list = []);
    const others = d.products.filter((p) => p.id !== base.id);
    const inShared = (p) => d.collections.some((c) => c.product_handles.includes(base.handle) && c.product_handles.includes(p.handle));
    const ordered = [
      ...others.filter((p) => p.product_type === base.product_type),
      ...others.filter((p) => p.product_type !== base.product_type && inShared(p)),
      ...others.filter((p) => p.product_type !== base.product_type && !inShared(p)),
    ];
    return (this._list = ordered.slice(0, this._limit).map((p) => this._store.product(p)));
  }
  get products_count() { return this.products.length; }
}

export { tokenize };
