// Per-request context: page state, globals for Liquid, error/warning collection.
import path from 'node:path';
import fs from 'node:fs';
import { Drop } from 'liquidjs';
import { Store, CustomerDrop } from './drops.mjs';
import { CartDrop, Renderer, readCached, parseJSONWithComments } from './theme.mjs';
import { escapeHTML } from './http.mjs';

const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
const CA_PROVINCES = ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'];
const PROVINCES = { 'United States': US_STATES, Canada: CA_PROVINCES, 'United Kingdom': [] };

function countryOptionTags(countries) {
  return countries.map((c) => {
    const prov = (PROVINCES[c.name] || []).map((p) => [p, p]);
    return `<option value="${escapeHTML(c.name)}" data-provinces="${escapeHTML(JSON.stringify(prov))}">${escapeHTML(c.name)}</option>`;
  }).join('\n');
}

export class TemplateDrop extends Drop {
  constructor(name, suffix, directory) { super(); this.__type = 'template'; this.name = name; this.suffix = suffix || null; this.directory = directory || null; }
  valueOf() { return `${this.directory ? `${this.directory}/` : ''}${this.name}${this.suffix ? `.${this.suffix}` : ''}`; }
  toString() { return this.valueOf(); }
}

export class RequestContext {
  constructor(opts) {
    Object.assign(this, opts); // data, themeDir, url (URL), origin, cart, loggedIn, countryIso, previewSettings, previewSections, log
    this.path = decodeURIComponent(this.url.pathname);
    this.query = this.url.searchParams;
    this.errors = [];
    this.warnings = [];
    this.missingTranslations = new Set();
    this.collected = [];
    this.formStates = opts.formStates || {};
    this.layout = null;
    this.contentOverride = null;
    this.resources = {};
    this.pageType = 'index';
    this.template = new TemplateDrop('index');
    this.templateJSON = null;
    this.templateLiquidFile = null;
    this.selectedVariantId = null;
    this.currentCollectionHandle = null;
    this.currentProductHandle = null;
    this.pageTitle = this.data.shop.name;
    this.pageDescription = this.data.shop.description ?? null;
    this.pageImage = null;
    this.handle = null;
    const countries = this.data.shop.countries || [];
    this.country = countries.find((c) => c.iso_code === this.countryIso) || countries[0]
      || { iso_code: 'US', name: 'United States', currency: { iso_code: 'USD', symbol: '$' } };
    this.store = new Store(this);
    this.renderer = new Renderer(this, { themeDir: this.themeDir });
    this.locale = readCached(path.join(this.themeDir, 'locales/en.default.json'), parseJSONWithComments) || {};
  }

  recordError(where, msg) {
    const text = `Liquid error (${where}): ${msg}`;
    this.errors.push(text);
    this.log?.(`[liquid] ${this.url.pathname}${this.url.search} :: ${text}`);
    return `<span class="preview-liquid-error">${escapeHTML(text)}</span>`;
  }
  warn(msg) {
    if (this.warnings.includes(msg)) return;
    this.warnings.push(msg);
    this.log?.(`[warn] ${this.url.pathname} :: ${msg}`);
  }
  formStateFor(type) { return this.formStates[type] || null; }

  /** Select the template to render: JSON first, then .liquid; suffix falls back to none. */
  setTemplate(name, { suffix = null, directory = null, pageType } = {}) {
    const dir = path.join(this.themeDir, 'templates', directory || '');
    const view = this.query.get('view');
    const tries = [];
    for (const s of [view, suffix, null]) {
      if (s === undefined) continue;
      const base = `${name}${s ? `.${s}` : ''}`;
      tries.push([s, path.join(dir, `${base}.json`), 'json'], [s, path.join(dir, `${base}.liquid`), 'liquid']);
    }
    this.pageType = pageType || (directory ? `${directory}/${name}` : name);
    for (const [s, file, kind] of tries) {
      if (!fs.existsSync(file)) continue;
      this.template = new TemplateDrop(name, s, directory);
      if (kind === 'json') {
        try { this.templateJSON = readCached(file, parseJSONWithComments); } catch (e) { this.contentOverride = this.recordError(path.relative(this.themeDir, file), e.message); }
      } else this.templateLiquidFile = file;
      return true;
    }
    this.template = new TemplateDrop(name, suffix, directory);
    this.contentOverride = this.recordError(`templates/${directory ? `${directory}/` : ''}${name}`, 'template file not found');
    return false;
  }

