#!/usr/bin/env node
// STEADFAST preview server: renders theme/ with liquidjs the way Shopify would, using
// placeholder fixtures (ARCHITECTURE §8). Dev-only, never shipped, never contacts Shopify.
//   node dev/preview/server.mjs [--port 9292] [--theme theme] [--fixtures dev/preview/fixtures] [--compress]
//   --compress (or SF_PREVIEW_COMPRESS=1): brotli/gzip text responses and immutable /cdn/ caching.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseCookies, cookieHeader, parseBody, send, sendJSON, redirect, serveFile, escapeHTML, setCompression,
} from './lib/http.mjs';
import { loadData } from './lib/data.mjs';
import { RequestContext } from './lib/request.mjs';
import {
  getCart, newToken, resetCart, addItem, changeItem, updateCart, clearCart, cartJSON, lineJSON, CartError,
} from './lib/cart.mjs';
import { jsonStringify, toShopifyJSONValue } from './lib/filters.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

function argv(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split('=').slice(1).join('=') : fallback;
}
const PORT = parseInt(argv('port', process.env.PREVIEW_PORT || '9292'), 10);
const HOST = argv('host', '127.0.0.1');
const resolveDir = (p) => (path.isAbsolute(p) ? p : fs.existsSync(path.resolve(process.cwd(), p)) ? path.resolve(process.cwd(), p) : path.resolve(repoRoot, p));
const THEME_DIR = resolveDir(argv('theme', 'theme'));
const FIXTURES_DIR = resolveDir(argv('fixtures', 'dev/preview/fixtures'));
const MEDIA_DIR = path.join(repoRoot, 'media/processed');
const QUIET = process.argv.includes('--quiet');
// PERF-07: opt-in brotli/gzip for text responses + immutable /cdn/ caching (lab numbers closer to the Shopify CDN).
const COMPRESS = process.argv.includes('--compress') || process.env.SF_PREVIEW_COMPRESS === '1';
setCompression(COMPRESS);

const log = (msg) => { if (!QUIET || /error|404/i.test(msg)) process.stderr.write(`[preview] ${msg}\n`); };

const RIBBON = '<div id="sf-preview-ribbon" role="note" aria-label="Preview with sample data" title="Sample data only: products, prices, sizes and inventory are placeholders. Changing country changes the currency code and symbol only; amounts are not converted."\n'
  + '     style="position:fixed;left:12px;bottom:12px;z-index:2147483000;pointer-events:none;font:600 11px/1 system-ui,sans-serif;letter-spacing:.14em;padding:8px 10px;background:#C3C8CD;color:#000">PREVIEW · SAMPLE DATA</div>';

function injectChrome(html) {
  let out = html;
  const robots = '<meta name="robots" content="noindex">';
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${robots}\n</head>`) : `${robots}${out}`;
  const i = out.toLowerCase().lastIndexOf('</body>');
  out = i >= 0 ? `${out.slice(0, i)}${RIBBON}\n${out.slice(i)}` : `${out}${RIBBON}`;
  return out;
}

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Preview': '1' };

// ---------------------------------------------------------------------------
// session (cookies)
function session(req) {
  const cookies = parseCookies(req.headers.cookie);
  const setCookies = [];
  let token = cookies.cart;
  if (!token || !/^preview-[a-f0-9]+$/.test(token)) { token = newToken(); setCookies.push(cookieHeader('cart', token)); }
  let previewSettings = {};
  if (cookies.preview_settings) { try { previewSettings = JSON.parse(cookies.preview_settings) || {}; } catch { /* ignore */ } }
  const flash = cookies.preview_flash || null;
  if (flash) setCookies.push(cookieHeader('preview_flash', '', { clear: true }));
  return {
    cookies, setCookies, token, previewSettings, flash,
    loggedIn: cookies.preview_customer === '1', countryIso: cookies.preview_country || null,
  };
}

function applyPreviewOverrides(url, sess) {
  const ps = url.searchParams.get('preview_settings');
  if (ps != null) {
    if (ps === 'reset') { sess.previewSettings = {}; sess.setCookies.push(cookieHeader('preview_settings', '', { clear: true })); }
    else {
      try {
        const obj = JSON.parse(ps);
        if (obj && typeof obj === 'object') {
          sess.previewSettings = { ...sess.previewSettings, ...obj };
          sess.setCookies.push(cookieHeader('preview_settings', JSON.stringify(sess.previewSettings)));
        }
      } catch (e) { log(`preview_settings: invalid JSON (${e.message})`); }
    }
  }
  let previewSections = {};
  const psec = url.searchParams.get('preview_sections');
  if (psec) { try { previewSections = JSON.parse(psec) || {}; } catch (e) { log(`preview_sections: invalid JSON (${e.message})`); } }
  return previewSections;
}

function makeRq(url, sess, extra = {}) {
  const data = loadData(FIXTURES_DIR, repoRoot);
  return new RequestContext({
    data, themeDir: THEME_DIR, url, origin: `http://${url.host}`, cart: getCart(sess.token), loggedIn: sess.loggedIn,
    countryIso: sess.countryIso, previewSettings: sess.previewSettings, previewSections: extra.previewSections || {},
    formStates: extra.formStates || {}, log,
  });
}

