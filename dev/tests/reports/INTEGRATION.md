# STEADFAST: integration report (ARCHITECTURE §11)

**Update 2026-11-07, round 2:** the final integration pass after all four fixers is §9. Its last full run (2026-11-07 01:23:58 UTC) is **424 passed / 0 failed / 0 flaky / 158 skipped**; `reports/results.json`, `reports/html/` and `docs/TEST-REPORT.md` are from that run. §1–§7 describe round 1 (2026-11-06) and §8 the MEDIA/HARNESS/DOCS fix pass.

**Round 1 (§1–§7):** integrator pass after the build agents finished. Every number in §1–§7 comes from a command run in that pass; its final suite run was at 2026-11-06 22:23 UTC (381/3/154). `results.json` has since been overwritten by later runs (see the note above). `SUMMARY.md` still describes the earlier pre-integration run (363/21/154).
## 1. Checklist results

| Step | Command | Result |
|---|---|---|
| 1 | `python3 tools/media/gen_asset_snippet.py` | exit 0: "sf-asset-data.liquid up to date (29 bases)", 127 media files, 0 copied or removed |
| 1 | `node tools/locales/merge-locales.mjs` | exit 0: `en.default.json` (26 namespaces, 362 keys) |
| 2 | `npx @shopify/cli theme check --path theme` | **0 errors**, 7 warnings (orphan `sf-button`, `RemoteAsset` in `sf-image` on `image_url` output, preload notices) |
| 3 | Preview on :9292 plus `dev/preview/tools/smoke.mjs` (every §8.2 route, plus `/search/suggest`, `/recommendations/products`, `?section_id=` and the cart routes) | **56/56 routes clean**: status, no Liquid errors, no "translation missing", no broken `/cdn/` references |
| 4 | Cross-owner issues | See §2 and §4 |
| 5 | `npm --prefix dev test` | **381 passed, 3 failed, 154 skipped** (skips are by design: project-specific cases) |
| 6 | §11.5 grep checks | All clean (see §3) |
| 7 | Homepage screenshots | `dev/tests/screenshots/integration/` (desktop 1440×900: hero, each section, the signature pin at 0/25/50/75/97 %; mobile 390×844: each section). No console errors in either run |

## 2. What I fixed (file: change)

