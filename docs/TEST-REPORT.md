# STEADFAST: Test report

> Source of truth: `dev/tests/reports/results.json` (Playwright JSON reporter) from the run below. Every count in this file comes from that file (`node dev/tests/helpers/summarize.mjs dev/tests/reports/results.json`); nothing is reported as passed unless it ran. A later run overwrites `results.json`: regenerate this file from it.
> BRIEF §12: "Never report a test as passed unless it actually ran."

## 1. The run

| | |
|---|---|
| Command | `SF_PREVIEW_PORT=9320 npm --prefix dev test` (full suite, both projects; integration round 2) |
| Started | 2026-11-07 01:23:58 UTC (`stats.startTime`), duration 365 s |
| Runner | `@playwright/test` 1.63.0, preinstalled Chromium, 2 workers, 0 retries |
| Projects | **desktop**: Chromium 1440×900, DPR 1 · **mobile**: Chromium 390×844, touch, DPR 3, iPhone user agent |
| Server | the local preview (`dev/preview/server.mjs`) with **placeholder** fixtures; no Shopify store was contacted |
| Result | **424 passed, 0 failed, 0 flaky, 158 skipped** (`stats.expected` 424, `unexpected` 0, `flaky` 0, `skipped` 158) |

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
| (extra) | 13 search (incl. result limits), 14 quick view, 15 every §8.2 route, 16 compressed performance budgets (ARCHITECTURE §6.1 v1.2), 17 data honesty |

Theme validity: spec 00 runs `shopify theme check --path theme` and passed (0 errors). A separate CLI run in this pass reported **0 errors, 4 warnings** across 105 files.

## 3. Failures from the previous report and how they were resolved

`dev/tests/reports/INTEGRATION.md` §4–§5 (run of 2026-11-06) ended at 381 passed / **3 failed** / 154 skipped. All three are resolved; none by weakening a check without a ruling:

| Previous failure | Resolution |
|---|---|
| 16 · budget: home, **desktop** (36 requests vs 25) | Orchestrator ruling §15.10 (ARCHITECTURE): the raw-byte / 25-request budgets measured the wrong thing for an HTTP/2 + brotli CDN and conflicted with §3.1's per-section files. §6.1 v1.2 replaces them with compressed, HTTP/2-aware budgets (requests, brotli JS and CSS, render-blocking CSS, compressed transfer at mobile DPR 3, per-file brotli caps), each set to the measured value + ~15 % with the rationale written in §6.1. Home now: 36 requests (≤ 41), JS 29.0 KB br (≤ 33.5), CSS 24.7 KB br (≤ 28.5), 3 render-blocking files / 12.2 KB br. |
| 16 · budget: home, **mobile** (37 requests vs 25) | Same ruling. Mobile home: 33 requests, transfer 404 KB compressed at DPR 3 (≤ 465 KB). |
| 16 · lazy images not requested before scrolling, **mobile** (flaky) | Root cause: the test assumed Chromium's 3000 px lazy distance, which applies only to an *unknown* connection type. The spec now pins the connection to `cellular4g` (CDP) and uses Chromium's 4g distance (1250 px); it passed on both projects. |

Also fixed in this pass and now covered: the preview never applied `template_suffix`, so `/pages/contact` had rendered without its contact form and specs 11, 12, 16 and 17 had not seen it; they do now (INTEGRATION §8.1).

## 4. Not executed / not covered

- **WebKit / iOS Safari was not executed.** Only Chromium is installed in this environment. The "mobile" project is Chromium with an iPhone user agent, touch and DPR 3; it does not prove iOS behaviour (inline autoplay, `100svh`, Safari focus rules). Test on a real iPhone before publishing (DEPLOYMENT §12).
- **No Shopify store.** Checkout, accelerated checkout (`payment_button`), `model_viewer_tag`, the gift-card QR code, customer-account modes and real CDN timing are stubbed or emulated by the preview (INTEGRATION §8.3). Re-check them on the unpublished theme.
- **Performance numbers are lab numbers** from the local preview (compressed sizes computed in-test). Core Web Vitals on a real store were not measured.
- Visual quality (crops, grade, retouches) is reviewed by eye from screenshots and contact sheets, not asserted by tests.

## 5. Open items found by the suite and its reviewers (not failures)

- **Product page transfer**: 563 KB compressed at DPR 3 before the first scroll, above the reviewer's 350 KB target; §6.1 records it (≤ 650 KB) so it can't grow. COMMERCE: lazy-load gallery slides 2+ and size the related-product cards.
- **Hero wordmark** (`sf-logo-textured`): now 800/1000 w renditions and alpha quality 60 (the hero pulls 29.5 KB on desktop and 43.6 KB on a DPR 3 phone, was 106 KB). HOME/CORE may also pass `fetchpriority: 'low'` (it is never the LCP).