function formStatesFromQuery(url, sess) {
  const fs_ = {};
  if (url.searchParams.get('customer_posted') === 'true') fs_.customer = { posted: true };
  if (url.searchParams.get('contact_posted') === 'true') fs_.contact = { posted: true };
  if (sess.flash) {
    if (sess.flash.startsWith('{')) {
      try { const f = JSON.parse(sess.flash); if (f && f.type) fs_[f.type] = { errors: f.errors || null, values: f.values || {} }; } catch { /* ignore */ }
    } else fs_[sess.flash] = { posted: true };
  }
  return fs_;
}

// ---------------------------------------------------------------------------
// route → page context
const notFound = (rq) => { rq.setTemplate('404'); rq.pageTitle = '404 Not Found'; return { status: 404 }; };

function prepare(rq, { loggedIn }) {
  const p = rq.path.replace(/\/+$/, '') || '/';
  const st = rq.store;
  const d = rq.data;
  let m;
  if (p === '/') { rq.setTemplate('index'); return { status: 200 }; }
  if (p === '/collections') { rq.setTemplate('list-collections'); rq.pageTitle = 'Collections'; return { status: 200 }; }
  if ((m = /^\/collections\/([^/]+)$/.exec(p))) {
    const c = st.collectionByHandle(m[1]);
    if (!c) return notFound(rq);
    rq.currentCollectionHandle = c.handle;
    rq.resources.collection = c;
    rq.handle = c.handle;
    rq.setTemplate('collection', { suffix: c.template_suffix });
    rq.pageTitle = c.title;
    rq.pageDescription = c.description ? c.description.replace(/<[^>]+>/g, '') : rq.pageDescription;
    return { status: 200 };
  }
  if ((m = /^\/(?:collections\/([^/]+)\/)?products\/([^/]+)$/.exec(p))) {
    const prod = st.productByHandle(m[2]);
    if (!prod) return notFound(rq);
    if (m[1]) {
      const c = st.collectionByHandle(m[1]);
      if (c) rq.resources.collection = c;
    }
    rq.currentProductHandle = prod.handle;
    const vid = parseInt(rq.query.get('variant') || '', 10);
    if (vid && prod._p.variants.some((v) => v.id === vid)) rq.selectedVariantId = vid;
    const ov = rq.query.get('option_values');
    if (!rq.selectedVariantId && ov) {
      const ids = ov.split(',').map((x) => parseInt(x, 10));
      const names = prod._p.options.map((o) => o.values.find((v) => ids.includes(v.id))?.name);
      const hit = prod._p.variants.find((v) => v.options.every((o, i) => names[i] == null || names[i] === o));
      if (hit) rq.selectedVariantId = hit.id;
    }
    rq.resources.product = prod;
    rq.handle = prod.handle;
    rq.setTemplate('product', { suffix: prod.template_suffix });
    rq.pageTitle = prod.title;
    rq.pageDescription = prod.description.replace(/<[^>]+>/g, '').trim();
    rq.pageImage = prod.featured_image;
    return { status: 200 };
  }
  if (p === '/search') {
    rq.setTemplate('search');
    const s = (rq._search ||= st.search());
    rq.pageTitle = s.performed ? `Search: ${s.results_count} results found for “${s.terms}”` : 'Search';
    return { status: 200 };
  }
  if (p === '/cart') { rq.setTemplate('cart'); rq.pageTitle = 'Your Shopping Cart'; return { status: 200 }; }
  if ((m = /^\/pages\/([^/]+)$/.exec(p))) {
    const pg = st.pageByHandle(m[1]);
    if (!pg) return notFound(rq);
    rq.resources.page = pg;
    rq.handle = pg.handle;
    rq.setTemplate('page', { suffix: pg.template_suffix });
    rq.pageTitle = pg.title;
    return { status: 200 };
  }
  if ((m = /^\/blogs\/([^/]+)(?:\/([^/]+))?$/.exec(p))) {
    const b = st.blogByHandle(m[1]);
    if (!b) return notFound(rq);
    rq.resources.blog = b;
    if (m[2]) {
      const a = b._b.articles.find((x) => x.handle === m[2]);
      if (!a) return notFound(rq);
      const ad = st.article(a, b._b);
      rq.resources.article = ad;
      rq.handle = a.handle;
      rq.setTemplate('article');
      rq.pageTitle = `${a.title} – ${b.title}`;
      rq.pageImage = ad.image;
    } else {
      rq.handle = b.handle;
      rq.setTemplate('blog');
      rq.pageTitle = b.title;
    }
    return { status: 200 };
  }
  if ((m = /^\/policies\/([^/]+)$/.exec(p))) {
    const pol = (d.shop.policies || []).find((x) => x.handle === m[1]);
    if (!pol) return notFound(rq);
    rq.pageType = 'policy';
    rq.template = new (rq.template.constructor)('policy');
    rq.pageTitle = pol.title;
    rq.contentOverride = `<div class="shopify-policy__container"><h1>${escapeHTML(pol.title)}</h1><p>Policy to be published by the store owner.</p></div>`;
    return { status: 200 };
  }
  if (p === '/account') {
    if (!loggedIn) return { redirect: '/account/login' };
    rq.setTemplate('account', { directory: 'customers' }); rq.pageTitle = 'Account'; return { status: 200 };
  }
  if (p === '/account/login') { rq.setTemplate('login', { directory: 'customers' }); rq.pageTitle = 'Account'; return { status: 200 }; }
  if (p === '/account/register') { rq.setTemplate('register', { directory: 'customers' }); rq.pageTitle = 'Create Account'; return { status: 200 }; }
  if (p === '/account/addresses') {
    if (!loggedIn) return { redirect: '/account/login' };
    rq.setTemplate('addresses', { directory: 'customers' }); rq.pageTitle = 'Your Addresses'; return { status: 200 };
  }
  if ((m = /^\/account\/orders\/([^/]+)$/.exec(p))) {
    if (!loggedIn) return { redirect: '/account/login' };
    const c = d.customer;
    const o = c?.orders.find((x) => x.name.replace('#', '') === decodeURIComponent(m[1]).replace('#', '') || String(x.id) === m[1]);
    if (!o) return notFound(rq);
    const cd = rq.globals().customer;
    rq.resources.order = cd.orders.find((x) => x.id === o.id) || null;
    rq.setTemplate('order', { directory: 'customers' });
    rq.pageTitle = `Order ${o.name}`;
    return { status: 200 };
  }
  if (/^\/account\/activate\/[^/]+\/[^/]+$/.test(p)) { rq.setTemplate('activate_account', { directory: 'customers' }); rq.pageTitle = 'Activate Account'; return { status: 200 }; }
  if (/^\/account\/reset\/[^/]+\/[^/]+$/.test(p)) { rq.setTemplate('reset_password', { directory: 'customers' }); rq.pageTitle = 'Reset Account'; return { status: 200 }; }
  if (p === '/password') { rq.setTemplate('password'); rq.pageTitle = d.shop.name; return { status: 200 }; }
  if ((m = /^\/gift_cards\/([^/]+)$/.exec(p))) {
    const gc = d.giftCard;
    if (!gc || gc.code.replace(/-/g, '').toLowerCase() !== decodeURIComponent(m[1]).replace(/-/g, '').toLowerCase()) return notFound(rq);
    rq.resources.gift_card = {
      __type: 'gift_card', code: gc.code, balance: gc.balance, initial_value: gc.initial_value, currency: gc.currency,
      expires_on: gc.expires_on, enabled: gc.enabled, expired: gc.expired, qr_identifier: gc.qr_identifier,
      pass_url: gc.pass_url, product: null, last_four_characters: gc.code.slice(-4), url: `/gift_cards/${gc.code}`,
      customer: null,
    };
    rq.setTemplate('gift_card');
    rq.pageTitle = 'Gift card';
    return { status: 200 };
  }
  return notFound(rq);
}

