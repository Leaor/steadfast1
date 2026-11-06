// Shopify tags for liquidjs (ARCHITECTURE §8.6) + removal of tags the contract forbids.
import { Tag, Value, Drop, toValue, isTruthy } from 'liquidjs';
import { RQ, esc } from './filters.mjs';
import { paginateInfo } from './catalog.mjs';

const isTagToken = (t) => t && t.kind === 4 /* TokenKind.Tag */;

/** Split `a, b: c | f: 1, d-e: 'x'` at top-level commas into positional + keyword Values. */
export function parseTagArgs(str, liquid) {
  const parts = [];
  let depth = 0; let quote = null; let cur = '';
  for (const ch of String(str || '')) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const pos = [];
  const kw = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    const m = /^([A-Za-z_][\w-]*)\s*:(?!:)\s*([\s\S]+)$/.exec(s);
    if (m) kw.push([m[1], new Value(m[2], liquid)]);
    else pos.push(new Value(s, liquid));
  }
  return { pos, kw };
}

function* evalArgs(args, ctx) {
  const pos = [];
  for (const val of args.pos) pos.push(toValue(yield val.value(ctx, false)));
  const kw = {};
  for (const [k, val] of args.kw) kw[k] = toValue(yield val.value(ctx, false));
  return { pos, kw };
}

function rawBlock(tag, remainTokens, endName) {
  const tokens = [];
  while (remainTokens.length) {
    const t = remainTokens.shift();
    if (isTagToken(t) && t.name === endName) return tokens;
    tokens.push(t);
  }
  throw new Error(`tag ${tag.token.getText()} not closed`);
}

function parseBlock(tag, remainTokens, parser, endName) {
  const templates = [];
  while (remainTokens.length) {
    const t = remainTokens.shift();
    if (isTagToken(t) && t.name === endName) return templates;
    templates.push(parser.parseToken(t, remainTokens));
  }
  throw new Error(`tag ${tag.token.getText()} not closed`);
}

const rqOf = (ctx) => ctx.globals[RQ];

// ---------------------------------------------------------------------------
class NoOutputRaw extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    this.body = rawBlock(this, remainTokens, `end${token.name}`).map((t) => t.getText()).join('');
  }
  render() { return ''; }
}

class CollectTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    this.kind = token.name;
    this.body = rawBlock(this, remainTokens, `end${token.name}`).map((t) => t.getText()).join('');
  }
  render(ctx) {
    const rq = rqOf(ctx);
    rq.warn(`{% ${this.kind} %} used in ${this.token.file || 'template'} (forbidden by ARCHITECTURE §0.9)`);
    rq.collected.push(this.kind === 'stylesheet' ? `<style>${this.body}</style>` : `<script>${this.body}</script>`);
    return '';
  }
}

class StyleTag extends Tag {
  constructor(token, remainTokens, liquid, parser) {
    super(token, remainTokens, liquid);
    this.templates = parseBlock(this, remainTokens, parser, 'endstyle');
  }
  *render(ctx) {
    const html = yield this.liquid.renderer.renderTemplates(this.templates, ctx);
    return `<style data-shopify>${html}</style>`;
  }
}

class ForbiddenTag extends Tag {
  constructor(token) {
    super(token, [], null);
    throw new Error(`tag "${token.name}" is forbidden by ARCHITECTURE §8.6`);
  }
  render() { return ''; }
}

class LayoutTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    const a = String(token.args || '').trim();
    this.none = a === 'none';
    this.value = this.none ? null : new Value(a, liquid);
  }
  *render(ctx) {
    const rq = rqOf(ctx);
    rq.layout = this.none ? false : String(toValue(yield this.value.value(ctx, false)));
    return '';
  }
}

class ContentForTag extends Tag {
  constructor(token, remainTokens, liquid) { super(token, remainTokens, liquid); }
  render(ctx) {
    rqOf(ctx).warn(`{% content_for %} used in ${this.token.file} (theme blocks are not used in v1)`);
    return '';
  }
}

class SectionTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    this.args = parseTagArgs(token.args, liquid);
    if (!this.args.pos.length) throw new Error('section tag needs a section name');
  }
  *render(ctx) {
    const { pos } = yield* evalArgs(this.args, ctx);
    return yield rqOf(ctx).renderer.renderStaticSection(String(pos[0]));
  }
}

class SectionsTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    this.args = parseTagArgs(token.args, liquid);
    if (!this.args.pos.length) throw new Error('sections tag needs a group name');
  }
  *render(ctx) {
    const { pos } = yield* evalArgs(this.args, ctx);
    return yield rqOf(ctx).renderer.renderSectionGroup(String(pos[0]));
  }
}

// ---------------------------------------------------------------------------
// paginate
export class PaginateDrop extends Drop {
  constructor(info) { super(); this.__type = 'paginate'; Object.assign(this, info); }
}

class PaginateTag extends Tag {
  constructor(token, remainTokens, liquid, parser) {
    super(token, remainTokens, liquid);
    const m = /^([\s\S]+?)\s+by\s+([\s\S]+?)(?:\s*,\s*window_size\s*:\s*([\s\S]+))?$/.exec(String(token.args).trim());
    if (!m) throw new Error(`paginate: expected "{% paginate <array> by <n> %}", got "${token.args}"`);
    const expr = m[1].trim();
    const dot = /^(.*)\.([A-Za-z_][\w]*)$/.exec(expr);
    this.expr = expr;
    this.parent = dot ? new Value(dot[1], liquid) : null;
    this.prop = dot ? dot[2] : null;
    this.whole = new Value(expr, liquid);
    this.by = new Value(m[2], liquid);
    this.templates = parseBlock(this, remainTokens, parser, 'endpaginate');
  }
  *render(ctx, emitter) {
    const rq = rqOf(ctx);
    const size = parseInt(toValue(yield this.by.value(ctx, false)), 10);
    if (!(size > 0)) throw new Error(`paginate: page size must be a positive number (got ${size})`);
    if (size > 250) throw new Error('paginate: Array \'paginate\' cannot be greater than 250');
    const page = Math.max(1, parseInt(rq.query.get('page') || '1', 10) || 1);
    let parent = this.parent ? yield this.parent.value(ctx, false) : null;
    let full;
    let restore = null;
    if (parent && typeof parent.paginateSource === 'function' && parent.paginateSource(this.prop)) {
      full = parent.paginateSource(this.prop);
    } else {
      const val = toValue(yield this.whole.value(ctx, false));
      if (!Array.isArray(val)) throw new Error(`paginate: "${this.expr}" is not paginatable`);
      full = val;
      parent = null;
    }
    const info = paginateInfo(full.length, size, page, rq.path, rq.query);
    if (parent) parent.setPagination(this.prop, info.current_offset, size);
    else if (!this.expr.includes('.')) {
      // plain array variable: shadow it with the page slice
      restore = this.expr;
    }
    const scope = { paginate: new PaginateDrop(info) };
    if (restore) scope[restore] = full.slice(info.current_offset, info.current_offset + size);
    ctx.push(scope);
    try {
      yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    } finally {
      ctx.pop();
      if (parent) parent.clearPagination(this.prop);
    }
  }
}

// ---------------------------------------------------------------------------
// form
export class FormErrorsDrop extends Drop {
  constructor(errors) {
    super();
    this.__type = 'form_errors';
    this._errors = errors;
    const LABELS = { email: 'Email', password: 'Password', first_name: 'First name', last_name: 'Last name', body: 'Message', author: 'Name', form: '' };
    this.messages = { ...errors };
    this.translated_fields = Object.fromEntries(Object.keys(errors).map((k) => [k, LABELS[k] ?? k.replace(/_/g, ' ')]));
  }
  get size() { return Object.keys(this._errors).length; }
  valueOf() { return Object.keys(this._errors); }
}

export class FormDrop extends Drop {
  constructor(type, state, obj, id) {
    super();
    this.__type = 'form';
    this._type = type;
    this._id = id;
    const values = state?.values || {};
    this.errors = state?.errors && Object.keys(state.errors).length ? new FormErrorsDrop(state.errors) : null;
    this['posted_successfully?'] = !!state?.posted;
    const pick = (...keys) => { for (const k of keys) if (values[k] != null) return values[k]; return null; };
    this.email = pick('email');
    this.first_name = pick('first_name');
    this.last_name = pick('last_name');
    this.body = pick('body');
    this.author = pick('author');
    this.phone = pick('phone');
    this.password_needed = type === 'storefront_password';
    if (type === 'customer_address') {
      const a = obj || {};
      for (const k of ['first_name', 'last_name', 'company', 'address1', 'address2', 'city', 'province', 'country', 'zip', 'phone']) this[k] = a[k] ?? '';
      const aid = a.id ?? 'new';
      this.id = aid;
      this.set_as_default_checkbox = `<input type="checkbox" id="address_default_address_${aid}" name="address[default]" value="1">`;
    } else {
      this.id = id;
    }
  }
}

