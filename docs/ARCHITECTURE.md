# STEADFAST: Theme Architecture (engineering contract)

> Status: **v1.2** (v1.1 = independent design review applied and reconciled with `DESIGN.md` v2 and `FILM-STORYBOARD.md` v2; the change log is §13, the points not applied as worded are §14. v1.2 = fix-pass rulings §15.10–§15.14: compressed, HTTP/2-aware budgets §6.1, brotli size caps §4.1, `payment_button` §8.6, harness and test-plan updates §8–§9). Written by the Shopify architect.
> **Precedence.** `docs/BRIEF.md` > `docs/CONTEXT.md` > the two specialist docs, which split authority by subject (the same sentence appears in DESIGN.md):
> - **`docs/DESIGN.md` wins on every visual and motion value**: colour values, type, sizes, spacing values, ratios, crops, grades, easing, durations, choreography, what may animate, and default copy.
> - **This file wins on ownership, names and mechanics**: file ownership, file and asset names, setting IDs, CSS custom property *names*, Liquid/JS APIs, events, the allowed Liquid surface, the harness and the tests.
> - DESIGN §13 gives a value to every custom property named in §3.4. Where this file quotes a DESIGN value, the quote is for convenience; if they differ, DESIGN's value is used and this file is corrected.
> Four build agents (CORE, HOME, COMMERCE, MEDIA) and one harness agent (HARNESS) implement **exactly** this contract in parallel.
> If something here is impossible, implement the closest compliant thing, then record it under "Open issues" in your final message. Do not silently diverge.
> The words MUST, MUST NOT, SHOULD and MAY carry their RFC 2119 meanings.

---

## 0. Ground rules for every build agent

1. **Online Store 2.0 only.** Liquid, JSON templates, sections, section blocks, section groups and `config/settings_*.json`. Vanilla JS uses custom elements. There is **no build step, no framework and no npm runtime dependency** in `theme/`. **Theme blocks (`theme/blocks/`) are not used** in v1, so the folder does not exist.
2. **One owner per file** (§1). Only edit files you own. Change another owner's file only through a contract stated here. If you need something that isn't here, put it in your final message as an open issue and add a minimal local workaround in **your own** files.
3. **Prefix everything** with `sf-`: file names, CSS classes, custom properties, custom elements, `data-sf-*` hooks, locale namespaces and sessionStorage keys. Vendored GSAP files are the only exception.
4. **Data honesty** (BRIEF §4–§7, CONTEXT decision 6). The theme ships **no** product data, prices, reviews, ratings, scarcity, inventory counts, fabric compositions, construction terms (embroidered, appliqué, embossed, reflective, crystal…; DESIGN anti-pattern 8), delivery times or brand history. Wherever information is missing, use restrained, editable placeholder copy, for example "Shipping details to be confirmed." The UI MUST NOT display `variant.inventory_quantity`. Nothing calls the hero edit a "campaign film" or says it was "shot by" / "directed by" anyone.
5. **Vocabulary.** The purchase verb is **"Add to cart"** and the container is **"Cart"**, everywhere (BRIEF §4B, §5; DESIGN §6.2, §7.7): buttons, locale keys, live-region messages, aria labels, tests. The word "bag" appears only as the internal icon name `bag`, never in visible or announced text.
6. **Allowed Liquid** is limited to the filter, tag and object list in §8.6. The preview harness runs with `strictFilters: true`, so an unknown filter breaks the preview. If you need another filter or object, propose it in your final message as an open issue and do not use it yet.
7. **Schema labels are plain English strings** (not `t:` keys). Each section `name` has at most 25 characters. Storefront strings MUST use `| t` (§1.4, locale fragments).
8. Write `{%- doc -%}` headers on **every snippet** (params with types, plus an example). The harness treats `doc` as a no-op tag.
9. **No `{% include %}`, no `img_url`, no `asset_img_url`, no `{% stylesheet %}` / `{% javascript %}`** in our files. We use files in `assets/`.
10. Hardcoded routes are forbidden. Use `routes.*` (theme-check `HardcodedRoutes`). Exceptions: `routes.cart_add_url | append: '.js'` style suffixing inside JS config, and in-page anchors such as `#campaign` / `#newsletter`.
11. Every `<img>` MUST have `width` and `height` (or sit inside a container with a CSS `aspect-ratio`), an `alt`, and an explicit `loading` value.
12. Validation gates before you report done:
    - `npx @shopify/cli theme check --path theme` reports **0 errors** for your files.
    - The preview harness renders your routes with no Liquid errors and no "translation missing".
    - The browser console shows no errors.

---

## 1. File tree and ownership

Owners:
- **CORE**: platform, global UI and shared primitives.
- **HOME**: homepage sections A–G.
- **COMMERCE**: all shopping, customer and content templates.
- **MEDIA**: binary media only.
- **HARNESS**: preview server and tests (outside `theme/`).
- **ORCH**: the orchestrator.

All of `theme/assets/` is flat, because Shopify does not allow sub-folders in `assets/`.

### 1.1 `theme/`

```
theme/
├── .theme-check.yml                          CORE   (extends recommended; documents any disabled checks with a reason)
├── layout/
│   ├── theme.liquid                          CORE
│   └── password.liquid                       CORE
├── config/
│   ├── settings_schema.json                  CORE
│   └── settings_data.json                    CORE   ("current" object form, §2.2)
├── locales/
│   └── en.default.json                       CORE   (GENERATED by tools/locales/merge-locales.mjs from dev/locales/*.json; §1.4)
├── sections/
│   ├── header-group.json                     CORE
│   ├── footer-group.json                     CORE   (contains sf-newsletter [HOME type] + sf-footer)
│   ├── sf-announcement.liquid                CORE
│   ├── sf-header.liquid                      CORE
│   ├── sf-footer.liquid                      CORE
│   ├── sf-apps.liquid                        CORE   (@app blocks)
│   ├── sf-custom-liquid.liquid               CORE
│   ├── sf-hero-film.liquid                   HOME   (A)
│   ├── sf-featured-collection.liquid         HOME   (B)
│   ├── sf-signature-showcase.liquid          HOME   (C)
│   ├── sf-campaign-editorial.liquid          HOME   (D)
│   ├── sf-category-grid.liquid               HOME   (E)
│   ├── sf-brand-story.liquid                 HOME   (F)
│   ├── sf-newsletter.liquid                  HOME   (G; placed in footer-group so it appears site-wide)
│   ├── sf-main-product.liquid                COMMERCE
│   ├── sf-related-products.liquid            COMMERCE
│   ├── sf-quick-view.liquid                  COMMERCE (rendered only via Section Rendering API)
│   ├── sf-main-collection.liquid             COMMERCE (banner + facets + grid + pagination)
│   ├── sf-main-list-collections.liquid       COMMERCE
│   ├── sf-main-search.liquid                 COMMERCE
│   ├── sf-predictive-search.liquid           COMMERCE (rendered only via /search/suggest)
│   ├── sf-cart-drawer.liquid                 COMMERCE (static section, rendered in layout)
│   ├── sf-main-cart.liquid                   COMMERCE
│   ├── sf-main-page.liquid                   COMMERCE
│   ├── sf-contact-form.liquid                COMMERCE
│   ├── sf-main-404.liquid                    COMMERCE
│   ├── sf-main-blog.liquid                   COMMERCE
│   ├── sf-main-article.liquid                COMMERCE
│   ├── sf-main-password.liquid               COMMERCE
│   ├── sf-main-login.liquid                  COMMERCE
│   ├── sf-main-register.liquid               COMMERCE
│   ├── sf-main-account.liquid                COMMERCE
│   ├── sf-main-order.liquid                  COMMERCE
│   ├── sf-main-addresses.liquid              COMMERCE
│   ├── sf-main-activate-account.liquid       COMMERCE
│   └── sf-main-reset-password.liquid         COMMERCE
├── templates/
│   ├── index.json                            HOME
│   ├── product.json                          COMMERCE
│   ├── collection.json                       COMMERCE
│   ├── list-collections.json                 COMMERCE
│   ├── search.json                           COMMERCE
│   ├── cart.json                             COMMERCE
│   ├── page.json                             COMMERCE
│   ├── page.contact.json                     COMMERCE
│   ├── blog.json                             COMMERCE
│   ├── article.json                          COMMERCE
│   ├── 404.json                              COMMERCE
│   ├── password.json                         COMMERCE ("layout": "password")
│   ├── gift_card.liquid                      COMMERCE ({% layout none %})
│   └── customers/
│       ├── login.json                        COMMERCE
│       ├── register.json                     COMMERCE
│       ├── account.json                      COMMERCE
│       ├── order.json                        COMMERCE
│       ├── addresses.json                    COMMERCE
│       ├── activate_account.json             COMMERCE
│       └── reset_password.json               COMMERCE
├── snippets/
│   ├── sf-head-boot.liquid                   CORE   inline <script> run first in <head> (§4.3)
│   ├── sf-css-tokens.liquid                  CORE   inline <style>: @layer order, @font-face, :root tokens from settings
│   ├── sf-config-script.liquid               CORE   inline window.Steadfast config (routes, strings, assets, settings)
│   ├── sf-meta-tags.liquid                   CORE   OG/Twitter/meta
│   ├── sf-structured-data-org.liquid         CORE   Organization JSON-LD (name, url, logo, sameAs from social settings)
│   ├── sf-live-regions.liquid                CORE   #sf-live-polite / #sf-live-assertive
│   ├── sf-icon.liquid                        CORE   inline SVG icon set (§1.3)
│   ├── sf-logo.liquid                        CORE   wordmark (flat SVG / textured raster / merchant upload)
│   ├── sf-image.liquid                       CORE   responsive image: Shopify image OR bundled asset fallback (§1.3, §10)
│   ├── sf-button.liquid                      CORE   link/button with sf-btn classes
│   ├── sf-section-heading.liquid             CORE   eyebrow + heading + optional link
│   ├── sf-price.liquid                       CORE
│   ├── sf-product-card.liquid                CORE
│   ├── sf-product-card-placeholder.liquid    CORE   honest no-product card (asset image, no price, no buy)
│   ├── sf-quick-add.liquid                   CORE   quick view / inline size cells / quick add (contract §4.6)
│   ├── sf-colorways.liquid                   CORE   card swatches (max 4 + N; buttons or links)
│   ├── sf-nav-desktop.liquid                 CORE
│   ├── sf-menu-drawer.liquid                 CORE   mobile navigation (fullscreen dialog repeating the header row, §4.2)
│   ├── sf-localization-form.liquid           CORE   country/currency (+ optional language)
│   ├── sf-newsletter-form.liquid             CORE   {% form 'customer' %} used by sf-newsletter + sf-main-password
│   ├── sf-social-links.liquid                CORE
│   ├── sf-motion-toggle.liquid               CORE   visitor "Reduce motion" switch
│   ├── sf-asset-data.liquid                  MEDIA  GENERATED from media/processed/manifest.json by tools/media/gen_asset_snippet.py (§10.3)
│   ├── sf-hero-film-sources.liquid           HOME   resolves intro / loop / end-still / campaign-film sources (§5.1)
│   ├── sf-product-gallery.liquid             COMMERCE
│   ├── sf-product-media.liquid               COMMERCE (image | video | external_video | model)
│   ├── sf-variant-picker.liquid              COMMERCE
│   ├── sf-product-form.liquid                COMMERCE (quantity + buy buttons + errors)
│   ├── sf-quantity-input.liquid              COMMERCE
│   ├── sf-product-json.liquid                COMMERCE (variant data <script type="application/json">)
│   ├── sf-size-guide.liquid                  COMMERCE
│   ├── sf-facets.liquid                      COMMERCE (also used by sf-main-search)
│   ├── sf-facet-price.liquid                 COMMERCE
│   ├── sf-active-facets.liquid               COMMERCE
│   ├── sf-sort.liquid                        COMMERCE
│   ├── sf-pagination.liquid                  COMMERCE
│   ├── sf-cart-line.liquid                   COMMERCE
│   ├── sf-cart-totals.liquid                 COMMERCE
│   ├── sf-cart-empty.liquid                  COMMERCE
│   ├── sf-quick-view-shell.liquid            COMMERCE (empty <dialog>, rendered by layout)
│   ├── sf-search-overlay.liquid              COMMERCE (search dialog, rendered by layout)
│   ├── sf-article-card.liquid                COMMERCE
│   ├── sf-address-form.liquid                COMMERCE
│   └── sf-account-nav.liquid                 COMMERCE
└── assets/
    ├── sf-base.css                           CORE   (render-blocking; reset/tokens use/typography/layout/buttons/forms/drawer+dialog base/utilities/reveal)
    ├── sf-header.css                         CORE   (render-blocking; header, mega menu, fullscreen mobile menu, announcement)
    ├── sf-product-card.css                   CORE   (render-blocking; card, price, colorways, quick-add)
    ├── sf-footer.css                         CORE   (loaded by sf-footer section; footer, localization, social, motion toggle)
    ├── sf-core.js                            CORE
    ├── sf-dialog-history.js                  CORE   (on demand, coarse pointer only: Back closes the top dialog; loaded via S.assets.dialogHistory, ruling §15.14)
    ├── sf-header.js                          CORE
    ├── sf-product-card.js                    CORE
    ├── gsap.min.js                           CORE   (vendored, gsap@3.15.x dist, unmodified, licence header kept)
    ├── ScrollTrigger.min.js                  CORE   (vendored, same version)
    ├── sf-hero-film.css                      HOME
    ├── sf-hero-film.js                       HOME
    ├── sf-featured-collection.css            HOME
    ├── sf-featured-collection.js             HOME
    ├── sf-signature-showcase.css             HOME
    ├── sf-signature-showcase.js              HOME
    ├── sf-campaign-editorial.css             HOME
    ├── sf-campaign-editorial.js              HOME
    ├── sf-category-grid.css                  HOME
    ├── sf-category-grid.js                   HOME   (<sf-category-index>: active stage on hover/focus)
    ├── sf-brand-story.css                    HOME
    ├── sf-brand-story.js                     HOME
    ├── sf-newsletter.css                     HOME
    ├── sf-product.css                        COMMERCE (product page + quick view product body + related)
    ├── sf-product.js                         COMMERCE
    ├── sf-collection.css                     COMMERCE (collection, list-collections, facets, sort, pagination)
    ├── sf-facets.js                          COMMERCE (<sf-facets>, <sf-grid-density>; loaded by sf-main-collection and sf-main-search)
    ├── sf-search.css                         COMMERCE (search page + search overlay + predictive results)
    ├── sf-predictive-search.js               COMMERCE
    ├── sf-cart.css                           COMMERCE (drawer + cart page)
    ├── sf-cart.js                            COMMERCE (Steadfast.cart API + <sf-cart-drawer> + <sf-quantity-input> + cart page elements)
    ├── sf-quick-view.css                     COMMERCE
    ├── sf-quick-view.js                      COMMERCE
    ├── sf-customer.css                       COMMERCE
    ├── sf-customer.js                        COMMERCE
    ├── sf-content.css                        COMMERCE (page, contact, 404, blog, article, password)
    ├── sf-gift-card.css                      COMMERCE
    └── [MEDIA files, exact names in §10.1]   MEDIA
```

### 1.2 Outside `theme/`

```
dev/
├── package.json, package-lock.json           HARNESS (devDeps: liquidjs@10.30.1 exact, @playwright/test@1.63.0 exact, @axe-core/playwright exact)
├── locales/core.json                         CORE      (locale fragment, namespaces in §1.4)
├── locales/home.json                         HOME
├── locales/commerce.json                     COMMERCE
├── preview/**                                HARNESS   (server, lib, fixtures; §8)
└── tests/**                                  HARNESS   (Playwright; §9)
tools/
├── locales/merge-locales.mjs                 CORE
└── media/**                                  MEDIA     (python/ffmpeg scripts, idempotent; incl. gen_asset_snippet.py + asset_alts.json §10.3; grade.sh = grade of record)
media/processed/**                            MEDIA     (+ manifest.json, §10.2)
docs/ARCHITECTURE.md                          architect; DESIGN.md (creative director); FILM-STORYBOARD.md (MEDIA); others ORCH
```

### 1.3 Shared snippet contracts (CORE implements; HOME/COMMERCE consume)

Every param not marked `[optional]` is required. The `{% doc %}` header in each file MUST match this table.