**CORE**
- `assets/sf-header.js`: In the mega menu, the hover-intent timer is now one shared timer that a click and `closeMega()` both cancel. Before this, a pending timer reopened the dropdown about 150 ms after Esc (spec 02).
- `assets/sf-header.js` + `assets/sf-footer.css`: Below 990 px the footer `<details>` groups are now collapsed by CSS from the first paint (`html.js … :not([data-sf-synced])`). The markup keeps them open for no-JS. Before this, JS closing them on load gave CLS 0.111 on `/pages/contact` at 834 px (spec 11).
- `assets/sf-core.js`:
  - `S.loadScript` now resolves for a script tag that is already in the markup and has already run (COMMERCE's open issue).
  - The newsletter success message gets focus again after `load`, because the `#form` fragment in the redirect took it away (spec 15).
  - New `S.anchor`: it remembers in-page hash navigation for 4 s and re-targets the hash after every `ScrollTrigger` refresh. A lazy GSAP load (campaign editorial on mobile) or a new pin spacer was cancelling the smooth anchor scroll (spec 08 (k) on desktop and mobile).
  - New `S.loadStyle` and `sf-dialog.prepare()`, plus a `data-sf-css` attribute: a closed dialog's stylesheet now loads when the visitor shows intent (hover, focus or touch on an opener, quick-view or add buttons), or on `open()`, which waits for it. It no longer loads with every page.
- `assets/sf-base.css`: While the scroll lock is on, the reserved scrollbar gutter is painted in the surface colour of an open right-hand drawer or full-screen dialog. This removes the 15 px strip COMMERCE reported.
- `snippets/sf-config-script.liquid`: Now carries the 11 COMMERCE strings that `sf-search-overlay` used to ship as JSON. That JSON block has been removed, and `sf-cart.js`'s merge step is now a no-op.
- `snippets/sf-css-tokens.liquid`: The "Archivo Label Fallback" metrics are now the values MEDIA measured (118 % / 74 % / 18 %, replacing the estimate of 110 / 80 / 19, as DESIGN §3.2 asks). I left the Spectral metrics at DESIGN's values.
- `snippets/sf-product-card.liquid` + `assets/sf-product-card.js`: The hover image is now inside an inert `<template>` and is inserted on the first mouse `pointerenter`. Touch devices and the first page load no longer download it (ARCH: "pointer: fine only").

**HOME**
- `assets/sf-hero-film.js`:
  - `replay()` now opens a 1.5 s quiet window, during which the hero's own scroll and IntersectionObserver no longer cut the restarted intro (spec 08 (k) replay).
  - Added an `inIntro` getter. The file stays under its cap at 14,323 of 14,336 B.
- `assets/sf-hero-film.css`: The end still is now 1 px shorter than the stage. Chromium skips an image that exactly fills the viewport as an LCP candidate (I confirmed this by experiment), so on mobile and narrow viewports there was no LCP entry at all. It now reports the image (spec 08 (a), mobile).
- `assets/sf-signature-showcase.js`: After the pin is built, it calls `ScrollTrigger.refresh()` when an anchor navigation is recent; `S.anchor` then re-targets the hash.
- `sections/sf-signature-showcase.liquid` + `.css`: The FRONT/BACK toggle is no longer `hidden` until JS runs; `.no-js` hides it instead. Lazy init was adding 70 px of layout shift in the middle of an anchor scroll.
- `templates/index.json`: The five category blocks are now bound to `hoodies`, `tracksuits`, `tops`, `bottoms` and `new-arrivals`. If a handle doesn't exist the block falls back to `/collections`.
- `sections/sf-category-grid.liquid`: An empty collection no longer shows "0 pieces".

**COMMERCE**
- `snippets/sf-facets.liquid` + `assets/sf-facets.js`: Every filter group now renders `open`, and JS collapses the groups after the first two (`data-sf-facet-collapse`). Before this, filters in closed `<details>` couldn't be seen without JS (spec 07 no-JS, §7.15).
- `sections/sf-main-search.liquid`: A query with no results shows `search.no_results_html` unless a filter is actually active. Before this it showed "No pieces match these filters." (spec 13).
- `assets/sf-collection.css`: At 389 px and below the sort select can shrink (`max-width: 34vw`) and the density buttons are 40 px wide. Before this they overflowed by 4 px at 360 px (spec 11).
- `assets/sf-cart.js`: `/cart.js` is no longer fetched on every page. It is primed when the cart drawer opens or on the cart page. Opening on add calls `prepare()` on the drawer.
- `sections/sf-cart-drawer.liquid`, `snippets/sf-search-overlay.liquid`, `snippets/sf-quick-view-shell.liquid`: These now use `data-sf-css` instead of `media="print"` links. The quick view also gets `sf-product.css` this way. The `<noscript>` links are kept.
- `assets/sf-search.css`: `.sf-ps__text` is now `display: block`. With flex, the `<mark>` runs became separate items and the spaces between words disappeared ("ziphoodie").

**Docs (ORCH)**
- `docs/ARCHITECTURE.md` §10.1: The rows for the logo (600/1200/1800), the streaks, Tops (400/560), New Arrivals (540/720) and `sf-grain-256` now show what was delivered.

Effect on page weight and requests (my own counter, the same method as spec 16):

| Page | Requests before | Requests after | Spec 16 budget |
|---|---|---|---|
| Collection | 28 | 21 | 25 |
| Product, mobile | 31 | 25 | 25 |
| Login | — | 16 | 20 |
| Home | 43 | 36 (37 mobile) | 25 |

Login CSS dropped from 103.7 KB to 82 KB.

## 3. Grep checks (§11.5)

- **Forbidden tags and filters** (`include`, `tablerow`, `increment`/`decrement`, `stylesheet`/`javascript`/`content_for`, `img_url`, `asset_img_url`, `img_tag`, `link_to*`, `within`, `font_*`, `color_*`, `currency_selector`, `payment_type_*`, `metafield_*`, `customer_*_link`, `hmac_*`, `base64*`, `md5`, `sha*`, `camelize`, `find*`, `has`, `reject`): none found.
- **`inventory_quantity`** in Liquid: none.
- **`console.log`** in theme JS and Liquid: none.
- **`backdrop-filter`**: none.
- **`box-shadow`**: only the focus-ring rule (`sf-base.css:71`) and `box-shadow: none` resets.
- **`filter`** in transitions, keyframes or GSAP tweens: none.
- **`/\bbag\b/i`**: no match in locale values, Liquid text or theme JS.
- **Banned honesty words** in the locale ("campaign film", "shot by", "directed by", "360°", construction terms): none.
- **Literal `asset_url` references**: every one resolves to a file in `theme/assets`.

## 4. Final test counts (last run, `node dev/tests/helpers/summarize.mjs`)

| Spec | Pass | Fail | Skip |
|---|---:|---:|---:|
| 00-theme-check | 1 | 0 | 1 |
| 01-homepage | 10 | 0 | 0 |
| 02-nav-desktop | 7 | 0 | 7 |
| 03-nav-mobile | 5 | 0 | 5 |
| 04-product | 48 | 0 | 0 |
| 05-variants | 8 | 0 | 0 |
| 06-cart | 20 | 0 | 0 |
| 07-collection-filtering | 24 | 0 | 4 |
| 08-hero-film | 22 | 0 | 2 |
| 09-animation | 9 | 0 | 1 |
| 10-reduced-motion | 8 | 0 | 0 |
| 11-responsive | 58 | 0 | 56 |
| 12-a11y-keyboard | 34 | 0 | 2 |
| 13-search | 6 | 0 | 0 |
| 14-quick-view | 4 | 0 | 0 |
| 15-templates-smoke | 50 | 0 | 40 |
| 16-performance | 21 | 3 | 0 |
| 17-data-honesty | 46 | 0 | 36 |
| **Total** | **381** | **3** | **154** |

There were four full runs in this pass: 367/17, then 380/4, then 379/5, then 381/3. **No test was edited or weakened.**

## 5. Remaining failures (diagnosis)

1. **16 · budget: home, desktop and mobile.** There are 36 and 37 requests before the first scroll; the budget is 25.
   - What's left is structural:
     - document: 1
     - CSS: 11 (3 render-blocking per §3.1, plus 8 section-scoped files, one per homepage section)
     - JS: 10 (one per section, also per the contract)
     - fonts: 4 (both Spectral faces are used above the fold)
     - images: 9–10 (Chromium starts `loading="lazy"` images up to 3,000 px below the fold, so the featured rail, the signature stills and the campaign image are all fetched)
     - the intro mp4: 1
   - **ARCH conflict:** §3.1 (one CSS and one JS file per section) and §6.1 (25 requests on a 7-section homepage) can't both hold. Options for ORCH:
     - raise the home budget to about 38;
     - or have `S.sections` lazy-load section JS by `rootMargin`, which would save about 3–4 requests;
     - or merge the HOME section CSS into one `sf-home.css`, which would save about 7.
2. **16 · below-the-fold lazy images are not requested before scrolling, mobile (flaky).** `sf-category-hoodies-1200.webp` is fetched.
   - Its first mobile tile is at y = 3,879. The test counts an image as "far" above 844 + 3,000 = 3,844, and this one is only 35 px past that.
   - It's fetched when Chromium decides on lazy loading before every in-body section stylesheet has applied. That depends on timing: it passes in isolation and in run 1.
   - The theme was not changed for this.
3. **No longer failing, but watch it:** spec 08 (k) replay.
   - In the harness I saw an occasional native smooth scroll of about 790 px, roughly 40 ms after the replay click. It happened with GSAP blocked too.
   - No JS scroll API was called (I instrumented `scrollTo`, `scroll`, `scrollIntoView`, the `scrollTop` setter and `focus`).
   - The hero now ignores self-induced scrolling for 1.5 s, so the intro restarts correctly either way, but I could not find the cause.

## 6. Visual review (screenshots in `dev/tests/screenshots/integration/`)

**What looks right:**
- Hero (desktop and mobile): the lockup, the editorial line, the CTAs, and the transparent header over the film.
- The featured rail.
- The signature pin, through all of its stages: dark entry, chest-logo zoom, and the back view with FRONT/BACK and the CTA.
- The campaign editorial, the category index (stage on the right), the brand-story lockup, the newsletter and the footer.
- The mobile footer accordions now start collapsed, with no shift.
- I also checked these on desktop: the dialogs (cart drawer, search overlay, quick view) with their stylesheets now loading on demand, the card hover image, and the 360 px collection toolbar.

**Problems:**
- **MEDIA:** The "Gothic hoodie" card and quick-view image (graded IMG_4913 frame) still show daylight trees and sky in the top right of the frame. It's the only off-palette image on the homepage and in the collection grid. It needs a tighter crop or a darker grade (CONTEXT: "grade dark/cool to remove daylight look").
- **HOME / DESIGN:**
  - At the start of the signature pin (progress 0–0.1) the stage is pure black with only the heading. That's by design (exposure 1→0), but in static screenshots it reads as empty.
  - At the 50 % mark (chest-logo zoom) no detail caption was visible in my capture.
- **COMMERCE:** At 360 px the sort select truncates to "DATE, NE…". That's acceptable, but a shorter label for the default sort would read better.
- **CORE (cosmetic):** With classic scrollbars, a modal or sheet-top dialog still leaves an undimmed gutter strip the colour of the page (black on black, so barely visible).

## 7. Open items for owners and ORCH

- **ARCH §6.1 vs §3.1:** the home request budget (above).
- **ARCH:** `payment_button` is still not an allowed filter, so the product page's dynamic checkout setting isn't rendered (COMMERCE).
- **ARCH §3.1:** `sf-cart.css`, `sf-search.css`, `sf-quick-view.css` and `sf-product.css` now load on intent through `data-sf-css` (this pass) instead of `media="print"`. §3.1 should be updated to match.
- **Size caps:**
  - `sf-core.js` is 31.0 KB against a 24 KB cap. It grew by `S.anchor`, `S.loadStyle` and `prepare()`.
  - `sf-header.js` is 16.4 KB against 12 KB.
  - `sf-header.css` is 21 KB against 14 KB.
  - `sf-product-card.css` is 9.6 KB against 8 KB.
  - The page-level JS and CSS byte budgets in spec 16 all pass.
- **FILM-STORYBOARD A4 (ORCH doc):** apply MEDIA-film's deviations 1–3: the smooth toe instead of `0.08/0` crush, the 5 %/15 % left burn, and the S7 mask edge.
- **MEDIA:** the products "Zip hoodie, black" and "Wide sweatpants" have only one image each, the lifestyle night crop, so a lifestyle image comes first in their galleries. There is no studio image of either garment.
- **CORE:** re-check the Archivo Label fallback visually on a system without Archivo cached.

## 8. Fix pass: MEDIA / HARNESS / DOCS (2026-11-07)

### 8.1 Harness changes

- **Template suffixes** (`lib/request.mjs`, CD-10 / A11Y-09 / F4). `setTemplate` tried `[view, suffix, null]` and skipped only `undefined`, but `URLSearchParams.get('view')` returns `null`, so the base template always won and no `template_suffix` was ever applied. It now tries `?view=`, then the resource's suffix, then the base. `/pages/contact` renders `page.contact` (main + `sf-contact-form`), so specs 11, 12, 16 and 17 now really cover the contact form. Product and collection suffixes are fixed the same way.
- **Predictive search `limit_scope`** (`lib/drops.mjs`, PLAT-08). Shopify's default is `all` (`resources[limit]` caps the total across types); `each` caps every type. The mock applied the limit per type regardless, which hid an overflow in the theme's overlay.
- **Pagination gap** (`lib/catalog.mjs`, PLAT-08): the gap part's title is `&hellip;` (what Shopify emits), not U+2026.
- **`payment_button`** (`lib/filters.mjs`, ruling §15.11): valid only on a product form; renders Shopify's `[data-shopify="payment-button"]` container with a disabled, clearly labelled stand-in button. Allowed surface: ARCHITECTURE §8.6.
- **`preview_sections` block overrides** (`lib/theme.mjs`): `{"main":{"blocks":{"buy_buttons":{"show_dynamic_checkout":true}}}}` merges settings into existing blocks (by id or type).
- **`--compress`** (`server.mjs`, `lib/http.mjs`, PERF-07): opt-in brotli/gzip for text and immutable `/cdn/` caching, for lab timing closer to the Shopify CDN. Off by default.
- **Fixtures** (`tools/build-fixtures.mjs`, ruling §15.12): the blue-grey zip hoodie is the newest placeholder product, so it leads "date, new to old" grids (featured rail, collection, search, related), and it is first in `new-arrivals`. No lifestyle or daylight frame is a first card image.

### 8.2 Tests added or changed

| Spec | Change |
|---|---|
| 04 | Dynamic checkout: off by default; on via a block override → exactly one inert `payment_button` container in the product form. |
| 07 | ≥ 6 pages: exactly one `[aria-current="page"]` in `.sf-pagination` on pages 1, 3, middle and last; gaps render `…`. |
| 12 | Contact form present on `/pages/contact`; failed contact submit focuses `[data-sf-error-summary]`; failed newsletter submit focuses the field/error. axe per open state (cart drawer with a line, search with results, quick view, zoom, filter drawer, size guide, menu, mega menu). The seven route scans again with motion on after a scroll-through. Keyboard (motion on): Tab reaches the signature CTA; no Tab stop at opacity 0 or entirely under the sticky header. |
| 13 | The overlay and the suggest endpoint never exceed `resources[limit]` under the requested `limit_scope`. |
| 16 | Budgets are compressed (brotli computed in-test) and HTTP/2-aware (ARCHITECTURE §6.1 v1.2); per-route `*-measure.json` attachments; per-file brotli caps; the connection is pinned to `cellular4g`, so the lazy-image check uses Chromium's 1250 px 4g distance instead of the 3000 px "unknown" one (this was the flaky §5 item 2). |

### 8.3 Platform features the preview stubs (not exercised against Shopify)

These render on Shopify but the preview only stands in for them, so no test here proves they work on the platform. Check them on the unpublished theme (DEPLOYMENT §9):

| Feature | Preview behaviour | What to check on Shopify |
|---|---|---|
| `{{ form \| payment_button }}` (dynamic checkout) | Inert container with a disabled stand-in button | Shop Pay / accelerated buttons render in the monochrome frame and complete a test checkout |
| `model_viewer_tag` (3D media) | Empty `<model-viewer data-preview-stub>` | Only if a GLB is ever uploaded: the viewer loads, AR/XR buttons work |
| Gift card QR code (`shopify_asset_url: 'vendor/qrcode.js'`) | `window.QRCode` is a no-op | The QR code draws on `/gift_cards/…` |
| Checkout (`/checkout`) | Static notice page | Shopify checkout opens with the cart lines |
| Customer accounts (new accounts / Shop sign-in) | Classic forms with fixture customer | Login, register, addresses with the store's account mode |
| `content_for_header` | Empty (no platform scripts) | Request counts in §6.1 exclude these |
| Predictive search ranking | Simple substring match | Result relevance and synonyms |
| Section Rendering API cache and CDN | Rendered fresh per request; no CDN unless `--compress` | Real TTFB and caching |

### 8.4 Media fixes in this pass (see `media/processed/manifest.json` ops per file)

- **Hanger painted out** of both zip-hoodie stills (CD-01), before/after in `media/processed/_qa/hanger-retouch-*.jpg`; regenerated the signature stage (front and aligned back), front/back 4:5, details, product images and film S2 (which now opens on the zip pull, y 0.30).
- **Gothic hoodie, washed charcoal** (CD-02 / F6): film grade + sky/foliage burnt behind the hood + supercar burn. Top-right 30 %×35 %: mean luma **13.9** (was 185), **0.0 %** green-dominant pixels; 40 %×35 %: luma 33, 0.0 %. The lookbook and New Arrivals stills use the same image.
- **Gothic hoodie, washed grey** (CD-14): crop shifted 40 px left, 0.12-wide right feather (the sleeve fades instead of ending in a straight cut), soft left burn on the kerb.
- **Reflective tracksuit** (CD-03): black knee (luma ≤ 14 → 0, smooth to 24) before plating on #000 with a 120 px feather. Row 500 of the front 800: 0 everywhere (was 2 / 8–12 / 2); plate-edge means ≤ 1.6 luma on all four sides (front ≤ 0.3).
- **Hoodies category tile** (CD-18): the black heavyweight zip hoodie (night photo, upper crop), not the showcase garment; also the mega-menu tile default and the Hoodies collection banner.
- **Hero film** (CD-04): 120 px horizontal feather, top 6 % / bottom 14 % fade on every desktop plate (and S7's full frame and the end stills), edge crush, wider left burn on S6/loop. Desktop end still: rows 1060–1079 mean luma 0.0, row 1030 max 21. Weights: intro desktop 2.58 MB, mobile 2.29 MB, loops 0.85 / 0.78 MB (all CRF 23, within §6.1).
- **Logo** (PERF-04): new 800w (29.5 KB) and 1000w (43.6 KB) renditions; alpha quality 60 takes the 1200w from 108.8 KB to 59.3 KB with no visible change on black.

## 9. Round 2: integration after the review fix pass (2026-11-07)

Integrator pass after the CORE, HOME, COMMERCE and MEDIA/HARNESS/DOCS fixers. Every number below comes from a command run in this pass, on a fresh preview at `:9320` (no stale fixer servers reused).

### 9.1 Checklist (§11)

| Step | Command | Result |
|---|---|---|
| 1 | `python3 tools/media/gen_asset_snippet.py` | exit 0: "sf-asset-data.liquid up to date (29 bases)", 129 bundled media files (14.04 MB), 0 copied, 0 removed; `theme/assets` 166 files, 14.52 MB |
| 1 | `node tools/locales/merge-locales.mjs` | exit 0: `en.default.json` (26 namespaces, 375 keys) |
| 2 | `shopify theme check --path theme` (dev's CLI 5.0.1) | **0 errors, 4 warnings**, 105 files: `AssetPreload` ×4 (font preloads, `layout/theme.liquid:41-42`, `layout/password.liquid:23-24`). They stay until `preload_tag` is in §8.6 and the preview (CORE PLAT-09 remainder) |
| 3 | `node dev/preview/tools/smoke.mjs --base http://127.0.0.1:9320` | **56/56 routes clean** (status, no Liquid errors, no "translation missing", every `/cdn/` subresource resolves). Re-run after my edits: 56/56 |
| 4 | Literal `asset_url` references | all resolve to files in `theme/assets` |
| 5 | §11.5 greps | see §9.3 |
| 6 | `SF_PREVIEW_PORT=9320 npm --prefix dev test` (both projects) | run 1 (before my edits): **424 / 0 / 158**; run 2 (final, after my edits): **424 passed, 0 failed, 0 flaky, 158 skipped** |
| 7 | `shopify theme package` in `theme/` | `Steadfast-1.1.0.zip`, **14,216,386 B (13.6 MiB)** compressed, 14,867,520 B uncompressed, 279 entries (167 assets, 3 config, 3 layout, 2 locales, 37 sections, 45 snippets, 22 templates). The zip was moved out of `theme/` so it is not committed or re-packaged |

### 9.2 What I fixed (file: change)

All are cross-owner leftovers the fixers flagged; none weakens or edits a test.

- **HOME** `assets/sf-campaign-editorial.css`, `assets/sf-newsletter.css`: removed `scroll-margin-top: var(--sf-header-h)`. CORE's A11Y-05 fix put `scroll-padding-top: header + sticky offset + 8px` on `html`, and the two add up. Measured with `location.hash` (motion on, header revealed at 56 px): `#newsletter` and the campaign section landed at y = 120–128, now y = 64–68 at 390 and 1440 (8–12 px below the header, as intended).
- **CORE** `config/settings_schema.json`, `config/settings_data.json`: `cart_note_text` has no default any more (blank) and an `info` line. **COMMERCE** `snippets/sf-cart-totals.liquid`: dropped the temporary string-match that hid the old default sentence; the note now renders whenever the merchant sets one. The computed tax/shipping line (PLAT-04) is the only tax wording in the drawer and on `/cart` (checked in the cart-drawer screenshots). Closes the PLAT-04 remainder.
- **CORE** `snippets/sf-quick-add.liquid`: a product with `requires_selling_plan` gets the quick-view link only, never inline size cells or a one-click add (they would post without a selling plan). The preview drop always returns `false`, so nothing changes on the preview. Closes the PLAT-01 remainder.
- **DOCS** `docs/ARCHITECTURE.md`: §1 file tree lists `sf-dialog-history.js` (CORE, on demand); the cross-owner key table lists `header.menu`; the `cart_note_text` row says blank by default and why. `docs/TEST-REPORT.md`: points at the final run (counts unchanged: 424/0/158).

### 9.3 Grep checks (§11.5)

- Forbidden tags and filters (§8.6), `inventory_quantity`, `console.log`, `backdrop-filter`: none in `theme/`.
- `box-shadow`: only focus rules (`sf-base.css:77` `:focus-visible`, `sf-product.css:80` option `:focus-visible`, `sf-product-card.css:99` card link `:focus-visible::after`) and `none` resets.
- `filter` in transitions, keyframes or GSAP tweens: none.
- `/\bbag\b/i`: no locale value or visible text; the only hits are the internal icon name `sf-icon name: 'bag'` (rendered as an SVG, label "Cart").
- Honesty words: "campaign film" appears only in the hero schema's merchant-facing labels for the optional uploaded film (not storefront text); none in the locale.

### 9.4 Final test counts (run 2, `node dev/tests/helpers/summarize.mjs`)

| Spec | Pass | Fail | Skip |
|---|---:|---:|---:|
| 00-theme-check | 1 | 0 | 1 |
| 01-homepage | 10 | 0 | 0 |
| 02-nav-desktop | 7 | 0 | 7 |
| 03-nav-mobile | 5 | 0 | 5 |
| 04-product | 50 | 0 | 0 |
| 05-variants | 8 | 0 | 0 |
| 06-cart | 20 | 0 | 0 |
| 07-collection-filtering | 26 | 0 | 4 |
| 08-hero-film | 22 | 0 | 2 |
| 09-animation | 9 | 0 | 1 |
| 10-reduced-motion | 8 | 0 | 0 |
| 11-responsive | 58 | 0 | 56 |
| 12-a11y-keyboard | 67 | 0 | 5 |
| 13-search | 8 | 0 | 0 |
| 14-quick-view | 4 | 0 | 0 |
| 15-templates-smoke | 50 | 0 | 40 |
| 16-performance | 25 | 0 | 1 |
| 17-data-honesty | 46 | 0 | 36 |
| **Total** | **424** | **0** | **158** |

Started 2026-11-07 01:23:58 UTC, 365 s, 2 workers, 0 retries, `flaky` 0. Skips are by design (project-specific cases). The fixers' reported failures (08 `aria-pressed`, the CORE mega-menu Liquid error, the pre-selected-size cases in 04/05/06/17, the old request budgets in 16) were all resolved before this pass by the later fixers; none reproduced in either run.

Spec 16 measurements, theme-owned requests before first scroll / JS br / CSS br (KB), desktop · mobile: home 36 · 33 / 29.0 / 24.7; product 20 · 25 / 23.9 / 17.7; collection 22 · 21 / 20.6 / 17.6; search 20 / 20.6 / 19.2; cart 16 / 17.7 / 16.2; contact 16 / 19.1 / 15.9; login 17 / 19.1 / 17.2. All within the §6.1 v1.2 budgets (home 41, product 29, collection 26, search 23, cart 19, content 19, customer 20). `sf-core.js` is 33,503 B raw (cap 33 KB raw / 8 KB br, at its cap), `sf-dialog-history.js` 3,274 B.

### 9.5 Remaining failures and open items

**No failing tests.** Open items, none of them blocking:

1. **PERF-06 (HOME):** the six homepage sections still load their JS with `<script defer>`; CORE's `data-sf-module` loader is ready. Moving them would take home from 36 to about 31 requests. The §6.1 budget (41) was calibrated on the current markup, so this is a saving, not a fix.
2. **PLAT-05 (COMMERCE/DOCS):** `<shopify-account>` is in the header, but `templates/customers/*` (7 files) is still shipped and §12.8 still says classic templates are included. Removing them is an ORCH decision; specs 15/17 cover the classic routes today.
3. **PLAT-09 (CORE/DOCS/HARNESS):** the 4 `AssetPreload` warnings remain until `preload_tag` is allowed in §8.6 and implemented in the preview.
4. **CD-05 caveat (HOME/MEDIA):** in the campaign editorial (desktop) the still's own top edge is visible as a faint step on black (HOME measured luma 0 → 33), also in the final frame; see `desktop-08-home-campaign.png`. A top feather in the still, or a mask on the shaft, would remove it.
5. **CD-01 / CD-04 (HOME):** the optional showcase target change and the CSS mask fallback for the film edges are still open (MEDIA did its parts).
6. **COMMERCE:** set `--sf-sticky-offset` from the real toolbar height (CORE's `html:has(.sf-facets__toolbar)` 50 px fallback is in use). Mobile product page transfer (≈ 563 KB before scroll vs the reviewer's 350 KB target) is recorded in the budget, not reduced.
7. **Behaviour note (not a regression):** a cart changed outside the page (another tab, or an API call) is only picked up on `pageshow` from bfcache or after 30 s hidden; opening the drawer primes `/cart.js` but keeps the server-rendered lines. Same as Dawn. I hit it only while scripting the screenshots.
8. **Hero logo:** could take `fetchpriority: 'low'` (MEDIA's note); the `sf-logo` snippet already accepts it.

### 9.6 Screenshots (`dev/tests/screenshots/integration/`, overwritten, DPR 1)

36 files, taken with `scratchpad/integrator2/shots.mjs` against `:9320`; no console errors, no failed `/cdn/` requests, `scrollWidth − innerWidth` = 0 on home, collection and PDP in both runs.

- **Desktop 1440×900** (19): `00-hero-film` (intro at 1.2 s: no CTAs yet, F2), `01-hero`, `02-home-featured`, `03…07-home-signature-{0,25,50,75,97}`, `08-home-campaign`, `09-home-categories`, `10-home-story`, `11-home-newsletter`, `12-home-footer`, `20-mega-menu`, `30-collection`, `31-collection-grid`, `40-pdp`, `41-pdp-scrolled`, `50-cart-drawer`.
- **Mobile 390×844** (17): the same home sections (signature at 0/50/97), `20-menu-drawer`, `30/31-collection`, `40/41-pdp`, `50-cart-drawer`.

What I checked by eye: hero lockup and CTAs (Explore collection + View the campaign, PAUSE label); zip hoodie leads the rail, grid and showcase with no hanger; the signature pin ends on BACK with title, price and "Shop the zip hoodie"; the category index with stage on the right; brand story with no default copy (F8); the textured wordmark in the full-height desktop header and the footer, the flat one when condensed and on mobile (F9); the mega menu as an index plus 3:4 stage, no promo (CD-11); the collection title block and "6 pieces" count (CD-08, CD-17); PDP "Select a size" with no size pre-selected (UX-07) and the mobile sticky buy bar (CD-16); cart drawer with one line and a single tax line (PLAT-04). The Gothic hoodie card no longer shows daylight (CD-02).


## 10. Revision round 1: integration after the MEDIA-HARNESS, HOME and CORE-COMMERCE-DOCS fixers (2026-11-07)

Integrator pass on the fixers' revision-round-1 output. Every number below comes from a command run in this pass, against a fresh preview on `:9340` (smoke, screenshots, probes; the Playwright runs started their own on `:9292`). The pass was interrupted by a container restart and resumed from its progress log; the checks were re-run after the restart, so the counts below are from after it.

### 10.1 Checklist (§11)

| Step | Command | Result |
|---|---|---|
| 1 | `python3 tools/media/gen_asset_snippet.py` | exit 0: 129 bundled media files (13.21 MB), 0 copied, 0 removed; `theme/assets` 166 files, 13.70 MB |
| 1 | `node tools/locales/merge-locales.mjs` | exit 0: `en.default.json` (26 namespaces, 376 keys; +1 `collections.all_title`) |
| 2 | `npx @shopify/cli theme check --path theme` | **0 errors, 0 warnings**, 105 files. The 4 `AssetPreload` warnings are gone: both layouts use `preload_tag` (now in §8.6) |
| 3 | `node dev/preview/tools/smoke.mjs --base http://127.0.0.1:9340` | **56/56 routes clean** |
| 4 | Fixture media | no fixture or theme reference to the deleted `--front-alt` / `--detail-zip` / `--detail-shoulder` / `--detail-hem` files (COMMERCE's 404 was a file MEDIA removed mid-run; it does not reproduce) |
| 5 | §11.5 greps | see §10.3 |
| 6 | `npm --prefix dev test` (both projects) | run 1 (before the budget tightening): 426 / 0 / 158; **run 2 (final): 426 passed, 0 failed, 0 flaky, 158 skipped** |

### 10.2 What I changed (file: change)

No test was weakened. Spec 16 budgets were *tightened* to the new measurements.

- **HARNESS** `dev/tests/16-performance.spec.mjs`: `BUDGETS.product` 29 req / 650 KB → **23 req / 285 KB** (COMMERCE's measured 20 / 245 KB + ~15 %, as §6.1 prescribes). `BUDGETS.home` 41 req / 33.5 KB JS br → **37 req / 27 KB** (HOME's lazy `data-sf-module` sections, measured 32 / 23.2 KB + ~15 %). `docs/ARCHITECTURE.md` §6.1 rows updated with the measured values and the old ones.
- **COMMERCE** `theme/snippets/sf-product-gallery.liquid`, `theme/assets/sf-product.css`: on the stacked desktop gallery, when the number of detail media (everything after front and back) is odd, the first detail gets `sf-gallery__item--wide` (`grid-column: 1 / -1`). The zip hoodie's three details now read chest logo full width, then neck label + cuff label side by side, with no empty cell (MEDIA's open note). Measured: wide item 755×944, the pair 376×470 each at y 2940 (`desktop-43-pdp-gallery-3.png`).
- **DOCS** `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`: hero eyebrow blank by default (FIXED POINT stays the proposed campaign name for the merchant to set; it renders only with the italic line); hero CTAs fade once to full cream over 500 ms from the film's first cut (no more 0.8 opacity); signature "sleeve label" step targets the left cuff; Section D's static four-sided edge mask and whole-pixel reveal; DEPLOYMENT's upload order for the zip hoodie lists the five published views (front, back, chest logo, neck label, cuff label) instead of the eight old ones.

### 10.3 Grep checks (§11.5)

- Forbidden tags and filters (§8.6), `console.log`, `backdrop-filter`: none in `theme/`.
- `box-shadow`: the `:focus-visible` ring in `sf-base.css:76` and `none` resets only.
- `filter` in transitions, keyframes or JS tweens: none.
- `/\bbag\b/i`: only the internal icon name `sf-icon name: 'bag'` (SVG, labelled "Cart").

### 10.4 Final test counts (run 2, `node dev/tests/helpers/summarize.mjs`)

| Spec | Pass | Fail | Skip |
|---|---:|---:|---:|
| 00-theme-check | 1 | 0 | 1 |
| 01-homepage | 10 | 0 | 0 |
| 02-nav-desktop | 7 | 0 | 7 |
| 03-nav-mobile | 5 | 0 | 5 |
| 04-product | 50 | 0 | 0 |
| 05-variants | 8 | 0 | 0 |
| 06-cart | 20 | 0 | 0 |
| 07-collection-filtering | 26 | 0 | 4 |
| 08-hero-film | 22 | 0 | 2 |
| 09-animation | 9 | 0 | 1 |
| 10-reduced-motion | 8 | 0 | 0 |
| 11-responsive | 58 | 0 | 56 |
| 12-a11y-keyboard | 67 | 0 | 5 |
| 13-search | 8 | 0 | 0 |
| 14-quick-view | 4 | 0 | 0 |
| 15-templates-smoke | 50 | 0 | 40 |
| 16-performance | 27 | 0 | 1 |
| 17-data-honesty | 46 | 0 | 36 |
| **Total** | **426** | **0** | **158** |

Started 2026-11-07 02:56:39 UTC, 384 s, 2 workers, 0 retries, `flaky` 0. The +2 against round 2 are spec 16's new `preload_tag` harness check (both projects). The batch-run failures the fixers saw (02 Esc focus, 02 dropdown focus, 11 home CLS ×2, 16 `sf-header.css` cap, the `front-alt` 404) did not reproduce in either run.

Spec 16 measurements before first scroll, requests desktop · mobile / JS br / CSS br / transfer desktop · mobile (KB): home **32 · 29** / 22.6 / 25.6 / 513 · 451; product **19 · 19** / 24.2 / 18.0 / 303 · 244; collection 22 · 21 / 20.6 / 17.9 / 187 · 304; search 20 / 20.6 / 19.5; cart 16 / 17.7 / 16.3; content 16 / 19.1 / 16.0; customer 17 / 19.1 / 17.4. Render-blocking CSS: 3 files, 12.4 KB br on every template. Per-file brotli: `sf-header.css` **4,540 B of 4,608** (68 B headroom), `sf-core.js` 8,113 B br / 33,503 B raw (at its cap), `sf-base.css` 5,736 B.

### 10.5 Remaining failures and open items

**No failing tests.** Open, none blocking:

1. **Hoodies collection image vs DESIGN §5.6 (ORCH decision).** MEDIA's item 6 set the *fixture* Hoodies collection image to the zip hoodie chest close-up (800 px source). Because the category grid and the mega-menu tile use the collection image when one is set, the preview homepage now shows the blue-grey zip hoodie in the featured rail, the signature showcase **and** the category stage, which DESIGN §5.6 rules out ("five tiles mean five garments"), and the crop is soft at 2× on the ~480 px desktop stage. The theme default (`sf-category-hoodies`, the black hoodie) is unchanged, so a real store is affected only if the merchant picks the same image. Either revert the fixture to `sf-category-hoodies` or amend §5.6; I left it as the fixer delivered it.
2. **HOME item 5 (partial):** desktop home is 32 requests before first scroll against HOME's own target of 31 (the two large signature stills that Chromium's lazy loading fetches early). Within the tightened budget (37).
3. **COMMERCE zoom viewer (partial):** its ~1 KB br of JS is still inside `sf-product.js`, not split out. Its images load only when it opens.
4. **`sf-header.css`** has 68 B of brotli headroom; the next header CSS change has to trim something or ask for a cap change.
5. **Screenshot note:** `*-00-intro-t2.45-cta-fading.png` shows the CTAs nearly fully faded in because the capture script seeks the film. The live timing was probed separately: desktop CTA opacity 0 at 2.03 s, 0.34 at 2.29 s, 0.99 at 2.54 s, 1 from 2.79 s; mobile 0 at 2.08 s, 0.82 at 2.34 s, 1 from 2.84 s.
6. Carried over: WebKit / real iOS not executed; no Shopify store contacted (TEST-REPORT §4).

### 10.6 Screenshots (`dev/tests/screenshots/integration/`, overwritten, DPR 1)

58 files from `scratchpad/rev1-INTEGRATOR/shots.mjs` against `:9340`: no console errors, no failed requests, `scrollWidth − innerWidth` = 0 on home, `/collections/all`, `/collections/hoodies` and the PDP in both projects.

- **Desktop 1440×900** (28): intro at 1.2 / 2.45 / 6 / 10 s, hero end state, featured, signature at 0/25/50/75/100 %, campaign at rest / mid-reveal / revealed, categories, story, newsletter, footer, mega menu, collection all (+ grid), hoodies (+ grid), PDP + gallery 1–3, cart drawer.
- **Mobile 390×844** (30): the same home set, menu drawer, both collections, PDP + gallery slides 2–5, PDP scrolled to related products, cart drawer.

Checked by eye: the hero's film frames and its end state (lockup, italic line on the left, CTAs, PAUSE); the signature ends on BACK with title, price and button; the sleeve-label step frames the left-cuff label centre-right with only black between it and the caption; the campaign still has no visible top or side edge at rest, mid-reveal or revealed; the mega menu is a list plus a 4:5 tile starting at column 7; "The collection" heading on `/collections/all`; the zip hoodie PDP leads with the clean hood-up front and shows its three details without an empty cell; the mobile gallery has 5 slides; the cart drawer has one line and one tax line. Issues found: only §10.5 item 1 (the repeated zip hoodie on the homepage), plus the cosmetic note that `desktop-13-home-newsletter.png` and `desktop-14-home-footer.png` are the same frame (both are the page bottom at 900 px).

## 11. Revision round 2: integration after the MEDIA-HARNESS fixer (2026-11-07)

Integrator pass on revision round 2. MEDIA-HARNESS delivered the two imagery items (Hoodies collection image, charcoal close-up halo); HOME and CORE-COMMERCE-DOCS had no items. Every number below comes from a command run in this pass against a fresh preview on `:9350` (smoke, screenshots, probes and all three Playwright runs, via `SF_PREVIEW_PORT=9350`). Progress log: `scratchpad/rev2-INTEGRATOR/progress.log`.

### 11.1 Checklist (§11)

| Step | Command | Result |
|---|---|---|
| 1 | `python3 tools/media/gen_asset_snippet.py` | exit 0: `sf-asset-data` up to date (29 bases); 129 bundled media files (13.21 MB), 0 copied, 0 removed; `theme/assets` 166 files, 13.70 MB. `sf-collection-hoodies` is not in `theme/assets` or `sf-asset-data` (preview-only, as reported) |
| 1 | `node tools/locales/merge-locales.mjs` | exit 0: `en.default.json` (26 namespaces, 376 keys) |
| 2 | `npx @shopify/cli theme check --path theme` | **0 errors, 0 warnings**, 105 files (run before and after this pass's edits) |
| 3 | `node dev/preview/tools/smoke.mjs --base http://127.0.0.1:9350` | **56/56 routes clean** (before and after the edits) |
| 4 | §11.5 greps | see §11.3 |
| 5 | `npm --prefix dev test` (both projects) | run 1: 429 / **1 failed** / 158; run 2: 429 / **1 failed** / 158 (a different test); **run 3 (final, after both fixes): 430 passed, 0 failed, 0 flaky, 158 skipped** |

### 11.2 Failures found and fixed (genuine theme bugs, no test changed)

Both had shown up before as "batch-only" flakes (§10, TEST-REPORT §3). This time I reproduced each one outside the suite and traced it to theme code.

1. **11-responsive `[desktop] 834x1112 home`: CLS 0.0505 (limit 0.05), run 1.**
   - **Cause:** `sf-header.css` pulls the hero up under the transparent header with `body:has([data-sf-header-sentinel]) .shopify-section:has(> .sf-header[data-transparent="true"]) { margin-bottom: -reserve }`. While the document is still parsing, Blink sometimes misses that `:has()` match after the sentinel is inserted. A per-frame probe showed the sentinel present with `margin-bottom: 0px` and the hero at top 56. The match only applied at the next stylesheet insertion, which moved `picture.sf-hero__end` from y 56 to y 0.
   - **Reproduction:** under 6× CPU throttling (`scratchpad/rev2-INTEGRATOR/cls.mjs`, `cls2.mjs`): 2 of 5 loads at 834×1112 (CLS 0.0506) and 1 of 4 to 1 of 10 loads at 390×844 (0.066–0.067).
   - **What did not work:** moving the sentinel to the hero's first child still reproduced (1 of 8), so I reverted it.
   - **Fix:** `theme/assets/sf-hero-film.css` now also sets the same pull-up, `.shopify-section:has(> .sf-header[data-transparent="true"]) { margin-bottom: calc(var(--_reserve) * -1); }`. That stylesheet loads only with the hero and just before its markup, so its arrival forces the match before the hero's first paint.
   - **After:** 0 of 24 throttled loads shift (12 at 834×1112, 12 at 390×844; residual CLS 0.0002–0.0010).
   - **Docs:** ARCHITECTURE `<sf-header>` bullets, "Pull-up under the hero".
2. **02-nav-desktop "dropdown … Esc closes and restores focus": focus "inactive" after the second Esc, run 2.**
   - **Cause:** each nav item kept its own 200 ms hover-out timer (`leaveT`), and opening the menu by click or Enter never cleared it. The test moves the mouse off the nav and then opens the menu with Enter within 200 ms. The stale timer then closed the newly opened menu, so the next Esc found nothing open and did not return focus, which stayed on a link inside the now-hidden panel.
   - **Real-world impact:** a keyboard user who has just moved the mouse off the nav loses the menu they opened.
   - **Reproduction:** `scratchpad/rev2-INTEGRATOR/mega.mjs` failed 4 of 4 times on the old `sf-header.js` (menu closed, focus lost) and passed 4 of 4 with the fix.
   - **Fix:** `theme/assets/sf-header.js` uses one shared `self._leaveT`, which `openMega()` clears. `sf-header.js` is now 3,923 B br of its 4,096 B cap.

### 11.3 Grep checks (§11.5)

- Forbidden tags and filters (§8.6), `console.log`, `backdrop-filter`: none in `theme/`.
- `box-shadow`: only the focus ring (`sf-base.css:76`, `sf-product-card.css:99`) and `none` resets.
- `filter` in transitions, keyframes or JS tweens: none.
- `/\bbag\b/i`: only the internal icon name `sf-icon name: 'bag'`.

### 11.4 Other changes (docs, from the fixer's open notes)

- `docs/DESIGN.md` §5.6: added a paragraph, "Preview fixture vs bundled default". The preview's Hoodies collection image is the non-bundled `stills/sf-collection-hoodies` (gothic hoodie back view). Its 900/1080 renditions are ×1.41/×1.69 upscales, accepted for this preview-only file and recorded in the manifest. The bundled `sf-category-hoodies` fallback is still the black zip hoodie, so a live store whose Hoodies collection has no image shows a different tile from the preview.
- `docs/ARCHITECTURE.md` §10.1 `sf-category-hoodies` row: notes that it is shown only when the collection has no image. §10.2 gains a "Preview-only stills" note.
- The orchestrator checkpoint `d42d833` already records the deletion of the two temporary `dev/.mh-r2-shots*.mjs` scripts; the working tree has no stray files from the fixers.

### 11.5 Final test counts (run 3, `node dev/tests/helpers/summarize.mjs`)

| Spec | Pass | Fail | Skip |
|---|---:|---:|---:|
| 00-theme-check | 1 | 0 | 1 |
| 01-homepage | 12 | 0 | 0 |
| 02-nav-desktop | 7 | 0 | 7 |
| 03-nav-mobile | 5 | 0 | 5 |
| 04-product | 50 | 0 | 0 |
| 05-variants | 8 | 0 | 0 |
| 06-cart | 20 | 0 | 0 |
| 07-collection-filtering | 28 | 0 | 4 |
| 08-hero-film | 22 | 0 | 2 |
| 09-animation | 9 | 0 | 1 |
| 10-reduced-motion | 8 | 0 | 0 |
| 11-responsive | 58 | 0 | 56 |
| 12-a11y-keyboard | 67 | 0 | 5 |
| 13-search | 8 | 0 | 0 |
| 14-quick-view | 4 | 0 | 0 |
| 15-templates-smoke | 50 | 0 | 40 |
| 16-performance | 27 | 0 | 1 |
| 17-data-honesty | 46 | 0 | 36 |
| **Total** | **430** | **0** | **158** |

- **Run:** started 2026-11-07 04:00:37 UTC, 368 s, 2 workers, 0 retries, `flaky` 0.
- **Change from round 1:** +4, which are MEDIA-HARNESS's two new strict tests in both projects. 01 checks that the zip hoodie appears only in the featured rail and the signature showcase. 07 checks that the collection banner is never a card's lead image.
- **Spec 16 measurements** (desktop · mobile):
  - Home: 32 · 29 requests; JS 22.7 KB br; CSS 25.7 KB br; transfer 513 · 450 KB.
  - Product: 19 · 19 requests; JS 24.2 KB br; CSS 18.0 KB br; transfer 303 · 244 KB.
  - Collection: 22 · 21 requests; transfer 186 · 303 KB.
  - Render-blocking CSS: 3 files, 12.4 KB br.
- **Per-file brotli:** `sf-header.css` 4,540 B of 4,608; `sf-header.js` 3,923 B of 4,096; `sf-core.js` 8,113 B.

### 11.6 Screenshots (`dev/tests/screenshots/integration/`, overwritten, DPR 1)

- **Capture:** 58 files from `scratchpad/rev2-INTEGRATOR/shots.mjs` against `:9350`. Captured after the CSS fix and before the `sf-header.js` timer fix, which changes no pixels in these states.
- **Checks:** no console errors and no failed requests. `scrollWidth − innerWidth` is 0 on the homepage, `/collections/all`, `/collections/hoodies` and the PDP in both projects. Intro frames are keyed on the film's `currentTime`: 1.22, 2.47–2.48, 6.01–6.03 and 10.02–10.03 s. The end state is at 12.8 s.
- **Desktop 1440×900 (28):** intro 1.2/2.45/6/10 s, hero end, featured, signature 0/25/50/75/100 %, campaign at rest/mid-reveal/revealed, categories, story, newsletter, footer, mega menu, collection all (+ grid), hoodies (+ grid), PDP + gallery 1–3, cart drawer.
- **Mobile 390×844 (30):** the same homepage set, menu drawer, both collections, PDP + gallery slides 2–5, PDP scrolled to related, cart drawer.

Checked by eye, from contact sheets and 1:1 crops:
- **Hoodies image (item 1):** the Hoodies stage tile, the mega-menu tile and the `/collections/hoodies` banner now show the gothic hoodie back view, a different garment from every card on the same screen. The blue-grey zip hoodie appears on the homepage only in the featured rail and the signature showcase.
- **Retouches:** no bystander or lit reflection right of the sleeve. The traced sleeve edge reads clean at 1:1.
- **Charcoal close-up (item 2):** no halo at 1:1 on the homepage rail card and `/collections/all` card 2; the background is flat black up to the garment edge.
- **Unchanged from round 1 and still correct:** hero end lockup, CTAs, signature BACK end state, campaign edges at rest, mid-reveal and revealed, mega menu, PDP gallery (no empty cell; 5 mobile slides), cart drawer (one line).

### 11.7 Remaining items

**No failing tests.** Open, none blocking:

1. **Hoodies image framing (cosmetic, MEDIA/ORCH):**
   - **Desktop:** on the category stage (`desktop-11`) and the collection banner (`desktop-32`), the 4:5 frame's top edge cuts across the back of the figure's head, leaving a visible horizontal edge in dark grey against black.
   - **Mobile:** `mobile-11` is cropped lower and reads better.
   - **Possible fix:** a burn on the top ~6 % of the still, like the existing left and top-left burns, would remove the edge.
   - **Resolution:** the 900 and 1080 renditions are upscales (×1.41 / ×1.69) and look slightly soft on the ~480 px desktop stage at DPR 2. This is accepted and documented.
2. **Live store vs preview for Hoodies:** documented in DESIGN §5.6 and ARCH §10.1/§10.2. A merchant who sets no Hoodies collection image gets the bundled black zip hoodie.
3. **Brotli headroom:** `sf-header.css` has 68 B left and `sf-header.js` has 173 B.
4. **Carried over from round 1:**
   - Home makes 32 requests on desktop, against HOME's own target of 31 (budget 37).
   - The zoom viewer's JS is still inside `sf-product.js`.
   - `*-00-intro-t2.45` shows the CTAs nearly fully in because the capture follows the film clock (live timing in §10.5).
   - `desktop-13` and `desktop-14` are the same frame.
   - WebKit and real iOS were not run; no Shopify store was contacted.
