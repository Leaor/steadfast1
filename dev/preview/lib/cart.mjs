// In-memory cart keyed by the `cart` cookie token; Ajax Cart API semantics (ARCHITECTURE §8.4).
import crypto from 'node:crypto';
import { imageFileUrl } from './drops.mjs';

const carts = new Map();

export function newToken() { return `preview-${crypto.randomBytes(12).toString('hex')}`; }

export function getCart(token) {
  if (!carts.has(token)) carts.set(token, { token, note: '', attributes: {}, lines: [] });
  return carts.get(token);
}
export function resetCart(token) { if (token) carts.delete(token); }
export function resetAllCarts() { carts.clear(); }

export class CartError extends Error {
  constructor(status, description, message = 'Cart Error') { super(description); this.status = status; this.description = description; this.cartMessage = message; }
  toJSON() { return { status: this.status, message: this.cartMessage, description: this.description }; }
}

const propsHash = (props) => crypto.createHash('md5').update(JSON.stringify(props || {})).digest('hex');
const cleanProps = (props) => {
  const out = {};
  if (props && typeof props === 'object') for (const [k, v] of Object.entries(props)) if (v !== '' && v != null) out[k] = String(v);
  return out;
};

function lineTitle(p, v) {
  const def = p.options.length === 1 && p.options[0].values.length === 1 && p.options[0].values[0].name === 'Default Title';
  return def ? p.title : `${p.title} - ${v.options.join(' / ')}`;
}

function maxFor(v) {
  const limits = [];
  if (v.inventory_management === 'shopify' && v.inventory_policy === 'deny') limits.push(v.inventory_quantity ?? 0);
  if (v.quantity_rule?.max) limits.push(v.quantity_rule.max);
  return limits.length ? Math.min(...limits) : Infinity;
}

/** Add one item; returns the affected line. Throws CartError (422) per Shopify. */
export function addItem(cart, data, { id, quantity = 1, properties }) {
  const vid = parseInt(id, 10);
  const hit = data.variantIndex.get(vid);
  if (!hit) throw new CartError(422, 'Cannot find variant');
  const { product: p, variant: v } = hit;
  let qty = parseInt(quantity, 10);
  if (Number.isNaN(qty)) qty = 1;
  if (qty <= 0) throw new CartError(422, 'Quantity must be greater than 0.');
  const title = lineTitle(p, v);
  if (!v.available) throw new CartError(422, `The product '${title}' is already sold out.`);
  const rule = v.quantity_rule || {};
  const props = cleanProps(properties);
  const key = `${vid}:${propsHash(props)}`;
  let line = cart.lines.find((l) => l.key === key);
  const existing = line ? line.quantity : 0;
  if (rule.increment > 1 && qty % rule.increment !== 0) throw new CartError(422, `You must add this item in multiples of ${rule.increment}.`);
  if (rule.min > 1 && existing + qty < rule.min) throw new CartError(422, `You must add at least ${rule.min} of this item.`);
  const max = maxFor(v);
  let capped = false;
  let finalQty = existing + qty;
  if (finalQty > max) { finalQty = max; capped = true; }
  if (finalQty > existing) {
    if (!line) { line = { key, variant_id: vid, quantity: 0, properties: props }; cart.lines.push(line); }
    line.quantity = finalQty;
  }
  if (capped) {
    const err = new CartError(422, `You can only add ${max} ${title} to the cart.`);
    err.line = line;
    throw err;
  }
  return line;
}

function setQty(cart, data, line, qty) {
  if (qty <= 0) { cart.lines = cart.lines.filter((l) => l !== line); return null; }
  const { variant: v, product: p } = data.variantIndex.get(line.variant_id);
  const max = maxFor(v);
  if (qty > max) {
    line.quantity = max;
    if (max <= 0) cart.lines = cart.lines.filter((l) => l !== line);
    throw new CartError(422, `You can only add ${max} ${lineTitle(p, v)} to the cart.`);
  }
  line.quantity = qty;
  return line;
}

function findLine(cart, idOrKey) {
  const s = String(idOrKey);
  if (s.includes(':')) return cart.lines.find((l) => l.key === s);
  const vid = parseInt(s, 10);
  return cart.lines.find((l) => l.variant_id === vid);
}

