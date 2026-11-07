# STEADFAST: Test report

> Source of truth: `dev/tests/reports/results.json` (Playwright JSON reporter) from the run below. Every count in this file comes from that file (`node dev/tests/helpers/summarize.mjs dev/tests/reports/results.json`); nothing is reported as passed unless it ran. A later run overwrites `results.json`: regenerate this file from it.
> BRIEF §12: "Never report a test as passed unless it actually ran."

## 1. The run

| | |
|---|---|
| Command | `npm --prefix dev test` (full suite, both projects; integration, revision round 1, run 2); Playwright started its own preview on `:9292` (no other server was running there) |
| Started | 2026-11-07 02:56:39 UTC (`stats.startTime`), duration 384 s |
| Runner | `@playwright/test` 1.63.0, preinstalled Chromium, 2 workers, 0 retries |
| Projects | **desktop**: Chromium 1440×900, DPR 1 · **mobile**: Chromium 390×844, touch, DPR 3, iPhone user agent |
| Server | the local preview (`dev/preview/server.mjs`) with **placeholder** fixtures; no Shopify store was contacted |
| Result | **426 passed, 0 failed, 0 flaky, 158 skipped** (`stats.expected` 426, `unexpected` 0, `flaky` 0, `skipped` 158) |

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

**Skips are by design**, not failures: project-specific cases (desktop-only keyboard and mega-menu flows, mobile-only menu drawer, the responsive matrix split by project, the template-smoke and honesty route lists run on desktop with key routes on mobile, theme check and file-size checks once).

## 2. What the suite covers (BRIEF §12)

| BRIEF §12 item | Spec(s) |
|---|---|
| Homepage load | 01 (sections A–F in order, no console errors, hero LCP still), 15 |
| Desktop navigation | 02 (mega menu by click/Enter/Esc, focus return, sticky header) |
| Mobile navigation | 03 (full-screen menu dialog, focus trap, ≥ 44 px targets) |
| Product pages | 04 (every fixture product: media, price, "Select a size" → "Add to cart", accordions, size guide, zoom, related products, JSON-LD, no review/360 strings; dynamic checkout off by default and inert when on) |
| Variant selection | 05 (size never pre-selected, `?variant=`, sold-out state, colour swaps gallery and legend, arrow keys) |
| Cart operations | 06 (add from PDP and card size cells, drawer, +/−/remove, 422 message, no-JS cart page, checkout hand-off) |
| Collection filtering | 07 (every filter type, URL state, back/forward, no-JS, sorting, pagination incl. one `aria-current` with ≥ 6 pages) |
| Video fallback | 08 (intro → beats 8/9 → loop, skip, reload static, mobile files, aborted/blocked video, Save-Data, PAUSE/PLAY label) |
| Animation behaviour | 09 (GSAP only after scroll, pin, ScrollTrigger cleanup, no long tasks > 200 ms while scrolling) |
| Reduced motion | 10 (static hero, no mp4 until PLAY, no pin, visitor toggle persists) |
| Responsive layouts | 11 (6 viewports × 7 routes: no horizontal overflow, CLS < 0.05, 44 px targets) |
| Keyboard accessibility | 12 (skip link, focus rings, landmarks, focus traps; axe 0 serious/critical on 7 routes at rest **and** with motion on after a scroll-through, and in 8 open states; contact and newsletter error focus; every home Tab stop visible and not under the header) |
| (extra) | 13 search (incl. result limits), 14 quick view, 15 every §8.2 route, 16 compressed performance budgets (ARCHITECTURE §6.1 v1.2, home and product rows tightened in revision round 1) and the preview's `preload_tag` emulation, 17 data honesty |

Theme validity: spec 00 runs `shopify theme check --path theme` and passed (0 errors). A separate CLI run in this pass reported **0 errors, 0 warnings** across 105 files (the 4 former `AssetPreload` warnings were removed by moving the font preloads to `preload_tag`).

## 3. Failures from the previous report and how they were resolved

The previous report (integration round 2, `INTEGRATION.md` §9) ended at 424 passed / **0 failed** / 158 skipped. In revision round 1 the fixers saw these failures in their own batch runs; none reproduced in the integrator's two full runs (426 / 0 / 158 both times):

| Fixer-reported failure | Resolution |
|---|---|
| 16 · per-file cap, `sf-header.css` 4,780 B br vs 4,608 | CORE trimmed comments: 4,540 B (68 B headroom). Cap unchanged |
| 02 · nav dropdown focus / Esc focus return (once each, batch only) | Passed alone 3/3 (fixers) and in both full runs here; load-related, not reproduced |
| 11 · home CLS ×2 (batch only) | Passed alone (HOME) and in both full runs here |
| 04 · 404 on `zip-hoodie-washed-blue-grey--front-alt-800.webp` | MEDIA deleted the file during COMMERCE's run; the fixtures no longer reference it |

Tests changed in this round, none weakened: 07 now reads the `/collections/all` heading from the locale key `collections.all_title` and also checks `<title>` (the old expectation "Products" was the behaviour being replaced); 16 gained the `preload_tag` harness check and its home (≤ 37 requests, ≤ 27 KB JS br) and product (≤ 23 requests, ≤ 285 KB) budgets were **tightened** to the new measurements + ~15 % (ARCHITECTURE §6.1).

## 4. Not executed / not covered

- **WebKit / iOS Safari was not executed.** Only Chromium is installed in this environment. The "mobile" project is Chromium with an iPhone user agent, touch and DPR 3; it does not prove iOS behaviour (inline autoplay, `100svh`, Safari focus rules). Test on a real iPhone before publishing (DEPLOYMENT §12).
- **No Shopify store.** Checkout, accelerated checkout (`payment_button`), `model_viewer_tag`, the gift-card QR code, customer-account modes and real CDN timing are stubbed or emulated by the preview (INTEGRATION §8.3). Re-check them on the unpublished theme.
- **Performance numbers are lab numbers** from the local preview (compressed sizes computed in-test). Core Web Vitals on a real store were not measured.
- Visual quality (crops, grade, retouches) is reviewed by eye from screenshots and contact sheets, not asserted by tests.

## 5. Open items found by the suite and its reviewers (not failures)

- **Product page transfer** is now 244 KB compressed at DPR 3 before the first scroll on mobile (was 563 KB), 19 requests; the budget is 285 KB / 23. The zoom viewer's ~1 KB br of JS still ships inside `sf-product.js`.
- **Home** makes 32 requests before first scroll on desktop, 29 on mobile (HOME's own target was ≤ 31 on desktop); budget 37.
- **`sf-header.css`** is 68 B under its 4,608 B brotli cap.
- **Hoodies collection image (preview fixture)** is now the zip hoodie chest close-up, which repeats the signature garment in the homepage category grid against DESIGN §5.6; ORCH to decide (INTEGRATION §10.5).
