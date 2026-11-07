# STEADFAST: Test report

> Source of truth: `dev/tests/reports/results.json` (Playwright JSON reporter) from the run below. Every count in this file comes from that file (`node dev/tests/helpers/summarize.mjs dev/tests/reports/results.json`); nothing is reported as passed unless it ran. A later run overwrites `results.json`: regenerate this file from it.
> BRIEF §12: "Never report a test as passed unless it actually ran."

## 1. The run

| | |
|---|---|
| Command | `npm --prefix dev test` (full suite, both projects; final run after the revision round 2 sign-off fix to the Hoodies collection still) |
| Started | 2026-11-07 04:16:50 UTC (`stats.startTime`), duration 380 s. Same per-spec counts as integration run 3 (04:00:37 UTC) |
| Runner | `@playwright/test` 1.63.0, preinstalled Chromium, 2 workers, 0 retries |
| Projects | **desktop**: Chromium 1440×900, DPR 1 · **mobile**: Chromium 390×844, touch, DPR 3, iPhone user agent |
| Server | the local preview (`dev/preview/server.mjs`) with **placeholder** fixtures; no Shopify store was contacted |
| Result | **430 passed, 0 failed, 0 flaky, 158 skipped** (`stats.expected` 430, `unexpected` 0, `flaky` 0, `skipped` 158) |

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

**Skips are by design**, not failures: project-specific cases (desktop-only keyboard and mega-menu flows, mobile-only menu drawer, the responsive matrix split by project, the template-smoke and honesty route lists run on desktop with key routes on mobile, theme check and file-size checks once).

## 2. What the suite covers (BRIEF §12)