  globals() {
    const rq = this;
    const st = this.store;
    const g = {};
    const lazy = (name, fn) => {
      let done = false; let val;
      Object.defineProperty(g, name, { enumerable: true, configurable: true, get() { if (!done) { val = fn(); done = true; } return val; } });
    };
    lazy('shop', () => st.shop());
    lazy('settings', () => rq.renderer.themeSettings());
    lazy('request', () => ({
      __type: 'request', host: rq.url.host, origin: rq.origin, path: rq.path, page_type: rq.pageType, design_mode: false,
      visual_preview_mode: false, locale: { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
    }));
    g.routes = {
      root_url: '/', account_url: '/account', account_login_url: '/account/login', account_logout_url: '/account/logout',
      account_register_url: '/account/register', account_addresses_url: '/account/addresses', account_recover_url: '/account/recover',
      collections_url: '/collections', all_products_collection_url: '/collections/all', search_url: '/search',
      predictive_search_url: '/search/suggest', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change',
      cart_update_url: '/cart/update', cart_clear_url: '/cart/clear', product_recommendations_url: '/recommendations/products',
    };
    lazy('template', () => rq.template);
    lazy('page_title', () => rq.pageTitle);
    lazy('page_description', () => rq.pageDescription);
    lazy('canonical_url', () => `${rq.origin}${rq.path}`);
    lazy('page_image', () => rq.pageImage);
    lazy('current_page', () => Math.max(1, parseInt(rq.query.get('page') || '1', 10) || 1));
    g.current_tags = null;
    lazy('handle', () => rq.handle);
    lazy('localization', () => {
      const mk = (c) => ({ __type: 'country', iso_code: c.iso_code, name: c.name, currency: { ...c.currency }, unit_system: c.iso_code === 'US' ? 'imperial' : 'metric', available_languages: rq.data.shop.languages || [] });
      const langs = (rq.data.shop.languages || []).map((l) => ({ __type: 'language', ...l, primary: true, root_url: '/' }));
      return {
        __type: 'localization', country: mk(rq.country), available_countries: (rq.data.shop.countries || []).map(mk),
        language: langs[0] || { iso_code: 'en', name: 'English', endonym_name: 'English' }, available_languages: langs,
        market: { id: 1, handle: rq.country.iso_code.toLowerCase() },
      };
    });
    lazy('all_country_option_tags', () => countryOptionTags(rq.data.shop.countries || []));
    lazy('country_option_tags', () => countryOptionTags(rq.data.shop.countries || []));
    lazy('cart', () => new CartDrop(rq.cart, st, rq.country.currency));
    g.additional_checkout_buttons = false;
    g.content_for_additional_checkout_buttons = '';
    lazy('customer', () => (rq.loggedIn && rq.data.customer ? new CustomerDrop(rq.data.customer, st) : null));
    lazy('collections', () => st.collectionsDrop());
    lazy('pages', () => st.pagesDrop());
    lazy('blogs', () => st.blogsDrop());
    lazy('linklists', () => st.linklistsDrop());
    lazy('all_products', () => st.allProductsDrop());
    lazy('predictive_search', () => st.predictiveSearch());
    lazy('recommendations', () => st.recommendations());
    lazy('search', () => (rq.pageType === 'search' || rq.pageType === 'predictive_search' ? (rq._search ||= st.search()) : null));
    for (const [k, val] of Object.entries(this.resources)) g[k] = val;
    return g;
  }
}
