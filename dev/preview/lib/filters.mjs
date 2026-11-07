// The ALLOWED filter surface (ARCHITECTURE §8.6). Every other liquidjs builtin is removed so
// that, with strictFilters, any filter outside the contract fails loudly with file + line.
import fs from 'node:fs';
import path from 'node:path';
import { Drop, toValue } from 'liquidjs';
import {
  ImageDrop, MediaDrop, ProductDrop, VariantDrop, CollectionDrop, ArticleDrop, LineItemDrop, AddressDrop,
  imageFileUrl, pickWidth,
} from './drops.mjs';
import { handleize } from './catalog.mjs';

export const RQ = Symbol.for('steadfast.preview.rq');

export const STANDARD_FILTERS = ('abs append at_least at_most capitalize ceil compact concat date default divided_by downcase ' +
  'escape escape_once first floor join last lstrip map minus modulo newline_to_br plus prepend remove remove_first replace ' +
  'replace_first reverse round rstrip size slice sort sort_natural split strip strip_html strip_newlines sum times truncate ' +
  'truncatewords uniq upcase url_decode url_encode where').split(' ');

export const SHOPIFY_FILTERS = ('asset_url inline_asset_content shopify_asset_url stylesheet_tag script_tag image_url image_tag ' +
  'video_tag external_video_url external_video_tag model_viewer_tag placeholder_svg_tag money money_with_currency ' +
  'money_without_currency money_without_trailing_zeros t json handleize handle pluralize default_errors format_address ' +
  'highlight structured_data time_tag url_param_escape item_count_for_variant payment_button').split(' ');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const v = (x) => toValue(x);

function splitArgs(args) {
  const pos = [];
  const kw = {};
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string' && a.__kw !== false && isKwPair(a)) kw[a[0]] = a[1];
    else pos.push(a);
  }
  return { pos, kw };
}
// liquidjs passes keyword args as [key, value] tuples. A real array value would never be
// a 2-tuple whose first element is an identifier-ish string AND come from a kw position,
// but we can't tell; filters here only take scalar positional args, so treat 2-tuples as kw.
const isKwPair = (a) => /^[A-Za-z_][\w-]*$/.test(a[0]);

function rqOf(ctx) { return ctx.context.globals[RQ]; }

// ---------------------------------------------------------------------------
// money
function formatAmount(cents, fmt) {
  if (cents == null || cents === '') return '';
  const n = Number(cents);
  if (Number.isNaN(n)) return '';
  const val = n / 100;
  const groups = (num, dec, th, ds) => {
    const fixed = num.toFixed(dec);
    const [i, d] = fixed.split('.');
    const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, th);
    return d ? `${int}${ds}${d}` : int;
  };
  return fmt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    switch (k) {
      case 'amount': return groups(val, 2, ',', '.');
      case 'amount_no_decimals': return groups(val, 0, ',', '.');
      case 'amount_with_comma_separator': return groups(val, 2, '.', ',');
      case 'amount_no_decimals_with_comma_separator': return groups(val, 0, '.', ',');
      case 'amount_with_apostrophe_separator': return groups(val, 2, "'", '.');
      default: return groups(val, 2, ',', '.');
    }
  });
}

// ---------------------------------------------------------------------------
// translations
export function lookupLocale(rq, key) {
  let node = rq.locale;
  for (const part of String(key).split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}
export function translate(rq, key, vars = {}) {
  let val = lookupLocale(rq, key);
  if (val && typeof val === 'object' && 'count' in vars) {
    const c = Number(v(vars.count));
    val = (c === 0 && val.zero != null) ? val.zero : (c === 1 && val.one != null) ? val.one : (val.other ?? val.one);
  }
  if (typeof val !== 'string') {
    rq.missingTranslations.add(key);
    return `translation missing: en.${key}`;
  }
  const raw = /_html$/.test(key);
  return val.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => {
    const x = v(vars[name]);
    if (x == null) return '';
    return raw ? String(x) : esc(String(x));
  });
}