// ---------------------------------------------------------------------------
async function renderSectionsMap(rq, ids) {
  const out = {};
  for (const id of ids) {
    try { out[id] = await rq.renderer.renderSectionById(id); } catch (e) { out[id] = rq.recordError(`sections/${id}`, e.message); }
  }
  return out;
}

function reportRequestProblems(rq) {
  if (rq.missingTranslations.size) log(`[i18n] ${rq.url.pathname}: translation missing for ${[...rq.missingTranslations].join(', ')}`);
}

async function respondHTMLRoute(req, res, url, sess, { formStates = {}, statusOverride } = {}) {
  const previewSections = applyPreviewOverrides(url, sess);
  const states = { ...formStatesFromQuery(url, sess), ...formStates };
  const rq = makeRq(url, sess, { previewSections, formStates: states });
  const result = prepare(rq, { loggedIn: sess.loggedIn });
  const baseHeaders = { ...HTML_HEADERS, 'Set-Cookie': sess.setCookies };
  if (result.redirect) return redirect(res, result.redirect, { 'Set-Cookie': sess.setCookies });
  const status = statusOverride || result.status;
  const sectionId = url.searchParams.get('section_id');
  const sections = url.searchParams.get('sections');
  if (sectionId) {
    const html = await rq.renderer.renderSectionById(sectionId);
    reportRequestProblems(rq);
    if (html == null) return send(res, 404, '', baseHeaders);
    return send(res, status === 404 ? 404 : 200, html, { ...baseHeaders, 'X-Preview-Liquid-Errors': String(rq.errors.length) });
  }
  if (sections != null) {
    const ids = sections.split(',').map((s) => s.trim()).filter(Boolean);
    const map = await renderSectionsMap(rq, ids);
    reportRequestProblems(rq);
    return sendJSON(res, 200, map, { 'Set-Cookie': sess.setCookies, 'X-Preview': '1' });
  }
  const html = await rq.renderer.renderPage();
  reportRequestProblems(rq);
  return send(res, status, injectChrome(html), { ...baseHeaders, 'X-Preview-Liquid-Errors': String(rq.errors.length) });
}