export function changeItem(cart, data, { id, line, quantity }) {
  let target = null;
  if (line != null && line !== '') target = cart.lines[parseInt(line, 10) - 1];
  else if (id != null && id !== '') target = findLine(cart, id);
  if (!target) throw new CartError(400, 'no valid id or line parameter', 'Cart Error');
  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 0) throw new CartError(400, 'Invalid quantity', 'Cart Error');
  return setQty(cart, data, target, qty);
}

/** updates: {key|variantId: qty} | [qty,...] */
export function updateCart(cart, data, { updates, note, attributes }) {
  if (note != null) cart.note = String(note);
  if (attributes && typeof attributes === 'object') {
    for (const [k, v] of Object.entries(attributes)) { if (v === '' || v == null) delete cart.attributes[k]; else cart.attributes[k] = String(v); }
  }
  let firstError = null;
  if (Array.isArray(updates)) {
    const snapshot = cart.lines.slice();
    updates.forEach((q, i) => {
      const l = snapshot[i];
      if (!l) return;
      try { setQty(cart, data, l, parseInt(q, 10) || 0); } catch (e) { firstError ||= e; }
    });
  } else if (updates && typeof updates === 'object') {
    for (const [k, q] of Object.entries(updates)) {
      const qty = parseInt(q, 10) || 0;
      const l = findLine(cart, k);
      try {
        if (l) setQty(cart, data, l, qty);
        else if (qty > 0) addItem(cart, data, { id: k, quantity: qty });
      } catch (e) { firstError ||= e; }
    }
  }
  if (firstError) throw firstError;
}

export function clearCart(cart) { cart.lines = []; cart.note = ''; cart.attributes = {}; }

export function lineJSON(line, data) {
  const { product: p, variant: v } = data.variantIndex.get(line.variant_id);
  const def = p.options.length === 1 && p.options[0].values.length === 1 && p.options[0].values[0].name === 'Default Title';
  const media = (p.media || []).find((m) => m.id === v.featured_media_id) || (p.media || [])[0];
  const img = media?.image ? { ...media.image, alt: media.alt } : null;
  const url = img ? imageFileUrl(img) : null;
  const q = v.quantity_rule || {};
  return {
    id: v.id, properties: line.properties || {}, quantity: line.quantity, variant_id: v.id, key: line.key,
    title: lineTitle(p, v), price: v.price, original_price: v.price, presentment_price: v.price / 100, discounted_price: v.price,
    line_price: v.price * line.quantity, original_line_price: v.price * line.quantity, total_discount: 0, discounts: [],
    sku: v.sku ?? null, grams: 0, vendor: p.vendor, taxable: true, product_id: p.id, product_has_only_default_variant: def,
    gift_card: false, final_price: v.price, final_line_price: v.price * line.quantity, url: `/products/${p.handle}?variant=${v.id}`,
    featured_image: img ? { aspect_ratio: +(img.width / img.height).toFixed(4), alt: img.alt || p.title, height: img.height, url, width: img.width } : null,
    image: url, handle: p.handle, requires_shipping: true, product_type: p.product_type, product_title: p.title,
    product_description: (p.description_html || '').replace(/<[^>]+>/g, ''), variant_title: def ? null : v.options.join(' / '),
    variant_options: v.options, options_with_values: def ? [] : p.options.map((o, i) => ({ name: o.name, value: v.options[i] })),
    line_level_discount_allocations: [], line_level_total_discount: 0, has_components: false,
    quantity_rule: { min: q.min ?? 1, max: q.max ?? null, increment: q.increment ?? 1 },
  };
}

export function cartJSON(cart, data, currency = 'USD') {
  const items = cart.lines.filter((l) => data.variantIndex.has(l.variant_id)).map((l) => lineJSON(l, data));
  const total = items.reduce((s, i) => s + i.final_line_price, 0);
  return {
    token: cart.token, note: cart.note || null, attributes: cart.attributes || {}, original_total_price: total,
    total_price: total, total_discount: 0, total_weight: 0, item_count: items.reduce((s, i) => s + i.quantity, 0),
    items, requires_shipping: items.length > 0, currency, items_subtotal_price: total, cart_level_discount_applications: [],
  };
}
