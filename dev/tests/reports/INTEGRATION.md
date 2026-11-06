# STEADFAST: integration report (ARCHITECTURE §11)

Integrator pass after the build agents finished. Every number below comes from a command that was actually run in this pass. The final suite run was at 2026-11-06 22:23 UTC, the last one listed in §5. `reports/results.json` and `reports/html/` are from that run. `SUMMARY.md` still describes the earlier pre-integration run (363/21/154).

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