| Snippet | Params | Output contract |
|---|---|---|
| `sf-icon` | `name` (string), `size` [optional, px, default 20], `class` [optional] | `<svg class="sf-icon sf-icon--{name} {class}" aria-hidden="true" focusable="false" width height viewBox="0 0 24 24">`, `fill="none"`, `stroke="currentColor"`, **stroke-width 1.5 (grid units)**, `stroke-linecap="square"`, `stroke-linejoin="miter"` (DESIGN §6.1). Names: `account bag search close menu arrow-right arrow-left chevron-down chevron-left chevron-right plus minus play pause zoom filter instagram tiktok youtube x facebook check error info globe ruler`. Unknown name → nothing. |
| `sf-logo` | `variant` (`'flat'`\|`'textured'`\|`'lockup'`), `width` (px number = **CSS width of the asset box**, DESIGN §3.4), `class` [optional], `loading` [optional, default `lazy`], `fetchpriority` [optional], `alt` [optional, default `shop.name`] | If `settings.logo != blank`, renders the merchant logo via `image_url`/`image_tag` (widths `width`×1, ×2, ×3). Otherwise: **`flat`** inlines `{{ 'sf-logo-wordmark.svg' \| inline_asset_content }}` (viewBox 1115×154, **7.24:1**, letters only) in `<span class="sf-logo sf-logo--flat" role="img" aria-label="{alt}" style="--sf-logo-w:{width}px">`, SVG `fill="currentColor"`. **`textured`** renders a `<picture class="sf-logo sf-logo--textured">` from the `sf-logo-textured` record of `sf-asset-data` (§10.3; webp widths + the png fallback), `width`/`height` from that record (1210×411 native box, **2.944:1**, streaks included; letters at x 4.50–96.65 %, y 32.48–69.95 %). **`lockup`** (Section F) is one element that is the textured raster below 990 px and DESIGN §3.4's layered lockup at ≥ 990 px: a wrapper with `aspect-ratio: 1210 / 411` holding a `<picture>` whose `<source media="(min-width: 990px)">` is the streak-only raster `sf-logo-streaks` and whose `<img>` is the textured raster, plus the inline SVG letters absolutely positioned at `left: 4.5%; top: 32.48%; width: 92.15%; height: 37.47%` and shown only at ≥ 990 px. Renders never exceed DESIGN §3.4's resolution caps (plain raster ≤ 900 CSS px). Callers below 200 px rendered width MUST use `flat`. It never renders the shop name as typed text in place of the logo. |
| `sf-image` | **either** `image` (Shopify image/media object) **or** `asset` (a bundled base name, §10.1); `sizes` (string); `class` [optional]; `alt` [optional, default `image.alt` / the asset's default alt]; `loading` [optional, default `lazy`]; `fetchpriority` [optional]; `widths` [optional CSV for Shopify images, default `360,540,720,960,1200,1440,1800,2200`]; `crop` [optional `'center'`, used with `ratio`]; `ratio` [optional decimal w/h to crop Shopify images] | Shopify image: `{{ image \| image_url: width: maxW \| image_tag: widths: widths, sizes: sizes, loading: loading, fetchpriority: fetchpriority, class: 'sf-img ' \| append: class, alt: alt }}`, where maxW = min(image.width, the last width). If `image` is blank, falls back to `asset`. Asset: CORE reads the record with `{%- capture _rec -%}{% render 'sf-asset-data', asset: asset %}{%- endcapture -%}` and splits it on `\|` into `webp_widths, fallback_width, fallback_ext, width, height, alt` (§10.3), then outputs `<picture class="sf-img-picture"><source type="image/webp" srcset="{each w: 'name-w.webp' \| asset_url} {w}w" sizes><img class="sf-img {class}" src="{{ 'name-FW.ext' \| asset_url }}" width height alt loading decoding="async" fetchpriority></picture>`. **CORE never hand-copies widths or sizes**: `sf-asset-data` is generated from `media/processed/manifest.json`. If both are blank or the asset is unknown, renders `placeholder_svg_tag: 'sf-placeholder'`. |
| `sf-button` | `label`, `url` [optional; if blank → `<button>`], `style` (`primary`\|`secondary`\|`text`\|`icon`), `size` [optional `sm`\|`md`\|`lg`], `icon` [optional icon name; never inside `primary`], `attrs` [optional raw attribute string], `type` [optional, default `button`] | `<a class="sf-btn sf-btn--{style} sf-btn--{size}">` or `<button>`. Label inside `<span class="sf-btn__label">`. The four styles are DESIGN §6.2's Primary, Secondary, Text link-button and Icon button. |
| `sf-section-heading` | `eyebrow` [optional], `heading`, `level` [optional, default 2], `id` [optional, for aria-labelledby], `align` [optional `start`\|`center`], `link_label` [optional], `link_url` [optional], `count` [optional number → `general.pieces`], `visually_hidden` [optional bool] | `<div class="sf-heading sf-heading--{align}">[<p class="sf-eyebrow">…</p>]<h{level} id class="sf-heading__title">…</h{level}>[count][link]</div>`. The eyebrow renders only when filled (DESIGN anti-pattern 6). `visually_hidden` renders only the heading, with `.sf-visually-hidden`. |
| `sf-price` | `product`, `variant` [optional, default `product.selected_or_first_available_variant`], `show_from` [optional bool, default false], `class` [optional] | `<div class="sf-price {modifiers}" data-sf-price>`. Modifiers: `sf-price--sale` (compare_at > price), `sf-price--sold-out`. Inside: `<span class="sf-visually-hidden">{{ 'price.regular' \| t }}</span>`, optional `<s class="sf-price__compare">`, and `<span class="sf-price__current">` showing `'price.from' \| t: price: …` when `show_from` and `product.price_varies`. It uses the `money` filter only, with tabular figures. **Never** renders a percentage or "save X" badge. |
| `sf-product-card` | `product` (or blank), `placeholder_index` [optional int, used when product blank], `sizes` [optional, default `(min-width: 990px) 24vw, (min-width: 750px) 45vw, 78vw`], `loading` [optional, default lazy], `fetchpriority` [optional], `heading_level` [optional, default 3], `show_actions` [optional bool, default true] | See markup contract §4.6. If `product` is blank it renders `sf-product-card-placeholder`. |
| `sf-product-card-placeholder` | `index` (1–5), `heading_level` [optional] | One bundled 4:5 still per index: 1 `sf-signature-front`, 2 `sf-lookbook-reflective-front`, 3 `sf-category-tracksuits`, 4 `sf-lookbook-embossed-hoodie`, 5 `sf-lookbook-black-tracksuit`, with a garment description title (e.g. "Zip hoodie, washed blue-grey"). **No price, no buttons, no link.** In design mode only, it adds a small "Add products in the theme editor" hint. |
| `sf-quick-add` | `product` | Contract §4.6 (inline size cells, single add, or quick view with `intent: 'add'`). |
| `sf-colorways` | `product`, `max` [optional, default 4] | Finds the option whose name downcased is in `color,colour,colorway,colourway`. `<ul class="sf-colorways" role="list" aria-label="{{ 'product_card.colorways' \| t: count: n }}">`. Per value (≤ `max`, then a `+N` item): if `value.variant.featured_media` exists, `<button type="button" class="sf-swatch" data-sf-swatch data-src data-srcset aria-label="{value}" aria-pressed="false" style="--sf-swatch:{value.swatch.color}">` (swaps the card image, §4.6); otherwise `<a class="sf-swatch" href="{{ value.variant.url }}" aria-label="{value}">`. Fill from `value.swatch.color`, else CORE's colour-name map (DESIGN §6.6). Renders nothing if there is no colour option. |
| `sf-localization-form` | `id_suffix` (string, unique per page), `show_country` [optional bool, default `settings.show_currency_selector`], `show_language` [optional bool, default `settings.show_language_selector`], `class` [optional] | `{% form 'localization', id: 'sf-localization-' \| append: id_suffix, class: 'sf-localization' %}`, with a native `<select name="country_code">` that **auto-submits on change via JS** and also has a visible submit `<button>` inside `<noscript>`. Renders only when `localization.available_countries.size > 1` (or languages > 1). Option label: `{{ country.name }} ({{ country.currency.iso_code }} {{ country.currency.symbol }})`. |
| `sf-newsletter-form` | `id_suffix`, `button_label` [optional], `placeholder` [optional], `show_consent` [optional bool, default true] | `{% form 'customer', id: 'sf-newsletter-' \| append: id_suffix, class: 'sf-newsletter-form' %}` with `<input type="hidden" name="contact[tags]" value="newsletter">`, a labelled email input `name="contact[email]"` (`autocomplete="email"`, `required`), and a submit button. On `form.posted_successfully?` the fields are **replaced** by `<p class="sf-newsletter-form__success" role="status" tabindex="-1">{{ settings.newsletter_success }}</p>` ("You're subscribed."), which `sf-core.js` focuses after the redirect (DESIGN §7.10). Errors (`form.errors \| default_errors`) render inline under the field with `aria-describedby`. The consent text is `settings.newsletter_consent` (richtext). |
| `sf-social-links` | `class` [optional] | `<ul class="sf-social" role="list">` listing only non-blank `settings.social_*_link`, each `<a href target="_blank" rel="noopener">` with `sf-icon` and visually-hidden name and the "opens in new window" text. |
| `sf-motion-toggle` | none | `<button class="sf-motion-toggle" data-sf-motion-toggle aria-pressed="{true if reduced}">{{ 'motion.reduce' \| t }}</button>`. Rendered by the footer only if `settings.show_motion_toggle`. |

### 1.4 Locales (single file, three fragments)

`theme/locales/en.default.json` is **generated**. Each owner writes only its fragment in `dev/locales/<owner>.json` and only the top-level namespaces it owns:

| Fragment | Top-level namespaces owned |
|---|---|
| `core.json` | `general`, `accessibility`, `header`, `menu`, `footer`, `newsletter`, `localization`, `price`, `product_card`, `quick_add`, `motion`, `social` |
| `home.json` | `home` |
| `commerce.json` | `products`, `collections`, `facets`, `search`, `cart`, `quick_view`, `customer`, `contact`, `blogs`, `pages`, `templates`, `password`, `gift_card` |

`node tools/locales/merge-locales.mjs` (CORE) deep-merges the three fragments into `theme/locales/en.default.json`, writing keys in sorted order with 2-space JSON. It **exits 1** if a namespace appears in two fragments, if a fragment uses a namespace it doesn't own, or if **any value matches `/\bbag\b/i`** (vocabulary rule §0.5). CORE runs it before handing off, and ORCH re-runs it at integration. Plural keys use `one`/`other`. Keys that output HTML end in `_html`.

Visible copy follows DESIGN's strings exactly. Uppercase labels are stored in sentence case and uppercased by CSS (the `--sf-text-xs` / `--sf-text-2xs` label roles, DESIGN §3.3), so screen readers don't spell them out.

Cross-owner keys (CORE MUST provide them; others MAY use them):

| Key | English value |
|---|---|
| `general.close` / `general.open` / `general.loading` / `general.error` / `general.view_all` / `general.previous` / `general.next` / `general.continue_shopping` | Close / Open / Loading / Something went wrong. Try again. / View all / Previous / Next / Continue shopping |
| `general.placeholder_info` | To be confirmed |
| `general.pieces.one` / `.other` | `{{ count }} piece` / `{{ count }} pieces` (DESIGN "24 PIECES") |
| `accessibility.skip_to_content`, `accessibility.opens_new_window`, `accessibility.close_dialog`, `accessibility.loading` | Skip to content, Opens in a new window, Close, Loading |
| `header.search` / `header.account` / `header.cart` / `header.menu` / `header.menu_open` / `header.menu_close` / `header.home_label` | Search / Account / Cart / Menu (menu dialog label, A11Y-11) / Open menu / Close menu / `{{ shop }} home` (desktop actions read `SEARCH`, `ACCOUNT`, `CART (n)` via CSS uppercase) |
| `price.regular`, `price.sale`, `price.from` (`From {{ price }}`), `price.sold_out`, `price.unavailable` | |
| `product_card.quick_view` | Quick view |
| `product_card.add_to_cart` | Add to cart |
| `product_card.add_size_to_cart` | `Add size {{ size }} to cart` (aria-label of a size cell) |
| `product_card.choose_size` | Choose a size (group label of the size cells) |
| `product_card.choose_options` | Choose options |
| `product_card.new` | New (badge; only from the merchant tag `new`) |
| `product_card.sold_out` | Sold out |
| `product_card.colorways.one/other` | `{{ count }} colour` / `{{ count }} colours` |
| `newsletter.email_label` / `newsletter.subscribe` / `newsletter.error_email` | Email / Subscribe / Enter a valid email address. |
| `quick_add.added` | `{{ title }} added to cart` |
| `motion.reduce`, `motion.reduced_on` | Reduce motion / Reduced motion on |

COMMERCE MUST provide these keys, because `sf-config-script` (CORE) reads them:

| Key | English value (DESIGN §6.2, §7.7–§7.9) |
|---|---|
| `cart.title` | Cart |
| `cart.empty` | Your cart is empty. |
| `cart.error` | The cart couldn't be updated. Try again. |
| `cart.quantity_error_html` | `You can only add {{ quantity }} of this item to your cart.` |
| `cart.item_added` | `{{ title }} added to cart` |
| `cart.item_removed` | `{{ title }} removed from cart` |
| `cart.count.one/other` | `{{ count }} item` / `{{ count }} items` |
| `products.add_to_cart` | Add to cart |
| `products.adding` | Adding… |
| `products.sold_out` | Sold out |
| `products.unavailable` | Unavailable |
| `products.value_unavailable` | `{{ value }} - Unavailable` |
| `products.size_guide` | Size guide |
| `products.tax_included` / `products.tax_at_checkout` | Tax included. / Taxes calculated at checkout. |
| `quick_view.title` | Quick view |
| `quick_view.full_details` | View full details |
| `search.no_results_html` | `No results for “{{ terms }}”.` |
| `collections.empty_filtered` | No pieces match these filters. |

### 1.5 DESIGN coverage matrix (every DESIGN component has a file, an owner, a schema and a JS/CSS home)

| DESIGN § | Component | Liquid (owner) | Schema / settings | CSS | JS |
|---|---|---|---|---|---|
| §2, §3, §4, §8.1 | Tokens, fonts, type roles, layout, motion tokens | `sf-css-tokens` (CORE) | §2.1, §3.4 (names) + DESIGN §13 (values) | inline + `sf-base.css` (`.sf-tone-*`, type roles) | — |
| §3.4 | Logo (flat SVG / textured / layered lockup) | `sf-logo` (CORE) + `sf-asset-data` (MEDIA) | `logo`, `logo_width_*`, hero `logo_width` | `sf-base.css` | — |
| §6.1 | Icons | `sf-icon` (CORE) | — | `sf-base.css` | — |
| §6.2–§6.4, §6.7 | Buttons, links, forms, focus, quantity stepper | `sf-button`, `sf-quantity-input` (COMMERCE) | — | `sf-base.css` | `<sf-quantity-input>` in `sf-cart.js` (COMMERCE; loaded on every page) |
| §6.5–§6.6 | Badges, swatches | `sf-product-card`, `sf-colorways` (CORE); `sf-variant-picker` (COMMERCE) | `card_show_colorways` | `sf-product-card.css`, `sf-product.css` | `sf-product-card.js`, `sf-product.js` |
| §7.1 | Header (transparent / solid / hidden) | `sf-header` section (CORE) | §2.4 sf-header | `sf-header.css` | `sf-header.js` `<sf-header>` |
| §7.2 | Mega menu | `sf-nav-desktop` (CORE) | `menu`, `mega_secondary_menu`, `menu_promo` blocks | `sf-header.css` | `sf-header.js` |
| §7.3 | Mobile menu | `sf-menu-drawer` (CORE) | `menu`, localization settings | `sf-header.css` | `sf-header.js` `<sf-menu-drawer>` inside a fullscreen `<sf-dialog>` |
| §7.4 | Search overlay + predictive results; results page | `sf-search-overlay`, `sf-predictive-search`, `sf-main-search` (COMMERCE) | `predictive_search_*`, §2.4 | `sf-search.css`, `sf-collection.css` | `sf-predictive-search.js`, `sf-facets.js` |
| §7.5 | Product card, size cells / quick add, quick view, swatches | `sf-product-card`, `sf-quick-add`, `sf-colorways` (CORE) | `card_*` | `sf-product-card.css` | `sf-product-card.js` (behaviour), `Steadfast.cart` |
| §7.6 | Quick view (dialog / mobile sheet) | `sf-quick-view-shell`, `sf-quick-view` (COMMERCE) | — | `sf-quick-view.css` | `sf-quick-view.js` |
| §7.7 | Cart drawer; cart page | `sf-cart-drawer`, `sf-cart-line`, `sf-cart-totals`, `sf-cart-empty`, `sf-main-cart` (COMMERCE) | `cart_*` | `sf-cart.css` | `sf-cart.js` |
| §7.8 | PDP: gallery, progress bar, info column, selectors, accordions, zoom, size guide, related | `sf-main-product`, `sf-product-gallery`, `sf-product-media`, `sf-variant-picker`, `sf-product-form`, `sf-size-guide`, `sf-related-products` (COMMERCE) | §2.4 | `sf-product.css` | `sf-product.js` |
| §7.9 | Collection: header, sticky toolbar, density toggle, filter drawer, pager / load more, empty state | `sf-main-collection`, `sf-facets`, `sf-facet-price`, `sf-active-facets`, `sf-sort`, `sf-pagination` (COMMERCE) | §2.4 | `sf-collection.css` | `sf-facets.js` (`<sf-facets>`, `<sf-grid-density>`, load more) |
| §7.10, §9 G | Newsletter band | `sf-newsletter` (HOME), `sf-newsletter-form` (CORE) | §2.4 G, `newsletter_*` | `sf-newsletter.css` | `sf-core.js` (success focus) |
| §7.11 | Footer (columns, bottom bar, localization, payment icons) | `sf-footer`, `sf-localization-form`, `sf-social-links`, `sf-motion-toggle` (CORE) | §2.4 sf-footer | `sf-footer.css` | `sf-header.js` `<sf-localization>`, `sf-core.js` motion toggle |
| §8.2 | Signature devices (exposure lift, aperture, light sweep) | — | — | `sf-base.css` (`data-sf-reveal`), section CSS | `sf-core.js` reveal; HOME modules |
| §8.3 "Page transitions" | Cross-document view transition (240 ms root crossfade) | `layout/theme.liquid` (CORE) | — | `sf-base.css` (`@view-transition` inside `prefers-reduced-motion: no-preference`, level `full` only) | — |
| §8.5 | Reduced motion | `sf-head-boot` (CORE) | `motion_level`, `show_motion_toggle` | `sf-base.css` (`sf.state`) | `sf-core.js` `Steadfast.motion` |
| §9 A | Hero | `sf-hero-film`, `sf-hero-film-sources` (HOME) | §2.4 A | `sf-hero-film.css` | `sf-hero-film.js` |
| §9 B | Featured collection rail + next-drop tile | `sf-featured-collection` (HOME) | §2.4 B | `sf-featured-collection.css` | `sf-featured-collection.js` |
| §9 C, §10 | Signature showcase | `sf-signature-showcase` (HOME) | §2.4 C | `sf-signature-showcase.css` | `sf-signature-showcase.js` |
| §9 D | Campaign editorial | `sf-campaign-editorial` (HOME) | §2.4 D | `sf-campaign-editorial.css` | `sf-campaign-editorial.js` |
| §9 E | Category index | `sf-category-grid` (HOME) | §2.4 E | `sf-category-grid.css` | `sf-category-grid.js` |
| §9 F | Brand story | `sf-brand-story` (HOME) | §2.4 F | `sf-brand-story.css` | `sf-brand-story.js` |
| §5 (imagery) | Bundled stills, hero end stills | `sf-image` (CORE) + generated `sf-asset-data` (MEDIA) | img+asset settings | — | — |
| §4.3 | Z-index layers | — | — | `sf-css-tokens` (`--sf-z-*`, §3.4) | — |


---

## 2. Settings and section schemas

### 2.1 `config/settings_schema.json` (CORE)

Element 0 is `theme_info`:
- `theme_name`: "Steadfast"
- `theme_version`: "1.1.0"
- `theme_author`: "Steadfast"
- `theme_documentation_url` and `theme_support_url`: `https://help.shopify.com/manual/online-store/themes`

Then these groups, in this order. Every colour default is DESIGN §2.1 / §13's value; the setting IDs are the names DESIGN §13 maps. There are no provisional values any more.

| Group (`name`) | id | type | default / options | Notes |
|---|---|---|---|---|
| **Logo** | `logo` | image_picker | — | Overrides the bundled wordmark everywhere. |
| | `logo_width_desktop` | range 80–260 step 2 px | 148 | Header SVG box width ≥ 990 px (condensed state: 120 px, fixed). |
| | `logo_width_mobile` | range 70–180 step 2 px | 112 | |
| | `favicon` | image_picker | — | Fallback is `sf-favicon-32.png` (+ `sf-apple-touch-icon-180.png`). |
| **Colors** | `color_ink` | color | `#000000` | → `--sf-ink`. Page, hero and film field: true black, so footage blacks merge. |
| | `color_charcoal` | color | `#141619` | → `--sf-charcoal`. **Raised surfaces**: drawers, dialogs, menus, quick view. |
| | `color_graphite` | color | `#24272B` | → `--sf-graphite`. Hairlines on black; hover rows on charcoal. |
| | `color_washed_grey` | color | `#8B9096` | → `--sf-washed-grey`. Muted text, meta, inactive nav, form-control borders. |
| | `color_steel` | color | `#7C91A5` | → `--sf-steel`. Cold steel accent. |
| | `color_silver` | color | `#C3C8CD` | → `--sf-silver`. Secondary text, icons. |
| | `color_bone` | color | `#F1E9DA` | → `--sf-bone`. Primary text and the primary button. **Never a background.** |
| **Typography** | `type_scale` | range 90–115 step 5 % | 100 | Multiplies `--sf-type-scale`. |
| | (paragraph) | | "Fonts and letter case are fixed by the design system." | No font picker (CONTEXT decision 5) and **no `type_display_case` setting** (removed, §14 R1). `--sf-display-transform` is the constant `none`. |
| **Motion** | `motion_level` | select `full` "Cinematic", `subtle` "Subtle", `reduced` "Minimal" | full | `subtle` (DESIGN §8.1): no pin and no scrubbed sequences; the hero intro and loop still play. The OS `prefers-reduced-motion: reduce` **always** wins, giving `reduced`. |
| | `show_motion_toggle` | checkbox | true | A visitor toggle in the footer, persisted in localStorage `sf:motion`. |
| **Layout** | `page_width` | select `1440`\|`1600`\|`full` | 1600 | |
| | `section_spacing` | select `compact`\|`standard`\|`generous` | standard | Global vertical rhythm multiplier. |
| **Cart** | `cart_type` | select `drawer`\|`page` | drawer | |
| | `cart_show_note` | checkbox | false | |
| | `cart_note_text` | text | — (blank) | Optional merchant note under the subtotal (DESIGN §7.7). Blank by default since the v1.2 fix pass: the tax/shipping line now follows the store's tax settings (PLAT-04), so a default sentence would repeat it. |
| | `cart_empty_collection` | collection | — | Products shown on the empty cart page, up to 4. |
| **Product cards** | `card_image_ratio` | select `portrait` (3:4) \| `tall` (4:5) \| `natural` | **`tall`** | 4:5 everywhere (DESIGN §5.1). |
| | `card_show_secondary_image` | checkbox | true | Alternate-image crossfade on hover (pointer: fine only). |
| | `card_show_colorways` | checkbox | true | |
| | `card_show_quick_view` | checkbox | true | |
| | `card_show_quick_add` | checkbox | true | Inline size cells / single add (§4.6). |
| **Product information** | `size_guide_page` | page | — | Size guide drawer content. |
| | `size_guide_fallback` | richtext | `<p>Sizing information to be confirmed.</p>` | Used if no page is set. Never invented measurements. |
| | `shipping_returns_page` | page | — | |
| | `shipping_returns_fallback` | richtext | `<p>Shipping and returns details to be confirmed.</p>` | |
| **Search** | `predictive_search_enabled` | checkbox | true | |
| | `predictive_search_show_price` | checkbox | true | |
| **Social media** | `social_instagram_link`, `social_tiktok_link`, `social_youtube_link`, `social_x_link`, `social_facebook_link` | text | "" | Blank by default. Never invent handles. |
| **Currency and language** | `show_currency_selector` | checkbox | true | Country/currency selector (footer bottom bar, mobile menu). |
| | `show_language_selector` | checkbox | false | |
| **Newsletter** | `newsletter_consent` | richtext | `<p>By subscribing you agree to receive emails. Unsubscribe at any time.</p>` | |
| | `newsletter_success` | text | "You're subscribed." | Replaces the form on success (DESIGN §7.10). |

The theme reads **no metafields** (DESIGN §6.6, §7.8): swatches come from `product_option_value.swatch`, and SIZE & FIT / CARE are `collapsible` blocks with merchant page or richtext content. There are **no payment icons** (DESIGN anti-pattern 4). So `product.metafields` and `payment_type_svg_tag` stay outside the §8.6 surface.

### 2.2 `config/settings_data.json` (CORE)

Format: `{ "current": { …every setting id above with its default…, "sections": {} } }`. No presets are needed.

### 2.3 Section groups (CORE)

`sections/header-group.json`:
```json
{ "type": "header", "name": "Header group",
  "sections": {
    "announcement": { "type": "sf-announcement", "disabled": true, "settings": {}, "blocks": {}, "block_order": [] },
    "header": { "type": "sf-header", "settings": { "menu": "main-menu", "sticky_behavior": "on-scroll-up", "transparent_on_home": true } }
  },
  "order": ["announcement", "header"] }
```

`sections/footer-group.json` (DESIGN §7.11: SHOP / HELP / LEGAL / FOLLOW; LEGAL comes from `show_policies`):
```json
{ "type": "footer", "name": "Footer group",
  "sections": {
    "newsletter": { "type": "sf-newsletter", "settings": { } },
    "footer": { "type": "sf-footer", "settings": { },
      "blocks": {
        "shop":   {"type":"menu","settings":{"heading":"Shop","menu":"footer-shop"}},
        "help":   {"type":"menu","settings":{"heading":"Help","menu":"footer"}},
        "social": {"type":"social","settings":{"heading":"Follow"}} },
      "block_order": ["shop","help","social"] }
  },
  "order": ["newsletter", "footer"] }
```

### 2.4 Section schema outlines

Notation: `id: type = default [options]`. "img+asset" means an `image_picker` whose blank state falls back to a named bundled asset through `sf-image`'s `asset` param. "video+asset" means a `video` setting (Shopify-hosted, which has no default) whose blank state falls back to the bundled theme asset. Every section has a `name` of at most 25 characters and a `class` (wrapper class `sf-shopify-section--{name}`). Sections with a `tone` use **`tone: select = ink [ink, charcoal]`**, which maps to the root class `sf-tone-{tone}`. There is no `bone` tone (DESIGN anti-pattern 3), and no preset uses `charcoal` (no coloured bands, DESIGN §4.2). `spacing: select = standard [none, compact, standard, generous]`.

Common section blocks rules: `{{ block.shopify_attributes }}` on the block root, and a `limit` on singleton blocks. Defaults marked **[PLACEHOLDER]** are DESIGN §9's owner-approval copy; the tag is a doc marker and never renders. Instructions to the owner go in the setting's `info`, never in a rendered default.

#### CORE sections

**sf-announcement**: `enabled_on: {groups:["header"]}`, max_blocks 3.
- settings: `tone`, `rotate: checkbox = false`, `rotate_seconds: range 4–10 = 6`
- blocks `message`: `text: inline_richtext` (no default text), `link: url`. The section renders nothing if no block has text.
- presets: "Announcement bar" with no blocks.

**sf-header**: `enabled_on: {groups:["header"]}`. Visual spec: DESIGN §7.1–§7.3.
- settings:
  - `menu: link_list = main-menu`
  - `mega_secondary_menu: link_list` (optional; the `COLLECTIONS` column of the SHOP panel, DESIGN §7.2)
  - `sticky_behavior: select = on-scroll-up [none, always, on-scroll-up]`
  - `transparent_on_home: checkbox = true`, which overlays the hero when `template.name == 'index'` and the first index section is `sf-hero-film`
  - `show_search: checkbox = true`
  - `show_account: checkbox = true`, effective only if `shop.customer_accounts_enabled`
  - `show_localization: checkbox = false`, for a compact selector in the header at ≥990px
  - `secondary_menu: link_list` (optional; shown in the mobile menu below the hairline)
- blocks `menu_promo` (max 2): `menu_item: text` (exact title of the top-level link it attaches to), `image: image_picker` (img+asset, default asset `sf-category-hoodies`, shown in the 4:5 stage, ~420 px tall), `heading: text`, `link: url`. The image leads that link's mega stage (frame 0), which starts at col 7 directly after the index (col 9 with the secondary label column); see DESIGN §7.2.
- Header markup contract: `<header class="sf-header" data-sf-header data-sticky="{{ sticky }}" data-transparent="{{ bool }}">`, then `<sf-header>`.
  - Logo: `<a class="sf-header__logo" href="{{ routes.root_url }}" aria-label="{{ 'header.home_label' | t: shop: shop.name }}">` + `sf-logo` **flat** (inline SVG; no request). In the transparent state the logo is `opacity: 0` with its box reserved; it **fades in over `--sf-dur-base` when the header turns solid**, on every viewport (DESIGN §7.1, §8.3 A). There is **no logo dock**.
  - Desktop nav comes from `sf-nav-desktop`.
  - Actions keep this order and these attributes; **≥ 990 px they render as text labels** (`--sf-text-xs`: `SEARCH`, `ACCOUNT`, `CART (n)`), **< 990 px as 44×44 icon buttons** with `aria-label`s (DESIGN §6.1). Both contents are in the markup; CSS shows one.
    1. search: `<a href="{{ routes.search_url }}" data-sf-open="search" aria-haspopup="dialog">` (`search` icon / "Search")
    2. account: `<a href="{{ routes.account_url }}">` (desktop only; on mobile it lives in the menu)
    3. cart: `<a href="{{ routes.cart_url }}" data-sf-open="cart" aria-haspopup="dialog">` with `<sf-cart-count data-count="{{ cart.item_count }}">` ("Cart (n)" / `bag` icon + the count as `--sf-text-2xs` text, not a bubble)
    4. menu (mobile, first in visual order): `<button data-sf-open="menu" aria-expanded="false" aria-controls="sf-menu-drawer">` (two-line `menu` icon)

  When `settings.cart_type == 'page'`, the cart link has no `data-sf-open`.

**sf-footer**: `enabled_on: {groups:["footer"]}`, max_blocks 6. Visual spec: DESIGN §7.11.
- settings:
  - `tone = ink`
  - `show_localization: checkbox = true` (bottom bar)
  - `show_policies: checkbox = true`, which renders the **LEGAL** column from `shop.policies` (privacy, refund, shipping, terms, contact info). This guarantees Shipping/Returns/Privacy/Terms links even with an empty menu.
  - `copyright_text: text = ""`, where blank means `© {{ 'now' | date: '%Y' }} {{ shop.name }}`
  - `show_logo: checkbox = true`, using **`sf-logo` flat (SVG) at 148 px** (DESIGN §3.4: the SVG below 200 px)
- blocks:
  - `menu` (`heading: text`, `menu: link_list`)
  - `text` (`heading: text`, `text: richtext`)
  - `social` (`heading: text`), limit 1
  - `@app`
- Mobile: the link groups render as `<details>` accordions.
- There are **no payment icons**. The footer renders `sf-motion-toggle` if `settings.show_motion_toggle`. It loads `sf-footer.css` itself.

**sf-apps**: `blocks: [{type:"@app"}]`, `settings: include_margins: checkbox = true`, presets "Apps".

**sf-custom-liquid**: `custom_liquid: liquid`, `tone`, `spacing`, presets "Custom Liquid".

#### HOME sections

All home sections have `disabled_on: {groups:["header","footer"]}` except sf-newsletter. All have a preset and `tone` + `spacing` unless noted. Every home section root is `<section class="sf-section sf-{name} sf-tone-{tone} sf-space-{spacing}" data-sf-section="{name}" aria-labelledby="{heading id}">` and loads its own CSS with `{{ 'sf-{name}.css' | asset_url | stylesheet_tag }}` at the top of the section file. A section's JS is loaded with `<script src="{{ 'sf-{name}.js' | asset_url }}" defer></script>` from the section file. The same section may appear twice (where `limit: 2`), and the browser would then execute the script twice. So **every JS file MUST be idempotent**: wrap it in an IIFE that returns early if `window.Steadfast.modules['{name}']` is set, then set that flag, and guard `customElements.define` with `customElements.get`.

Each section's look and motion are DESIGN's; the "Spec" line names the DESIGN sections its owner implements.

**A · sf-hero-film**: `limit: 1`, `enabled_on: {templates:["index","page"]}`, no blocks, no tone (always ink). Spec: DESIGN §8.3 A, §9 A; FILM-STORYBOARD A2–A8, B7. Contract: §5.

| id | type | default | Notes |
|---|---|---|---|
| `intro_enabled` | checkbox | true | Plays the intro (beats 1–7 file, then DOM beats 8–9). |
| `intro_frequency` | select | `once_per_session` [`once_per_session`, `every_visit`] | Replaces v1 `play_once_per_session`. |
| `intro_video_desktop` | video | — | video+asset `sf-film-desktop.mp4`. 16:9; must end on ≥ 0.4 s of black and be ≤ 14 s. |
| `intro_video_mobile` | video | — | video+asset `sf-film-mobile.mp4`. 9:16. Blank → the bundled mobile file (a 16:9 override is never shown on phones). |
| `loop_video_desktop` | video | — | video+asset `sf-film-loop-desktop.mp4`. Seamless loop. |
| `loop_video_mobile` | video | — | video+asset `sf-film-loop-mobile.mp4`. |
| `use_bundled_film` | checkbox | true | If false, blank video slots stay empty (end still only). |
| `end_image_desktop` | image_picker | — | img+asset `sf-film-end-desktop`: the **loop's first frame** (no logo). LCP, reduced-motion and save-data still. |
| `end_image_mobile` | image_picker | — | img+asset `sf-film-end-mobile`. |
| `campaign_film_desktop` | video | — | Optional full campaign film, **merchant upload only** (nothing bundled). |
| `campaign_film_mobile` | video | — | Blank → `campaign_film_desktop`. |
| `logo_reveal` | checkbox | true | DOM beat 8 (light-sweep reveal at `duration − 0.4 s`). Off: the wordmark appears with beat 9. |
| `show_skip` | checkbox | true | Hides only `SKIP INTRO` during the intro (scroll, keys and focus still end it). The `PAUSE` / `PLAY` control for the loop **always** renders (WCAG 2.2.2), whatever this setting. |
| `show_logo` | checkbox | true | Textured wordmark inside the homepage `<h1>`. Off: the `<h1>` holds a visually hidden `shop.name`. |
| `logo_width` | range 240–640 step 10 px | 640 | Desktop **box** width cap: `min(44vw, {logo_width}px)`; mobile `min(84vw, {logo_width}px)` (DESIGN §3.4). |
| `eyebrow` | text | blank | Optional label above the campaign line; renders only when `subheading` is set (revision round 1). |
| `subheading` | text | "The figure stays. The light moves." | **[PLACEHOLDER]** Every layout except short landscape phones (revision round 1: also on mobile). |
| `cta_primary_label` | text | "Explore collection" | Rendered uppercase via CSS. |
| `cta_primary_link` | url | — | Blank means `routes.all_products_collection_url`. |
| `cta_secondary_label` | text | "View the campaign" | Text link-button. |
| `cta_secondary_action` | select | **`link`** [`link` "Go to link", `film` "Open the campaign film", `replay` "Replay the intro"] | `film` falls back to `link` when no campaign film is set. |
| `cta_secondary_link` | url | — | Blank means `#campaign` (Section D). |

Removed from v1: `content_delay` (the intro timeline decides when content appears, §5.3), `play_once_per_session`, `video_desktop`/`video_mobile` (split into intro/loop slots), `overlay_opacity` and `height` (DESIGN fixes the scrims and `100svh`, min 560 px). Preset "Hero film".

**B · sf-featured-collection**: `limit: 2`. Spec: DESIGN §7.5, §8.3 B, §9 B.

| id | type | default |
|---|---|---|
| `eyebrow` | text | "" |
| `heading` | text | "The collection" |
| `collection` | collection | — (index.json sets `"all"`) |
| `products_to_show` | range 4–16 step 1 | 8 |
| `layout` | select | `rail` [`rail` horizontal scroll-snap, `grid`] |
| `columns_desktop` | range 3–5 | 4 |
| `show_count` | checkbox | true (`N PIECES`) |
| `show_view_all` | checkbox | true |
| `view_all_label` | text | "View all" |

- blocks `drop_teaser` (max 1, last in the rail): `image: image_picker` (optional; **blank renders DESIGN's typographic tile**: raised surface, flat wordmark at 40% width / 30% opacity), `label: text = "Next drop"`, `text: text = "Details to be announced."`, `link_label: text = "Get notified"`, `link: url` (blank → `#newsletter`). No price, no buy button, no date.
- If the collection is blank or empty, it renders 5 `sf-product-card-placeholder` items.
- Preset "Featured collection".

**C · sf-signature-showcase**: `limit: 1`. Spec: DESIGN §8.3 C and §10 (stage, keyframes, rects, zoom maths).

| id | type | default |
|---|---|---|
| `product` | product | — (price + CTA link when set). `index.json` binds `"zip-hoodie-washed-blue-grey"`; a store without that handle resolves it to blank. Pick the product before publishing (DEPLOYMENT). |
| `eyebrow` | text | "Signature piece" |
| `heading` | text | "The zip hoodie" (blank → `product.title`) |
| `image_hero` | image_picker | img+asset `sf-signature-hero` (16:9 front stage) |
| `image_hero_back` | image_picker | img+asset `sf-signature-hero-back` (16:9 back, aligned to the front; the desktop front→back crossfade) |
| `image_front` | image_picker | img+asset `sf-signature-front` (4:5, mobile / `subtle` / reduced) |
| `image_back` | image_picker | img+asset `sf-signature-back` (4:5, FRONT/BACK toggle) |
| `cta_label` | text | "Shop the zip hoodie" |
| `cta_link` | url | — (blank → `product.url`; with no product either → `routes.all_products_collection_url`, and the label becomes `home.signature.cta_fallback` "Explore the collection", so the button never names a product it does not open) |
| `pin_on_desktop` | checkbox | true |
| `scroll_length` | select | `standard` [`short` 200%, `standard` 300%] |

- blocks `detail` (max 5): `image: image_picker` (1:1 crop for the stacked layout), `asset_crop: select = zip [zip, chest-logo, shoulder, cuff-label, neck-label]` (picks `sf-signature-detail-{crop}` when `image` is blank; DESIGN §10.2 keys its rect, centre and zoom by this value, so the desktop zoom needs no extra settings), `title: text`, `text: text = ""`. Titles and text describe **only what is visible**: no construction or material words (appliqué, embroidered, embossed, crystal…).
- The preset has the **4** blocks of DESIGN §10.2, one per rect: `zip` "Zip and neck label", `chest-logo` "Distressed chest logo", `shoulder` "Shoulder embellishment", `cuff-label` "Sleeve label". `neck-label` is an optional fifth block; the produced `hem` crop is not offered (§14 R5).
- It never uses the words 360°, 3D or "rotate".

**D · sf-campaign-editorial**: `limit: 1`. Spec: DESIGN §8.3 D, §9 D. **Nothing else goes in this section**: the v1 `look` blocks are deleted.

| id | type | default |
|---|---|---|
| `anchor_id` | text | "campaign" (root `id`) |
| `image` | image_picker | img+asset `sf-campaign-back` |
| `image_mobile` | image_picker | img+asset `sf-campaign-back-portrait` |
| `eyebrow` | text | "" (the hero carries the only campaign label) |
| `heading` | text | "Under one light." (**[PLACEHOLDER]**) |
| `text` | richtext | `<p>The tracksuit in stone, seen from behind.</p>` (**[PLACEHOLDER]**; info: "Describe only what's in the photo.") |
| `link_label` | text | "" |
| `link` | url | — (the text link renders only when both are set) |
| `text_position` | select | **`middle-left`** [`middle-left` "Left, vertically centred in the void", `bottom-left`, `center`] |

- Preset "Campaign editorial", no blocks.

**E · sf-category-grid**: `limit: 2`, max_blocks 6. Spec: DESIGN §8.3 E, §9 E.

| id | type | default |
|---|---|---|
| `eyebrow` | text | "" |
| `heading` | text | "Shop by category" (in `index` layout it's a **visually hidden `h2`**; the name list is the visible heading) |
| `layout` | select | **`index`** [`index` "Index: name list and image stage", `row` "Row of tiles"] |
| `show_counts` | checkbox | true (product count per name, from `collection.products_count`) |

- `index` (DESIGN §9 E): desktop, a Spectral name list (cols 1–5, each a real link with its count) and a sticky 4:5 stage (cols 7–12) that follows hover and focus; mobile, a stack of full-width 4:5 tiles. `row` is a single row of 4:5 tiles with visible names, for merchants who want it. There is no mosaic.
- blocks `category`: `collection: collection`, `title: text` (blank → collection.title), `image: image_picker` (blank → collection.image, then asset), `asset: select [hoodies, tracksuits, tops, bottoms, new-arrivals]` (picks `sf-category-{asset}`), `link: url` (blank → collection.url, then `routes.collections_url`).
- The preset has 5 blocks: Hoodies, Tracksuits, Tops, Bottoms and New Arrivals, with the matching assets. Each `sf-category-*` still shows a different garment per DESIGN §5.6 (MEDIA regenerates Tops and New Arrivals, §10.1).

**F · sf-brand-story**: `limit: 1`. Spec: DESIGN §3.4 (lockup), §8.2 (light sweep), §8.3 F, §9 F.

| id | type | default |
|---|---|---|
| `heading` | text | "About STEADFAST" (visually hidden `h2`; the wordmark is the visible subject) |
| `logo_display` | select | `textured` [`textured` (renders `sf-logo` `lockup`), `flat`, `none`] |
| `text` | richtext | blank (no invented brand copy: the wordmark carries the section until STEADFAST supplies two or three sentences; a client input in DEPLOYMENT) |
| `link_label` | text | "" |
| `link` | url | — (hidden unless both are set) |

No background image. Copy MUST NOT state history, founding dates, locations or materials.

**G · sf-newsletter**: no group restriction, `limit: 1`. Root `id="newsletter"`. Spec: DESIGN §7.10.

| id | type | default |
|---|---|---|
| `eyebrow` | text | "" |
| `heading` | text | "New pieces, by email." |
| `text` | text | "" (hidden when blank) |
| `button_label` | text | "Subscribe" |
| `show_consent` | checkbox | true |
| `tone` | select | **ink** |

It uses `sf-newsletter-form` with `id_suffix: section.id`. It is the only newsletter instance (not repeated inside the footer). Preset "Newsletter".

#### COMMERCE sections

Main sections have no presets (they can't be added from the editor). `sf-quick-view`, `sf-predictive-search` and `sf-cart-drawer` have schema `{ "name": "…" }` and no presets.

**sf-main-product**. Spec: DESIGN §7.8.

| id | type | default |
|---|---|---|
| `gallery_layout` | select | `stacked` [`stacked` desktop 4:5 column + mobile snap rail with progress bar and counter, `carousel`] |
| `enable_zoom` | checkbox | true (full-screen viewer; `image_url` width 2400) |
| `sticky_info` | checkbox | true (`top: calc(var(--sf-header-h) + 32px)`) |
| `enable_video_loop` | checkbox | false |
| `hide_single_value_options` | checkbox | true |

blocks:
- `title` (limit 1; the page `h1`, styled per DESIGN §7.8, text as entered)
- `price` (limit 1; also renders the tax note `products.tax_at_checkout`, `--sf-text-sm` washed-grey)
- `variant_picker` (limit 1; `picker_type: select = buttons [buttons, dropdown]`; `color_as_swatches: checkbox = true`; `show_size_guide_link: checkbox = true`, which puts the `SIZE GUIDE` text link on the size label row)
- `quantity` (limit 1; not in the default template)
- `buy_buttons` (limit 1; `show_dynamic_checkout: checkbox = false`)
- `description` (limit 1)
- `collapsible` (`heading: text`, `source: select = custom [custom, description, shipping_returns]`, `content: richtext`, `page: page`). `custom` shows `page.content`, else `content`, and **renders nothing when both are blank** (DESIGN §7.8: SIZE & FIT and CARE are hidden if empty; no metafield sources). `shipping_returns` reads the global page/fallback plus `shop.policies` links.
- `text` (`text: inline_richtext`)
- `@app`

product.json block_order: title, price, variant_picker (with the size guide link), buy_buttons, collapsible "Details" (source description), collapsible "Size & fit" (custom, empty), collapsible "Shipping & returns" (source shipping_returns), collapsible "Care" (custom, empty). The two empty blocks render nothing until the merchant fills them.

**sf-related-products**: `heading: text = "You may also like"`, `products_to_show: range 2–8 = 4`, `tone`, `spacing`. Renders a rail of `sf-product-card` (same component as Section B).

**sf-main-collection**. Spec: DESIGN §7.9.
- `show_description: checkbox = true`
- `show_banner_image: checkbox = true` (21:9 desktop, 4:5 mobile)
- `products_per_page: range 8–48 step 4 = 24`
- `columns_desktop: select = 4 [2, 4]` (the default density)
- `columns_mobile: select = 2 [1, 2]`
- `show_density_toggle: checkbox = true` (DESIGN §7.9: 2/4 columns on desktop, 1/2 on mobile; persisted in localStorage `sf:grid-density`, wrapped in try/catch)
- `enable_filtering: checkbox = true` (filter drawer, left, `FILTER (n)` trigger in the sticky toolbar)
- `enable_sorting: checkbox = true`
- `pagination_type: select = pager [pager, load_more]`

**sf-main-list-collections**: `sort: select = alphabetical [alphabetical, alphabetical_reversed, products_high, products_low]`. Tiles are 4:5.

**sf-main-search**: `products_per_page: range 8–48 step 4 = 24`, `enable_filtering`, `enable_sorting`, `show_density_toggle`, `show_vendor: checkbox = false`. Same grid as the collection.

**sf-main-cart**: `show_recommendations: checkbox = false`. The cart note follows the global `cart_show_note`.

**sf-main-page**, **sf-main-404**, **sf-main-blog** (`show_image`, `posts_per_page: range 4–24 = 12`), **sf-main-article** (`show_image`, `show_date`, `show_author`), **sf-contact-form** (`heading = "Contact"`), and **sf-main-password**, which renders a textured logo, `shop.password_message`, `sf-newsletter-form`, and a `storefront_password` form inside a `<details>`.

Customer sections have no settings beyond `heading`.

### 2.5 JSON templates

- `index.json` (HOME), with order:
  1. `hero` → sf-hero-film
  2. `featured` → sf-featured-collection (`collection: "all"`)
  3. `signature` → sf-signature-showcase
  4. `campaign` → sf-campaign-editorial
  5. `categories` → sf-category-grid
  6. `story` → sf-brand-story
  (The newsletter band comes from the footer group, so it follows `story` on the homepage.)
- `product.json`: `main` (sf-main-product), `related` (sf-related-products).
- `collection.json`: `main`. `list-collections.json`: `main`. `search.json`: `main`.
- `cart.json`: `main` (sf-main-cart). `page.json`: `main`. `page.contact.json`: `main` (sf-main-page) + `form` (sf-contact-form).
- `blog.json`: `main`. `article.json`: `main`. `404.json`: `main`.
- `password.json`: `{"layout":"password","sections":{"main":{"type":"sf-main-password"}},"order":["main"]}`.
- `customers/*.json`: one `main` section of the matching sf-main-* type.
- `gift_card.liquid`: standalone HTML (`{% layout none %}`). It loads `sf-base.css` + `sf-gift-card.css` and shows `gift_card.code`, balance, expiry and a print button. A QR code via `{{ 'vendor/qrcode.js' | shopify_asset_url | script_tag }}` plus `gift_card.qr_identifier`. "Add to Apple Wallet" uses `gift_card.pass_url`.
- Pickup availability is **out of scope for v1** (documented and not implemented).

---

## 3. CSS architecture

### 3.1 Files and load strategy

| File | Owner | Loaded by | Strategy |
|---|---|---|---|
| inline `<style>` from `sf-css-tokens` | CORE | layout `<head>` | Inline, critical. Contains the `@layer` order statement, `@font-face` (URLs via `asset_url`, so they exactly match the preloads), and `:root` tokens computed from settings. Target: ≤ 4 KB. |
| `sf-base.css` | CORE | layout `<head>` | `stylesheet_tag`, render-blocking. Raw ≤ 36 KB. |
| `sf-header.css` | CORE | layout `<head>` | Render-blocking. Raw ≤ 14 KB. |
| `sf-product-card.css` | CORE | layout `<head>` | Render-blocking (cards appear on most pages). Raw ≤ 8 KB. |
| `sf-footer.css` | CORE | `sf-footer` section | `stylesheet_tag` at the top of the section. |
| `sf-{home-section}.css` | HOME | the section itself | The section emits `{{ 'sf-x.css' \| asset_url \| stylesheet_tag }}` at the top of its markup, so CSS loads **only when the section is present**. Raw ≤ 14 KB each. |
| `sf-product.css`, `sf-collection.css`, `sf-search.css`, `sf-cart.css`, `sf-quick-view.css`, `sf-customer.css`, `sf-content.css` | COMMERCE | the sections that need them | Same pattern. `sf-cart.css` is loaded by `sf-cart-drawer` (every page in drawer mode) and `sf-main-cart`. `sf-search.css` is loaded by `sf-search-overlay` with `media="print" onload="this.media='all'"` (non-blocking, because the overlay is hidden initially) and normally by `sf-main-search`. `sf-quick-view.css` and `sf-product.css` are loaded non-blocking by `sf-quick-view-shell`. |

Rules:
- CSS files are plain `.css` (no `.css.liquid`).
- Asset images referenced from CSS use **relative** URLs (`url(sf-grain.webp)`), which resolve on the same CDN folder.
- Fonts are declared **only** inline in `sf-css-tokens`.

### 3.2 Cascade layers

`sf-css-tokens` emits the order statement first:

```css
@layer sf.reset, sf.tokens, sf.base, sf.layout, sf.components, sf.sections, sf.utilities, sf.state;
```

| Layer | Who writes into it |
|---|---|
| `sf.reset`, `sf.base`, `sf.layout` | `sf-base.css` (CORE) |
| `sf.tokens` | inline tokens (CORE) |
| `sf.components` | `sf-base.css` (buttons, forms, dialog/drawer, accordion), `sf-header.css`, `sf-product-card.css`, `sf-footer.css` (CORE), and component parts of COMMERCE files (e.g. variant pills, cart lines) |
| `sf.sections` | every HOME section file and every COMMERCE page/section file. Each file wraps its whole content in `@layer sf.sections { … }` |
| `sf.utilities` | `sf-base.css` only (`.sf-visually-hidden`, `.sf-hidden`, `.sf-container`, `.sf-stack`, etc.) |
| `sf.state` | reduced-motion overrides and `[hidden]` hardening (CORE, in `sf-base.css`) |

Unlayered CSS is **forbidden** (it would beat every layer). Third-party app CSS is unlayered and will win, which is acceptable.

### 3.3 Naming

- **BEM-ish with `sf-` prefix**: block `.sf-card`, element `.sf-card__media`, modifier `.sf-card--compact`.
- Section roots: `.sf-section.sf-{section-name}`, for example `.sf-hero-film`, `.sf-main-product`. All rules in a section file are scoped under its root class.
- State classes: `.is-open`, `.is-active`, `.is-loading`, `.is-disabled`, `.is-sold-out`, `.is-visible`, `.is-revealed`, plus `[aria-expanded="true"]`, `[aria-current]` and `[data-state="…"]` attribute states. State classes are only ever combined with a block (`.sf-card.is-loading`), never styled bare.
- JS hooks use `data-sf-*` attributes **only**. Never select by styling classes in JS (except within your own component).
- Tones: `.sf-tone-ink` and `.sf-tone-charcoal` set the semantic color tokens (`--sf-bg`, `--sf-bg-raised`) locally (DESIGN §2.1). **There is no `.sf-tone-bone`.** Sections use semantic tokens only, never the raw palette tokens.
- Spacing: `.sf-space-none|compact|standard|generous` set `--sf-section-pad-y`.
- Breakpoints (literal values; CSS custom properties can't be used in media queries): `750px` (md), `990px` (lg), `1200px` (xl), `1600px` (2xl). Design mobile-first with `min-width`. Hover effects go only inside `@media (hover: hover) and (pointer: fine)`.
- No rounded corners (`--sf-radius: 0`). **No `backdrop-filter` anywhere**, including the solid header, and no `box-shadow` except the focus-ring separator (DESIGN §4.3, §6.7).

### 3.4 Token names (values: DESIGN.md §13)

CORE defines all of these in `sf-css-tokens` (the palette comes from settings; every value is DESIGN §13's, which maps each name below). Other owners MUST use only these names and MAY define private custom properties prefixed `--_` inside their component.

| Group | Custom properties | Value |
|---|---|---|
| Palette (raw) | `--sf-ink`, `--sf-charcoal`, `--sf-graphite`, `--sf-washed-grey`, `--sf-steel`, `--sf-silver`, `--sf-bone` | settings (§2.1), defaults #000000, #141619, #24272B, #8B9096, #7C91A5, #C3C8CD, #F1E9DA |
| Semantic color | `--sf-bg`, `--sf-bg-raised`, `--sf-bg-sunken`, `--sf-fg`, `--sf-fg-muted`, `--sf-fg-subtle`, `--sf-line`, `--sf-line-strong`, `--sf-accent`, `--sf-accent-fg`, `--sf-focus`, `--sf-scrim`, `--sf-error`, `--sf-success`, `--sf-selection` | DESIGN §2.1/§13 (tone `ink`; `charcoal` overrides `--sf-bg` and `--sf-bg-raised`) |
| Font families | `--sf-font-display`, `--sf-font-text`, `--sf-font-label` | see DESIGN.md |
| Type scale | `--sf-type-scale` (from settings), `--sf-text-2xs`, `--sf-text-xs`, `--sf-text-sm`, `--sf-text-base`, `--sf-text-lg`, `--sf-text-xl`, `--sf-display-sm`, `--sf-display-md`, `--sf-display-lg`, `--sf-display-xl` (fluid `clamp()`) | see DESIGN.md |
| Type details | `--sf-leading-tight`, `--sf-leading-snug`, `--sf-leading-body`, `--sf-tracking-tight`, `--sf-tracking-normal`, `--sf-tracking-wide`, `--sf-tracking-label`, `--sf-weight-regular`, `--sf-weight-medium`, `--sf-display-transform` (constant `none`; never applied to Spectral) | DESIGN §13 |
| Spacing | `--sf-space-1` … `--sf-space-12`, `--sf-gutter` (fluid page side padding), `--sf-section-pad-y`, `--sf-grid-gap`, `--sf-page-max` (from settings), `--sf-measure` (text max width) | see DESIGN.md |
| Runtime-measured | `--sf-header-h`, `--sf-announcement-h` (set by `sf-header.js`), `--sf-vh` (1% of the visual viewport, set by `sf-core.js` as the `svh` fallback) | JS |
| Header state (CORE, `sf-header.css`, CSS only) | `--sf-header-offset` (the height the sticky bar covers once its state settles: 72 px ≥ 990 full height, 56 px condensed or < 990, 0 while hidden or with `sticky_behavior: none`), `--sf-header-offset-dur` / `--sf-header-offset-ease` (the bar's own tween for the current change) | Consumers stuck under the header (the collection / search facets toolbar) use `top: var(--sf-header-offset)` with `transition: top var(--sf-header-offset-dur) var(--sf-header-offset-ease)`, so they move with the bar and never overlap it or leave a gap. `--sf-sticky-offset` (scroll-padding) is set by the second sticky bar itself: `sf-collection.css` = toolbar 48 px + 2 hairlines. |
| Media | `--sf-ratio-card` (from `card_image_ratio`), `--sf-ratio-hero-desktop` (16/9), `--sf-ratio-hero-mobile` (9/16) | settings / fixed |
| Motion | `--sf-ease-out`, `--sf-ease-in-out`, `--sf-ease-standard`, `--sf-dur-instant`, `--sf-dur-fast`, `--sf-dur-base`, `--sf-dur-slow`, `--sf-dur-cinematic`, `--sf-stagger`, `--sf-reveal-distance`, `--sf-motion` (0 \| 0.5 \| 1 multiplier for the motion level) | DESIGN §8.1/§13 (120 / 240 / 320 / 480 / 1200 ms) |
| Shape and elevation | `--sf-radius` (0), `--sf-radius-input` (0), `--sf-hairline` (1px), `--sf-shadow-drawer` (**`none`**; no shadows) | DESIGN §4.3 |
| Z-index | `--sf-z-base: 1`, `--sf-z-intro: 5` (hero intro layers, inside the hero; below the header, which stays usable during the intro), `--sf-z-sticky: 10` (collection toolbar), `--sf-z-header: 50`, `--sf-z-dropdown: 60` (mega panel + its scrim), `--sf-z-drawer: 100`, `--sf-z-modal: 110`, `--sf-z-toast: 120`, `--sf-z-skip: 200` | **The single scale for both docs** (DESIGN §4.3/§13 adopt it). Native `<dialog>`s are in the top layer and ignore it. The preview ribbon uses 2147483000 and is not a theme token. |

Reduced motion in CSS: `html[data-sf-motion="reduced"]` (set by boot, §4.3) is the single switch (DESIGN §8.5). `sf-base.css` (layer `sf.state`) sets `--sf-motion: 0`, and all transitions use `calc(var(--sf-dur-base) * var(--sf-motion))` or equivalent. Opacity crossfades ≤ 150ms remain allowed. CSS ALSO includes `@media (prefers-reduced-motion: reduce)` as a no-JS safety net.

Reveal utility (CORE, `sf-base.css` + `sf-core.js`): an element with `data-sf-reveal` (values `fade`, `exposure`, `mask`: DESIGN §8.2's devices; `exposure` is the black-overlay lift) starts hidden **only when** `html.js` and motion is not reduced. It gets `.is-revealed` once, via IntersectionObserver (threshold 0.15), and never re-hides. HOME/COMMERCE use it only where DESIGN §8.3 specifies a reveal (not every section fades up; exactly three text reveals on the homepage, DESIGN §8.4) and use GSAP only for scrubbed or pinned work.

---

## 4. JS architecture

### 4.1 Principles

- Classic `defer` scripts and IIFEs that attach to `window.Steadfast`. **No ES module imports** between assets (CDN `?v=` versioning breaks relative module URLs). No frameworks, no build step, no Lenis, no scroll hijacking, no `ScrollTrigger.normalizeScroll`, no `scrollerProxy`.
- Execution order is guaranteed by `defer` order in the layout: `sf-core.js` → `sf-header.js` → `sf-product-card.js` → `sf-cart.js`. Section scripts come later in document order, so they can rely on `Steadfast` core being present at execution time.
- Components are **custom elements** that implement `connectedCallback` and `disconnectedCallback`. Cleanup in `disconnectedCallback` is mandatory: remove listeners via an `AbortController`, disconnect observers, and revert the GSAP context.
- Size caps are **brotli** (q11), the bytes Shopify's CDN actually sends (v1.2, ruling §15.10; the v1.1 raw caps are void). Always-loaded files are enforced by spec 16 (§6.1): `sf-core.js` ≤ 8 KB br and ≤ 33 KB raw (**its measured size**, ruling §15.14: no build step, so dead code is removed and rarely used features move to lazily loaded modules; a new core feature that doesn't fit ships as an on-demand module), `sf-header.js` ≤ 4 KB, `sf-product-card.js` ≤ 1.75 KB, `sf-cart.js` ≤ 5.125 KB. On-demand and section modules, measured + ~15 % (guidance, reviewed in each pass): `sf-product.js` 7.2 KB, `sf-facets.js` 3.5 KB, `sf-hero-film.js` 4.2 KB, `sf-signature-showcase.js` 4 KB, `sf-predictive-search.js` 1.75 KB, `sf-quick-view.js` 1.9 KB, `sf-customer.js` 1.7 KB, `sf-dialog-history.js` 1.4 KB, other HOME modules 1.6 KB each.
- `console.log` is not allowed in shipped code. Use `Steadfast.debug(...)`, which logs only when `localStorage['sf:debug']==='1'`.

### 4.2 Global namespace `window.Steadfast`

`sf-config-script` (inline in `<head>`, CORE) creates the object with **data**. `sf-core.js` adds **behaviour**.

```js
window.Steadfast = {
  version: '1.0.0',
  modules: {},                        // idempotency flags: Steadfast.modules['hero-film'] = true
  routes: { root, cart, cart_add, cart_change, cart_update, cart_clear, search, predictive_search, product_recommendations, account, all_products },
                                      // all from routes.* (cart_add = routes.cart_add_url etc., WITHOUT .js; JS appends '.js')
  settings: { cartType: 'drawer'|'page', motionLevel: 'full'|'subtle'|'reduced', quickView: bool, quickAdd: bool,
              predictiveSearch: bool, designMode: bool, pageType: request.page_type, templateName: template.name },
  strings: { /* the keys listed in §1.4, already translated */ },
  assets: { gsap, scrollTrigger, product, quickView, predictiveSearch, facets, customer },   // asset_url strings
  breakpoints: { md: 750, lg: 990, xl: 1200 },
};
```

`sf-core.js` public API. These names are frozen, and every one is required:

| Member | Signature | Behaviour |
|---|---|---|
| `Steadfast.bus.on(name, handler)` | returns an `off()` fn | `document.addEventListener(name, e => handler(e.detail, e))` |
| `Steadfast.bus.emit(name, detail)` | | `document.dispatchEvent(new CustomEvent(name, { detail, bubbles: false }))` |
| `Steadfast.bus.off(name, handler)` | | |
| `Steadfast.motion.level` | getter `'full'\|'subtle'\|'reduced'` | The effective level, combining OS preference, setting and visitor toggle. Mirrors `html[data-sf-motion]`. |
| `Steadfast.motion.reduced` | getter bool | `level === 'reduced'` |
| `Steadfast.motion.set(level)` | | Visitor toggle: persists in localStorage `sf:motion` (`reduced` or removes it), updates the html attribute, emits `motion:change`. |
| `Steadfast.motion.gsapMatchMedia(scopeEl, setup)` | returns `{ revert() }` | Loads GSAP, creates `gsap.matchMedia(scopeEl)`, adds conditions `{ desktop: '(min-width: 990px)', mobile: '(max-width: 989px)', osReduce: '(prefers-reduced-motion: reduce)' }`, calls `setup(context.conditions, Steadfast.motion.level, gsap, ScrollTrigger)` inside, and re-runs (revert + add) on `motion:change`. The **standard** way for any section to use GSAP. |
| `Steadfast.loadScript(url)` | `Promise<void>` | Singleton per URL. Injects `<script src defer>` once. |
| `Steadfast.loadGsap()` | `Promise<{gsap, ScrollTrigger}>` | Loads `assets.gsap` then `assets.scrollTrigger` once, registers ScrollTrigger, sets `gsap.config({ nullTargetWarn: false })` and `ScrollTrigger.config({ ignoreMobileResize: true })`. After `document.fonts.ready` and `window load` it calls `ScrollTrigger.refresh()` once. |
| `Steadfast.sections.register(type, { init(el), destroy(el), lazy?: bool, rootMargin?: string })` | | Finds `[data-sf-section="{type}"]`. If `lazy`, `init` runs when the element comes within `rootMargin` (default `'50% 0px'`) of the viewport. Also handles `shopify:section:load` (init within `event.target`), `shopify:section:unload` (destroy), `shopify:section:select` (init immediately + scroll into view) and `shopify:block:select`. Prefer custom elements; use `register` for section-level timelines. |
| `Steadfast.inView(el, cb, { once=true, rootMargin, threshold })` | returns `disconnect()` | Shared IntersectionObserver helper. |
| `Steadfast.onIdle(cb, timeout=2000)` | | `requestIdleCallback` with a `setTimeout` fallback. |
| `Steadfast.utils.debounce(fn, ms)`, `throttle(fn, ms)` | | |
| `Steadfast.utils.fetchJSON(url, { method, body, signal })` | `Promise<any>` | Sends `Accept: application/json` and `Content-Type: application/json` when there's a body. Rejects with `{ status, message, description }` on non-2xx. |
| `Steadfast.utils.fetchSections(ids[], url = location.pathname + location.search)` | `Promise<Record<id, html>>` | `GET url (+ '&' or '?') sections=a,b`. |
| `Steadfast.utils.fetchSection(id, url)` | `Promise<string>` | `GET url?section_id=id`, returns HTML. |
| `Steadfast.utils.swapHTML(html, selector, root=document)` | bool | Parses `html` with `DOMParser`, finds `selector` in it and in `root`, and replaces the target's **innerHTML** with the source's innerHTML. Returns false if either is missing. Used for all Section Rendering API updates. |
| `Steadfast.a11y.announce(msg, politeness='polite')` | | Writes to `#sf-live-polite` / `#sf-live-assertive`: it clears, then sets the text after 50ms. |
| `Steadfast.a11y.trapFocus(container, { initialFocus })` | returns `release()` | For non-`<dialog>` containers only. |
| `Steadfast.scrollLock.lock()` / `.unlock()` | | Reference counted. Sets `overflow: hidden` on `html` with `scrollbar-gutter: stable` (DESIGN §7.3), falling back to `padding-inline-end` compensation, so there is no layout shift. |
| `Steadfast.debug(...args)` | | |

CORE custom elements in `sf-core.js`:
- **`<sf-dialog>`**: a generic wrapper around a native `<dialog>`, used by drawers and modals (cart drawer, menu, search overlay, quick view, size guide, zoom, campaign film, facets drawer).
  - API: `open(trigger?)`, `close()`, and the `isOpen` property.
  - Attributes: `id`, `data-sf-dialog-type="drawer-right|drawer-left|modal|sheet-top|fullscreen"`.
  - Behaviour: it uses `dialog.showModal()` (top layer, inertness, Esc), animates in and out with CSS classes `.is-opening` and `.is-closing` (DESIGN §8.3 durations × `--sf-motion`), and restores focus to the trigger on close. A backdrop click closes it. It calls `Steadfast.scrollLock`, emits `drawer:open` / `drawer:close` with `{ id }`, and listens globally for clicks on `[data-sf-open="{id-without-sf-prefix}"]` and `[data-sf-close]`.
  - Mapping: `data-sf-open="cart"` → `#sf-cart-drawer`, `"menu"` → `#sf-menu-drawer` (fullscreen), `"search"` → `#sf-search-overlay` (sheet-top), `"size-guide-{section.id}"` → `#sf-size-guide-{section.id}`, `"campaign-film-{section.id}"` → `#sf-campaign-film-{section.id}` (fullscreen).
- **`<sf-reveal-root>`**: not needed. The `[data-sf-reveal]` observer is global, and it re-scans on `section:load`, `quickview:loaded` and `facets:updated`.
- **`<sf-motion-toggle>`**: not an element. A delegated click handler on `[data-sf-motion-toggle]`.

CORE custom elements in other files:
- `<sf-header>` (`sf-header.js`). Spec: DESIGN §7.1 and §8.3 "Header".
  - Sticky modes; hides on scroll down and shows on scroll up for `on-scroll-up` (home: hide only once past the hero; elsewhere past 2× the header height).
  - **Transparent → solid without GSAP:** transparent while the hero's `[data-sf-header-sentinel]` (rendered by sf-hero-film at the hero's bottom edge) is intersecting the area below the header (`rootMargin: "-{header height}px 0px 0px 0px"`), solid otherwise. Solid = background, bottom hairline, condensed height and logo width, and the **header logo fades in (`--sf-dur-base`)**. Every other template is solid from load (server-rendered). There is no logo dock and no ScrollTrigger in the header or hero.
  - The header is **visible and usable from t = 0, including during the hero intro** (DESIGN §7.1 state 1); only the logo slot is empty while transparent.
  - Writes `--sf-header-h` via ResizeObserver.
  - Desktop dropdowns use a disclosure pattern: `<button aria-expanded aria-controls>`, opening on click and on hover with intent (120 ms, pointer: fine), closing on Esc, outside click, focusout or 200 ms after the pointer leaves. The panel uses `--sf-z-dropdown`.
- `<sf-menu-drawer>` (`sf-header.js`): the mobile nav inside **`<sf-dialog id="sf-menu-drawer" data-sf-dialog-type="fullscreen">`** (DESIGN §7.3). Because the dialog is in the top layer, the panel **repeats the 56 px header row** (close icon exactly where the menu icon was, the flat wordmark, search and cart icons), so the header reads as persistent while the panel opens under it with a top-down `clip-path` (DESIGN §8.3). Links stagger in per DESIGN (≤ 8 children, **≤ 560 ms total**, 0 when reduced). Nested levels are `<details>`-based slide-over panels with a `‹ SHOP` back button. Below a hairline: Account, Search, Instagram (if set), then `sf-localization-form`.
- `<sf-cart-count>` (`sf-header.js`): listens to `cart:updated` and sets the text and `data-count`. The `aria-label` uses `strings['cart.count']`.
- `<sf-localization>` (`sf-header.js`): wraps the `sf-localization-form` select, submitting the form on change.
- `<sf-product-card>` (`sf-product-card.js`): the size-cell / quick-add / quick-view / swatch contract (§4.6). It also preloads the secondary image on first `pointerenter` (fine pointer only).


### 4.3 Boot script (`sf-head-boot`, CORE, inline, first thing in `<head>`)

It runs synchronously (≤ 1 KB, wrapped in try/catch) and does the following:
1. Replaces `no-js` with `js` on `<html>`.
2. Computes the motion level and sets `html[data-sf-motion]`. The order is: OS `matchMedia('(prefers-reduced-motion: reduce)')` → `reduced`; else `localStorage['sf:motion']==='reduced'` → `reduced`; else the `settings.motion_level` value (inlined by Liquid).
3. Sets `html[data-sf-intro-seen]` if `sessionStorage['sf:intro-seen']==='1'` and `request.design_mode` is false. (`html[data-sf-intro]` is set by the hero's own inline script, §5.2, because only the section knows its settings.)
4. Sets `html[data-sf-save-data]` if `navigator.connection?.saveData` or `effectiveType` matches `/2g/`.
5. Sets `html[data-sf-pointer="fine|coarse"]`.

### 4.4 Event bus (frozen names; all dispatched on `document`)

| Event | detail | Emitted by | Listened by |
|---|---|---|---|
| `cart:updated` | `{ cart, source: 'product-form'\|'quick-add'\|'quick-view'\|'drawer'\|'cart-page'\|'external' }` | `Steadfast.cart` (COMMERCE) | `<sf-cart-count>` (CORE), drawer, cart page |
| `cart:item-added` | `{ items, cart, source }` | `Steadfast.cart.add` | drawer (opens), quick view (closes) |
| `cart:error` | `{ status, message, description, source }` | `Steadfast.cart` | the originating form (inline error), drawer |
| `cart:open` | `{ trigger? }` | anyone | `<sf-cart-drawer>`, or redirects to `/cart` in page mode |
| `cart:close` | `{}` | anyone | `<sf-cart-drawer>` |
| `variant:change` | `{ sectionId, productId, variant /* product JSON variant */, source: 'pdp'\|'quick-view' }` | `<sf-variant-picker>` | gallery, price, product form, URL updater |
| `quickview:open` | `{ url, handle, intent: 'view'\|'add', trigger }` | `<sf-product-card>` | `<sf-quick-view>` (lazy loads `sf-quick-view.js` + `sf-product.js` via `Steadfast.assets`) |
| `quickview:loaded` | `{ url, el }` | `<sf-quick-view>` | reveal re-scan |
| `quickview:close` | `{}` | `<sf-quick-view>` | |
| `drawer:open` / `drawer:close` | `{ id }` | `<sf-dialog>` | header (aria state), hero (ends the intro / pauses the loop) |
| `search:open` / `search:close` | `{}` | `<sf-dialog id="sf-search-overlay">` | `<sf-predictive-search>` (focus input; lazy loads JS on first open) |
| `menu:open` / `menu:close` | `{}` | `<sf-menu-drawer>` | header |
| `facets:updated` | `{ url, sectionId }` | `<sf-facets>` | reveal re-scan, ScrollTrigger refresh |
| `motion:change` | `{ level }` | `Steadfast.motion.set` | every animated component (revert/rebuild), `<sf-hero-film>` |
| `hero:intro-start` | `{ source: 'bundled'\|'shopify'\|'mixed', variant: 'desktop'\|'mobile' }` | `<sf-hero-film>` | analytics hooks (the header is already visible) |
| `hero:intro-end` | `{ reason: 'ended'\|'skipped'\|'focus'\|'key'\|'scrolled'\|'paused'\|'drawer'\|'seen'\|'disabled'\|'reduced'\|'save-data'\|'no-film'\|'error' }` | `<sf-hero-film>` | analytics hooks, tests |
| `section:load` / `section:unload` | `{ sectionId, type, el }` | `Steadfast.sections` (re-emits the `shopify:*` events) | |

### 4.5 GSAP and motion rules

**DESIGN §8 decides what moves, how far, how fast and with which ease; this section only decides how the code is wired.** Where an older value here disagrees with DESIGN §8.1–§8.7 or §10, DESIGN wins.

- Load GSAP **only** through `Steadfast.loadGsap()` or `Steadfast.motion.gsapMatchMedia()`. Never write `<script src="gsap…">` in Liquid.
- The trigger is lazy: a section that uses GSAP registers with `lazy: true` (IntersectionObserver, rootMargin `'100% 0px'`), so GSAP downloads only as the first such section approaches the viewport. **The hero and the header use no GSAP** (CSS, Web Animations API, IntersectionObserver), which keeps the LCP path free of it. Section B and E don't need it either (CSS + `Steadfast.inView`). PDP, collection, search, cart and content templates never load it.
- Homepage ScrollTriggers stay within DESIGN §8.7's cap (≤ 10, exactly 1 pin): C 1 (the pin), D 2, F 2, plus B 1 only if HOME chooses GSAP for it.
- Every timeline and ScrollTrigger lives inside a `gsap.matchMedia()` (via `gsapMatchMedia`) or `gsap.context(…, scopeEl)`. `setup` receives `Steadfast.motion.level`; scrubs and pins run only at level `full`. `destroy`/`disconnectedCallback` calls `.revert()`. Never use global `ScrollTrigger.killAll()`.
- `ScrollTrigger.refresh()` is called after images inside pinned sections `decode()`, after `document.fonts.ready`, and on `facets:updated`. It's never called in scroll handlers.
- Pinning (signature showcase only) requires `desktop && level === 'full' && pin_on_desktop`. It uses `pinSpacing: true`, `anticipatePin: 1`, `invalidateOnRefresh: true`. Pinned scroll length follows `scroll_length`. There is **at most one pinned/scrubbed-pin sequence per page**. On mobile, `subtle` or `reduced`: DESIGN §10.3's stacked layout, no pin.
- **Allowed animated properties: `transform`, `opacity`, `clip-path`, and the `--sweep` mask variable on the wordmark.** Never `filter` (including `brightness()`), `backdrop-filter`, `width`, `height`, `top` or `left` (DESIGN's one exception: the fixed header's height). Darkening/lifting is a black `::after` overlay's opacity.
- **Rotation:** only the signature showcase's perspective tilt and its front↔back turn, **|rotateX| and |rotateY| ≤ 6°** (DESIGN §8.1, §10.2), and the 45° menu-icon lines. No `rotateZ` on content.
- **No parallax anywhere** (DESIGN §8.1). Translations 8–16 px; drawers and sheets travel their own size.
- No `bounce`, `elastic`, `back`, springs or overshoot. Scrubbed tweens use `ease: "none"`. Every reveal plays once.
- `will-change` is set by JS right before a tween and removed on complete; never in static CSS.

### 4.6 Product card + quick-add contract (CORE markup; COMMERCE behaviour)

Spec: DESIGN §7.5. One stretched link per card (on the title); actions are separate controls above it, so nothing interactive is nested.

`sf-product-card` output (product present):

```html
<sf-product-card class="sf-card{% unless product.available %} is-sold-out{% endunless %}"
  data-product-id="{{ product.id }}" data-product-handle="{{ product.handle }}" data-product-url="{{ product.url }}">
  <div class="sf-card__media" style="--sf-ratio: var(--sf-ratio-card)">
    {% render 'sf-image', image: product.featured_media, sizes: sizes, loading: loading, fetchpriority: fetchpriority, class: 'sf-card__img sf-card__img--primary' %}
    {%- if settings.card_show_secondary_image and product.media[1] and product.media[1].media_type == 'image' -%}
      {% render 'sf-image', image: product.media[1], sizes: sizes, loading: 'lazy', class: 'sf-card__img sf-card__img--secondary', alt: '' %}
    {%- endif -%}
    {%- if product.tags contains 'new' -%}<span class="sf-card__badge">{{ 'product_card.new' | t }}</span>{%- endif -%}
    {%- unless product.available -%}<span class="sf-card__badge">{{ 'product_card.sold_out' | t }}</span>{%- endunless -%}
  </div>
  <div class="sf-card__info">
    <h3 class="sf-card__title"><a class="sf-card__link" href="{{ product.url }}">{{ product.title | escape }}</a></h3>  {# as entered, never uppercased (DESIGN §3.3); ::after stretches over the card: the ONE real link #}
    {% render 'sf-price', product: product, show_from: true %}
    {%- if settings.card_show_colorways -%}{% render 'sf-colorways', product: product %}{%- endif -%}
  </div>
  {%- if show_actions -%}<div class="sf-card__actions">{% render 'sf-quick-add', product: product %}</div>{%- endif -%}
</sf-product-card>
```

`sf-quick-add` renders, in this order, only if `product.available`. "Varying options" means options with `values.size > 1`.

| Condition | Markup | JS behaviour (`sf-product-card.js`) | No-JS fallback |
|---|---|---|---|
| `settings.card_show_quick_view` | `<a class="sf-btn sf-btn--text sf-btn--sm" href="{{ product.url }}" data-sf-quick-view data-intent="view" aria-haspopup="dialog">Quick view<span class="sf-visually-hidden">: {{ product.title }}</span></a>` | preventDefault → `bus.emit('quickview:open', {url, handle, intent:'view', trigger})` | navigates to the PDP |
| `settings.card_show_quick_add` and **exactly one varying option** (e.g. Size only, or Size × one Colour value) and `product.variants.size <= 8` | **Inline size cells** (DESIGN v1 §7.5; §14 R2): `<div class="sf-quick-add__sizes" role="group" aria-label="{{ 'product_card.choose_size' \| t }}">` with **one small form per variant**: `<form method="post" action="{{ routes.cart_add_url }}" data-sf-quick-add>` + `<input type="hidden" name="id" value="{{ variant.id }}">` + `<input type="hidden" name="quantity" value="{{ variant.quantity_rule.min \| at_least: 1 }}">` + `<button type="submit" class="sf-quick-add__size" aria-label="{{ 'product_card.add_size_to_cart' \| t: size: value }}">{{ value }}</button>`. A sold-out variant's cell is `disabled`, slashed, with visually-hidden `product_card.sold_out`. | preventDefault → the cell gets `.is-loading` + `aria-busy`; `Steadfast.cart.add([{id, quantity}], {source:'quick-add', trigger})`; the drawer opens on success. On error it shows `.sf-card__error` (role=alert). If `Steadfast.cart` is undefined, it lets the form submit. | POST `/cart/add` → Shopify redirects to `/cart` with the line added |
| `settings.card_show_quick_add` and `product.has_only_default_variant` | One form as above with `<button type="submit" class="sf-btn sf-btn--text sf-btn--sm">{{ 'product_card.add_to_cart' \| t }}</button>` | same | same |
| `settings.card_show_quick_add` and more than one varying option (or > 8 variants) | `<a class="sf-btn sf-btn--text sf-btn--sm" href="{{ product.url }}" data-sf-quick-view data-intent="add" aria-haspopup="dialog">{{ 'product_card.add_to_cart' \| t }}<span class="sf-visually-hidden"> – {{ 'product_card.choose_options' \| t }}</span></a>` | emits `quickview:open` with `intent:'add'`. The quick view focuses the first unselected option fieldset. | navigates to the PDP |

Placement and visibility follow DESIGN §7.5: the actions row sits under the swatches, visible on hover and `:focus-within` on fine pointers (always in the DOM and tab order) and always visible on touch. The size cells are compact text cells in the same row. The card's title link is the only element in tab order besides the swatches and the actions, which sit above the stretched link (`position: relative; z-index: 2`).

Swatches (`[data-sf-swatch]`): a click swaps `.sf-card__img--primary`'s `src`/`srcset` to that colour's variant featured media (200 ms crossfade) and sets `aria-pressed`; colours without variant media are plain links to `value.variant.url` (DESIGN §7.5).


### 4.7 COMMERCE JS modules (public APIs)

`sf-cart.js` → `Steadfast.cart` (exists on every page, both cart modes):

| Member | Contract |
|---|---|
| `get()` | `GET routes.cart + '.js'` → cart JSON. |
| `add(items, { source, trigger, open = true } = {})` | `POST routes.cart_add + '.js'` with JSON body `{ items, sections: sectionIds(), sections_url: location.pathname }`. It applies the returned `sections` HTML (via `swapHTML`), then calls `get()`, then emits `cart:item-added` + `cart:updated`, then (drawer mode and `open`) `cart:open`. In page mode it navigates to `routes.cart`. On a 422 it emits `cart:error` and rejects. |
| `change({ key?, line?, quantity })` | `POST routes.cart_change + '.js'` with `{ id: key, quantity, sections, sections_url }` (or `line`). Emits `cart:updated`. Announces `cart.item_removed` when quantity is 0. |
| `update(updates, { note, attributes } = {})` | `POST routes.cart_update + '.js'`. |
| `clear()` | `POST routes.cart_clear + '.js'`. |
| `open(trigger?)` / `close()` | Proxies to `#sf-cart-drawer`, or navigates in page mode. |
| `refresh()` | Re-fetches the sections and `/cart.js`, then emits `cart:updated` with `source: 'external'`. It also runs on `pageshow` with `persisted` (bfcache) and when `document.visibilityState` becomes visible after ≥ 30 s hidden. |
| `sectionIds()` | `['sf-cart-drawer']` (drawer mode), plus the `data-section-id` of `[data-sf-main-cart]` if on the cart page. |

All requests go through a **serial promise queue**. Quantity inputs debounce at 350ms.

Drawer markup contract (in `sf-cart-drawer.liquid`):
- `<sf-dialog id="sf-cart-drawer" data-sf-dialog-type="drawer-right">`
- `<dialog aria-labelledby="sf-cart-drawer-title" class="sf-drawer">`
- Inner `<sf-cart-drawer>`. The **replaceable region** is `[data-sf-cart-drawer-body]` (`swapHTML(html['sf-cart-drawer'], '[data-sf-cart-drawer-body]')`), so the dialog element and its open state persist.
- Line markup: `<li class="sf-cart-line" data-key="{{ item.key }}" data-line="{{ forloop.index }}">`
- Quantity: `<sf-quantity-input>` with `<input name="updates[]" data-key min="{{ item.variant.quantity_rule.min }}" step="{{ item.variant.quantity_rule.increment }}" {% if max %}max{% endif %}>`
- Remove: `<button data-sf-cart-remove data-key>`
- Checkout: `<form action="{{ routes.cart_url }}" method="post"><button type="submit" name="checkout" class="sf-btn sf-btn--primary">` (Shopify checkout; **never** a fake checkout).
- Cart page `sf-main-cart`: root `[data-sf-main-cart][data-section-id="{{ section.id }}"]`, replaceable region `[data-sf-main-cart-body]`. It wraps everything in a real `<form action="{{ routes.cart_url }}" method="post" id="sf-cart-form">`, so it works without JS. Dynamic checkout buttons render `{{ content_for_additional_checkout_buttons }}` if `additional_checkout_buttons`.

`sf-product.js` (PDP + quick view):

| Element | Contract |
|---|---|
| `<sf-variant-picker data-section-id data-product-id data-update-url="true\|false">` | Reads `<script type="application/json" data-sf-product-json>` (from `sf-product-json`) with the shape `{ id, handle, url, options: [names], variants: [{ id, title, options: [..], available, price_html, featured_media_id, quantity_rule: {min,max,increment}, requires_selling_plan:false }] }`. On a change of native radio inputs or `<select>`, it finds the variant matching all selected values. It recomputes the availability of every value: a value is **available** if some available variant has it **and** matches the other currently selected values. Unavailable values get `.is-unavailable` and visually-hidden "Sold out" text, but stay selectable. Then it emits `variant:change`, updates `?variant=` with `history.replaceState` (PDP only, when `data-update-url` is true), and updates the visible legend value (`Color: Washed blue-grey`). |
| `<sf-product-form data-section-id>` | Wraps `{% form 'product', product, id: 'sf-product-form-' \| append: section.id, novalidate: 'novalidate' %}` with `input[name=id]`. On `variant:change` for its section it sets the id and the button state: available → `products.add_to_cart`; not available → `products.sold_out` (disabled); no variant → `products.unavailable` (disabled); while the request runs → `products.adding` + `aria-busy` (DESIGN §6.2). It also swaps `[data-sf-price]` innerHTML from `price_html` and applies quantity rules to its `<sf-quantity-input>`. Submit → `Steadfast.cart.add` with `source: 'product-form'` or `'quick-view'`. Errors go to `[data-sf-form-error]` (role=alert). |
| `<sf-product-gallery data-section-id>` | On `variant:change` with `featured_media_id`, it scrolls/activates that media (desktop stacked: `scrollIntoView` with `behavior` respecting motion; mobile: scroll-snap rail). It shows a thumbnail/counter `1 / N` (aria-live off). Zoom opens `<sf-dialog id="sf-zoom-{section.id}" data-sf-dialog-type="fullscreen">` with `image_url: width: 2400` images and pinch/scroll pan via native overflow. External/hosted videos start only on click. Models are loaded with `Shopify.loadFeatures([{name:'model-viewer-ui',version:'1.0'},{name:'shopify-xr',version:'1.0'}])` only if a model exists. |
| `<sf-related-products data-url>` | `data-url="{{ routes.product_recommendations_url }}?product_id={{ product.id }}&limit={{ n }}&intent=related&section_id={{ section.id }}"`. It fetches when within 400px of the viewport, then `swapHTML(…, '[data-sf-related-body]')`. If the response has 0 products, it removes the section's visible container (`hidden`). |
| `<sf-size-guide>` | A `SIZE GUIDE` text button on the size label row, `data-sf-open="size-guide-{{ section.id }}"`, opening a drawer-right `<sf-dialog>`. Content is `settings.size_guide_page.content` or `settings.size_guide_fallback`. |

`sf-quick-view.js` → `Steadfast.quickView`:
- `open({url, intent, trigger})`: opens `#sf-quick-view` (the `<sf-dialog data-sf-dialog-type="modal">` from `sf-quick-view-shell`) in a loading state. It runs `Steadfast.utils.fetchSection('sf-quick-view', url)` and injects the result into `[data-sf-quick-view-body]`. It ensures `sf-product.js` is loaded, sets `data-update-url="false"` on the picker, focuses the title, or the first option fieldset when `intent:'add'`, then emits `quickview:loaded`.
- `close()`.
- After `cart:item-added` with `source:'quick-view'`, it closes itself before the drawer opens.

`sf-facets.js` → `<sf-facets data-section-id>`:
- The form uses GET on the current URL with the native param names (`filter.v.option.size`, `filter.v.price.gte`, `filter.p.product_type`, `sort_by`, `q`, …).
- Desktop (≥ 990 px) applies live (DESIGN §7.9): on input change (debounced 300 ms), it builds `URLSearchParams` from the form, drops empty values and `page`, fetches `location.pathname + '?' + params + '&section_id=' + sectionId`, swaps `[data-sf-facets-results]`, `[data-sf-active-facets]`, `[data-sf-facets-count]` and the filter form groups (preserving open `<details>` state and focus), then calls `history.pushState`.
- `popstate` re-renders.
- Active facet "remove" links (`url_to_remove`) are intercepted the same way.
- No-JS: the form has a visible submit button inside `<noscript>`.
- The filter drawer (all viewports, DESIGN §7.9) is an `<sf-dialog data-sf-dialog-type="drawer-left" id="sf-facets-drawer-{section.id}">` opened by the toolbar's `FILTER (n)`. Desktop applies live; mobile applies on submit. Its footer has `CLEAR ALL` and `SHOW n RESULTS` (which closes it). Active filters are removable chips at the top.
- `<sf-grid-density>` (same file): toggles the grid between the two densities (desktop 2/4, mobile 1/2), sets `data-density` on the grid and `aria-pressed` on its buttons, and persists to localStorage `sf:grid-density` (try/catch). Without JS the section's `columns_*` defaults apply.

`sf-predictive-search.js` → `<sf-predictive-search>` inside `#sf-search-overlay`:
- Input `name="q"`, `role="combobox"`, `aria-expanded`, `aria-controls="sf-predictive-results"`, `aria-autocomplete="list"`.
- After a 250ms debounce and for ≥ 2 chars, it fetches `routes.predictive_search + '?q=' + enc(q) + '&resources[type]=product,collection,page,article,query&resources[limit]=4&resources[options][unavailable_products]=last&section_id=sf-predictive-search'` with an `AbortController`.
- It swaps `[data-sf-predictive-body]`, announces the result count, and supports arrow-key navigation over `[role=option]`.
- Enter submits to `routes.search`. The overlay form works without JS (GET `/search`).

`sf-customer.js`: address forms (`<sf-address-form>`, which syncs the country → province select using `data-provinces` JSON from `country_option_tags`; see §8.6), toggles for the "add address" and "edit" forms, and the recover-password toggle on login (`#recover` hash).

### 4.8 HOME JS modules

The motion in every row is **per DESIGN §8.3 and §10**; this table fixes only the element, the tech and the fallback.

| File | Element / registration | Tech | Level `full` (desktop) | Mobile / `subtle` / `reduced` |
|---|---|---|---|---|
| `sf-hero-film.js` | `<sf-hero-film>` | video + CSS + Web Animations API; **no GSAP** | §5 | §5 eligibility table |
| `sf-featured-collection.js` | `<sf-product-rail>` | CSS + `Steadfast.inView` (GSAP optional, §4.5) | Exposure lift on the visible cards once; prev/next buttons `scrollBy` one card (`behavior` honours motion), `disabled` at the ends; 1 px progress line; native scroll-snap; no auto-advance. | Mobile: ≤ 2 cards lifted. Reduced: none. |
| `sf-signature-showcase.js` | `Steadfast.sections.register('signature-showcase', {lazy:true})` | GSAP + ScrollTrigger | One pinned scrubbed timeline per DESIGN §10.1–§10.2 (front stage `image_hero`, back stage `image_hero_back`, detail zooms keyed by each block's `asset_crop`). | DESIGN §10.3 stacked layout. |
| `sf-campaign-editorial.js` | `register('campaign-editorial', {lazy:true})` | GSAP + ScrollTrigger | Per DESIGN §8.3 D (scrubbed aperture + inner scale; text mask once). | `subtle`: final state with one opacity reveal. Reduced: static. |
| `sf-category-grid.js` | `<sf-category-index>` | CSS + pointer/focus listeners | Hover/focus on a name sets the active stage image (DESIGN §8.3 E). The first category is active in the markup, so the stage is right without JS. | Mobile: stacked tiles, press state only. |
| `sf-brand-story.js` | `register('brand-story', {lazy:true})` | GSAP + ScrollTrigger | Per DESIGN §8.2 device 3 and §8.3 F (scrubbed `--sweep` on the `lockup` over a 0.14 base copy; lead paragraph mask once). | `subtle`: final state with one opacity reveal. Reduced: fully visible, static. |

`sf-newsletter` needs no JS (`sf-core.js` focuses `#newsletter [role=status]` after a successful post).

---

## 5. Hero film component contract (HOME)

The hero models FILM-STORYBOARD A3–A8 and DESIGN §8.3 A: an **intro file** (beats 1–7, 12.8 s, 30 fps, ends on ≥ 0.4 s of black, **no logo baked in**), the **live DOM logo reveal** (beat 8, at `duration − 0.4 s`), the **shopping UI** (beat 9), and a **seamless 5.6 s loop file** behind the UI. The **end still** (the loop's first frame, no logo) is the LCP image, the reduced-motion and save-data still, and the layer the loop fades in over. An optional merchant-uploaded campaign film plays in a full-screen dialog. Nothing in the hero uses GSAP.

### 5.1 Media query and source resolution (`sf-hero-film-sources` snippet)

**One constant decides desktop vs mobile media everywhere**: the `<source media>` and `<picture>` attributes, the JS source check, the CSS `object-fit` switch, MEDIA's renders and FILM-STORYBOARD A2.

```
MOBILE_MQ = (max-width: 749px), (orientation: portrait) and (max-width: 1100px)
```
Mobile media (9:16, `object-fit: cover`) when it matches; desktop media (16:9, `object-fit: contain` on black, "the aperture") otherwise. CSS writes the same query literally (custom properties can't be used in media queries); the snippet emits it once as `data-mq-mobile`. It is independent of the 990 px **layout** breakpoint, which only moves text and CTAs (DESIGN §9 A).

| Slot | Priority order |
|---|---|
| intro desktop | 1. `intro_video_desktop`: the `video.sources` entry with `mime_type == 'video/mp4'` and the largest `height` ≤ 1080. 2. If `use_bundled_film`, `'sf-film-desktop.mp4' \| asset_url`. 3. None. |
| intro mobile | 1. `intro_video_mobile` (same pick rule, height ≤ 1920). 2. If `use_bundled_film`, `'sf-film-mobile.mp4' \| asset_url`. 3. None. A desktop override is never used for mobile. |
| loop desktop / mobile | Same pattern with `loop_video_*` and `sf-film-loop-desktop.mp4` / `sf-film-loop-mobile.mp4`. |
| end still desktop / mobile | `end_image_desktop` / `end_image_mobile` via `sf-image`, otherwise assets `sf-film-end-desktop` / `sf-film-end-mobile`. Always present. |
| campaign film | `campaign_film_desktop` / `campaign_film_mobile` (mp4 pick rule). No bundled fallback. |
| poster attribute | None on either `<video>`. The intro opens on black (`#000` stage); the loop fades in over the end still. |

Bundled video is **H.264 MP4 only** (decision §12.5); a Shopify-hosted override uses the mp4 rendition picked above.

### 5.2 Markup

```html
<section class="sf-section sf-hero-film sf-tone-ink" data-sf-section="hero-film" aria-labelledby="sf-hero-title-{{ section.id }}">
  <script>/* ≤ 600 B, inline, runs during parse: sets html[data-sf-intro]="play"|"skip" from intro_enabled,
     intro_frequency, html[data-sf-motion], html[data-sf-save-data], html[data-sf-intro-seen] and design mode,
     so CSS paints the right first frame before sf-hero-film.js runs */</script>
  <sf-hero-film class="sf-hero" data-state="idle" data-frequency="{{ intro_frequency }}"
     data-logo-reveal="{{ logo_reveal }}" data-mq-mobile="{{ MOBILE_MQ }}"
     data-intro-desktop="…" data-intro-mobile="…" data-loop-desktop="…" data-loop-mobile="…"
     data-source="bundled|shopify|mixed|none">
    <div class="sf-hero__stage" aria-hidden="true">
      <picture class="sf-hero__end">   {# ALWAYS painted at opacity 1, bottom of the stack: the LCP element #}
        <source media="{{ MOBILE_MQ }}" type="image/webp" srcset="mobile 480w, 720w" sizes="100vw" width="720" height="1280">
        <source type="image/webp" srcset="desktop 960w, 1600w, 1920w" sizes="100vw" width="1920" height="1080">
        <img src="{{ 'sf-film-end-desktop-1600.jpg' | asset_url }}" width="1600" height="900" alt="" loading="eager" fetchpriority="high" decoding="async">
      </picture>
      <video class="sf-hero__loop" muted playsinline loop preload="none" disablepictureinpicture disableremoteplayback tabindex="-1"></video>
      <video class="sf-hero__intro" muted playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1"></video>
      {# no src/<source> in markup: JS sets the src of a video only when that video will play, so nothing downloads otherwise #}
      <div class="sf-hero__scrim"></div>
    </div>
    <div class="sf-hero__content sf-container">
      <h1 class="sf-hero__title" id="sf-hero-title-{{ section.id }}">
        {% render 'sf-logo', variant: 'textured', width: logo_width, loading: 'eager', alt: shop.name %}   {# h1 accessible name = shop name #}
      </h1>
      <p class="sf-hero__eyebrow">{{ eyebrow }}</p><p class="sf-hero__sub">{{ subheading }}</p>   {# sub: desktop only #}
      <div class="sf-hero__ctas">
        <a class="sf-btn sf-btn--primary" href="…">{{ cta_primary_label }}</a>
        <a class="sf-btn sf-btn--text" href="{{ cta_secondary_link | default: '#campaign' }}" data-sf-hero-secondary data-action="link|film|replay">{{ cta_secondary_label }}</a>
      </div>
    </div>
    <button type="button" class="sf-hero__control" data-sf-hero-control>{{ 'home.hero.skip' | t }}</button>
    <span class="sf-hero__sentinel" data-sf-header-sentinel aria-hidden="true"></span>
  </sf-hero-film>
  {%- comment -%} only when a campaign film is set {%- endcomment -%}
  <sf-dialog id="sf-campaign-film-{{ section.id }}" data-sf-dialog-type="fullscreen"><dialog aria-label="{{ cta_secondary_label }}">
    <video controls playsinline preload="none" data-sf-campaign-film></video><button type="button" data-sf-close>{{ 'general.close' | t }}</button>
  </dialog></sf-dialog>
  <noscript><style>.sf-hero__intro,.sf-hero__loop,.sf-hero__control{display:none}.sf-hero__content{opacity:1}</style></noscript>
</section>
```

- **Heading**: the `<h1>` wraps the textured wordmark with `alt="{{ shop.name }}"` (DESIGN §3.3 ruling): one heading, accessible name "STEADFAST", no separate hidden h1. During the intro it is in the DOM at `opacity: 0` (never `visibility: hidden` / `display: none`).
- With `cta_secondary_action == 'film'` and a campaign film set, the secondary link also gets `data-sf-open="campaign-film-{{ section.id }}"` and `aria-haspopup="dialog"`; its `href` stays `#campaign`, so it works without JS.
- Both videos use the `muted` attribute **and** `video.muted = true` in JS (iOS needs the property). No `autoplay` attribute: JS sets the src and calls `play()`. MEDIA strips audio.
- The end still never contains the logo; the DOM wordmark is the only logo in the hero.

### 5.3 States, timeline and behaviour

`data-state` takes one of `idle`, `loading`, `playing`, `paused`, `ended`, `fallback`, `static`; the beats add `.is-beat-8` and `.is-beat-9` (DESIGN §8.3 A). CSS reads only these. `document.documentElement.dataset.sfHero` mirrors the state.

**Eligibility** (on connect; the inline script has already set `html[data-sf-intro]`, so CSS shows the right frame before JS):

| Condition (first match wins) | Result | `hero:intro-end` reason |
|---|---|---|
| `html[data-sf-motion="reduced"]` | `static`: end still + full UI + wordmark at rest. No video requested. The control reads **PLAY** and plays the loop on request (DESIGN §8.5). | `reduced` |
| `html[data-sf-save-data]` | `static`, no control, no video (DESIGN §8.6). | `save-data` |
| `intro_enabled` false; or `intro_frequency == once_per_session` and `html[data-sf-intro-seen]` (ignored in design mode); or no intro source | `static` with the loop: UI at rest, the loop fades in over 600 ms once it can play (DESIGN §8.3 A "not eligible"); the control is PAUSE. | `seen` / `disabled` / `no-film` |
| otherwise (levels `full` and `subtle`) | intro | — |

**Intro timeline** (`D` = `video.duration` read on `loadedmetadata`; 12.8 s for the bundled edit, so a merchant file works unchanged):

| Time | Event (values: DESIGN §8.3 A, FILM A6) |
|---|---|
| 0 | State `loading` → `playing` on the `playing` event. `hero:intro-start {source, variant}`. The header is already visible (transparent, logo slot empty). Hero content is focusable at `opacity: 0`. |
| 0.8 s | `SKIP INTRO` fades in (if `show_skip`). |
| `currentTime ≥ 2.2 s` (first cut) | `.is-ui`: the CTA row (EXPLORE COLLECTION, VIEW THE CAMPAIGN) fades in once (opacity only, 500 ms) to full opacity 1 and becomes clickable, so a visitor who neither scrolls nor presses a key can shop during the film (BRIEF §3). Before `.is-ui` the row has `pointer-events: none`. The wordmark still waits for beat 8, eyebrow and line for beat 9. |
| `D − 0.4 s` | `.is-beat-8` (if `logo_reveal`): the wordmark light-sweep reveal. Detected with `requestVideoFrameCallback` where available, else `timeupdate` + rAF on `currentTime`. The loop's `src` is set now so it is ready for beat 9. |
| `D + 0.6 s` | `.is-beat-9` + state `ended`: loop fades in, wordmark glides to rest, eyebrow/subheading/CTAs reveal (starting `D + 0.9 s`), `SKIP INTRO` → `PAUSE`. `sessionStorage['sf:intro-seen']='1'` (try/catch). `hero:intro-end {reason:'ended'}`. |
| `currentTime ≥ 14 s` | Hard cap (FILM B7): treated as the end of the film. |

The light sweep animates the registered property `--sweep` (`@property --sweep { syntax: '<percentage>'; inherits: false; initial-value: 130%; }`) with the Web Animations API; without `@property` support the wordmark gets the opacity and scale part only.

**Ending the intro early** (DESIGN §8.3 A): `SKIP INTRO`; focus entering the hero content; any `keydown`; any page scroll, `wheel` or `touchmove`; the pause toggle; `drawer:open`. The hero jumps to the end of beat 9 in `--sf-dur-base` (intro opacity → 0 and paused, wordmark at rest, content visible, loop fading in), kills its timers, stores seen and emits `hero:intro-end` with `skipped` / `focus` / `key` / `scrolled` / `paused` / `drawer`. `SKIP INTRO` moves focus to the primary CTA. Nothing ever blocks scrolling, the header or the keyboard.

| Situation | Rule |
|---|---|
| Watchdogs | Intro: no `playing` within 4 s, `play()` rejects (iOS Low Power Mode, autoplay policy), `error`, or a stall > 4 s → end early (reason `error`) and try the loop. Loop failure → `fallback`: end still + UI, src removed and `load()` called to cancel the download, plus DESIGN's static treatment (no animated still). |
| Source check | On `loadedmetadata`, if `matchMedia(MOBILE_MQ).matches` disagrees with the variant loaded, swap to the other variant's src and `load()` again. |
| Pause toggle | After beat 9 (and in `static` with a loop) the control is PAUSE / PLAY: toggles `play()`/`pause()` and swaps its label `home.hero.pause` / `home.hero.play` (the label names the action; **no `aria-pressed`**, which would announce "Play, pressed"); state `paused`. WCAG 2.2.2: SKIP INTRO covers the intro, PAUSE the loop. `show_skip` never hides PAUSE / PLAY. |
| Off-screen | IntersectionObserver (threshold 0.25): leaving during the intro ends it (`scrolled`); the loop pauses when < 25% visible and resumes on return unless the user paused it. |
| Tab hidden / drawer open | Pause on `visibilitychange` hidden and on `drawer:open`; resume the loop on return only if it was playing and not user-paused. |
| Secondary CTA | `link` (default): a plain anchor to `#campaign` or the URL. `film`: opens `#sf-campaign-film-{id}`, sets the film src lazily (by MOBILE_MQ), plays with native controls and pauses the loop; closing pauses the film and resumes the loop. `replay`: a user gesture, so allowed under reduced motion and when seen; restarts the intro timeline from 0. |
| Disconnect / `shopify:section:unload` | Pause both videos, abort the AbortController, disconnect observers, cancel rVFC/rAF and timers. |
| Design mode | Ignore the seen flag. Don't write sessionStorage. Re-init on `shopify:section:load`. |

Honesty: no UI copy calls the bundled edit a "campaign film". VIEW THE CAMPAIGN scrolls to the campaign editorial (Section D) by default; the full-screen player exists only when the merchant uploads a real campaign film.

### 5.4 Shopify-hosted override

A merchant can upload a real intro, loop, end still and campaign film later (FILM-STORYBOARD B7) through the settings in §2.4 A. Markup and behaviour are identical, with `data-source="shopify"` (or `mixed`). The timeline reads `video.duration`, so any intro that ends on ≥ 0.4 s of black and is ≤ 14 s works. `use_bundled_film` stays as the per-slot fallback.

---

## 6. Performance strategy and budgets

### 6.1 Budgets (verified by `dev/tests/16-performance.spec.mjs` on the preview)

**v1.2 (fix pass, ruling §15.10).** The v1.1 budgets were raw bytes and a 25-request home cap. Both measured the wrong thing: Shopify's CDN serves text with brotli over HTTP/2, and Shopify minifies only ES5-valid JS (ours uses `class`/`const`, so raw unminified bytes are what gets compressed); and on HTTP/2 the request count matters far less than critical bytes and render-blocking work. A controlled experiment (HTTP/2 + brotli proxy, mobile DPR 3, 4× CPU, Slow 4G, median of 3) showed the per-section files cost little: dropping the five below-the-fold section scripts took home LCP from 1608 to 1492 ms, and also merging the seven section stylesheets only to 1432 ms; on Fast 4G LCP was 384–428 ms in every variant. So §3.1's per-section files stay (cacheable, theme-editor add/remove), non-critical section JS is downloaded only near its section, and the budgets below are **compressed** and **HTTP/2-aware**.

**How the numbers were set.** Each is the value measured by spec 16 on 2026-11-07 (after this pass's media and logo fixes; the larger of the desktop and mobile projects; connection pinned to 4g so the lazy-load distance is a fixed 1250 px) **plus about 15 %**, rounded up. Re-derive them the same way from the spec's `*-measure.json` attachments; tighten them when a fix lands, never loosen them without a written reason here.

| Page | Theme-owned requests before first scroll (measured) | Theme JS, brotli (measured) | CSS, brotli (measured) | Non-video transfer before first scroll, mobile DPR 3, compressed (measured) |
|---|---|---|---|---|
| Home `/` | ≤ **37** (32; was ≤ 41 / 36) | ≤ **27 KB** (23.2; was ≤ 33.5 / 29.0) | ≤ **28.5 KB** (26.2) | ≤ **465 KB** (451) |
| Product | ≤ **23** (20) | ≤ **27.5 KB** (24.2) | ≤ **20.5 KB** (18.2) | ≤ **285 KB** (245) |
| Collection | ≤ **26** (22) | ≤ **24 KB** (20.6) | ≤ **20.5 KB** (17.6) | ≤ **390 KB** (339) |
| Search | ≤ **23** (20) | ≤ **24 KB** (20.6) | ≤ **22.5 KB** (19.2) | ≤ **270 KB** (234) |
| Cart page | ≤ **19** (16) | ≤ **20.5 KB** (17.7) | ≤ **18.75 KB** (16.2) | ≤ **117 KB** (102) |
| Content (`/pages/contact`) | ≤ **19** (16) | ≤ **22 KB** (19.1) | ≤ **18.5 KB** (15.9) | ≤ **118 KB** (103) |
| Customer (`/account/login`) | ≤ **20** (17) | ≤ **22 KB** (19.1) | ≤ **20 KB** (17.2) | ≤ **120 KB** (104) |

- **Requests** count the document, theme assets and media; `content_for_header` platform requests are excluded (the preview has none). Video is excluded from transfer (its own rows below). KB = 1,024 bytes.
- **Render-blocking CSS, every template:** ≤ **4** stylesheets and ≤ **14.5 KB** brotli (measured: the three global files, 12.2 KB).
- **GSAP:** 0 bytes before the first scroll on every page; ≤ 125 KB raw after scrolling the home page.
- **Product row (revision round 1, re-measured 2026-11-07):** was ≤ 29 requests / ≤ 650 KB (measured 25 / 563 KB, far above the reviewer's 350 KB target). At DPR 3 media 3–4 of the mobile rail (Chromium's lazy-load margin also applies inside horizontal scrollers) and the related-product fetch plus its card images started before the first scroll. Fixed in COMMERCE: rail media 3+ stay `display:none` until the visitor first uses the gallery, related products load only when in view (or within 400 px after a scroll), and the gallery / related `sizes` match the rendered widths (§6.2). Measured 20 requests (desktop) / 245 KB (mobile DPR 3: LCP front 1200w 82 KB, back slide 38.5 KB, wordmark, 3 fonts, buy-bar thumb, CSS/JS); the row is that + ~15 %. JS and CSS ceilings unchanged (still ≥ 12 % over the measured value). `dev/tests/16-performance.spec.mjs` BUDGETS.product must mirror this row (HARNESS).
- **Home row (revision round 1, re-measured 2026-11-07 by the integrator):** HOME moved the five below-the-hero sections to CORE's `data-sf-module` loader (PERF-06); only `sf-featured-collection.js` loads before the first scroll. Measured desktop 32 / mobile 29 requests, JS 23.2 KB br; requests and JS are tightened to measured + ~15 %. CSS (26.2 KB, +1.5 KB for the campaign edge mask and hero copy rules) and transfer (451 KB at mobile DPR 3, 3 % under the cap) keep their ceilings: the transfer now includes the signature front still (`sf-signature-front-1200`, 82 KB), which is byte-identical to the product front MEDIA republished, and is the first row to watch.
- **Per-file caps (brotli q11; enforced for the always-loaded files):** `sf-core.js` ≤ **8 KB** br and ≤ **33 KB** raw (its measured size, ruling §15.14: 8,113 B br / 33,503 B raw), `sf-header.js` ≤ 4 KB, `sf-header.css` ≤ 4.5 KB, `sf-product-card.css` ≤ 2.5 KB, `sf-product-card.js` ≤ 1.75 KB, `sf-cart.js` ≤ 5.125 KB, `sf-base.css` ≤ 6.5 KB. On-demand modules: §4.1.

| Asset | Budget |
|---|---|
| Fonts | **Exactly the 5 files of DESIGN §3.1**, Latin subset, `font-display: swap`, **each ≤ 40 KB**: `sf-font-display-300.woff2`, `sf-font-display-300-italic.woff2` (Spectral), `sf-font-text-400.woff2`, `sf-font-text-500.woff2` (Archivo, static instances at wdth 100) and `sf-font-label-500.woff2` (Archivo at wght 500 / wdth 115, declared as the family "Archivo Label"). MEDIA instances them with `fontTools.varLib.instancer`; the 90 KB variable file is **not** shipped under any name. **Preload exactly 2**: `sf-font-text-400.woff2` and `sf-font-label-500.woff2`, emitted with Shopify's `preload_tag` (`{{ 'x' \| asset_url \| preload_tag: as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }}`, §8.6; PLAT-09), which also sends them in the HTTP `Link` header; never the italic. Metric-matched fallbacks are DESIGN §3.2's. |
| Hero end still (LCP) | Desktop webp 1600 ≤ 200 KB (960 and 1920 scale accordingly), jpg 1600 ≤ 220 KB. Mobile webp 720 ≤ 110 KB. No grain (FILM A7). |
| Hero intro (12.8 s, H.264) | `sf-film-desktop.mp4` ≤ 3.5 MB; `sf-film-mobile.mp4` ≤ 2.4 MB (FILM A8). |
| Hero loop (5.6 s, H.264) | `sf-film-loop-desktop.mp4` ≤ 1.5 MB; `sf-film-loop-mobile.mp4` ≤ 1.0 MB. |
| Video requests per visit | At most **one intro file and one loop file** (one orientation each). Later page views in the session: loop only. Reduced motion or save-data: **zero** (until the visitor presses PLAY). |
| Other default stills | ≤ 180 KB at the largest width, ≤ 90 KB at ≤ 900w (the 2730/3840 px stage renditions are exempt and lazy). |
| Theme folder total | ≤ 40 MB (the Shopify zip upload limit is 50 MB). |
| Core Web Vitals targets | LCP ≤ 2.5 s (mobile, real store), CLS ≤ 0.05 (asserted in tests), INP ≤ 200 ms, no long task > 200 ms during scroll on the desktop preview. |


### 6.2 Rules

- **LCP element per template:**
  - Home: the hero end still `<img>` (§5.2). It is **always painted** (under the intro stage while the intro plays), `loading="eager" fetchpriority="high"`, and never hidden with `opacity: 0`, `visibility` or `display`.
  - PDP: first gallery image (`loading="eager" fetchpriority="high"`).
  - Collection: the first 4 cards use `loading="eager"`, and the first card also gets `fetchpriority="high"`; the rest are lazy.
  - All other images are `loading="lazy" decoding="async"`.
- **Shopify images:** `image_url` + `image_tag` with explicit `widths` and accurate `sizes`. Width sets:
  - Cards `360,540,720,900,1080`, with numeric `sizes` per layout because `var()` can't be used in `sizes`: grid 4-up `(min-width: 990px) 24vw, (min-width: 750px) 48vw, 50vw` (1-up mobile density `100vw`); rail `(min-width: 990px) 27vw, 78vw` (DESIGN §9 B: about 3.6 cards on desktop, 78vw on mobile).
  - PDP gallery `600,900,1200,1600,2000`, sizes `(min-width: 990px) 53vw, (min-width: 750px) 72vw, 100vw` (front + back; detail media in the desktop 2-up grid `(min-width: 990px) 26vw, …`; with an odd number of detail media the first one spans both columns, class `sf-gallery__item--wide`, and takes the full-column sizes, so the grid never ends on an empty cell — integrator, revision round 1); related cards `(min-width: 990px) 23vw, (min-width: 750px) 37vw, 66vw` (rendered widths measured at 390–1440, round 1). On rails, media 3+ stay `display:none` until the visitor first touches, scrolls, focuses or steps the gallery (`[data-primed]`), and related products are fetched only when in view, or within 400 px once the visitor has scrolled.
  - Zoom: a single `2400`.
  - Cart line `120,240`.
  - Predictive search `120,240`.
  - Collection banner `750,1100,1500,2200,3000`.
  - Category tiles `540,720,900,1200`.
  - Never request widths above the image's intrinsic width (`at_most: image.width`).
- **Bundled stills:** pre-sized by MEDIA (§10.1). There's no runtime resizing of assets (`image_url` cannot resize theme assets).
- **CSS:** three render-blocking files plus inline tokens. Everything else is section-scoped (§3.1). No `@import`.
- **JS:** everything `defer`. Lazy-loaded on demand: GSAP, `sf-product.js` in quick view, `sf-quick-view.js`, `sf-predictive-search.js`, `sf-facets.js` (on collection/search it's loaded by the section) and model-viewer. No third-party scripts. No polyfills.
- **Video:**
  - FILM-STORYBOARD A8 settings: H.264 High profile, `yuv420p`, `+faststart`, `-an` (no audio track), BT.709 tagged, **30 fps**, 2 s GOP.
  - Desktop 1920×1080, mobile 720×1280. Intro **12.8 s**, loop **5.6 s**. Weights in §6.1.
  - No src until JS decides a video will play (§5.2). Never requested under reduced motion or save-data (until PLAY); paused off-screen and in hidden tabs.
- **Runtime:**
  - Passive listeners for scroll and touch.
  - No scroll handlers doing layout reads. Use IntersectionObserver, plus at most one rAF-throttled scroll listener for the header.
  - `content-visibility: auto` on the footer, with `contain-intrinsic-size` (never on pinned or ScrollTrigger-measured sections).
  - Nothing animates layout properties.
- **CLS:** every media box has `aspect-ratio`. The header height is reserved by CSS (with `--sf-header-h` set in CSS defaults, not only by JS). Fonts use metric-adjusted fallbacks. The drawer and dialog live in the top layer.

---

## 7. Accessibility requirements (WCAG 2.2 AA)

1. **Landmarks:**
   - one `<header>` (banner) inside sf-header
   - `<nav aria-label="Primary">` for desktop and `<nav aria-label="Mobile">` inside the fullscreen menu
   - `<main id="MainContent" tabindex="-1">` (layout)
   - one `<footer>` (contentinfo) inside sf-footer, with `<nav aria-label="Footer">`
   - Sections use `<section aria-labelledby>` when they have a heading.
   - The cart drawer, search and quick view dialogs have `aria-labelledby`.
2. **Skip link:** it's the first focusable element in `<body>` (`.sf-skip-link`, visible on focus, z `--sf-z-skip`), targets `#MainContent`, and its text is `accessibility.skip_to_content`.
3. **Headings:** exactly one `<h1>` per page.
   - Home: the hero `<h1>` wrapping the textured wordmark (`alt` = shop name).
   - Section E (`index` layout) and Section F use visually hidden `<h2>`s.
   - PDP: the product title.
   - Collection: the collection title.
   - Other templates: the page title.
   - Home sections use `<h2>`, and cards use `<h3>`.
4. **Dialogs and drawers:** native `<dialog>` via `<sf-dialog>`:
   - `showModal` (focus contained, background inert)
   - initial focus on the heading (`tabindex="-1"`) or the close button
   - Esc closes, and focus returns to the trigger
   - close button labelled `general.close`
   - `aria-expanded` on toggle buttons
   - Scroll is locked without layout shift.
   - The cart drawer, menu, search, quick view, size guide, zoom and the facets drawer all follow this.
5. **Disclosure navigation:** the desktop dropdowns use button + `aria-expanded` + `aria-controls`, not `role=menu`. The current page link has `aria-current="page"`.
6. **Variant picker:**
   - one `<fieldset>` + `<legend>` per option, with the legend showing the selected value
   - native `<input type="radio">` (arrow-key operable) with visible `<label>`
   - colour swatches keep a text label (visually hidden) and have a ≥ 3:1 non-text contrast ring when selected
   - unavailable values are announced via visually-hidden "Sold out" / "Unavailable", not only by strike-through
   - The dropdown mode uses `<label for>` + `<select>`.
   - The add button state change is announced via the polite live region ("Sold out"), and its label text changes.
7. **Live regions:** `#sf-live-polite` and `#sf-live-assertive` (layout, CORE). Announce:
   - cart add ("{title} added to cart")
   - quantity change, remove
   - cart errors (assertive)
   - predictive result counts
   - facet result counts ("12 products")
   - newsletter success (role=status in the form)
8. **Forms:**
   - every input has a `<label>` (visually hidden is allowed only for the newsletter email, and only with a visible placeholder-independent context)
   - `autocomplete` attributes on customer and address forms
   - errors linked via `aria-describedby`, with `aria-invalid`
   - focus moves to the error summary on failed submit
9. **Focus:** `:focus-visible` gives a 2px `--sf-focus` outline with 3px offset on all interactive elements, and `outline` is never removed without a replacement. Hover-only information is forbidden (card actions are always visible on touch and appear on focus-within on desktop).
10. **Motion:** `prefers-reduced-motion` plus the merchant and visitor overrides (§3.4, §4.3). The hero intro has SKIP INTRO and the loop has PAUSE (2.2.2); the intro never plays under reduced motion or save-data, and the header and nav are usable from t = 0. Nothing flashes more than 3 times per second. Pinning and scrubbed effects are off under reduced motion (and under `subtle`).
11. **Contrast:** body text ≥ 4.5:1 and large text ≥ 3:1 on its tone background. Text over imagery gets a scrim (`--sf-scrim`) so it meets these ratios. DESIGN.md values MUST pass. The test suite checks with axe.
12. **Targets:** interactive targets are ≥ 44×44 CSS px on coarse pointers (icon buttons get padding).
13. **Images:** product media `alt` comes from Shopify alt text, falling back to the product title + position. Decorative imagery (hero videos and end still, duplicate secondary card image) uses `alt=""` / `aria-hidden`. The logo's accessible name is the shop name.
14. **Language:** `<html lang="{{ request.locale.iso_code }}">`.
15. **No-JS:** navigation, product add (form POST), cart page, search, filtering (submit button) and localization (noscript button) all work without JS.

---

## 8. Preview harness contract (HARNESS)

### 8.1 Purpose and invocation

`dev/preview/server.mjs` is a Node 22 HTTP server (`node:http`, no Express needed). It renders `theme/` with **liquidjs** the way Shopify would, using fixtures. It is dev-only and never shipped.

- Start with `node dev/preview/server.mjs [--port 9292] [--theme theme] [--fixtures dev/preview/fixtures] [--compress]`. The default port is 9292 and the host 127.0.0.1. Playwright reads the port from `SF_PREVIEW_PORT` (default 9292), so parallel runs can use their own server.
- `--compress` (or `SF_PREVIEW_COMPRESS=1`; off by default): text responses (HTML, CSS, JS, JSON, SVG) are brotli/gzip-encoded per `Accept-Encoding` (static files at brotli q11, cached; dynamic HTML at q5) and `/cdn/` files get `Cache-Control: public, max-age=31536000, immutable`, like the Shopify CDN. Use it for lab timing (Lighthouse, LCP). Spec 16 does **not** depend on it: it computes compressed sizes itself.
- `npm --prefix dev run preview` / `npm --prefix dev test` scripts.
- Liquid is re-read from disk per request (no restart while developing).
- HTML responses send `Cache-Control: no-store` and `X-Preview: 1`.
- Every full-page HTML response gets `<meta name="robots" content="noindex">` injected before `</head>` and the **ribbon** injected before `</body>`:
  ```html
  <div id="sf-preview-ribbon" role="note" aria-label="Preview with sample data"
       style="position:fixed;left:12px;bottom:12px;z-index:2147483000;pointer-events:none;font:600 11px/1 system-ui,sans-serif;letter-spacing:.14em;padding:8px 10px;background:#C3C8CD;color:#000">PREVIEW · SAMPLE DATA</div>
  ```
  It is not injected into Section Rendering responses or Ajax JSON.
- Theme editor events, `request.design_mode` (always `false`) and the editor UI are **not** emulated.

### 8.2 Routes

| Route | page_type / template | Notes |
|---|---|---|
| `GET /` | `index` | |
| `GET /collections` | `list-collections` | |
| `GET /collections/all` | `collection` | Synthetic "all" collection (title "Products", all fixture products, sort default `created-descending`). |
| `GET /collections/:handle` | `collection` | 404 template if unknown. |
| `GET /products/:handle`, `GET /collections/:c/products/:handle` | `product` | `?variant=ID` selects a variant; `?option_values=id,id` selects by option value ids. |
| `GET /search` | `search` | `q`, `type`, `options[prefix]`, filters, `sort_by`, `page`. |
| `GET /search/suggest` | (Section Rendering) | Requires `section_id`. `q`, `resources[type]`, `resources[limit]`. Renders the section with the `predictive_search` object. |
| `GET /recommendations/products` | (Section Rendering) | `product_id`, `limit`, `intent` (`related` \| `complementary`), `section_id`. Renders with the `recommendations` object. `/recommendations/products.json` returns `{ products: [...] }`. |
| `GET /cart` | `cart` | |
| `POST /cart` | | Form `updates[]` or `updates[key]`, `note`. If `checkout` is present → 302 to `/checkout`, else 302 to `/cart`. |
| `GET /checkout` | | A static, neutral HTML page: "Checkout is provided by Shopify and is not available in this preview." (ribbon included). **No fake checkout UI.** |
| `GET /cart.js` | | Cart JSON (§8.4). |
| `POST /cart/add`, `/cart/add.js` | | §8.4 |
| `POST /cart/change`, `/cart/change.js` | | §8.4 |
| `POST /cart/update`, `/cart/update.js` | | §8.4 |
| `POST /cart/clear`, `/cart/clear.js` | | §8.4 |
| `GET /pages/:handle` | `page` (+ `template_suffix` from fixture, e.g. `contact` → `page.contact.json`) | |
| `GET /blogs/:blog` | `blog` | |
| `GET /blogs/:blog/:article` | `article` | |
| `POST /blogs/:blog/:article/comments` | | 302 back with `#comments`. |
| `GET /policies/:handle` | | Layout rendered with `content_for_layout` = a neutral `<div class="shopify-policy__container"><h1>{title}</h1><p>Policy to be published by the store owner.</p></div>`. |
| `GET /account` | `customers/account` | 302 → `/account/login` unless cookie `preview_customer=1`. |
| `GET /account/login` | `customers/login` | |
| `POST /account/login` | | Sets the cookie and 302s to `/account`. With an empty password it re-renders with `form.errors`. |
| `GET /account/logout` | | Clears the cookie, 302 to `/`. |
| `GET /account/register`, `POST /account` | `customers/register` | POST sets the cookie and 302s to `/account`. |
| `GET /account/addresses`, `POST /account/addresses[/:id]` | `customers/addresses` | |
| `GET /account/orders/:name` | `customers/order` | |
| `GET /account/activate/:id/:token` | `customers/activate_account` | |
| `GET /account/reset/:id/:token` | `customers/reset_password` | |
| `POST /account/recover` | | 302 to `/account/login#recover` with `form.posted_successfully?`. |
| `POST /contact` | | `form_type=customer` (newsletter) → 302 `{return_to or referer path}?customer_posted=true#{form id}`. `form_type=contact` → `?contact_posted=true#contact_form`. On the following GET the matching form has `posted_successfully? == true`. An invalid email → re-render with `form.errors` (`email`). |
| `POST /localization` | | Sets cookie `preview_country`, then 302 to `return_to`. `localization.country` follows the cookie. Currency iso and symbol change; **amounts are not converted** (documented in the ribbon tooltip `title`). |
| `GET /password`, `POST /password` | `password` (layout `password`) | POST → 302 `/`. |
| `GET /gift_cards/:code` | `gift_card` (liquid, `layout none`) | |
| `GET /404` and any unmatched route | `404` | Status 404. |
| `GET /cdn/shop/t/preview/assets/:file` | static | Serves `theme/assets/:file` (correct MIME, `Accept-Ranges` + **206 range support for mp4**, required for video). |
| `GET /cdn/preview-media/*` | static | Serves `media/processed/*` (fixture product imagery). |
| `GET /__preview/health` | | `{ ok: true }` |
| `POST /__preview/reset` | | Clears the cart, customer and localization cookies for the caller. |
| `GET /__preview/state` | | `{ cart, settings, customer }` for tests. |

On any HTML route:
- `?section_id=X` → returns only the section HTML (wrapper included) with status 200, or 404 if the section doesn't exist.
- `?sections=a,b` → `application/json` `{ a: html|null, b: html|null }`.
- Test overrides:
  - `?preview_settings=<url-encoded JSON>` merges into theme settings and persists in cookie `preview_settings`; `?preview_settings=reset` clears it.
  - `?preview_sections=<JSON {"<templateSectionKey>": {settingId: value, "blocks": {"<block id or block type>": {settingId: value}}}}>` applies to this request only. The optional `blocks` key merges settings into the template's existing blocks (by id, else every block of that type); it never adds blocks.

### 8.3 Rendering model (must match Shopify)

1. **Settings:** defaults from `settings_schema.json` (every `settings[].default`), overlaid by `settings_data.json` `current`, overlaid by `preview_settings`. Typed resolution:

   | Setting type | Resolves to |
   |---|---|
   | `link_list` | linklist drop (`menus.json`) |
   | `collection` | collection drop (handle; `"all"` → all collection) |
   | `product`, `page`, `blog` | drop by handle |
   | `collection_list`, `product_list` | arrays |
   | `image_picker`, `video` | `nil` (unless a fixture value is given) |
   | `checkbox` | boolean |
   | `range`, `number` | number |
   | `richtext`, `inline_richtext`, `text`, `url`, `color`, `select`, `liquid` | strings |

2. **Template resolution:**
   - JSON templates: `templates/{type}[.{suffix}].json` → `templates/{type}[.{suffix}].liquid` → without the suffix.
   - Customers: `templates/customers/{name}.json`.
   - A JSON template's `layout` key (string or `false`) selects `layout/{name}.liquid`, defaulting to `theme`.
   - In a Liquid template, `{% layout 'x' %}` / `{% layout none %}`.
   - Sections in a JSON template render in `order`, skipping `disabled: true`.
   - Template section id = `template--preview__{key}`.
   - Wrapper: `<{schema.tag or 'div'} id="shopify-section-{id}" class="shopify-section {schema.class}">…</…>`.
3. **Section groups:**
   - `{% sections 'header-group' %}` reads `sections/header-group.json`.
   - Each section id = `sections--preview__{key}`, wrapper class `shopify-section shopify-section-group-{group-file-name}`.
   - Output is wrapped in `<!-- BEGIN sections: … -->`/`<!-- END sections: … -->`.
4. **Static sections:** `{% section 'sf-cart-drawer' %}` → id `sf-cart-drawer`, settings = schema defaults.
5. **Section scope:**
   - `section` = `{ id, settings, blocks: [{ id, type, settings, shopify_attributes: '' }], index, index0, location }`.
   - Sections **cannot** see variables assigned in the layout or template (isolated scope), but they see the globals (§8.6).
   - Blocks follow `block_order`, and block settings defaults come from the block schema.
6. **`render` isolation:**
   - Snippets see only passed params + globals (liquidjs `render` semantics; pass Shopify globals via per-render `globals`).
   - `{% render 'x' for items as item %}` and `with … as` are supported.
   - `{% include %}` throws.
7. **Section Rendering API:**
   - The page context of the request URL is built (product, collection, search, cart), then only the requested section is rendered.
   - A name is resolved first as a template/group section id (`template--preview__*` / `sections--preview__*`), then as a section file name (default settings).
8. **Errors:** Liquid errors render inline as `<span class="preview-liquid-error">Liquid error (sections/x.liquid:12): message</span>` and are logged to stderr. Tests fail on the presence of `Liquid error` or `translation missing`.
9. **Locales:**
   - `| t` reads `theme/locales/en.default.json`.
   - Interpolation uses `{{ name }}`.
   - `count` selects `one`/`other`.
   - Keys ending in `_html` are not escaped; others are HTML-escaped interpolations.
   - A missing key outputs `translation missing: en.{key}`.
10. **`content_for_header`** outputs:
    ```html
    <script>window.Shopify={shop:"steadfast.preview",locale:"en",currency:{active:"<iso>",rate:"1.0"},country:"<iso>",designMode:false,routes:{root:"/"},theme:{name:"Preview",role:"development"},loadFeatures:function(f,cb){cb&&cb()}};</script>
    ```
    `Shopify.loadFeatures` is a stub (no model-viewer in the preview).
11. **`{% stylesheet %}` / `{% javascript %}`** are supported for completeness: their contents are collected and appended to `content_for_header` as `<style>`/`<script>`. The theme MUST NOT use them (§0).
12. liquidjs options: `{ strictFilters: true, strictVariables: false, jsTruthy: false, outputEscape: undefined, greedy: false, extname: '.liquid', root: ['theme/snippets'], relativeReference: false, dynamicPartials: true, ownPropertyOnly: false }`. Drops are JS classes with prototype getters; `ownPropertyOnly` must stay false. Note: Shopify treats `empty` and `blank` specially; implement `blank` (nil, false, '', whitespace-only string, empty array/object) on drops.

### 8.4 Ajax Cart API (mock; shapes follow Shopify)

The cart is in memory, keyed by cookie `cart` (a random token), and persists across requests until `/__preview/reset` or a server restart.

- **Cart JSON** (`/cart.js`, and the body of change/update/clear):
  ```
  { token, note, attributes, original_total_price, total_price, total_discount: 0, total_weight: 0, item_count,
    items: [ { id /*variant id*/, variant_id, key: "<variantId>:<hash>", product_id, title /*"Product - Variant"*/,
               product_title, variant_title, quantity, price, original_price, final_price, line_price, original_line_price,
               final_line_price, discounts: [], url /*"/products/h?variant=id"*/, handle, image /*url*/,
               featured_image: { url, width, height, alt, aspect_ratio }, options_with_values: [{name,value}],
               product_has_only_default_variant, requires_shipping: true, product_type, vendor, sku,
               quantity_rule: {min,max,increment}, properties: {} } ],
    requires_shipping, currency, items_subtotal_price, cart_level_discount_applications: [] }
  ```
  All prices are integer cents.
- **`POST /cart/add.js`:**
  - Accepts a JSON body `{ items: [{id, quantity, properties}] , sections?, sections_url? }` **or** form-encoded `id`, `quantity`, `sections`.
  - It merges the quantity into an existing line with the same variant and properties.
  - Response: for an `items` array, `{ items: [lineItem...] }`; for a single `id`, the line item JSON. Either way plus `sections: {id: html}` when requested. `sections` may be a comma-separated string or an array, and is rendered in the context of `sections_url` (default `/`).
  - **422** if the variant is unknown (`{status:422,message:"Cart Error",description:"Cannot find variant"}`), if it's unavailable (`description: "The product '{title}' is already sold out."`), or if the requested total exceeds `inventory_quantity` when `inventory_management=="shopify" && inventory_policy=="deny"`. In the last case it adds the maximum possible and responds 422 with `description: "You can only add {n} {title} to the cart."`. Quantity rules are enforced (min/increment/max → 422 with a description).
  - The non-`.js` form POST → 302 `/cart`.
- **`POST /cart/change.js`:** `{ id: key|variantId, line?: 1-based, quantity, sections?, sections_url? }`. Quantity 0 removes the line. Returns cart JSON (+ `sections`). Over-inventory requests are capped, with a 422 as above.
- **`POST /cart/update.js`:** `{ updates: {key|variantId: qty} | [qty...], note?, attributes?, sections?, sections_url? }` → cart JSON (+ `sections`).
- **`POST /cart/clear.js`** → empty cart JSON (+ `sections`).
- The Liquid `cart` object reflects the same state, with line items as drops: `item.key`, `item.variant`, `item.product`, `item.image`, `item.url`, `item.options_with_values`, `item.final_price`, `item.final_line_price`, `item.original_line_price`, `item.quantity`, `item.line_level_discount_allocations` (empty), `item.variant.quantity_rule`.

### 8.5 Collection filtering, sorting, search and pagination semantics

- **Filters** are generated per collection or search result set from fixture products, in this order:
  1. `availability`: type `boolean`, param `filter.v.availability`, values `1` "In stock" and `0` "Out of stock".
  2. `price`: type `price_range`, params `filter.v.price.gte` / `filter.v.price.lte` in **major units**. `filter.min_value.value` / `max_value.value` are **cents** or nil, and `range_max` is the cents max.
  3. One `list` filter per product option name present (`filter.v.option.{handleized name}`, label = option name), with values in the fixture option order.
  4. `product_type`: type `list`, param `filter.p.product_type`.
- **Semantics:**
  - Values of the same filter are OR'd; different filters are AND'd.
  - Variant-level filters (`filter.v.*`: availability, price, options) must be satisfied by **the same variant**.
  - `filter_value.count` = the number of products that would match if this value were added to the current active filters (Shopify semantics).
  - Each value has `active`, `param_name`, `value`, `label`, `url_to_add` and `url_to_remove`. Each filter has `url_to_remove`, `active_values`, `inactive_values` and `operator: 'OR'`.
  - The generated URLs preserve `q`, `sort_by` and other filters, and drop `page`.
  - `swatch` on option values comes from the fixture `swatch.color` (nil otherwise).
  - `presentation`: `swatch` for colour options with swatches, else `text`.
- **Sorting** (`sort_by`):

  | Value | Order |
  |---|---|
  | `manual` | fixture collection order |
  | `best-selling` | `best_selling_rank` ascending, then manual |
  | `title-ascending` / `title-descending` | by title |
  | `price-ascending` / `price-descending` | by `price_min` (ties → title) |
  | `created-ascending` / `created-descending` | by `created_at` |
  | `relevance` | search only |

  `collection.sort_options` lists `{name, value}` in Shopify order. `collection.sort_by` is the current value; `collection.default_sort_by` comes from the fixture. Unknown values fall back to the default.
- **Search:**
  - Tokens from `q` are matched case-insensitively against title, product_type, tags and vendor (products), title/content (pages, articles).
  - `options[prefix]=last` gives prefix matching on the last token.
  - `type` filters result types (`product`, `page`, `article`; default all).
  - `search.results` mixes types (`object_type` per item), and `search.results_count` is set.
  - `search.filters` follow the collection rules, applied to the product results.
  - `search.performed` is true when `q` is present. `search.terms` is set.
  - Predictive search: products, collections, pages, articles and `queries` (`[{text, styled_text, url}]` from matching titles), each limited by `resources[limit]`.
- **Recommendations** (`intent=related`): products sharing `product_type`, then a shared collection, then any. The current product is excluded. Limited by `limit` (default 4). `recommendations.performed = true`, plus `intent`.
- **Pagination:**
  - `{% paginate X by N %}` slices `X` (`collection.products`, `search.results`, `blog.articles`, `customer.orders`, `customer.addresses`) using `?page=`. `N` may be an expression.
  - The `paginate` object has `current_page`, `current_offset`, `items`, `pages`, `page_size`, `previous {title,url,is_link}`, `next {…}` and `parts [{title,url,is_link}]` (ellipsis parts with `is_link:false, title:'…'`).
  - Page URLs preserve the other params.

### 8.6 ALLOWED Liquid surface (the theme MUST stay within this; HARNESS MUST implement all of it)

**Tags:**
- standard: `assign`, `capture`, `if`/`elsif`/`else`, `unless`, `case`/`when`, `for` (with `limit`, `offset`, `reversed`, ranges, `else`), `break`, `continue`, `cycle`, `raw`, `comment`, inline `{% # … %}`, `liquid`, `echo`, `render` (`with`/`for`/`as`/named params)
- Shopify: `layout`, `section`, `sections`, `schema` (no output), `style` (outputs `<style data-shopify>`), `doc` (no output), `form`, `paginate`
- harness-only completeness: `stylesheet`, `javascript`, `content_for` (`'blocks'` → renders nothing; `'block'` → renders nothing). The theme MUST NOT use these.
- Forbidden: `include`, `tablerow`, `increment`/`decrement`.

`{% form %}` types (attributes `id:`, `class:`, `novalidate:`, `data-*:` and `return_to:` pass through as HTML attributes). Output is `<form method="post" action="…" accept-charset="UTF-8" …><input type="hidden" name="form_type" value="…"><input type="hidden" name="utf8" value="✓">…</form>`. Inside the block, `form` has `errors` (with `messages`, `translated_fields`, iterable field names), `posted_successfully?`, `email`, `first_name`, `last_name`, `body`, `id`, `set_as_default_checkbox` and the address fields.

| Form type | Action | Args |
|---|---|---|
| `product` | `/cart/add` (+ `enctype="multipart/form-data"`) | `product` |
| `customer` | `/contact#<id>` | |
| `contact` | `/contact#contact_form` | |
| `create_customer` | `/account` | |
| `customer_login` | `/account/login` | |
| `recover_customer_password` | `/account/recover` | |
| `reset_customer_password` | `/account/reset` | |
| `activate_customer_password` | `/account/activate` | |
| `customer_address` | `/account/addresses` or `/account/addresses/{id}` | `customer.new_address` \| `address` |
| `localization` | `/localization` | |
| `storefront_password` | `/password` | |
| `new_comment` | `/blogs/{b}/{a}/comments` | `article` |

**Filters (standard):** `abs append at_least at_most capitalize ceil compact concat date default divided_by downcase escape escape_once first floor join last lstrip map minus modulo newline_to_br plus prepend remove remove_first replace replace_first reverse round rstrip size slice sort sort_natural split strip strip_html strip_newlines sum times truncate truncatewords uniq upcase url_decode url_encode where`. `date` supports strftime and `'now'`. `default` supports `allow_false: true`.

**Filters (Shopify):**

| Filter | Usage / semantics the harness must implement |
|---|---|
| `asset_url` | `'f' \| asset_url` → `/cdn/shop/t/preview/assets/f?v={mtime}` |
| `inline_asset_content` | Contents of an SVG/CSS/JS asset < 15 KB. Larger → Liquid error. |
| `shopify_asset_url` | Gift card only (`'vendor/qrcode.js'`) → `/cdn/shopify-assets/vendor/qrcode.js` (the harness serves a stub that defines `window.QRCode` as a no-op) |
| `stylesheet_tag` | `<link href rel="stylesheet" type="text/css" media="all">`. The `preload: true` arg is accepted and ignored. |
| `preload_tag` | `{{ 'x.woff2' \| asset_url \| preload_tag: as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }}` → `<link href as type crossorigin rel="preload">` (named params only, `as` required, `rel` not overridable; input must come from `asset_url`/`shopify_asset_url`) and the URL is added to the response `Link` header, as on Shopify (https://shopify.dev/docs/api/liquid/filters/preload_tag). Used for the two font preloads in `layout/theme.liquid` and `layout/password.liquid` (PLAT-09; replaces hand-written `<link rel="preload">`, clearing theme-check `AssetPreload`). |
| `script_tag` | Gift card only. `<script src></script>` |
| `image_url` | Args `width`, `height`, `crop`. Accepts image, media (uses `preview_image`), product (featured_media), variant (featured_media), collection (image), article (image), line_item (image) and video `preview_image`. Harness: returns the smallest available fixture width ≥ the requested width (else the largest). |
| `image_tag` | Args `widths` (CSV), `sizes`, `loading`, `fetchpriority`, `decoding`, `class`, `alt`, `width`, `height`, `preload` (ignored). It emits `src`, `srcset` (from `widths`, each ≤ the intrinsic width, else the fixture widths), `sizes`, `width`, `height` (computed from the aspect ratio) and `alt` (default `image.alt`), passing every other arg through as an attribute. |
| `video_tag` | Args `autoplay`, `loop`, `muted`, `controls`, `playsinline`, `image_size`, `class`. `<video …><source src type>…<img src=preview></video>` |
| `external_video_url` | Args `autoplay`, `loop`, `mute`, `controls`, `enablejsapi`, `playsinline` → youtube-nocookie/vimeo URL |
| `external_video_tag` | `<iframe>` with `title`, `class` |
| `model_viewer_tag` | `<model-viewer>` stub |
| `placeholder_svg_tag` | Arg is a class string. Any name → a neutral inline `<svg class>` |
| `money`, `money_with_currency`, `money_without_currency`, `money_without_trailing_zeros` | Using `shop.money_format` / `money_with_currency_format` with `{{amount}}`, `{{amount_no_decimals}}`, `{{amount_with_comma_separator}}` |
| `t` | §8.3 |
| `json` | Drops serialize to their Shopify JSON shape |
| `handleize` (alias `handle`) | |
| `pluralize` | `'item' \| pluralize: 'items'` used as `n \| pluralize: 'a','b'` |
| `default_errors` | `<ul class="errors">…</ul>` |
| `format_address` | `<p>` lines |
| `highlight` | `highlight: search.terms` → `<strong class="highlight">` |
| `structured_data` | Product/article JSON-LD object, output as JSON (used inside `<script type="application/ld+json">`) |
| `time_tag` | `<time datetime>` with a strftime arg |
| `url_param_escape` | |
| `item_count_for_variant` | `cart \| item_count_for_variant: variant.id` |
| `payment_button` | `{{ form \| payment_button }}` inside `{% form 'product' %}` only (any other input is a Liquid error). Shopify renders the accelerated checkout buttons client-side into `<div data-shopify="payment-button" class="shopify-payment-button">`. **Harness:** emits that container with one **inert** placeholder: a disabled `<button class="shopify-payment-button__button shopify-payment-button__button--unbranded">` reading "Accelerated checkout (renders on Shopify)". Never a working or fake checkout. Theme use: `sf-product-form` renders it under Add to cart **only** when `show_dynamic_checkout` is on (block setting on `sf-main-product` `buy_buttons`, default **false**; ruling §15.11). |

Everything else is **forbidden** until it's added here. Explicitly forbidden: `img_url`, `asset_img_url`, `img_tag`, `link_to*`, `within`, `font_*`, `color_*`, `currency_selector`, `payment_type_*` (not needed: `payment_button` covers dynamic checkout), `metafield_*`, `customer_*_link`, `hmac_*`, `base64*`, `md5`, `sha*`, `camelize`, `find*`, `has`, `reject`.

**Global objects:**
- `shop`: `name`, `url`, `domain`, `email`, `description`, `currency`, `money_format`, `money_with_currency_format`, `customer_accounts_enabled`, `customer_accounts_optional`, `password_message`, `policies` (each with `title`, `url`, `body`, `handle`), `privacy_policy`, `refund_policy`, `shipping_policy`, `terms_of_service`, `brand` (nil in the preview)
- `settings` (all ids in §2.1)
- `request`: `locale.iso_code`, `path`, `host`, `origin`, `page_type`, `design_mode`
- `routes`: `root_url`, `account_url`, `account_login_url`, `account_logout_url`, `account_register_url`, `account_addresses_url`, `account_recover_url`, `collections_url`, `all_products_collection_url`, `search_url`, `predictive_search_url`, `cart_url`, `cart_add_url`, `cart_change_url`, `cart_update_url`, `cart_clear_url`, `product_recommendations_url`
- `template`: `name`, `suffix`, `directory`, and `template` as a string, e.g. `"product"` / `"customers/login"`
- `page_title`, `page_description`, `canonical_url`, `page_image`, `content_for_header`, `content_for_layout`, `current_page`, `current_tags`, `handle`
- `localization`:
  - `country`: `iso_code`, `name`, `currency` (with `iso_code`, `symbol`)
  - `available_countries`
  - `language`: `iso_code`, `name`, `endonym_name`
  - `available_languages`
- `all_country_option_tags`, `country_option_tags` (`<option value data-provinces>` strings)
- `cart` (§8.4), `additional_checkout_buttons` (false in the preview), `content_for_additional_checkout_buttons` (empty string)
- `customer` (nil unless logged in): `id`, `first_name`, `last_name`, `name`, `email`, `orders` (paginate-able), `orders_count`, `addresses`, `addresses_count`, `default_address`, `new_address`, `has_account`
- `collections[handle]`, `pages[handle]`, `blogs[handle]`, `linklists[handle]`
- `predictive_search`, `recommendations`, `search`, `paginate` (in-tag)
- `product` / `collection` / `page` / `blog` / `article` / `order` / `gift_card` on their templates

**Object properties:**

- **product:** `id`, `title`, `handle`, `url`, `vendor`, `type`, `description`, `content`, `featured_media`, `media`, `price`, `price_min`, `price_max`, `price_varies`, `compare_at_price`, `compare_at_price_min`, `compare_at_price_max`, `available`, `options`, `options_with_values`, `variants`, `selected_variant`, `selected_or_first_available_variant`, `first_available_variant`, `has_only_default_variant`, `tags`, `collections`, `template_suffix`, `created_at`, `published_at`, `gift_card?`, `requires_selling_plan` (false), `quantity_price_breaks_configured?` (false)
- **product_option** (from `options_with_values`): `name`, `position`, `values`, `selected_value`
- **product_option_value:** `id`, `name`, `available` (semantics §4.7: has an available variant matching the other selected values), `selected`, `swatch` (with `color`, or nil), `variant` (the variant for the selection with this value, or nil), `product_url`. It stringifies to `name`.
- **variant:** `id`, `title`, `available`, `price`, `compare_at_price`, `sku`, `option1`, `option2`, `option3`, `options`, `featured_media`, `url`, `selected`, `inventory_management`, `inventory_policy`, `quantity_rule` (with `min`, `max`, `increment`), `requires_shipping`, `product`. `inventory_quantity` exists in fixtures but the **theme must not render it**.
- **media:** `id`, `media_type` (`image`\|`video`\|`external_video`\|`model`), `alt`, `position`, `aspect_ratio`, `preview_image`, `width`, `height`, `src`.
  - video media: `sources` (each `url`, `mime_type`, `format`, `width`, `height`), `duration`
  - external_video: `host`, `external_id`
- **image:** `src`, `url`, `width`, `height`, `alt`, `aspect_ratio`, `id`, `presentation.focal_point`
- **video** (setting): `sources`, `preview_image`, `aspect_ratio`, `duration`, `alt`
- **collection:** `id`, `title`, `handle`, `url`, `description`, `image`, `featured_image`, `products`, `products_count`, `all_products_count`, `filters`, `sort_by`, `default_sort_by`, `sort_options`, `template_suffix`
- **filter / filter_value:** as in §8.5
- **search:** `performed`, `terms`, `results`, `results_count`, `filters`, `sort_by`, `default_sort_by`, `sort_options`, `types`
- **predictive_search:** `performed`, `terms`, `resources.products`, `resources.collections`, `resources.pages`, `resources.articles`, `resources.queries`
- **recommendations:** `performed`, `products`, `products_count`, `intent`
- **linklist:** `title`, `handle`, `links`, `levels`
- **link:** `title`, `url`, `type`, `active`, `current`, `child_active`, `child_current`, `links`, `levels`, `object`
- **page:** `id`, `title`, `handle`, `url`, `content`, `template_suffix`
- **blog:** `title`, `handle`, `url`, `articles`, `articles_count`, `comments_enabled?`
- **article:** `id`, `title`, `handle`, `url`, `content`, `excerpt`, `excerpt_or_content`, `image`, `author`, `published_at`, `tags`, `comments`, `comments_count`, `comments_enabled?`, `comment_post_url`
- **order:** `name`, `created_at`, `financial_status_label`, `fulfillment_status_label`, `cancelled`, `cancelled_at`, `line_items`, `subtotal_price`, `total_price`, `total_tax`, `shipping_price`, `shipping_address`, `billing_address`, `customer_url`, `order_status_url`
- **address:** `id`, `first_name`, `last_name`, `company`, `address1`, `address2`, `city`, `province`, `province_code`, `country`, `country_code`, `zip`, `phone`, `url`
- **gift_card:** `code`, `balance`, `initial_value`, `currency`, `expires_on`, `enabled`, `expired`, `qr_identifier`, `pass_url`, `product`

### 8.7 Fixtures (`dev/preview/fixtures/*.json`)

Every fixture file's root object carries `"placeholder": true` and a `"_note"` explaining that it holds sample data derived only from the supplied assets. **Prices, sizes, inventory, SKUs and dates are placeholders.** Descriptions are neutral, e.g. "Placeholder description. Product details to be confirmed by STEADFAST." They have no fabric, fit or origin claims.

- `shop.json`:
  ```
  { placeholder, name: "STEADFAST", domain: "steadfast.preview", url, email: null, currency: "USD",
    money_format: "${{amount}}", money_with_currency_format: "${{amount}} USD", customer_accounts_enabled: true,
    customer_accounts_optional: true, password_message: "Opening soon.",
    policies: [ {handle:"privacy-policy",title:"Privacy policy"}, {handle:"refund-policy",title:"Refund policy"},
                {handle:"shipping-policy",title:"Shipping policy"}, {handle:"terms-of-service",title:"Terms of service"} ],
    countries: [ {iso_code:"US",name:"United States",currency:{iso_code:"USD",symbol:"$"}},
                 {iso_code:"GB",name:"United Kingdom",currency:{iso_code:"GBP",symbol:"£"}},
                 {iso_code:"CA",name:"Canada",currency:{iso_code:"CAD",symbol:"$"}} ],
    languages: [ {iso_code:"en",name:"English",endonym_name:"English"} ] }
  ```
  The currency and country list are placeholders for exercising the selector only.
- `products.json`: an array. Each item:
  ```
  { "id": 1001, "handle", "title", "product_type": "Hoodies|Tracksuits|Bottoms", "vendor": "STEADFAST",
    "description_html", "tags": [], "created_at", "published_at", "best_selling_rank",
    "options": [ { "name": "Size", "values": [ { "id": 5001, "name": "S" } ] },
                 { "name": "Color", "values": [ { "id": 5101, "name": "Washed blue-grey", "swatch": { "color": "#6f7e8c" } } ] } ],
    "variants": [ { "id": 2001, "options": ["S","Washed blue-grey"], "price": 0, "compare_at_price": null, "sku": null,
                    "available": true, "inventory_management": "shopify", "inventory_policy": "deny",
                    "inventory_quantity": 5, "quantity_rule": { "min": 1, "max": null, "increment": 1 },
                    "featured_media_id": 3001 } ],
    "media": [ { "id": 3001, "media_type": "image", "alt", "position": 1,
                 "image": { "base": "products/<handle>--<view>", "ext": "webp", "widths": [360,540,720,1080,1440], "width": 1440, "height": 1800 } } ],
    "placeholder": true, "placeholder_fields": ["price","variants","inventory","description","created_at"] }
  ```
  Products: **only** the five garments in CONTEXT, and only views that exist. For example, the stone embossed tracksuit has back views only: **no fabricated front view**. Garment 4 has two colourways (Washed charcoal, Washed grey) with variant `featured_media_id`s from the respective footage frames. At least one size variant per product is sold out (inventory 0), so availability states are exercised. Prices must be placeholder round numbers in cents, identical across a product's variants (variation is not needed). At least one product (the zip hoodie: several sizes × one colour value) has exactly one varying option, so the card size cells (§4.6) are exercised.
- `collections.json`: `[{ id, handle, title, description_html, image: <image ref or null>, product_handles: [...], default_sort_by: "manual", placeholder: true }]`. Collections: `hoodies`, `tracksuits`, `tops` (**empty**, exercises the empty state), `bottoms`, `new-arrivals`, `zip-ups`.
- `menus.json`:
  - `main-menu`: Shop → [Hoodies, Tracksuits, Tops, Bottoms, New arrivals, All products], Campaign → `/#campaign`, Contact → `/pages/contact`
  - `footer-shop` (SHOP): Hoodies, Tracksuits, Tops, Bottoms, New arrivals
  - `footer` (HELP): Shipping (`/policies/shipping-policy`), Returns (`/policies/refund-policy`), Contact (`/pages/contact`), Size guide (`/pages/size-guide`)
  - LEGAL comes from `shop.policies` (`show_policies`), so there is no legal menu.
- `pages.json`: `contact` (template_suffix `contact`, content "<p>Contact details to be confirmed.</p>"), `size-guide` ("<p>Size guide to be provided by STEADFAST.</p>"), `shipping-returns`.
- `blogs.json`: blog `journal` with one article "Journal entry (placeholder)" whose content is "<p>Article content to be written.</p>", plus an image reference to a processed still.
- `customer.json`: "Sample Customer", `customer@example.com`, one address with obviously sample values ("1 Example Street"), and one order `#1001` referencing fixture variants (placeholder).
- `gift_card.json`: code `PREV-IEW0-0000`, balance and initial value placeholders.

---

## 9. Test plan (Playwright; HARNESS writes, ORCH runs)

**Infrastructure:**
- `dev/tests/playwright.config.mjs`:
  - `testDir: '.'`, `webServer: { command: 'node ../preview/server.mjs --port 9292', url: 'http://127.0.0.1:9292/__preview/health', reuseExistingServer: true }`, `use.baseURL`
  - reporters: `list`, `['json', {outputFile: 'reports/results.json'}]`, `['html', {outputFolder: 'reports/html', open: 'never'}]`
  - projects: `desktop` (Chromium, 1440×900) and `mobile` (Chromium, 390×844, `isMobile`, `hasTouch`, DPR 3, iPhone Safari UA)
- Only Chromium is installed. **iOS Safari / WebKit cannot be executed here.** TEST-REPORT must say so, not claim it.
- Helpers in `dev/tests/helpers/`:
  - `console.mjs`: fails a test on `pageerror` / `console.error`, with an allowlist per test for intentionally aborted requests
  - `fixtures.mjs`: reads the fixtures so expectations are computed, not hard-coded
  - `routes.mjs`: the canonical route list
  - `a11y.mjs`: axe via `@axe-core/playwright`, failing on serious and critical impacts
- Every test calls `POST /__preview/reset` in `beforeEach`.
- Screenshots go to `dev/tests/screenshots/{project}/{name}.png`.

| BRIEF §12 item | Spec file | Required cases |
|---|---|---|
| (gate) theme validity | `00-theme-check.spec.mjs` | Spawns `npx @shopify/cli theme check --path ../../theme --output json` and asserts 0 `error` severity offenses. It lists the warnings in an attachment. |
| Homepage load | `01-homepage.spec.mjs` | 200 status. Sections A–F present in order (`[data-sf-section]` sequence: hero-film, featured-collection, signature-showcase, campaign-editorial, category-grid, brand-story) and G (newsletter + footer) present. Exactly one `h1`, containing the hero wordmark `img`, whose accessible name is "STEADFAST". CTA labels are "EXPLORE COLLECTION" (case-insensitive, href → collection) and "VIEW THE CAMPAIGN" (href `#campaign`, and `#campaign` exists on Section D). Section D has no lookbook. Section E renders the index list (5 links) with a visually hidden `h2`. `#newsletter` exists once. Ribbon visible. No `Liquid error` or `translation missing`. No console errors. No 4xx/5xx subresource. Featured cards = fixture count (≤ 8) with names, prices and colorways. |
| Desktop nav | `02-nav-desktop.spec.mjs` | Primary nav links match `menus.json`. The dropdown opens on click and Enter, `aria-expanded` toggles, and Esc closes it and returns focus. The header is visible and its links are clickable during the intro (first visit). It is transparent over the hero with the logo at opacity 0, and solid after scrolling past it with the logo faded in. No element has a computed `backdrop-filter`. The `on-scroll-up` hide/show works. Desktop actions are the text labels SEARCH (opens the overlay with focus in the input), ACCOUNT (→ `/account/login`) and CART (n) (opens the drawer). |
| Mobile nav | `03-nav-mobile.spec.mjs` (mobile project) | The desktop nav is hidden and the menu button visible (≥ 44px). The menu opens as the fullscreen dialog whose top row repeats the header (close button at the menu button's position), with focus inside; the open sequence settles within 560 ms. The submenu slide-over expands with a back button, and a link navigates. Esc and the close button work, and focus returns to the menu button. Body scroll is locked while open. The localization select is present when enabled. |
| Product pages | `04-product.spec.mjs` | For **every** fixture product: title `h1`, price, all fixture media rendered with width/height, front/back where present, zoom dialog open/close, size guide drawer with the fallback "Sizing information to be confirmed.", the SHIPPING & RETURNS collapsible, no empty SIZE & FIT / CARE accordion, the buy button labelled "Add to cart", no dynamic checkout buttons by default, related products loaded via `/recommendations/products` (non-empty when fixtures allow), valid JSON-LD Product, and no "review"/"rating"/"★"/"360" strings. Dynamic checkout: none by default; with `preview_sections={"main":{"blocks":{"buy_buttons":{"show_dynamic_checkout":true}}}}` exactly one `[data-shopify="payment-button"]` renders inside the product form, and its placeholder button is disabled (ruling §15.11). |
| Variant selection | `05-variants.spec.mjs` | Selecting a size updates `input[name=id]`, `?variant=` and the button label. A sold-out variant shows a disabled "Sold out". The unavailable-value marker is set correctly per §4.7. A colour change (garment 4) swaps the gallery to the variant media and updates the legend. Direct load of `?variant=` preselects it. Arrow keys move within the radio group. |
| Cart operations | `06-cart.spec.mjs` | Add from the PDP → drawer opens, a line is present, `<sf-cart-count>` = 1, and the live region contains the added message. Increase/decrease and remove work. Exceeding fixture inventory shows the 422 message inline. The empty state renders. Card size cells: the zip hoodie card renders one `form[action$="/cart/add"]` per variant; a sold-out size is disabled; clicking an available size adds that variant and opens the drawer; with `javaScriptEnabled:false` the same click lands on `/cart` with the line. The multi-option "Add to cart" opens quick view with `intent:'add'`, and quick view add works. The live region says "… added to cart"; no visible or announced text matches `/\bbag\b/i`. `/cart` page update works with JS **and** with `javaScriptEnabled:false`. The checkout button POSTs to `/cart` → `/checkout` (Shopify checkout notice). `preview_settings={"cart_type":"page"}` → add navigates to `/cart`. |
| Collection filtering | `07-collection-filtering.spec.mjs` | Counts are computed from fixtures. Each filter type works (size, colour, availability, price range, product type) and updates URL params and results without a reload. The active facet remove and "clear all" work. Back/forward restores state. The no-JS submit works. Sort by price ascending/descending and title gives the correct order. Pagination works with `preview_sections={"main":{"products_per_page":4}}`. The empty `tops` collection shows the empty state. The mobile filter drawer (mobile project) works. With `products_per_page: 1` (≥ 6 pages), pages 1, 3, the middle and the last each have **exactly one** `[aria-current="page"]` in `.sf-pagination` with the page number, and gap parts render `…` (Shopify titles them `&hellip;`; PLAT-08). |
| Video fallback | `08-hero-film.spec.mjs` | (a) Desktop first visit: the intro's `currentSrc` ends with `sf-film-desktop.mp4`, state reaches `playing`, the end still `img` is present with `fetchpriority="high"` and is the LCP entry, the header is visible. Seeking to `duration − 1` gives `.is-beat-8`, then `.is-beat-9` + state `ended`: the loop's `currentSrc` ends with `sf-film-loop-desktop.mp4`, the CTAs are visible, the control reads PAUSE, `sessionStorage['sf:intro-seen']==='1'`. (b) SKIP INTRO at ~1 s → final state within 500 ms and focus on the primary CTA. (c) Reload → **no intro request**, state `static`, end still and UI visible from first paint, the loop requested. (d) Mobile project: `sf-film-mobile.mp4` and `sf-film-loop-mobile.mp4`; a 1024×1366 portrait viewport also gets the mobile files (`MOBILE_MQ`). (e) `page.route('**/sf-film-desktop.mp4', abort)` → the intro ends (reason `error`) within 5 s and the loop plays; `page.route('**/sf-film-*.mp4', abort)` → `fallback`, end still and CTAs visible. (f) `HTMLMediaElement.prototype.play` rejecting (init script) → `fallback`, UI visible. (g) Save-Data emulation → `static`, **zero** mp4 requests. (h) Tab during the intro moves focus into the header and ends the intro (reason `key` or `focus`). (i) Scrolling during the intro ends it (`scrolled`); the loop pauses off-screen. (j) PAUSE swaps its label to PLAY (no `aria-pressed`) and pauses the loop; PLAY resumes it. (k) VIEW THE CAMPAIGN goes to `#campaign` by default; with `preview_sections={"hero":{"cta_secondary_action":"replay"}}` it restarts the intro from 0. (l) At most one intro and one loop file per visit. |
| Animation behaviour | `09-animation.spec.mjs` | `gsap.min.js` is **not** requested on `/products/*`, `/collections/*` or the initial home load before scrolling, and **is** requested after scrolling to the signature section. A desktop `.pin-spacer` exists in the signature showcase; on mobile there's none. `ScrollTrigger.getAll().length` ≤ 10 on the homepage, and no GSAP is requested before scrolling past the hero. No running animation (`document.getAnimations()` or GSAP tween) targets `filter`. `[data-sf-reveal]` elements get `.is-revealed` after scrolling. No long task > 200 ms while scrolling the home page (PerformanceObserver). Dispatching `shopify:section:unload` on the signature section removes its pin-spacer and ScrollTriggers (`ScrollTrigger.getAll().length` drops). The cart drawer open/close transition settles and focus is correct. |
| Reduced motion | `10-reduced-motion.spec.mjs` | With `reducedMotion: 'reduce'`: `html[data-sf-motion="reduced"]`, the hero is `static` with the wordmark and UI at rest, there's no mp4 request until PLAY is pressed (then only the loop file), no `.pin-spacer`, the Section F wordmark is fully visible, reveal content is visible immediately (computed opacity 1), and drawer animations are ≤ 150 ms. The footer visitor toggle sets reduced and persists across reloads. `preview_settings={"motion_level":"reduced"}` does the same without the OS preference. |
| Responsive layouts | `11-responsive.spec.mjs` | Viewports 360×780, 390×844, 834×1112, 1280×800, 1440×900, 1920×1080 × routes `/`, `/collections/all`, a product, `/cart`, `/search?q=hoodie`, `/pages/contact`, `/account/login`. No horizontal overflow (`scrollWidth <= innerWidth`). CLS < 0.05 during load (layout-shift observer). Primary controls ≥ 44px on mobile. A full-page screenshot is saved for each. |
| Keyboard accessibility | `12-a11y-keyboard.spec.mjs` | The skip link is the first Tab stop and focuses `#MainContent`. Focus indicators are visible (computed outline). Focus is trapped and Tab cycles inside the cart drawer, quick view, menu, search and size guide. Esc closes each and restores focus. Variant and facet controls are fully keyboard operable. Landmarks: one banner, one main, one contentinfo, labelled navs. axe on `/`, a product, `/collections/all`, `/cart`, `/search?q=hoodie`, `/account/login` and `/pages/contact` gives 0 serious/critical violations. **Template suffixes are honoured** (A11Y-09): `/pages/contact` renders `form#contact_form` (page.contact), and a failed submit (server-side error path) renders `[data-sf-error-summary]` and **focuses** it; a failed newsletter submit moves focus to the invalid field or its error. **Open states** (A11Y-15), each axe-scanned on its own (`include: '[id=…] dialog'`) after opening via its trigger: cart drawer with a line, search overlay with results, quick view, product zoom, filter drawer, size guide, menu drawer (mobile), desktop mega menu. **Motion on**: the seven route scans run again with `reducedMotion: 'no-preference'` after a scroll-through. **Keyboard regressions (motion on, desktop):** Tab reaches `.sf-signature-showcase__cta`; every Tab stop on the homepage has an effective opacity > 0 once settled (2.4.7) and is never *entirely* covered by `.sf-header` (2.4.11). |
| (extra) Search | `13-search.spec.mjs` | Predictive results for "hoodie" (products section, arrow-key navigation, Enter → `/search?q=hoodie`). The results page shows counts and filters. The no-results state renders. The overlay never shows more results than the request allows: with `resources[limit_scope]=each` at most `limit` per type, with the default `all` at most `limit` in total; the suggest endpoint itself enforces the same rule (PLAT-08). |
| (extra) Quick view | `14-quick-view.spec.mjs` | Opens from a card, loads `?section_id=sf-quick-view`, the variant picker works, add → quick view closes and the drawer opens. Esc restores focus to the card trigger. |
| (extra) Template smoke | `15-templates-smoke.spec.mjs` | Every route in §8.2 (GET) returns the expected status, has no Liquid errors and no console errors. Covers customer pages (logged out and logged in), password, gift card, policies, blog, article and 404 (status 404). |
| (extra) Performance | `16-performance.spec.mjs` | The §6.1 budgets per route, **compressed** (brotli q11 computed in-test with `zlib` on each text response; binary bodies as served) and HTTP/2-aware: theme-owned requests before first scroll, theme JS and CSS (brotli), render-blocking stylesheets (count and brotli bytes, from `renderBlockingStatus`), non-video transfer before first scroll (asserted on the mobile project, DPR 3). Every route attaches `<kind>-measure.json` (per-file raw and brotli bytes) so §6.1 can be re-derived. The connection is pinned to `cellular4g` (CDP `Network.emulateNetworkConditions`), so Chromium's lazy-load distance is a fixed 1250 px: lazy images more than `innerHeight + 1250 + 250` px below the fold are not requested before scrolling. Per-file brotli caps for the always-loaded core files (§6.1). GSAP is 0 bytes before scroll and ≤ 125 KB raw after. At most one intro and one loop file per visit. Fonts: exactly the five files, each ≤ 40 KB, two preloaded. Theme folder ≤ 40 MB. |
| (extra) Data honesty | `17-data-honesty.spec.mjs` | On all routes: no matches for `/review|rating|★|only \d+ left|selling fast|limited stock|360°|in stock: \d+|campaign film|shot by|directed by|appliqu|embroider|\bbag\b/i` in visible text or `aria-label`s. The ribbon is present on every HTML page. No inventory numbers are rendered. |

The pass/fail evidence is `dev/tests/reports/results.json`. ORCH writes `docs/TEST-REPORT.md` **only** from executed results, and skipped tests are reported as skipped with their reasons.

---

## 10. Media naming conventions (MEDIA)

### 10.1 `theme/assets/` (flat; exact names)

**Source of truth: `media/processed/manifest.json` → `theme_assets`.** The still table below was **generated from the manifest** (run of 2026-11-06T18:37:29Z), not hand-copied, and CORE's `sf-image` / `sf-logo` read the same data through the generated `sf-asset-data` snippet (§10.3). When MEDIA re-renders, MEDIA regenerates the snippet and ORCH regenerates this table; neither is edited by hand. Rows marked **MEDIA:** are pending regenerations requested by DESIGN v2; until they land, the table (and the theme) use what the manifest holds.

**Fonts** (DESIGN §3.1; MEDIA adds them to `manifest.json` → `fonts`; CORE's `@font-face` matches DESIGN §3.2):

| File | Family / instance | Source | Budget |
|---|---|---|---|
| `sf-font-display-300.woff2` | Spectral 300 normal | `@fontsource/spectral@5.3.0`, Latin | ≤ 40 KB |
| `sf-font-display-300-italic.woff2` | Spectral 300 italic | same | ≤ 40 KB |
| `sf-font-text-400.woff2` | Archivo, `wght=400 wdth=100` | `@fontsource-variable/archivo@5.3.0`, instanced + Latin subset | ≤ 40 KB |
| `sf-font-text-500.woff2` | Archivo, `wght=500 wdth=100` | same | ≤ 40 KB |
| `sf-font-label-500.woff2` | "Archivo Label", `wght=500 wdth=115` | same | ≤ 40 KB |

The v1 names `sf-font-display-400` and `sf-font-display-400-italic` are retired.

**Logo** (geometry measured by MEDIA, manifest `stills.logo`; DESIGN §0/§3.4 now quote the same numbers):

| File | Spec |
|---|---|
| `sf-logo-wordmark.svg` | Traced letterforms, **viewBox 0 0 1115 154 (7.24:1)**, `fill="currentColor"`, no `width`/`height`, 10.4 KB (< 15 KB, required for `inline_asset_content`). |
| `sf-logo-textured-{600,800,1000,1200,1800}.webp`, `sf-logo-textured-1200.png` | Alpha-transparent cream wordmark with streaks, **1210×411 native box (2.944:1)**; letters at x 4.50–96.65 %, y 32.48–69.95 %. Delivered: 600/800/1000/1200/1800 + png 1200 (the 1800 is a 1.49× upscale, DESIGN §3.4). WebP alpha quality 60: 600w 17.6 KB, 800w 29.5 KB, 1000w 43.6 KB, 1200w 59.3 KB (was 108.8 KB at alpha quality 75; PERF-04). |
| `sf-logo-streaks-{1200,1800}.webp` | Delivered (MEDIA): the streak-only raster for the F lockup (letters knocked out under the SVG letter mask dilated 1 px), same 1210×411 box. |
| `sf-favicon-32.png`, `sf-apple-touch-icon-180.png` | First-letter crops. (`sf-favicon-180.png`, `sf-favicon-512.png` are bundled but unreferenced.) |
| `sf-og-default.jpg` | 1200×630 |

**Film** (FILM-STORYBOARD A3, A7, A8; **H.264 only**; not yet in the manifest, MEDIA adds a `films` array):

| File | Spec | Budget |
|---|---|---|
| `sf-film-desktop.mp4` | **Intro**, 1920×1080, 30 fps, 12.8 s, aperture composite, ends on ≥ 0.4 s of black, **no logo** | ≤ 3.5 MB |
| `sf-film-mobile.mp4` | Intro, 720×1280, 30 fps, 12.8 s | ≤ 2.4 MB |
| `sf-film-loop-desktop.mp4` | **Loop**, 1920×1080, 30 fps, 5.6 s seamless ping-pong | ≤ 1.5 MB |
| `sf-film-loop-mobile.mp4` | Loop, 720×1280, 30 fps, 5.6 s | ≤ 1.0 MB |

These four names are final (FILM A8's "name pending ARCH" is resolved). Any campaign-film render with a baked logo is **not bundled** (§14 R3).

**Hero end stills** (the loop's first frame, graded, no grain, **no logo**, black-point clamped; FILM A7):

| Base | WebP widths | Fallback | Intrinsic | Alt |
|---|---|---|---|---|
| `sf-film-end-desktop` | 960, 1600, 1920 | `sf-film-end-desktop-1600.jpg` | 1600×900 | "" (decorative; the `h1` names the page) |
| `sf-film-end-mobile` | 480, 720 | `sf-film-end-mobile-720.jpg` | 720×1280 | "" |

**Stills** (generated from `manifest.json` `theme_assets`; files are `{base}-{width}.webp` plus the listed fallback):
| Base | WebP widths | Fallback file | Intrinsic w×h (fallback) | Default alt | Used by |
|---|---|---|---|---|---|
| `sf-logo-textured` | 600, 800, 1000, 1200, 1800 | `sf-logo-textured-1200.png` | 1200×408 | (logo; `sf-logo` sets the alt) | hero `h1`, brand story (< 990 px), password page. |
| `sf-logo-wordmark` | — | `sf-logo-wordmark.svg` | 1115×154 | (logo; `sf-logo` sets the label) | header, footer, next-drop tile, menu header row, letters of the F lockup |
| `sf-favicon-32` | — | `sf-favicon-32.png` | 32×32 | n/a | favicon fallback |
| `sf-favicon-180` | — | `sf-favicon-180.png` | 180×180 | n/a | spare (not referenced) |
| `sf-apple-touch-icon-180` | — | `sf-apple-touch-icon-180.png` | 180×180 | n/a | apple-touch-icon fallback |
| `sf-favicon-512` | — | `sf-favicon-512.png` | 512×512 | n/a | spare (not referenced) |
| `sf-og-default` | — | `sf-og-default.jpg` | 1200×630 | n/a | `og:image` fallback |
| `sf-category-hoodies` | 540, 900, 1080 | `sf-category-hoodies-900.jpg` | 900×1125 | Hoodies | E default; header mega tile default. The black heavyweight zip hoodie, night photo upper crop (DESIGN §5.6; source-limited to 1080) |
| `sf-signature-hero` | 960, 1600, 2400, 2730 | `sf-signature-hero-1600.jpg` | 1600×900 | STEADFAST zip hoodie in washed blue-grey on black, front | C desktop stage, front |
| `sf-category-new-arrivals` | 540, 720 | `sf-category-new-arrivals-720.jpg` | 720×900 | New arrivals | E default. from the graded IMG_4913 embossed charcoal close-up (DESIGN §5.6) |
| `sf-signature-front` | 600, 900, 1200 | `sf-signature-front-900.jpg` | 900×1125 | Front of the washed blue-grey STEADFAST zip hoodie | C mobile/reduced front; placeholder card 1 |
| `sf-signature-back` | 600, 900, 1200 | `sf-signature-back-900.jpg` | 900×1125 | Back of the washed blue-grey STEADFAST zip hoodie | C mobile/reduced back |
| `sf-category-tops` | 400, 560 | `sf-category-tops-560.jpg` | 560×700 | Tops | E default. from the reflective tracksuit front, top crop (DESIGN §5.6) |
| `sf-signature-hero-back` | 960, 1600, 2400, 2730 | `sf-signature-hero-back-1600.jpg` | 1600×900 | Back of the washed blue-grey STEADFAST zip hoodie on black | C desktop stage, back (front→back crossfade) |
| `sf-signature-detail-zip` | 400, 720, 800 | `sf-signature-detail-zip-720.jpg` | 720×720 | Detail: zip and neck label | C detail 1 (stacked layout) |
| `sf-signature-detail-neck-label` | 400, 720 | `sf-signature-detail-neck-label-720.jpg` | 720×720 | Detail: neck label | C optional 5th block |
| `sf-signature-detail-chest-logo` | 400, 720, 800 | `sf-signature-detail-chest-logo-720.jpg` | 720×720 | Detail: distressed chest logo | C detail 2 |
| `sf-signature-detail-shoulder` | 400, 720 | `sf-signature-detail-shoulder-720.jpg` | 720×720 | Detail: shoulder embellishment | C detail 3 |
| `sf-signature-detail-cuff-label` | 400, 720 | `sf-signature-detail-cuff-label-720.jpg` | 720×720 | Detail: sleeve label | C detail 4 |
| `sf-signature-detail-hem` | 400, 720, 800 | `sf-signature-detail-hem-720.jpg` | 720×720 | Detail: hem | not offered (DESIGN §10.2); MEDIA may drop it |
| `sf-lookbook-reflective-front` | 400, 560 | `sf-lookbook-reflective-front-560.jpg` | 560×700 | Black speckle STEADFAST tracksuit with white piping, front | placeholder card 2 |
| `sf-lookbook-reflective-back` | 400, 560 | `sf-lookbook-reflective-back-560.jpg` | 560×700 | Black speckle STEADFAST tracksuit with white piping, back | spare |
| `sf-campaign-back` | 828, 960, 1280, 1600, 1920, 2400, 2560, 3840 | `sf-campaign-back-1600.jpg` | 1600×900 | Model seen from behind in a stone STEADFAST tracksuit under a single overhead light | D desktop; campaign-film dialog poster (desktop) |
| `sf-campaign-back-portrait` | 540, 828, 900, 1200, 1600 | `sf-campaign-back-portrait-900.jpg` | 900×1125 | Model seen from behind in a stone STEADFAST tracksuit under a single overhead light | D mobile |
| `sf-campaign-back-916` | 640, 828, 1080 | `sf-campaign-back-916-828.jpg` | 828×1472 | Model seen from behind in a stone STEADFAST tracksuit under a single overhead light | campaign-film dialog poster (mobile) |
| `sf-category-tracksuits` | 540, 900, 1200 | `sf-category-tracksuits-900.jpg` | 900×1125 | Tracksuits | E default; placeholder card 3 |
| `sf-lookbook-black-tracksuit` | 540, 900, 1200 | `sf-lookbook-black-tracksuit-900.jpg` | 900×1125 | Black STEADFAST zip hoodie and wide sweatpants, photographed at night | placeholder card 5 |
| `sf-category-bottoms` | 540, 900, 1200 | `sf-category-bottoms-900.jpg` | 900×1125 | Bottoms | E default |
| `sf-editorial-black-tracksuit-4x5` | 800, 1200, 1600 | `sf-editorial-black-tracksuit-4x5-1200.jpg` | 1200×1500 | Black STEADFAST zip hoodie and wide sweatpants, photographed at night | spare |
| `sf-editorial-black-tracksuit-2x3` | 800, 1200, 1600 | `sf-editorial-black-tracksuit-2x3-1200.jpg` | 1200×1800 | Black STEADFAST zip hoodie and wide sweatpants, photographed at night | spare |
| `sf-lookbook-embossed-hoodie` | 400, 720 | `sf-lookbook-embossed-hoodie-720.jpg` | 720×900 | STEADFAST lettering on the back of a washed charcoal hoodie | placeholder card 4 |
| `sf-grain` | 256 | `sf-grain-256.webp` (`sf-grain.webp` also shipped) | 256×256 | n/a (CSS background) | optional static ≤ 4% tile over the hero poster only (DESIGN §5.3) |

Dropped widths (manifest `dropped_widths`, 1.5× upscale limit): `sf-signature-detail-zip` 1200; `-chest-logo` 1200; `-hem` 1200; `-neck-label`, `-shoulder`, `-cuff-label` 800 and 1200. Callers take the widths from `sf-asset-data`; nothing is added by hand.

DESIGN §5.3's black-point clamp (luma ≤ 6 → 0) applies to every still that sits on the page's black; MEDIA re-renders `sf-signature-hero`, `sf-signature-hero-back` and the other on-black stills through it (same names, so nothing else changes).

The v1 `sf-lookbook-*` bases no longer feed a section (Section D has no lookbook); they remain as the placeholder-card stills listed above. `sf-editorial-black-tracksuit-*`, `sf-lookbook-reflective-back`, `sf-favicon-180` and `sf-favicon-512` are bundled spares.

### 10.2 `media/processed/`

```
media/processed/
├── manifest.json        { generated_at, tool_versions,
│                          theme_assets:[{file,base,path,width,height,bytes,sha1,source,crop:[x,y,w,h] px,ops,owner}],
│                          fixtures:[{file,handle,view,width,height,format,source,owner}],
│                          dropped_widths:[{base,width,native_width,max_width_allowed,reason}],
│                          stills:{logo:{…measurements…}, quality_notes:[…], files:[…]},
│                          fonts:[{file,family,weight,style,axes,unicode_range,source_pkg,bytes}],      ← MEDIA to add
│                          films:[{file,width,height,fps,duration_s,bytes,codec,crf,segments:[…]}] }  ← MEDIA to add
├── logo/                sf-logo-*, favicons, og image (theme copies share the names)
├── fonts/               sf-font-*.woff2
├── film/                sf-film-*.mp4, edit-decision-list.json, contact-sheet.jpg
├── stills/              every theme still (theme/assets holds copies)
├── products/            {product-handle}--{view}-{width}.{webp|jpg}   e.g. zip-hoodie-washed-blue-grey--front-800.webp
├── frames/              extracted video frames (not referenced by the theme)
└── _qa/                 QA overlays (not referenced)
```

**Crop notation.** Every crop tuple in every doc is labelled. The manifest's `crop` is **pixels `[x, y, w, h]`**; `tools/media/grade.sh` takes **fractions `x,y,w,h`**; DESIGN §5.2/§10.2 and FILM-STORYBOARD A3 use **fractions `(x0, y0, x1, y1)`** unless a table says otherwise.

**Grade.** `tools/media/grade.sh` is the single grade of record for film and editorial stills (DESIGN §5.4, FILM v2).

Fixture product handles are fixed so HARNESS and MEDIA agree:
- `zip-hoodie-washed-blue-grey`
- `reflective-piping-tracksuit-black-speckle`
- `embossed-gothic-tracksuit-stone`
- `embossed-gothic-hoodie` (colourways washed charcoal / washed grey, views `back-charcoal` / `back-grey`)
- `heavyweight-zip-hoodie-black`
- `wide-sweatpants-black`

MEDIA writes the exact view list per handle to the manifest `fixtures` array, and HARNESS builds `products.json` media **only** from that array. Product media never includes a view that doesn't exist in the sources.

### 10.3 Generated asset data (MEDIA generates; CORE consumes)

`tools/media/gen_asset_snippet.py` (MEDIA) reads `media/processed/manifest.json` plus `tools/media/asset_alts.json` (MEDIA-owned; the default alts of §10.1 keyed by base, and a `pending` map for bases not yet in the manifest, e.g. the end stills and `sf-logo-streaks`, with their widths and sizes from §10.1) and writes **`theme/snippets/sf-asset-data.liquid`** (MEDIA-owned, header comment "GENERATED — do not edit"). It is idempotent and is re-run whenever stills, end stills or the logo change.

Contract:
- Param `asset` (base name). Output: exactly one line `webp_widths|fallback_width|fallback_ext|width|height|alt`, e.g. `960,1600,2400,2730|1600|jpg|1600|900|STEADFAST zip hoodie in washed blue-grey on black, front`, or **nothing** for an unknown base.
- One whitespace-stripped `{%- case asset -%}` with a `when` per base. Alts never contain `|`.
- A `{% doc %}` header with the param and an example.

---

## 11. Integration checklist (ORCH)

1. Run `python3 tools/media/gen_asset_snippet.py` (regenerates `sf-asset-data.liquid` from the manifest), then `node tools/locales/merge-locales.mjs`; both must exit 0.
2. Run `npx @shopify/cli theme check --path theme` and get 0 errors.
3. Run `npm --prefix dev ci && npm --prefix dev test`, then inspect `dev/tests/reports/results.json`.
4. Check that every `asset_url` reference in `theme/**/*.liquid` resolves to a file in `theme/assets` (HARNESS logs missing assets with a 404, and `01-homepage` fails on 404s).
5. Grep `theme/` for the forbidden filters and tags (§8.6), for `console.log`, for `backdrop-filter`, for `box-shadow` outside the focus rule, for `filter` in transitions/keyframes/GSAP tweens, and for `/\bbag\b/i` in locale values and Liquid text.

## 12. Decisions taken here (flag if you disagree)

1. **The section-local snippet `sf-hero-film-sources` is HOME's**, but the hero uses CORE's `sf-logo` and `sf-image`.
2. **Variant changes run client-side**, from the embedded JSON with pre-rendered `price_html`, with no Section Rendering round-trip. This is faster, simpler to emulate and avoids `option_values` coupling. The URL still updates `?variant=`.
3. **The newsletter is site-wide** (footer group, `id="newsletter"`). index.json does not repeat it, and the footer doesn't contain a second one.
4. **No `poster` attribute** on either hero video. The intro opens on the `#000` stage; the loop fades in over the end still `<picture>`, which is always painted and is the LCP image.
5. **H.264 MP4 only** for bundled video (universal, including iOS). No WebM/HEVC/AV1 in v1, to keep the asset count and theme size down. DESIGN v2 and FILM v2 agree.
6. **One media query** (`MOBILE_MQ`, §5.1) selects hero media everywhere.
7. **Schema labels are plain English.** Storefront strings are translated through locale fragments merged into one file.
8. **Classic customer account templates** are included (ruling PLAT-05: **KEEP**). Stores still on classic (legacy) customer accounts need `templates/customers/*.json` and the `sf-main-{login,register,account,order,addresses,activate-account,reset-password}` sections; stores on new customer accounts bypass them, because every account link uses `routes.account_url`, which Shopify points at the hosted account pages. Shopify no longer *requires* these templates for Theme Store submissions (changelog, https://shopify.dev/changelog/the-shopify-account-component-for-customer-accounts-is-now-a-theme-store-requirement), but removing them would break sign-in for classic-account stores, so they stay. The header also carries Shopify's documented account component, `<shopify-account menu="…">` (https://shopify.dev/docs/storefronts/themes/customer-engagement/account-component): wrapped in `shop.customer_accounts_enabled` (plus the header's `show_account` setting), `menu` from the header's `customer_account_menu` `link_list` setting (default `customer-account-main-menu`), our icon in the `signed-out-avatar` slot, and the signed-in avatar styled through `--shopify-account-signed-in-avatar-*`. On new accounts it opens Shopify's account sheet; on legacy accounts Shopify links it to sign-in. Until Shopify defines the element (no JS, or the preview, where it is never defined) CSS hides it (`shopify-account:not(:defined)`) and the plain `routes.account_url` link `ACCOUNT` shows instead; on desktop the link is hidden only once the element is defined (`:has(> shopify-account:defined)`), so exactly one account control is ever visible.
9. **Pickup availability, theme blocks, gift-card recipient form, selling plans, quantity price breaks, metafield sources and payment icons are out of scope for v1.**
10. **Bundled-asset data is generated** from the manifest into a MEDIA-owned snippet (§10.3); nobody hand-copies widths or sizes.

## 13. v1.1 change log and cross-doc status

`DESIGN.md` v2 and `FILM-STORYBOARD.md` v2 were revised in parallel with this file. DESIGN v2 kept this file's names (its §13 maps every §3.4 property to a value) and ruled on the cross-doc items in its §14. This revision applies the reviewer's list **reconciled with those rulings**, so the three docs read the same.

### 13.1 Reviewer revisions

| # | Revision | Status | Where |
|---|---|---|---|
| 1 | §3.4 token names vs DESIGN | **Applied via the alias-table option**: DESIGN v2 §13 now gives a value to every §3.4 name (`--sf-ink`, `--sf-fg`, `--sf-text-sm`, `--sf-ease-out`, `--sf-dur-fast` …), and DESIGN v1's `--color-*`/`--fs-*`/`--sp-*`/`--ease-*`/`--dur-*`/`--z-*` names are retired there. §3.4 adds `--sf-z-dropdown` and `--sf-z-intro`. | §3.4 |
| 2 | Palette defaults | Applied: `#000000`, `#141619`, `#24272B`, `#8B9096`, `#7C91A5`, `#C3C8CD`, `#F1E9DA`; charcoal = raised surfaces. IDs stay `color_ink` / `color_washed_grey` (the names DESIGN v2 maps). | §2.1 |
| 3 | `type_display_case`, card ratio, collection columns | Applied: the setting is removed (`--sf-display-transform: none`); `card_image_ratio` defaults to `tall` (4:5); `columns_desktop` defaults to 4 with the 2/4 (1/2 mobile) density toggle. | §2.1, §2.4 |
| 4 | Hero storyboard model | Applied: intro 12.8 s / 30 fps, loop 5.6 s, end still = loop frame 0 (LCP, reduced, save-data), optional campaign film, DOM beat 8 at `duration − 0.4 s`, no logo in any bundled still. File names: the set DESIGN v2 and FILM v2 already use (§14 R4). Test 08 rewritten. | §2.4 A, §5, §6.1, §9, §10.1 |
| 5 | Secondary CTA default `link`; `content_delay` gone | Applied. | §2.4 A, §5.3 |
| 6 | One desktop/mobile media query | Applied: `MOBILE_MQ` everywhere (FILM v2 A2 already uses it). | §5.1 |
| 7 | Real font files | Applied with DESIGN v2's files: five static instances ≤ 40 KB each, preload text-400 + label-500 (§14 R6). | §6.1, §10.1 |
| 8 | Motion defers to DESIGN | Applied: no `filter`/`brightness()`, no parallax, rotation ≤ 6° (DESIGN v2 also brought the front↔back turn down from ±10° to ±6°), §4.8 says "per DESIGN §8.3/§10". | §4.5, §4.8 |
| 9 | No `backdrop-filter`, no drawer shadow, one z-scale with `--sf-z-intro` and `--sf-z-dropdown` | Applied. | §3.3, §3.4 |
| 10 | Logo dock dropped; header logo fades in when solid | Applied (DESIGN v2 agrees). | §2.4, §4.2 |
| 11 | Section D: no `look` blocks; text middle-left | Applied. | §2.4 D |
| 12 | Section E index layout + hidden h2 | Applied (`index` default; `row` kept as an option, the mosaic is gone). | §2.4 E |
| 13 | Mobile menu fullscreen top-down clip under a persistent header | Applied with DESIGN v2's mechanism (modal fullscreen dialog that repeats the header row) and its **≤ 560 ms** cap, which replaces both 450 and 740. | §4.2 |
| 14 | Card quick add: inline size cells, one POST form per variant | **Applied** (overrides DESIGN v2 ruling 18, §14 R2). | §4.6 |
| 15 | "Add to cart" / "Cart" everywhere; DESIGN strings | Applied; keys renamed `product_card.add_to_cart`, `products.add_to_cart`; strings follow DESIGN v2 ("You may also like", "New pieces, by email.", "You're subscribed.", "Sizing information to be confirmed.", "Shipping and returns details to be confirmed.", "Taxes and shipping calculated at checkout."). | §0.5, §1.4, §2 |
| 16 | Showcase titles, `sf-signature-hero-back`, 4 blocks = 4 rects | Applied with DESIGN v2's visible-only titles (§14 R5). | §2.4 C |
| 17 | Footer flat SVG at 148 px; payment icons | Applied: flat SVG; payment icons **dropped** (DESIGN v2 calls them a trust-badge row). | §2.4 |
| 18 | §10.1 generated from the manifest | Applied, plus the generated `sf-asset-data` snippet. | §10 |
| 19 | Metafields | Dropped in favour of collapsible blocks with page/richtext content (DESIGN v2 ruling 23). | §2.1, §2.4 |
| 20 | Icons stroke 1.5, `filter`, zoom | Applied (`filter`, `chevron-left` added; the magnifier-plus keeps the name `zoom`). | §1.3 |
| 21 | Desktop header text labels | Applied. | §2.4 |
| 22 | Hero h1 | Settled: the `h1` wraps the textured wordmark (DESIGN v2 ruling 10). | §5.2, §7, §9 |

### 13.2 Cross-doc items still open (owner action)

| ID | Item | Binding resolution | Owner action |
|---|---|---|---|
| X1 | DESIGN v2 ruling 18 says "no inline size cells" | ARCH's contract now has them (§4.6, §14 R2). DESIGN owns how they look. | DESIGN §7.5: draw the size-cell row in the actions area |
| X2 | Locale key names | `product_card.add_to_cart`, `products.add_to_cart` (DESIGN §6.2 still names the v1 keys) | DESIGN §6.2: update the key names |
| X3 | Hero settings | IDs in §2.4 A (`intro_*`, `loop_*`, `end_image_*`, `campaign_film_*`, `logo_reveal`, `intro_frequency`); DESIGN v2's `eyebrow`, `subheading`, `logo_width` kept | FILM B7: use these IDs |
| X4 | Section C `scroll_length` | Kept (DESIGN §10.1 uses it) | — |
| X5 | Logo renditions | 600/800/1000/1200/1800 + `sf-logo-streaks-{1200,1800}` (800/1000 added in the fix pass, PERF-04) | Done: rendered, manifest updated, generator re-run |
| X6 | Category Tops / New Arrivals stills | DESIGN §5.6 sources | MEDIA: regenerate `sf-category-tops`, `sf-category-new-arrivals` |
| X7 | Black-point clamp | DESIGN §5.3 | MEDIA: re-render on-black stills |
| X8 | Fonts | DESIGN §3.1 five files | MEDIA: instance and subset; add `fonts` to the manifest |
| X9 | Film files and end stills | §10.1 names | MEDIA: render; add `films` to the manifest |

## 14. Reviewer notes (points not applied as worded, with reasons)

- **R1 — `type_display_case` removed rather than re-defaulted.** With Spectral never uppercased (reviewer and DESIGN) and Archivo labels always uppercase (DESIGN §3.3), an `uppercase` option has nothing it may legally change and `as_written` changes nothing. DESIGN v2 §14 ruling 5 prefers removal too. `--sf-display-transform` stays defined as the constant `none`.
- **R2 — Inline size cells kept against DESIGN v2's ruling 18.** DESIGN v2 deferred to ARCH v1's contract because it's an API choice, so the call is this file's. The reviewer is right: nearly every real garment has a size option, so v1's contract sends almost every "add to cart" on a card through a quick-view round trip, and the brief asks for add to cart on cards. One small POST form per variant also works with no JS. DESIGN keeps authority over the visual (X1).
- **R3 — No bundled "campaign film".** A baked-logo version of the phone-footage edit as the target of VIEW THE CAMPAIGN would present it as "the campaign", which the reviewer and CONTEXT decision 4 both reject. The `film` action plays only a merchant upload; the default is the `#campaign` link.
- **R4 — Hero file names are `sf-film-*`, not the reviewer's example `sf-hero-intro-*` / `sf-hero-loop-*` / `sf-hero-poster-*`.** The revision asks for *one agreed set* and offers its names as an example. While this revision was written, DESIGN v2 and FILM v2 both settled on `sf-film-desktop/-mobile.mp4` (intro), `sf-film-loop-desktop/-mobile.mp4` and `sf-film-end-desktop/-mobile` (end stills = loop poster). Adopting those gives one set across all three docs without a third rename. The reviewer's substantive points (intro + loop + poster as three distinct assets, no logo in the still, 30 fps) all hold.
- **R5 — Showcase titles use DESIGN v2's wording**: "Zip and neck label", "Distressed chest logo", "Shoulder embellishment", "Sleeve label" (reviewer: "Chest logo", "Shoulder detail"). Default copy is DESIGN's call under the precedence rule, and DESIGN v2's titles already meet the reviewer's test: they describe what is visible and drop "appliqué". The hem crop isn't offered (DESIGN v2: unused).
- **R6 — Fonts are five static ≤ 40 KB instances, not one variable file at ≤ 60 KB.** The reviewer's list (`sf-font-text-var.woff2`, preload display-300 + text-var) followed DESIGN v1. DESIGN v2 (which owns families, weights and widths) switched to static Archivo instances, including a separate "Archivo Label" at wdth 115, precisely so every file meets the ≤ 40 KB rule. So the budget isn't raised. It preloads the two faces used above the fold on every template (text-400, label-500); Spectral swaps in with a metric-matched fallback.
- **R7 — Codecs stay H.264 only and the query stays `MOBILE_MQ`.** The reviewer flagged both as conflicts without picking a side; DESIGN v2 and FILM v2 both adopted ARCH v1's choices, so keeping them is what makes the docs agree.
- **R8 — Mobile-menu stagger cap is 560 ms**, DESIGN v2's new value, rather than either 450 (ARCH v1) or 740 (DESIGN v1) named in the review.
- **R9 — Payment icons and metafields are dropped, not added to the harness.** Both were options in the review; DESIGN v2 removed the features (payment-icon rows are now an anti-pattern; SIZE & FIT / CARE come from merchant page or richtext), so §8.6 stays unchanged.

---

## 15. Orchestrator rulings (final, binding for the build)

- **Precedence.** DESIGN.md wins on every visual and motion value. ARCHITECTURE.md wins on ownership, file names, IDs, setting IDs, locale key names, APIs, the allowed Liquid surface, the harness and the tests. FILM-STORYBOARD.md wins on the hero edit.
- **X1 — Inline size cells: ON** (§4.6 contract, ARCH R2). Visual spec, which DESIGN §7.5 inherits: a single row of square-cornered cells in `--sf-text-2xs` Archivo Label 500, uppercase, tracking 0.16em, 1px `--sf-line` hairline border, min 44×44 px hit area (visual box can be 32 px tall inside a 44 px padded target), gap 0 (cells share borders), unavailable sizes `aria-disabled="true"`, 40 % opacity and a 1px diagonal strike drawn with a CSS linear-gradient hairline (no other gradient use). Desktop (`pointer: fine`, ≥990): the row sits in the card's action area below the image, hidden until `:hover`/`:focus-within`, revealed with opacity 0→1 + translateY(8px→0) in `--sf-dur-fast` `--sf-ease-out`. Under reduced motion it's instant. Touch/mobile: no hover reveal; the card shows a text button "Add to cart" that toggles the size row open (aria-expanded). Products with more than one option, or with an option that isn't size, fall back to the quick view with `intent: 'add'`. Products with a single variant get a direct add button.
- **X2 — Locale keys:** ARCH names (`product_card.add_to_cart`, `products.add_to_cart`, …). DESIGN §6.2's v1 key names are void.
- **X3 — Hero settings:** ARCH §2.4 A IDs (`intro_*`, `loop_*`, `end_image_*`, `campaign_film_*`, `logo_reveal`, `intro_frequency`) plus DESIGN's `eyebrow`, `subheading`, `logo_width`.
- **Manifest concurrency.** Film renders write `media/processed/manifest.films.json`. Stills, logo and fonts write `media/processed/manifest.json`. `tools/media/gen_asset_snippet.py` reads **both**. Nobody else writes either file.
- **Playwright.** Use the preinstalled Chromium. Never run `playwright install`. `@playwright/test` is pinned to the preinstalled `playwright` version. If the browser isn't found, launch with `executablePath: '/opt/pw-browsers/chromium'` per the environment note (resolve the real binary path under `/opt/pw-browsers`).
- **15.10 — Performance budgets (fix pass, PERF-01 / PERF-07).** Keep Shopify-standard per-section stylesheets (§3.1; cacheable, multiplexed over HTTP/2 on the Shopify CDN, and required for theme-editor add/remove), but section JS that is not needed for the first screen is downloaded only when its section nears the viewport, and nothing is render-blocking beyond the three global stylesheets. Budgets are **compressed** and **HTTP/2-aware**: the old raw-byte totals and the 25-request home cap measured the wrong thing (Shopify serves brotli, and minifies only ES5-valid JS, which ours is not, so raw unminified bytes are what gets compressed). §6.1 numbers are the measured post-fix values + ~15 % margin; spec 16 enforces them. Merging the HOME stylesheets was rejected: it saves about 50 ms under Slow 4G and breaks §3.1 and the theme editor.
- **15.11 — Dynamic checkout.** `payment_button` joins the allowed surface (§8.6); `payment_type_*` stays forbidden (not needed). The harness renders an inert stand-in. The PDP renders `{{ form | payment_button }}` only when the `buy_buttons` block's `show_dynamic_checkout` is on (default **false**).
- **15.12 — Lead images.** The strongest product image leads: the blue-grey zip hoodie is the first card in the featured rail and grids (fixture order). A lifestyle or daylight frame is never the first card image or an LCP image when another view exists; the Gothic hoodie's charcoal frame is graded and its sky burnt out (MEDIA).
- **15.13 — Default copy.** No construction or material claims (embroidered, appliqué, embossed, reflective, crystal, fabric, weight) and no invented facts in any default copy, alt text, fixture title or caption. Captions describe only what is visible.
- **15.14 — `sf-core.js` size.** No build step. Dead code is removed and rarely used features move to lazily loaded modules where that reduces critical JS; the cap is then set to the measured size (§4.1, §6.1). New core features beyond it ship as on-demand modules.
