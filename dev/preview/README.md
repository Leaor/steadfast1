# STEADFAST preview harness (dev-only, never shipped)

Renders `theme/` with liquidjs the way Shopify would, using placeholder fixtures (ARCHITECTURE §8).
It never contacts a Shopify store.

```
npm --prefix dev install            # liquidjs, @playwright/test, @axe-core/playwright, @shopify/cli
npm --prefix dev run preview        # http://127.0.0.1:9292  (node dev/preview/server.mjs --port 9292)
node dev/preview/tools/smoke.mjs --base http://127.0.0.1:9292   # every route: status, Liquid errors, i18n, ribbon, broken /cdn/ refs
node dev/preview/tools/build-fixtures.mjs                       # regenerate products/collections from media/processed/manifest.json
```

- Liquid, JSON templates, locales, settings and fixtures are re-read per request; changes to `dev/preview/lib/*.mjs` need a restart.
- Only the ARCHITECTURE §8.6 tag/filter surface exists (`strictFilters`). Anything else, and `include`/`tablerow`/`increment`/`decrement`,
  renders `<span class="preview-liquid-error">Liquid error (file:line): …</span>` inline and is logged to stderr.
- Test hooks: `?preview_settings=<json>` (persists in a cookie, `reset` clears), `?preview_sections={"<key>":{…}}` (this request only),
  `POST /__preview/reset`, `GET /__preview/state`, `GET /__preview/health`.
- Form errors (newsletter/contact, login, register) answer with a 302 back to the form's page plus a one-shot `preview_flash` cookie,
  so the browser stays on a real GET route; the next GET renders `form.errors`.
- `/checkout` is a neutral notice page ("Shopify checkout would open here"); there is no fake checkout.
- Fixtures (`fixtures/*.json`) are sample data derived only from the supplied assets; prices, sizes, inventory and dates are placeholders.