/** Render named sections in the context of another URL (cart Ajax `sections` + `sections_url`). */
async function sectionsFor(sess, req, sectionsParam, sectionsUrl) {
  let ids = sectionsParam;
  if (typeof ids === 'string') ids = ids.split(',');
  if (!Array.isArray(ids)) return null;
  ids = ids.map((s) => String(s).trim()).filter(Boolean);
  if (!ids.length) return null;
  const host = req.headers.host || `${HOST}:${PORT}`;
  let target;
  try { target = new URL(sectionsUrl || '/', `http://${host}`); } catch { target = new URL('/', `http://${host}`); }
  if (target.host !== host) target = new URL(target.pathname + target.search, `http://${host}`);
  const rq = makeRq(target, sess);
  prepare(rq, { loggedIn: sess.loggedIn });
  const map = await renderSectionsMap(rq, ids);
  reportRequestProblems(rq);
  return map;
}

function referrerPath(req, fallback = '/') {
  const ref = req.headers.referer;
  if (!ref) return fallback;
  try {
    const u = new URL(ref);
    if (u.host !== req.headers.host) return fallback;
    return u.pathname + u.search;
  } catch { return fallback; }
}
const sameOriginPath = (p, fallback) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : fallback);
const withQuery = (p, key, val) => {
  const u = new URL(p, 'http://x');
  u.searchParams.set(key, val);
  return u.pathname + u.search;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// cart endpoints
async function handleCart(req, res, url, sess, body) {
  const data = loadData(FIXTURES_DIR, repoRoot);
  const cart = getCart(sess.token);
  const p = url.pathname;
  const isJS = p.endsWith('.js') || p.endsWith('.json');
  const action = p.replace(/\.(js|json)$/, '');
  const b = body.data || {};
  const currency = (data.shop.countries || []).find((c) => c.iso_code === sess.countryIso)?.currency.iso_code || data.shop.currency;
  const headers = { 'Set-Cookie': sess.setCookies };
  const withSections = async (obj) => {
    const sections = b.sections ?? url.searchParams.get('sections');
    if (sections != null && sections !== '') {
      obj.sections = await sectionsFor(sess, req, sections, b.sections_url || url.searchParams.get('sections_url') || '/');
    }
    return obj;
  };
  const fail = (e) => {
    if (!(e instanceof CartError)) throw e;
    if (isJS) return sendJSON(res, e.status, e.toJSON(), headers);
    return send(res, e.status, injectChrome(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cart error</title></head><body style="background:#000;color:#F1E9DA;font:16px/1.5 system-ui,sans-serif;padding:48px 16px"><h1 style="font-weight:400">Cart error</h1><p>${escapeHTML(e.description)}</p><p><a style="color:inherit" href="/cart">Return to cart</a></p></body></html>`), { ...HTML_HEADERS, ...headers });
  };

  if (req.method === 'GET' && (action === '/cart')) return sendJSON(res, 200, cartJSON(cart, data, currency), headers);

  try {
    if (action === '/cart/add') {
      let items;
      if (Array.isArray(b.items)) items = b.items;
      else if (b.items && typeof b.items === 'object') items = Object.values(b.items);
      else items = [{ id: b.id, quantity: b.quantity ?? 1, properties: b.properties }];
      const lines = [];
      let err = null;
      for (const it of items) {
        try { lines.push(addItem(cart, data, it)); } catch (e) { if (e instanceof CartError) { err = e; break; } throw e; }
      }
      if (err) throw err;
      if (!isJS) return redirect(res, sameOriginPath(b.return_to, '/cart'), headers);
      const single = !Array.isArray(b.items) && !(b.items && typeof b.items === 'object');
      const payload = single ? lineJSON(lines[0], data) : { items: lines.map((l) => lineJSON(l, data)) };
      return sendJSON(res, 200, await withSections(payload), headers);
    }
    if (action === '/cart/change') {
      changeItem(cart, data, { id: b.id, line: b.line, quantity: b.quantity });
      if (!isJS) return redirect(res, '/cart', headers);
      return sendJSON(res, 200, await withSections(cartJSON(cart, data, currency)), headers);
    }
    if (action === '/cart/update') {
      updateCart(cart, data, { updates: b.updates, note: b.note, attributes: b.attributes });
      if (!isJS) return redirect(res, b.checkout != null ? '/checkout' : '/cart', headers);
      return sendJSON(res, 200, await withSections(cartJSON(cart, data, currency)), headers);
    }
    if (action === '/cart/clear') {
      clearCart(cart);
      if (!isJS) return redirect(res, '/cart', headers);
      return sendJSON(res, 200, await withSections(cartJSON(cart, data, currency)), headers);
    }
    if (action === '/cart' && req.method === 'POST') {
      let error = null;
      try { updateCart(cart, data, { updates: b.updates, note: b.note, attributes: b.attributes }); } catch (e) { if (e instanceof CartError) error = e; else throw e; }
      if (error) log(`POST /cart: ${error.description} (capped)`);
      return redirect(res, b.checkout != null ? '/checkout' : '/cart', headers);
    }
  } catch (e) {
    if (e instanceof CartError && e.line && isJS && action === '/cart/add') {
      // Shopify adds what it can, then reports the 422.
      return sendJSON(res, 422, e.toJSON(), headers);
    }
    return fail(e);
  }
  return sendJSON(res, 404, { status: 404, message: 'Not Found', description: 'Not Found' }, headers);
}

// ---------------------------------------------------------------------------
const CHECKOUT_PAGE = () => injectChrome(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout (not available in preview)</title>
<style>html,body{margin:0;background:#000;color:#F1E9DA;font:16px/1.6 system-ui,-apple-system,sans-serif}
main{max-width:560px;margin:0 auto;padding:96px 16px}h1{font-weight:400;font-size:28px;line-height:1.2;letter-spacing:.01em;margin:0 0 20px}
p{color:#C3C8CD;margin:0 0 16px}a{color:#F1E9DA}</style></head>
<body><main id="MainContent"><h1>Shopify checkout would open here</h1>
<p>Checkout is provided by Shopify and is not available in this preview.</p>
<p>On the live store, this step hands the cart to Shopify's secure checkout. No payment details are collected by the theme.</p>
<p><a href="/cart">Return to cart</a></p></main></body></html>`);

const QR_STUB = 'window.QRCode=window.QRCode||function QRCode(){};';

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const p = url.pathname;
  const method = req.method;

  // static ------------------------------------------------------------------
  if (p.startsWith('/cdn/shop/t/preview/assets/')) {
    const name = decodeURIComponent(p.slice('/cdn/shop/t/preview/assets/'.length));
    if (name.includes('/') || name.includes('..')) return send(res, 400, 'bad asset path');
    return serveFile(req, res, path.join(THEME_DIR, 'assets', name), { log: (m) => log(`${m} (theme asset missing)`) });
  }
  if (p.startsWith('/cdn/preview-media/')) {
    const rel = decodeURIComponent(p.slice('/cdn/preview-media/'.length));
    const file = path.resolve(MEDIA_DIR, rel);
    if (!file.startsWith(MEDIA_DIR + path.sep)) return send(res, 400, 'bad media path');
    return serveFile(req, res, file, { log: (m) => log(`${m} (fixture media missing)`) });
  }
  if (p === '/cdn/shopify-assets/vendor/qrcode.js') return send(res, 200, QR_STUB, { 'Content-Type': 'text/javascript; charset=utf-8' });
  if (p === '/favicon.ico') return send(res, 204, '');

  const sess = session(req);

  // harness endpoints ---------------------------------------------------------
  if (p === '/__preview/health') return sendJSON(res, 200, { ok: true, theme: THEME_DIR });
  if (p === '/__preview/reset') {
    if (method !== 'POST' && method !== 'GET') return send(res, 405, '');
    resetCart(sess.token);
    return sendJSON(res, 200, { ok: true }, {
      'Set-Cookie': [
        cookieHeader('cart', '', { clear: true }), cookieHeader('preview_customer', '', { clear: true }),
        cookieHeader('preview_country', '', { clear: true }), cookieHeader('preview_settings', '', { clear: true }),
        cookieHeader('preview_flash', '', { clear: true }),
      ],
    });
  }
  if (p === '/__preview/state') {
    const rq = makeRq(url, sess);
    const data = rq.data;
    const { values } = rq.renderer.themeSettingsRaw();
    return sendJSON(res, 200, {
      cart: cartJSON(getCart(sess.token), data, rq.country.currency.iso_code), settings: values,
      customer: sess.loggedIn ? data.customer : null, country: rq.country.iso_code,
    }, { 'Set-Cookie': sess.setCookies });
  }

  // cart -------------------------------------------------------------------
  if (/^\/cart(\/(add|change|update|clear))?(\.js|\.json)?$/.test(p) && !(method === 'GET' && p === '/cart')) {
    const body = method === 'POST' ? await parseBody(req) : { data: {} };
    if (body.invalid) return sendJSON(res, 400, { status: 400, message: 'Bad Request', description: 'Invalid JSON' });
    if (method === 'GET' && p !== '/cart.js' && p !== '/cart.json') return send(res, 405, '');
    return handleCart(req, res, url, sess, body);
  }
  if (p === '/checkout' || p.startsWith('/checkouts/')) return send(res, 200, CHECKOUT_PAGE(), { ...HTML_HEADERS, 'Set-Cookie': sess.setCookies });

  // JSON product endpoints ---------------------------------------------------
  let m;
  if (method === 'GET' && (m = /^\/(?:collections\/[^/]+\/)?products\/([^/]+)\.(js|json)$/.exec(p))) {
    const rq = makeRq(url, sess);
    const prod = rq.store.productByHandle(m[1]);
    if (!prod) return sendJSON(res, 404, { status: 404, message: 'Not Found' });
    const json = toShopifyJSONValue(prod);
    return sendJSON(res, 200, m[2] === 'json' ? { product: json } : json);
  }
  if (method === 'GET' && (p === '/recommendations/products' || p === '/recommendations/products.json')) {
    applyPreviewOverrides(url, sess);
    const rq = makeRq(url, sess);
    const baseProduct = rq.data.productById.get(parseInt(url.searchParams.get('product_id') || '0', 10));
    rq.setTemplate('product', { suffix: baseProduct?.template_suffix || null });
    rq.pageType = 'recommendations';
    const recs = rq.store.recommendations();
    if (p.endsWith('.json')) return sendJSON(res, 200, { intent: recs.intent, products: recs.products.map((x) => toShopifyJSONValue(x)) });
    const sid = url.searchParams.get('section_id');
    if (!sid) return send(res, 400, 'section_id is required', HTML_HEADERS);
    const html = await rq.renderer.renderSectionById(sid);
    reportRequestProblems(rq);
    if (html == null) return send(res, 404, '', HTML_HEADERS);
    return send(res, 200, html, { ...HTML_HEADERS, 'X-Preview-Liquid-Errors': String(rq.errors.length) });
  }
  if (method === 'GET' && (p === '/search/suggest' || p === '/search/suggest.json')) {
    const rq = makeRq(url, sess);
    rq.pageType = 'predictive_search';
    const ps = rq.store.predictiveSearch();
    if (p.endsWith('.json')) {
      const r = ps.resources;
      return sendJSON(res, 200, { resources: { results: {
        products: r.products.map((x) => toShopifyJSONValue(x)), collections: r.collections.map((c) => ({ id: c.id, title: c.title, handle: c.handle, url: c.url })),
        pages: r.pages.map((x) => ({ id: x.id, title: x.title, handle: x.handle, url: x.url })), articles: r.articles.map((x) => ({ id: x.id, title: x.title, handle: x.handle, url: x.url })),
        queries: r.queries,
      } } });
    }
    const sid = url.searchParams.get('section_id');
    if (!sid) return send(res, 400, 'section_id is required', HTML_HEADERS);
    const html = await rq.renderer.renderSectionById(sid);
    reportRequestProblems(rq);
    if (html == null) return send(res, 404, '', HTML_HEADERS);
    return send(res, 200, html, { ...HTML_HEADERS, 'X-Preview-Liquid-Errors': String(rq.errors.length) });
  }

  // POST forms ----------------------------------------------------------------
  if (method === 'POST') {
    const body = await parseBody(req);
    const b = body.data || {};
    const back = sameOriginPath(b.return_to, referrerPath(req, '/'));
    // Errors: 302 back to the page the form lives on with a one-shot flash cookie, so the
    // browser URL stays a real GET route (Shopify keeps the visitor on the same page).
    const reRender = (pathname, formStates) => {
      const [type, state] = Object.entries(formStates)[0];
      const flash = JSON.stringify({ type, errors: state.errors, values: state.values });
      return redirect(res, pathname, { 'Set-Cookie': [...sess.setCookies.filter((c) => !c.startsWith('preview_flash=')), cookieHeader('preview_flash', flash)] });
    };
    if (p === '/contact') {
      const type = b.form_type === 'contact' ? 'contact' : 'customer';
      const email = String(b.contact?.email ?? '').trim();
      if (!EMAIL_RE.test(email)) {
        return reRender(back, { [type]: { errors: { email: email ? 'is invalid.' : "can't be blank." }, values: { email, body: b.contact?.body ?? null } } });
      }
      return redirect(res, withQuery(back, type === 'contact' ? 'contact_posted' : 'customer_posted', 'true'), { 'Set-Cookie': sess.setCookies });
    }
    if (p === '/account/login') {
      const email = String(b.customer?.email ?? '').trim();
      const pw = String(b.customer?.password ?? '');
      if (!pw || !email) return reRender('/account/login', { customer_login: { errors: { form: 'Incorrect email or password.' }, values: { email } } });
      return redirect(res, sameOriginPath(b.checkout_url || b.return_url, '/account'), { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_customer', '1')] });
    }
    if (p === '/account') {
      const email = String(b.customer?.email ?? '').trim();
      const errors = {};
      if (!EMAIL_RE.test(email)) errors.email = email ? 'is invalid.' : "can't be blank.";
      if (!String(b.customer?.password ?? '')) errors.password = "can't be blank.";
      if (Object.keys(errors).length) return reRender('/account/register', { create_customer: { errors, values: { email, first_name: b.customer?.first_name, last_name: b.customer?.last_name } } });
      return redirect(res, '/account', { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_customer', '1')] });
    }
    if (/^\/account\/addresses(\/[^/]+)?$/.test(p)) {
      if (!sess.loggedIn) return redirect(res, '/account/login', { 'Set-Cookie': sess.setCookies });
      return redirect(res, '/account/addresses', { 'Set-Cookie': sess.setCookies });
    }
    if (p === '/account/recover') {
      return redirect(res, '/account/login#recover', { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_flash', 'recover_customer_password')] });
    }
    if (p === '/account/reset' || p === '/account/activate') {
      return redirect(res, '/account', { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_customer', '1')] });
    }
    if (p === '/localization') {
      const iso = String(b.country_code || '').toUpperCase();
      const data = loadData(FIXTURES_DIR, repoRoot);
      const known = (data.shop.countries || []).some((c) => c.iso_code === iso);
      const cookies = [...sess.setCookies];
      if (known) cookies.push(cookieHeader('preview_country', iso));
      return redirect(res, back, { 'Set-Cookie': cookies });
    }
    if (p === '/password') return redirect(res, '/', { 'Set-Cookie': sess.setCookies });
    if ((m = /^\/blogs\/([^/]+)\/([^/]+)\/comments$/.exec(p))) {
      return redirect(res, `/blogs/${m[1]}/${m[2]}#comments`, { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_flash', 'new_comment')] });
    }
    if (p === '/__preview/reset') return undefined;
    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
  }

  if (p === '/account/logout') return redirect(res, '/', { 'Set-Cookie': [...sess.setCookies, cookieHeader('preview_customer', '', { clear: true })] });

  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, '');
  return respondHTMLRoute(req, res, url, sess);
}

function descriptors(obj) {
  const out = {};
  Object.defineProperties(out, Object.getOwnPropertyDescriptors(obj));
  return out;
}

export function createServer() {
  return http.createServer((req, res) => {
    const t0 = Date.now();
    handle(req, res).catch((e) => {
      log(`500 ${req.method} ${req.url}: ${e.stack || e}`);
      if (!res.headersSent) send(res, 500, `<!doctype html><title>Preview error</title><pre class="preview-liquid-error">Liquid error (server): ${escapeHTML(e.message)}</pre>`, HTML_HEADERS);
      else res.end();
    }).finally(() => {
      if (!QUIET && res.statusCode >= 400 && !req.url.startsWith('/cdn/')) log(`${res.statusCode} ${req.method} ${req.url} (${Date.now() - t0}ms)`);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    log(`listening on http://${HOST}:${PORT}${COMPRESS ? '  (compress on)' : ''}  theme=${path.relative(repoRoot, THEME_DIR) || THEME_DIR}  fixtures=${path.relative(repoRoot, FIXTURES_DIR)}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

export { jsonStringify };