const FORM_DEFAULT_IDS = {
  contact: 'contact_form', customer: 'contact_form', customer_login: 'customer_login', create_customer: 'create_customer',
  recover_customer_password: 'recover_customer_password', reset_customer_password: 'reset_customer_password',
  activate_customer_password: 'activate_customer_password', localization: 'localization_form',
  storefront_password: 'login_form', new_comment: 'comment_form', product: null, customer_address: null,
};

class FormTag extends Tag {
  constructor(token, remainTokens, liquid, parser) {
    super(token, remainTokens, liquid);
    this.args = parseTagArgs(token.args, liquid);
    if (!this.args.pos.length) throw new Error('form tag needs a type');
    this.templates = parseBlock(this, remainTokens, parser, 'endform');
  }
  *render(ctx, emitter) {
    const rq = rqOf(ctx);
    const { pos, kw } = yield* evalArgs(this.args, ctx);
    const type = String(pos[0]);
    const obj = pos[1] ?? null;
    if (!(type in FORM_DEFAULT_IDS)) throw new Error(`form: unknown form type '${type}'`);
    let id = kw.id ?? FORM_DEFAULT_IDS[type];
    let action;
    const hidden = [];
    let enctype = null;
    switch (type) {
      case 'product':
        if (!obj) throw new Error("form 'product' requires a product argument");
        action = '/cart/add'; enctype = 'multipart/form-data';
        id ??= `product_form_${obj.id}`;
        break;
      case 'customer': action = `/contact#${id}`; break;
      case 'contact': action = `/contact#${id}`; break;
      case 'create_customer': action = '/account'; break;
      case 'customer_login': action = '/account/login'; break;
      case 'recover_customer_password': action = '/account/recover'; break;
      case 'reset_customer_password': action = '/account/reset'; break;
      case 'activate_customer_password': action = '/account/activate'; break;
      case 'customer_address': {
        const aid = obj && obj.id;
        action = aid ? `/account/addresses/${aid}` : '/account/addresses';
        id ??= aid ? `address_form_${aid}` : 'address_form_new';
        if (aid) hidden.push('<input type="hidden" name="_method" value="put" />');
        break;
      }
      case 'localization': action = '/localization'; hidden.push('<input type="hidden" name="_method" value="put" />'); break;
      case 'storefront_password': action = '/password'; break;
      case 'new_comment':
        if (!obj) throw new Error("form 'new_comment' requires an article argument");
        action = `${obj.url}/comments`; break;
      default: break;
    }
    const returnTo = kw.return_to ?? (type === 'localization' ? rq.path : null);
    if (returnTo != null) hidden.push(`<input type="hidden" name="return_to" value="${esc(returnTo)}" />`);
    const extra = Object.entries(kw).filter(([k]) => !['id', 'return_to'].includes(k))
      .filter(([, v]) => v !== false && v != null)
      .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
    emitter.write(`<form method="post" action="${esc(action)}"${id ? ` id="${esc(id)}"` : ''} accept-charset="UTF-8"${enctype ? ` enctype="${enctype}"` : ''}${extra}>`
      + `<input type="hidden" name="form_type" value="${type}" /><input type="hidden" name="utf8" value="✓" />${hidden.join('')}`);
    if (type === 'product') emitter.write(`<input type="hidden" name="product-id" value="${esc(obj.id)}" />`);
    const state = rq.formStateFor(type, id);
    ctx.push({ form: new FormDrop(type, state, obj, id) });
    try {
      yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    } finally { ctx.pop(); }
    emitter.write('</form>');
  }
}

export function registerTags(engine) {
  for (const name of ['include', 'tablerow', 'increment', 'decrement', 'block', 'ifchanged']) engine.registerTag(name, ForbiddenTag);
  engine.registerTag('schema', NoOutputRaw);
  engine.registerTag('doc', NoOutputRaw);
  engine.registerTag('stylesheet', CollectTag);
  engine.registerTag('javascript', CollectTag);
  engine.registerTag('style', StyleTag);
  engine.registerTag('layout', LayoutTag);
  engine.registerTag('content_for', ContentForTag);
  engine.registerTag('section', SectionTag);
  engine.registerTag('sections', SectionsTag);
  engine.registerTag('paginate', PaginateTag);
  engine.registerTag('form', FormTag);
}

export { isTruthy };
