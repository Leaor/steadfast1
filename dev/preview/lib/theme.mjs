// Theme rendering: settings resolution, JSON templates, section groups, static sections,
// the Section Rendering API and the layout (ARCHITECTURE §8.3).
import fs from 'node:fs';
import path from 'node:path';
import { Liquid, Drop, toValue } from 'liquidjs';
import { registerFilters, RQ } from './filters.mjs';
import { registerTags } from './tags.mjs';
import { ImageDrop, LineItemDrop } from './drops.mjs';

// ---------------------------------------------------------------------------
// file helpers with mtime caches
const fileCache = new Map();
export function readCached(file, parse) {
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const key = `${file}|${parse ? 'p' : 'r'}`;
  const hit = fileCache.get(key);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.value;
  const text = fs.readFileSync(file, 'utf8');
  const value = parse ? parse(text, file) : text;
  fileCache.set(key, { mtime: st.mtimeMs, size: st.size, value });
  return value;
}
export function parseJSONWithComments(text, file) {
  const stripped = text.replace(/^﻿/, '').replace(/^\s*\/\*[\s\S]*?\*\//, '');
  try { return JSON.parse(stripped); } catch (e) { throw new Error(`invalid JSON in ${file}: ${e.message}`); }
}
function schemaOf(src, file) {
  const m = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(src);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch (e) { throw new Error(`invalid {% schema %} JSON in ${file}: ${e.message}`); }
}

// ---------------------------------------------------------------------------
// CartDrop
export class CartDrop extends Drop {
  constructor(cart, store, currency) {
    super();
    this.__type = 'cart';
    Object.defineProperty(this, '_cart', { value: cart, enumerable: false });
    Object.defineProperty(this, '_store', { value: store, enumerable: false });
    this._currency = currency;
  }
  get items() {
    return (this._items ||= this._cart.lines.filter((l) => this._store.data.variantIndex.has(l.variant_id)).map((l) => new LineItemDrop(l, this._store)));
  }
  get item_count() { return this.items.reduce((s, i) => s + i.quantity, 0); }
  get items_count() { return this.items.length; }
  get total_price() { return this.items.reduce((s, i) => s + i.final_line_price, 0); }
  get original_total_price() { return this.total_price; }
  get items_subtotal_price() { return this.total_price; }
  get checkout_charge_amount() { return this.total_price; }
  get total_discount() { return 0; }
  get total_weight() { return 0; }
  get note() { return this._cart.note || null; }
  get attributes() { return this._cart.attributes || {}; }
  get currency() { return { iso_code: this._currency.iso_code, symbol: this._currency.symbol, name: this._currency.name }; }
  get requires_shipping() { return this.items.length > 0; }
  get 'empty?'() { return this.items.length === 0; }
  get cart_level_discount_applications() { return []; }
  get discount_applications() { return []; }
  get taxes_included() { return false; }
  get duties_included() { return false; }
  get token() { return this._cart.token; }
}

// ---------------------------------------------------------------------------
const OPTIONS = {
  strictFilters: true, strictVariables: false, jsTruthy: false, outputEscape: undefined, greedy: false,
  extname: '.liquid', relativeReference: false, dynamicPartials: true, ownPropertyOnly: false, cache: true,
};

function stringify(x) {
  x = toValue(x);
  if (typeof x === 'string') return x;
  if (x == null) return '';
  if (Array.isArray(x)) return x.map(stringify).join('');
  return String(x);
}

export class Renderer {
  constructor(rq, { themeDir }) {
    this.rq = rq;
    this.themeDir = themeDir;
    const snippets = path.join(themeDir, 'snippets');
    this.engine = new Liquid({ ...OPTIONS, root: [snippets], partials: [snippets], layouts: [path.join(themeDir, 'layout')] });
    registerTags(this.engine);
    registerFilters(this.engine, { themeDir });
    const renderer = this.engine.renderer;
    const self = this;
    renderer.renderTemplates = function* renderTemplates(templates, ctx, emitter) {
      if (!emitter) emitter = { buffer: '', write(h) { this.buffer += stringify(h); } };
      for (const tpl of templates) {
        try {
          const html = yield tpl.render(ctx, emitter);
          if (html) emitter.write(html);
          if (ctx.breakCalled || ctx.continueCalled) break;
        } catch (e) {
          emitter.write(self.inlineError(e, tpl));
        }
      }
      return emitter.buffer;
    };
    this._parsed = new Map();
  }

  rel(file) { return file ? path.relative(this.themeDir, file).split(path.sep).join('/') : null; }

  inlineError(e, tpl) {
    let err = e;
    while (err && err.name === 'LiquidErrors' && err.errors?.length) err = err.errors[0];
    const token = err?.token || tpl?.token;
    const file = this.rel(token?.file) || 'unknown';
    let line = '?';
    try { line = token?.getPosition ? token.getPosition()[0] : '?'; } catch { /* ignore */ }
    let msg = String(err?.originalError?.message || err?.message || err);
    msg = msg.replace(/, file:[^,]*, line:\d+, col:\d+$/, '').replace(/, line:\d+, col:\d+$/, '');
    return this.rq.recordError(`${file}:${line}`, msg);
  }

  // ------------------------------------------------------------------ settings
  themeSettingsRaw() {
    const schema = readCached(path.join(this.themeDir, 'config/settings_schema.json'), parseJSONWithComments) || [];
    const dataJSON = readCached(path.join(this.themeDir, 'config/settings_data.json'), parseJSONWithComments) || {};
    let current = dataJSON.current ?? {};
    if (typeof current === 'string') current = dataJSON.presets?.[current] ?? {};
    const types = {};
    const out = {};
    for (const group of schema) {
      for (const s of group.settings || []) {
        if (!s.id) continue;
        types[s.id] = s.type;
        if ('default' in s) out[s.id] = s.default;
        else out[s.id] = s.type === 'checkbox' ? false : null;
      }
    }
    for (const [k, val] of Object.entries(current)) if (k !== 'sections' && k !== 'content_for_index' && k !== 'blocks') out[k] = val;
    for (const [k, val] of Object.entries(this.rq.previewSettings || {})) out[k] = val;
    return { values: out, types };
  }
  resolveSettings(values, types) {
    const store = this.rq.store;
    const out = {};
    for (const [k, raw] of Object.entries(values)) out[k] = resolveSetting(types[k], raw, store);
    return out;
  }
  themeSettings() {
    if (this._settings) return this._settings;
    const { values, types } = this.themeSettingsRaw();
    this._settings = this.resolveSettings(values, types);
    return this._settings;
  }

  // ------------------------------------------------------------------ files
  sectionFile(type) { return path.join(this.themeDir, 'sections', `${type}.liquid`); }
  parseFile(file) {
    if (this._parsed.has(file)) return this._parsed.get(file);
    const src = fs.readFileSync(file, 'utf8');
    const tpl = this.engine.parse(src, file);
    const out = { src, tpl };
    this._parsed.set(file, out);
    return out;
  }
  sectionSchema(type) {
    const file = this.sectionFile(type);
    return readCached(file, schemaOf);
  }

  globals(extra = {}) {
    const g = (this._globals ||= this.rq.globals());
    const out = Object.create(null);
    Object.defineProperties(out, Object.getOwnPropertyDescriptors(g));
    Object.assign(out, extra);
    out[RQ] = this.rq;
    return out;
  }

  async renderLiquidFile(file, scope = {}, extraGlobals = {}) {
    let parsed;
    try { parsed = this.parseFile(file); } catch (e) { return this.inlineError(e, null); }
    try {
      return await this.engine.render(parsed.tpl, scope, { globals: this.globals(extraGlobals) });
    } catch (e) { return this.inlineError(e, null); }
  }

  // ------------------------------------------------------------------ sections
  buildSectionDrop({ id, type, settings = {}, blocks = {}, block_order, index = null, location }) {
    const schema = this.sectionSchema(type) || {};
    const types = {};
    const values = {};
    for (const s of schema.settings || []) {
      if (!s.id) continue;
      types[s.id] = s.type;
      values[s.id] = 'default' in s ? s.default : (s.type === 'checkbox' ? false : null);
    }
    for (const [k, val] of Object.entries(settings || {})) values[k] = val;
    const blockDefs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    const order = block_order || Object.keys(blocks || {});
    const blockDrops = [];
    for (const bid of order) {
      const b = blocks?.[bid];
      if (!b || b.disabled) continue;
      if (b.type?.startsWith('shopify://') || b.type === '@app') continue;
      const def = blockDefs[b.type];
      if (!def && !blockDefs['@app']) {
        this.rq.warn(`section ${type}: block type "${b.type}" not in schema`);
      }
      const btypes = {};
      const bvals = {};
      for (const s of def?.settings || []) {
        if (!s.id) continue;
        btypes[s.id] = s.type;
        bvals[s.id] = 'default' in s ? s.default : (s.type === 'checkbox' ? false : null);
      }
      for (const [k, val] of Object.entries(b.settings || {})) bvals[k] = val;
      blockDrops.push({ id: bid, type: b.type, settings: this.resolveSettings(bvals, btypes), shopify_attributes: '' });
    }
    return {
      __type: 'section', id, settings: this.resolveSettings(values, types), blocks: blockDrops,
      index, index0: index == null ? null : index - 1, location,
    };
  }

  async renderSectionInstance(inst, { groupName } = {}) {
    const file = this.sectionFile(inst.type);
    if (!fs.existsSync(file)) {
      return this.rq.recordError(`sections/${inst.type}.liquid`, `Error in tag 'section' - '${inst.type}' is not a valid section type`);
    }
    let schema;
    try { schema = this.sectionSchema(inst.type) || {}; } catch (e) {
      return this.rq.recordError(`sections/${inst.type}.liquid`, e.message);
    }
    let section;
    try { section = this.buildSectionDrop(inst); } catch (e) {
      return this.rq.recordError(`sections/${inst.type}.liquid`, `settings: ${e.message}`);
    }
    const html = await this.renderLiquidFile(file, { section });
    const tag = schema.tag || 'div';
    const cls = ['shopify-section', groupName ? `shopify-section-group-${groupName}` : null, schema.class || null].filter(Boolean).join(' ');
    return `<${tag} id="shopify-section-${inst.id}" class="${cls}">${html}</${tag}>`;
  }

  templateSectionInstances() {
    const t = this.rq.templateJSON;
    if (!t) return [];
    const overrides = this.rq.previewSections || {};
    const order = (t.order || Object.keys(t.sections || {})).filter((k) => t.sections?.[k] && !t.sections[k].disabled);
    return order.map((key, i) => {
      const s = t.sections[key];
      return {
        key, id: `template--preview__${key}`, type: s.type, settings: { ...(s.settings || {}), ...(overrides[key] || {}) },
        blocks: s.blocks || {}, block_order: s.block_order, index: i + 1, location: 'template',
      };
    });
  }

  groupJSON(name) {
    return readCached(path.join(this.themeDir, 'sections', `${name}.json`), parseJSONWithComments);
  }
  groupSectionInstances(name) {
    const g = this.groupJSON(name);
    if (!g) return null;
    const overrides = this.rq.previewSections || {};
    const order = (g.order || Object.keys(g.sections || {})).filter((k) => g.sections?.[k] && !g.sections[k].disabled);
    const location = g.type || name.replace(/-group$/, '');
    return order.map((key, i) => {
      const s = g.sections[key];
      return {
        key, id: `sections--preview__${key}`, type: s.type, settings: { ...(s.settings || {}), ...(overrides[key] || {}) },
        blocks: s.blocks || {}, block_order: s.block_order, index: i + 1, location,
      };
    });
  }

  async renderSectionGroup(name) {
    const list = this.groupSectionInstances(name);
    if (!list) return this.rq.recordError('layout', `sections: group file sections/${name}.json not found`);
    let out = `<!-- BEGIN sections: ${name} -->`;
    for (const inst of list) out += await this.renderSectionInstance(inst, { groupName: name });
    return `${out}<!-- END sections: ${name} -->`;
  }

  staticInstance(type) {
    const schema = this.sectionSchema(type) || {};
    const def = schema.default || {};
    const blocks = {};
    const order = [];
    (def.blocks || []).forEach((b, i) => { const id = `${type}-block-${i + 1}`; blocks[id] = { type: b.type, settings: b.settings || {} }; order.push(id); });
    const overrides = this.rq.previewSections?.[type] || {};
    return { id: type, type, settings: { ...(def.settings || {}), ...overrides }, blocks, block_order: order, index: null, location: 'static' };
  }

  async renderStaticSection(type) {
    if (!fs.existsSync(this.sectionFile(type))) {
      return this.rq.recordError(this.rq.currentFile || 'layout', `Error in tag 'section' - '${type}' is not a valid section type`);
    }
    return this.renderSectionInstance(this.staticInstance(type));
  }

  /** Section Rendering API: id → html|null */
  async renderSectionById(id) {
    const tpl = this.templateSectionInstances().find((s) => s.id === id);
    if (tpl) return this.renderSectionInstance(tpl);
    const m = /^sections--preview__(.+)$/.exec(id);
    if (m) {
      for (const g of this.groupNames()) {
        const hit = (this.groupSectionInstances(g) || []).find((s) => s.key === m[1]);
        if (hit) return this.renderSectionInstance(hit, { groupName: g });
      }
      return null;
    }
    if (/^[\w-]+$/.test(id) && fs.existsSync(this.sectionFile(id))) return this.renderSectionInstance(this.staticInstance(id));
    return null;
  }
  groupNames() {
    try { return fs.readdirSync(path.join(this.themeDir, 'sections')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')); } catch { return []; }
  }

  // ------------------------------------------------------------------ pages
  async renderContentForLayout() {
    const rq = this.rq;
    if (rq.contentOverride != null) return rq.contentOverride;
    if (rq.templateJSON) {
      if (rq.templateJSON.layout === false) rq.layout = false;
      else if (typeof rq.templateJSON.layout === 'string') rq.layout = rq.templateJSON.layout;
      let html = '';
      for (const inst of this.templateSectionInstances()) html += await this.renderSectionInstance(inst);
      if (rq.templateJSON.wrapper) html = wrapWith(rq.templateJSON.wrapper, html);
      return html;
    }
    if (rq.templateLiquidFile) return this.renderLiquidFile(rq.templateLiquidFile, {});
    return rq.recordError('templates', `template not found for ${rq.template.name}`);
  }

  async renderPage() {
    const rq = this.rq;
    const content = await this.renderContentForLayout();
    if (rq.layout === false) return content;
    const layoutName = rq.layout || 'theme';
    const file = path.join(this.themeDir, 'layout', `${layoutName}.liquid`);
    if (!fs.existsSync(file)) return `${rq.recordError(`layout/${layoutName}.liquid`, 'layout file not found')}${content}`;
    const header = contentForHeader(rq);
    return this.renderLiquidFile(file, {}, { content_for_layout: content, content_for_header: header });
  }
}

function wrapWith(spec, html) {
  const m = /^([a-z]+)((?:[#.][\w-]+)*)((?:\[[^\]]+\])*)$/.exec(String(spec).trim());
  if (!m) return html;
  const tag = m[1];
  const id = (m[2].match(/#([\w-]+)/) || [])[1];
  const classes = [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  const at = [...m[3].matchAll(/\[([\w-]+)(?:=([^\]]*))?\]/g)].map((x) => ` ${x[1]}${x[2] != null ? `="${x[2]}"` : ''}`).join('');
  return `<${tag}${id ? ` id="${id}"` : ''}${classes.length ? ` class="${classes.join(' ')}"` : ''}${at}>${html}</${tag}>`;
}

export function contentForHeader(rq) {
  const cur = rq.country.currency.iso_code;
  const cfg = `window.Shopify={shop:"steadfast.preview",locale:"en",currency:{active:"${cur}",rate:"1.0"},country:"${rq.country.iso_code}",designMode:false,routes:{root:"/"},theme:{name:"Preview",role:"development"},loadFeatures:function(f,cb){cb&&cb()}};`;
  return `<script>${cfg}</script>${rq.collected.join('')}`;
}

export function resolveSetting(type, raw, store) {
  if (raw === undefined) raw = null;
  switch (type) {
    case 'checkbox': return raw === true || raw === 'true';
    case 'range': case 'number': return raw == null || raw === '' ? null : Number(raw);
    case 'link_list': return raw ? store.linklist(raw) : null;
    case 'collection': return raw ? store.collectionByHandle(raw) : null;
    case 'product': return raw ? store.productByHandle(raw) : null;
    case 'page': return raw ? store.pageByHandle(raw) : null;
    case 'blog': return raw ? store.blogByHandle(raw) : null;
    case 'article': {
      if (!raw) return null;
      const [bh, ah] = String(raw).split('/');
      const b = store.data.blogs.find((x) => x.handle === bh);
      const a = b?.articles?.find((x) => x.handle === ah);
      return a ? store.article(a, b) : null;
    }
    case 'collection_list': return Array.isArray(raw) ? raw.map((h) => store.collectionByHandle(h)).filter(Boolean) : [];
    case 'product_list': return Array.isArray(raw) ? raw.map((h) => store.productByHandle(h)).filter(Boolean) : [];
    case 'image_picker':
      if (raw && typeof raw === 'object' && raw.base) return new ImageDrop(raw, store);
      return null;
    case 'video':
      if (raw && typeof raw === 'object' && raw.sources) return raw;
      return null;
    case 'header': case 'paragraph': return null;
    default:
      if (raw == null) return null;
      return typeof raw === 'string' ? raw : raw;
  }
}