// ---------------------------------------------------------------------------
// images
function imageRefOf(input) {
  input = input instanceof ImageUrl ? input : input;
  if (input == null || input === '') return null;
  if (input instanceof ImageDrop) return input._ref;
  if (input instanceof MediaDrop) return input.preview_image?._ref ?? null;
  if (input instanceof ProductDrop || input instanceof VariantDrop) return imageRefOf(input.featured_media);
  if (input instanceof CollectionDrop || input instanceof ArticleDrop) return imageRefOf(input.image);
  if (input instanceof LineItemDrop) return imageRefOf(input.image);
  if (input && typeof input === 'object' && input.preview_image) return imageRefOf(input.preview_image);
  if (input && typeof input === 'object' && input.base && input.width) return input;
  return undefined;
}

export class ImageUrl extends Drop {
  constructor(ref, opts, url) { super(); this.__type = 'image_url'; this._ref = ref; this._opts = opts; this._url = url; }
  valueOf() { return this._url; }
  toString() { return this._url; }
}

function imageUrlFilter(input, ...args) {
  const { kw } = splitArgs(args);
  const width = kw.width != null ? parseInt(v(kw.width), 10) || null : null;
  const height = kw.height != null ? parseInt(v(kw.height), 10) || null : null;
  const crop = kw.crop != null ? String(v(kw.crop)) : null;
  if (input instanceof ImageUrl) input = input._ref;
  const raw = input instanceof Drop ? input : v(input);
  if (typeof raw === 'string') {
    if (!raw) return '';
    const sep = raw.includes('?') ? '&' : '?';
    return width ? `${raw}${sep}width=${width}` : raw;
  }
  const ref = imageRefOf(input);
  if (ref === null) return '';
  if (ref === undefined) throw new Error(`image_url: invalid input (${input?.__type || typeof input}); expected an image, media, product, variant, collection, article or line_item`);
  return new ImageUrl(ref, { width, height, crop }, imageFileUrl(ref, { width, height, crop }));
}

function attrs(obj) {
  return Object.entries(obj).filter(([, x]) => x !== null && x !== undefined && x !== false)
    .map(([k, x]) => (x === true ? ` ${k}` : ` ${k}="${esc(x)}"`)).join('');
}

function imageTagFilter(input, ...args) {
  const { kw } = splitArgs(args);
  const K = Object.fromEntries(Object.entries(kw).map(([k, x]) => [k, v(x)]));
  if (!(input instanceof ImageUrl)) {
    const ref = imageRefOf(input);
    if (ref) input = new ImageUrl(ref, {}, imageFileUrl(ref));
  }
  if (!(input instanceof ImageUrl)) {
    const src = String(v(input) ?? '');
    if (!src) return '';
    const { widths, preload, ...rest } = K;
    return `<img${attrs({ src, ...rest })}>`;
  }
  const ref = input._ref;
  const o = input._opts || {};
  const intrinsic = ref.width;
  const ratio = o.width && o.height && o.crop ? o.width / o.height : ref.width / ref.height;
  const reqW = o.width ? Math.min(o.width, intrinsic) : intrinsic;
  let width = K.width != null ? parseInt(K.width, 10) : reqW;
  let height = K.height != null ? parseInt(K.height, 10) : Math.round(width / ratio);
  if (K.width != null && K.height == null) height = Math.round(width / ratio);
  let list;
  if (K.widths) list = String(K.widths).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
  else list = (ref.widths || [ref.width]).filter((w) => w <= reqW);
  let usable = list.filter((w) => w <= intrinsic);
  if (!usable.length) usable = [Math.min(intrinsic, Math.max(...list, 0) || intrinsic)];
  const srcset = [...new Set(usable)].sort((a, b) => a - b)
    .map((w) => `${imageFileUrl(ref, { width: w, height: o.crop && o.height ? Math.round(w / ratio) : null, crop: o.crop })} ${w}w`).join(', ');
  const alt = 'alt' in K ? (K.alt ?? '') : (ref.alt ?? '');
  const { widths, preload, alt: _a, width: _w, height: _h, sizes, loading, fetchpriority, decoding, class: cls, ...rest } = K;
  return `<img${attrs({
    src: input._url, srcset, sizes: sizes ?? null, alt, width, height, loading: loading ?? null,
    fetchpriority: fetchpriority ?? null, decoding: decoding ?? null, class: cls ?? null, ...rest,
  })}>`;
}