| BRIEF §12 item | Spec(s) |
|---|---|
| Homepage load | 01 (sections A–F in order, no console errors, hero LCP still; the blue-grey zip hoodie only in the featured rail and signature showcase, the Hoodies tile shows the Hoodies collection image), 15 |
| Desktop navigation | 02 (mega menu by click/Enter/Esc, focus return, sticky header) |
| Mobile navigation | 03 (full-screen menu dialog, focus trap, ≥ 44 px targets) |
| Product pages | 04 (every fixture product: media, price, "Select a size" → "Add to cart", accordions, size guide, zoom, related products, JSON-LD, no review/360 strings; dynamic checkout off by default and inert when on) |
| Variant selection | 05 (size never pre-selected, `?variant=`, sold-out state, colour swaps gallery and legend, arrow keys) |
| Cart operations | 06 (add from PDP and card size cells, drawer, +/−/remove, 422 message, no-JS cart page, checkout hand-off) |
| Collection filtering | 07 (collection banner is the collection image and no card's lead image; every filter type, URL state, back/forward, no-JS, sorting, pagination incl. one `aria-current` with ≥ 6 pages) |
| Video fallback | 08 (intro → beats 8/9 → loop, skip, reload static, mobile files, aborted/blocked video, Save-Data, PAUSE/PLAY label) |
| Animation behaviour | 09 (GSAP only after scroll, pin, ScrollTrigger cleanup, no long tasks > 200 ms while scrolling) |
| Reduced motion | 10 (static hero, no mp4 until PLAY, no pin, visitor toggle persists) |
| Responsive layouts | 11 (6 viewports × 7 routes: no horizontal overflow, CLS < 0.05, 44 px targets) |
| Keyboard accessibility | 12 (skip link, focus rings, landmarks, focus traps; axe 0 serious/critical on 7 routes at rest **and** with motion on after a scroll-through, and in 8 open states; contact and newsletter error focus; every home Tab stop visible and not under the header) |
| (extra) | 13 search (incl. result limits), 14 quick view, 15 every §8.2 route, 16 compressed performance budgets (ARCHITECTURE §6.1 v1.2, home and product rows tightened in revision round 1) and the preview's `preload_tag` emulation, 17 data honesty |

Theme validity: spec 00 runs `shopify theme check --path theme` and passed (0 errors). A separate CLI run in this pass reported **0 errors, 0 warnings** across 105 files (the 4 former `AssetPreload` warnings were removed by moving the font preloads to `preload_tag`).

## 3. Failures from the previous report and how they were resolved

The previous report (revision round 1, `INTEGRATION.md` §10) ended at 426 passed / **0 failed** / 158 skipped. In revision round 2 the integrator's first two full runs each had one failure. Both were the "batch-only" flakes noted in round 1, and both turned out to be genuine theme bugs. Both were reproduced outside the suite and fixed in theme code; no test was changed (`INTEGRATION.md` §11.2):

| Failure (run) | Cause | Fix |
|---|---|---|
| 11 · `[desktop] 834x1112 home`, CLS 0.0505 (run 1) | Blink can miss the header's `body:has([data-sf-header-sentinel])` pull-up while the page is still parsing, so the hero painted one header-height low and then moved up. Reproduced under 6× CPU throttling: 2 of 5 loads at 834×1112, 1 of 4 to 1 of 10 at 390×844 | `sf-hero-film.css` also sets the pull-up; it loads with the hero, so the rule applies before the hero's first paint. 0 of 24 throttled loads shifted afterwards |
| 02 · dropdown "Esc closes and restores focus" (run 2) | A 200 ms hover-out timer from before a click or Enter open closed the newly opened menu, so Esc found nothing open and focus was lost. Reproduced 4 of 4 | `sf-header.js`: one shared hover-out timer, cleared when a menu opens (0 of 4 after). `sf-header.js` 3,923 B br of 4,096 |

Tests added in this round (MEDIA-HARNESS, both projects, +4): 01 "the blue-grey zip hoodie appears only in the featured rail and the signature showcase"; 07 "collection banner: the fixture image, no product lead image, not repeated by any card". None weakened.

## 4. Not executed / not covered

- **WebKit / iOS Safari was not executed.** Only Chromium is installed in this environment. The "mobile" project is Chromium with an iPhone user agent, touch and DPR 3; it does not prove iOS behaviour (inline autoplay, `100svh`, Safari focus rules). Test on a real iPhone before publishing (DEPLOYMENT §12).
- **No Shopify store.** Checkout, accelerated checkout (`payment_button`), `model_viewer_tag`, the gift-card QR code, customer-account modes and real CDN timing are stubbed or emulated by the preview (INTEGRATION §8.3). Re-check them on the unpublished theme.
- **Performance numbers are lab numbers** from the local preview (compressed sizes computed in-test). Core Web Vitals on a real store were not measured.
- Visual quality (crops, grade, retouches) is reviewed by eye from screenshots and contact sheets, not asserted by tests.

## 5. Open items found by the suite and its reviewers (not failures)

- **Product page:** 244 KB compressed at DPR 3 before the first scroll on mobile, 303 KB on desktop, 19 requests (budget 285 KB / 23). The zoom viewer's ~1 KB br of JS still ships inside `sf-product.js`.
- **Home:** 32 requests before the first scroll on desktop and 29 on mobile; HOME's own target was 31 on desktop, and the budget is 37.
- **Brotli headroom:** `sf-header.css` is 68 B under its 4,608 B cap; `sf-header.js` is 173 B under its 4,096 B cap.
- **Hoodies collection image (preview fixture):**
  - It is now the gothic hoodie back view (`stills/sf-collection-hoodies`, preview-only). The repeat of the zip hoodie is gone, and that is asserted by 01 and 07.
  - Its 900 and 1080 renditions are ×1.41 and ×1.69 upscales (documented exception, DESIGN §5.6).
  - The 4:5 frame's top edge cuts across the back of the figure's head on the desktop stage and the banner (cosmetic; `INTEGRATION.md` §11.7).
  - The bundled fallback `sf-category-hoodies` is still the black zip hoodie, so a live store with no collection image shows that instead.
