// Canonical route list (ARCHITECTURE §8.2), built from the fixtures so handles are never guessed.
import * as fx from './fixtures.mjs';

export function productRoutes() { return fx.products().map((p) => `/products/${p.handle}`); }
export function collectionRoutes() { return ['/collections/all', ...fx.collections().map((c) => `/collections/${c.handle}`)]; }

/** GET HTML routes: { path, status, auth?: true (needs login), page: bool (full page with ribbon) }. */
export function htmlRoutes() {
  const out = [
    { path: '/', status: 200 },
    { path: '/collections', status: 200 },
    ...collectionRoutes().map((path) => ({ path, status: 200 })),
    ...productRoutes().map((path) => ({ path, status: 200 })),
    { path: `/collections/hoodies/products/${fx.products()[0].handle}`, status: 200 },
    { path: '/search', status: 200 },
    { path: '/search?q=hoodie', status: 200 },
    { path: '/search?q=zzqxnomatch', status: 200 },
    { path: '/cart', status: 200 },
    { path: '/checkout', status: 200 },
    ...fx.pages().map((p) => ({ path: `/pages/${p.handle}`, status: 200 })),
    ...(fx.shop().policies || []).map((p) => ({ path: `/policies/${p.handle}`, status: 200 })),
    { path: '/account/login', status: 200 },
    { path: '/account/register', status: 200 },
    { path: '/account/activate/1/preview-token', status: 200 },
    { path: '/account/reset/1/preview-token', status: 200 },
    { path: '/account', status: 200, auth: true },
    { path: '/account/addresses', status: 200, auth: true },
    { path: '/password', status: 200 },
    { path: '/404', status: 404 },
    { path: '/this-route-does-not-exist', status: 404 },
    { path: '/products/no-such-product', status: 404 },
  ];
  for (const b of fx.blogs()) {
    out.push({ path: `/blogs/${b.handle}`, status: 200 });
    for (const a of b.articles || []) out.push({ path: `/blogs/${b.handle}/${a.handle}`, status: 200 });
  }
  const c = fx.customer();
  const order = c?.orders?.[0];
  if (order) {
    const p = order.url ? new URL(order.url, 'http://x').pathname : `/account/orders/${encodeURIComponent(String(order.name).replace(/^#/, ''))}`;
    out.push({ path: p, status: 200, auth: true });
  }
  const g = fx.giftCard();
  if (g?.code) out.push({ path: `/gift_cards/${g.code}`, status: 200 });
  return out;
}