// ---------------------------------------------------------------------------
// JSON (Shopify shapes)
export function toShopifyJSONValue(x, seen = new Set()) {
  if (x == null) return x;
  if (typeof x !== 'object') return x;
  if (seen.has(x)) return null;
  if (x instanceof Drop) {
    if (typeof x.toShopifyJSON === 'function') return toShopifyJSONValue(x.toShopifyJSON(), seen);
    seen.add(x);
    const out = {};
    let proto = Object.getPrototypeOf(x);
    const keys = new Set(Object.keys(x).filter((k) => !k.startsWith('_')));
    while (proto && proto !== Drop.prototype && proto !== Object.prototype) {
      for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(proto))) if (d.get && !k.startsWith('_')) keys.add(k);
      proto = Object.getPrototypeOf(proto);
    }
    for (const k of keys) {
      if (['metafields', 'product', 'variant', 'collections', 'blog'].includes(k)) continue;
      try { out[k] = toShopifyJSONValue(x[k], seen); } catch { /* skip */ }
    }
    seen.delete(x);
    return out;
  }
  if (Array.isArray(x)) return x.map((y) => toShopifyJSONValue(y, seen));
  seen.add(x);
  const out = {};
  for (const [k, y] of Object.entries(x)) if (!k.startsWith('__')) out[k] = toShopifyJSONValue(y, seen);
  seen.delete(x);
  return out;
}
export const jsonStringify = (x) => JSON.stringify(toShopifyJSONValue(x) ?? null)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// ---------------------------------------------------------------------------
function strftime(date, fmt) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return String(date ?? '');
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return fmt.replace(/%([-]?)([a-zA-Z%])/g, (_, flag, c) => {
    const nopad = flag === '-';
    const pp = (n) => (nopad ? String(n) : p(n));
    switch (c) {
      case 'Y': return d.getUTCFullYear();
      case 'y': return p(d.getUTCFullYear() % 100);
      case 'm': return pp(d.getUTCMonth() + 1);
      case 'd': return pp(d.getUTCDate());
      case 'e': return String(d.getUTCDate()).padStart(2, ' ');
      case 'B': return M[d.getUTCMonth()];
      case 'b': case 'h': return M[d.getUTCMonth()].slice(0, 3);
      case 'A': return D[d.getUTCDay()];
      case 'a': return D[d.getUTCDay()].slice(0, 3);
      case 'H': return pp(d.getUTCHours());
      case 'I': return pp(((d.getUTCHours() + 11) % 12) + 1);
      case 'l': return String(((d.getUTCHours() + 11) % 12) + 1);
      case 'M': return pp(d.getUTCMinutes());
      case 'S': return pp(d.getUTCSeconds());
      case 'p': return d.getUTCHours() < 12 ? 'AM' : 'PM';
      case 'P': return d.getUTCHours() < 12 ? 'am' : 'pm';
      case 'Z': return 'UTC';
      case 'z': return '+0000';
      case 'j': return p(Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5), 3);
      case 's': return Math.floor(d.getTime() / 1000);
      case 'F': return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
      case 'T': return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
      case '%': return '%';
      default: return `%${c}`;
    }
  });
}
const DATE_FORMAT_FALLBACK = { abbreviated_date: '%b %d, %Y', basic: '%m/%d/%Y', date: '%B %d, %Y', date_at_time: '%B %d, %Y at %-I:%M %p', default: '%a, %b %d, %Y, %-I:%M %p', on_date: 'on %b %d, %Y', month_day_year: '%B %d, %Y' };
function toDate(x) {
  x = v(x);
  if (x === 'now' || x === 'today') return new Date();
  if (x instanceof Date) return x;
  if (typeof x === 'number') return new Date(x * 1000);
  if (typeof x === 'string' && /^\d+$/.test(x)) return new Date(parseInt(x, 10) * 1000);
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PLACEHOLDER_SVG = (cls) => `<svg class="${esc(cls)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525.5 525.5" aria-hidden="true" focusable="false"><rect width="525.5" height="525.5" fill="currentColor" opacity=".08"/><path d="M0 525.5 525.5 0" stroke="currentColor" stroke-width="1" opacity=".2"/></svg>`;

const ERROR_LABELS = { email: 'Email', password: 'Password', first_name: 'First name', last_name: 'Last name', body: 'Message', author: 'Name', form: '' };

export function registerFilters(engine, { themeDir }) {
  const keep = new Set(STANDARD_FILTERS);
  for (const name of Object.keys(engine.filters)) if (!keep.has(name)) delete engine.filters[name];
  for (const name of STANDARD_FILTERS) if (!engine.filters[name]) throw new Error(`liquidjs lacks builtin filter ${name}`);

  const builtinDate = engine.filters.date;
  engine.registerFilter('date', function (input, ...args) {
    const { pos, kw } = splitArgs(args);
    if (kw.format != null) {
      const name = String(v(kw.format));
      const rq = rqOf(this);
      const fmt = rq.locale?.date_formats?.[name] || DATE_FORMAT_FALLBACK[name] || '%B %d, %Y';
      const d = toDate(input);
      return d ? strftime(d, fmt) : '';
    }
    if (pos.length && typeof v(pos[0]) === 'string') {
      const d = toDate(input);
      return d ? strftime(d, v(pos[0])) : v(input);
    }
    return builtinDate.call(this, input, ...args);
  });

  const assetPath = (name) => path.join(themeDir, 'assets', String(name));
  engine.registerFilter('asset_url', function (name) {
    name = String(v(name) ?? '');
    let mtime = 0;
    try { mtime = Math.floor(fs.statSync(assetPath(name)).mtimeMs / 1000); } catch { rqOf(this).warn(`asset_url: missing theme asset "${name}"`); }
    return `/cdn/shop/t/preview/assets/${name}?v=${mtime}`;
  });
  engine.registerFilter('inline_asset_content', function (name) {
    name = String(v(name) ?? '');
    if (!/\.(svg|css|js)$/i.test(name)) throw new Error(`inline_asset_content: only svg/css/js assets are allowed ("${name}")`);
    let buf;
    try { buf = fs.readFileSync(assetPath(name)); } catch { throw new Error(`inline_asset_content: asset "${name}" not found`); }
    if (buf.length >= 15 * 1024) throw new Error(`inline_asset_content: asset "${name}" is ${buf.length} bytes (limit 15 KB)`);
    return buf.toString('utf8');
  });
  engine.registerFilter('shopify_asset_url', (name) => `/cdn/shopify-assets/${String(v(name))}`);
  engine.registerFilter('stylesheet_tag', (url) => `<link href="${esc(v(url))}" rel="stylesheet" type="text/css" media="all" />`);
  engine.registerFilter('script_tag', (url) => `<script src="${esc(v(url))}" type="text/javascript"></script>`);
  engine.registerFilter('image_url', imageUrlFilter);
  engine.registerFilter('image_tag', imageTagFilter);
  engine.registerFilter('placeholder_svg_tag', (name, cls) => PLACEHOLDER_SVG(v(cls) || `placeholder-svg placeholder-svg--${v(name)}`));
  engine.registerFilter('video_tag', function (video, ...args) {
    const { kw } = splitArgs(args);
    if (!video) return '';
    const K = Object.fromEntries(Object.entries(kw).map(([k, x]) => [k, v(x)]));
    const sources = (video.sources || []).map((s) => `<source src="${esc(s.url)}" type="${esc(s.mime_type)}">`).join('');
    const pv = video.preview_image;
    const poster = pv ? imageFileUrl(pv._ref, { width: parseInt(String(K.image_size || '').split('x')[0], 10) || null }) : null;
    const { image_size, ...rest } = K;
    return `<video${attrs({ playsinline: 'playsinline', preload: 'metadata', poster, ...rest })}>${sources}${poster ? `<img src="${esc(poster)}" alt="">` : ''}</video>`;
  });
  engine.registerFilter('external_video_url', (video, ...args) => {
    const { kw } = splitArgs(args);
    if (!video) return '';
    const q = new URLSearchParams(Object.fromEntries(Object.entries(kw).map(([k, x]) => [k, String(v(x) === true ? 1 : v(x) === false ? 0 : v(x))])));
    const host = video.host;
    const id = video.external_id;
    const base = host === 'vimeo' ? `https://player.vimeo.com/video/${id}` : `https://www.youtube-nocookie.com/embed/${id}`;
    return `${base}${q.toString() ? `?${q}` : ''}`;
  });
  engine.registerFilter('external_video_tag', (url, ...args) => {
    const { kw } = splitArgs(args);
    const K = Object.fromEntries(Object.entries(kw).map(([k, x]) => [k, v(x)]));
    return `<iframe${attrs({ src: v(url), frameborder: '0', allow: 'autoplay; encrypted-media', allowfullscreen: true, title: K.title ?? null, class: K.class ?? null })}></iframe>`;
  });
  // `{{ form | payment_button }}` (ruling §15.11): Shopify renders the accelerated checkout buttons
  // client-side from a `[data-shopify="payment-button"]` container. The preview has no checkout
  // network, so it emits that container with an INERT placeholder: a disabled button whose text says
  // it is a preview stand-in (never a working or fake checkout). Only valid on a product form.
  engine.registerFilter('payment_button', function (form) {
    const f = v(form);
    if (!f || f.__type !== 'form' || f._type !== 'product') {
      return rqOf(this).recordError('payment_button', 'payment_button must be applied to a product form object ({% form "product" %})');
    }
    return '<div data-shopify="payment-button" class="shopify-payment-button" data-preview-stub>'
      + '<button type="button" class="shopify-payment-button__button shopify-payment-button__button--unbranded" disabled aria-disabled="true">'
      + 'Accelerated checkout (renders on Shopify)</button></div>';
  });
  engine.registerFilter('model_viewer_tag', (media) => `<model-viewer data-preview-stub alt="${esc(media?.alt ?? '')}"></model-viewer>`);

  const moneyF = (kind) => function (cents) {
    const rq = rqOf(this);
    const cur = rq.country.currency;
    const fmt = kind === 'with' ? `${cur.symbol}{{amount}} ${cur.iso_code}` : kind === 'without' ? '{{amount}}' : `${cur.symbol}{{amount}}`;
    let out = formatAmount(v(cents), fmt);
    if (kind === 'trailing') out = out.replace(/\.00(?!\d)/, '');
    return out;
  };
  engine.registerFilter('money', moneyF('plain'));
  engine.registerFilter('money_with_currency', moneyF('with'));
  engine.registerFilter('money_without_currency', moneyF('without'));
  engine.registerFilter('money_without_trailing_zeros', moneyF('trailing'));

  engine.registerFilter('t', function (key, ...args) {
    const { kw } = splitArgs(args);
    return translate(rqOf(this), String(v(key)), kw);
  });
  engine.registerFilter('json', (x) => jsonStringify(x));
  engine.registerFilter('handleize', (s) => handleize(v(s)));
  engine.registerFilter('handle', (s) => handleize(v(s)));
  engine.registerFilter('pluralize', (n, one, many) => (Number(v(n)) === 1 ? v(one) : v(many)));
  engine.registerFilter('url_param_escape', (s) => encodeURIComponent(String(v(s) ?? '')));
  engine.registerFilter('item_count_for_variant', (cart, id) => {
    const vid = parseInt(v(id), 10);
    return (cart?.items || []).filter((i) => i.variant_id === vid).reduce((s, i) => s + i.quantity, 0);
  });
  engine.registerFilter('default_errors', (errors) => {
    if (!errors || !errors._errors) return '';
    const items = Object.entries(errors._errors).map(([field, msg]) => {
      const label = ERROR_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
      return `<li>${esc(label ? `${label} ${msg}` : msg)}</li>`;
    });
    return items.length ? `<ul class="errors">${items.join('')}</ul>` : '';
  });
  engine.registerFilter('format_address', (a) => {
    if (!a) return '';
    const g = (k) => (a[k] == null ? '' : String(a[k]));
    const lines = [
      [g('first_name'), g('last_name')].filter(Boolean).join(' '), g('company'), g('address1'), g('address2'),
      [g('city'), g('province_code') || g('province'), g('zip')].filter(Boolean).join(' '), g('country'), g('phone'),
    ].filter((l) => l.trim());
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  });
  engine.registerFilter('highlight', (text, terms) => {
    const t = String(v(terms) ?? '').trim();
    const s = String(v(text) ?? '');
    if (!t) return s;
    const toks = t.split(/\s+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${toks.join('|')})`, 'gi');
    return s.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part : part.replace(re, '<strong class="highlight">$1</strong>'))).join('');
  });
  engine.registerFilter('time_tag', function (input, ...args) {
    const { pos, kw } = splitArgs(args);
    const d = toDate(input);
    if (!d) return '';
    let fmt = pos.length ? v(pos[0]) : null;
    if (kw.format != null) fmt = rqOf(this).locale?.date_formats?.[v(kw.format)] || DATE_FORMAT_FALLBACK[v(kw.format)];
    fmt ||= '%a, %b %d, %Y';
    const dt = kw.datetime != null ? strftime(d, v(kw.datetime)) : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `<time datetime="${esc(dt)}">${esc(strftime(d, fmt))}</time>`;
  });
  engine.registerFilter('structured_data', function (obj) {
    const rq = rqOf(this);
    if (obj instanceof ProductDrop) {
      const cur = rq.country.currency.iso_code;
      return jsonStringify({
        '@context': 'http://schema.org/', '@type': 'Product', name: obj.title, url: `${rq.origin}${obj.url}`,
        description: String(obj.description).replace(/<[^>]+>/g, '').trim(), brand: { '@type': 'Brand', name: obj.vendor },
        image: obj.images.map((i) => `${rq.origin}${i.src}`), productID: String(obj.id),
        offers: obj.variants.map((x) => ({
          '@type': 'Offer', availability: x.available ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
          price: (x.price / 100).toFixed(2), priceCurrency: cur, url: `${rq.origin}${x.url}`, ...(x.sku ? { sku: x.sku } : {}),
        })),
      });
    }
    if (obj instanceof ArticleDrop) {
      return jsonStringify({
        '@context': 'http://schema.org/', '@type': 'Article', headline: obj.title, url: `${rq.origin}${obj.url}`,
        datePublished: obj.published_at, author: { '@type': 'Person', name: obj.author },
        ...(obj.image ? { image: `${rq.origin}${obj.image.src}` } : {}),
        publisher: { '@type': 'Organization', name: rq.data.shop.name },
      });
    }
    throw new Error('structured_data: input must be a product or article');
  });

  // Defensive: assert the final surface equals the contract exactly.
  const allowed = new Set([...STANDARD_FILTERS, ...SHOPIFY_FILTERS]);
  for (const name of Object.keys(engine.filters)) if (!allowed.has(name)) delete engine.filters[name];
  for (const name of allowed) if (!engine.filters[name]) throw new Error(`filter ${name} not implemented`);
}

export { esc, splitArgs, pickWidth, AddressDrop };
