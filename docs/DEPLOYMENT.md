# STEADFAST: Deployment and store setup

> Status: v1 (fix pass, 2026-11-07). Owner: ORCH (docs). Read with `BRIEF.md` (final deliverable: "clear deployment instructions"; "do not publish or change a live store without approval").
> **No Shopify store is connected to this project.** Nothing here has been run against a live store. Every step that touches a store is written for the merchant (or a developer acting for them) to run, and **publishing needs the owner's explicit approval.**

The deliverable is the theme in `theme/`. It is a standard Online Store 2.0 theme (Liquid, JSON templates, sections, section groups, no build step), so it uploads as-is. `dev/`, `tools/`, `media/` and `docs/` are never uploaded.

---

## 1. Before you start

| You need | Notes |
|---|---|
| A Shopify store and staff access with **Themes** and **Files** permissions | Any plan. A development store is fine for a first look. |
| Shopify CLI 3.x+ (`npm i -g @shopify/cli`) or this repo's `npx @shopify/cli` | Node 18+ (the repo uses Node 22). |
| This repository | `theme/` must pass `npx @shopify/cli theme check --path theme` with **0 errors** before upload (it does at the time of writing; see `TEST-REPORT.md`). |

Optional local preview (no store needed): `node dev/preview/server.mjs --port 9292`, then open `http://127.0.0.1:9292/`. It renders the theme with **placeholder sample data** and shows a `PREVIEW · SAMPLE DATA` ribbon. Nothing in it is STEADFAST product data.

---

## 2. Upload the theme as an unpublished theme

```bash
# 1. Validate (offline)
npx @shopify/cli theme check --path theme          # must report 0 errors

# 2. Log in to the store and push as a NEW, UNPUBLISHED theme
npx @shopify/cli theme push --path theme --store <your-store>.myshopify.com --unpublished --json
#   -> note the theme id it prints

# 3. Preview it (opens the theme's preview URL; the live theme is untouched)
npx @shopify/cli theme open --store <your-store>.myshopify.com --theme <theme-id>
```

Alternative without the CLI: zip the **contents** of `theme/` (so `layout/`, `sections/`, … are at the zip root; the folder is about 15 MB, under Shopify's 50 MB limit) and use **Online Store → Themes → Add theme → Upload zip file**. The theme is added unpublished.

> **Do not publish without approval.** Do not run `theme push` without `--unpublished` against a store's live theme, do not run `theme publish`, and do not click **Publish** until the owner has reviewed the unpublished theme (steps 3–9 below) and said yes in writing.

For iterative work on the unpublished theme: `npx @shopify/cli theme push --path theme --theme <theme-id>` (pushes to that theme only). `theme dev` also works for a hot-reloading preview.

---

## 3. Navigation (Online Store → Navigation)

The section groups reference three menus by handle. Create them with exactly these handles (the handle is shown under the menu title):

| Menu handle | Used by | Suggested items |
|---|---|---|
| `main-menu` | Header (`sections/header-group.json`, setting `menu`) | SHOP (→ All products, with the categories below as child links for the mega panel), CAMPAIGN (→ `/#campaign`) |
| `footer-shop` | Footer SHOP column (`sections/footer-group.json`) | Hoodies, Tracksuits, Tops, Bottoms, New arrivals |
| `footer` | Footer HELP column | Shipping, Returns, Contact, Size guide (link the pages from §5) |

The footer LEGAL column comes from the store policies (§6), not from a menu. If a handle is missing, that block simply renders nothing.

---

## 4. Collections (Products → Collections)

`templates/index.json` binds these collection handles. Create them (manual or automated) with **exactly** these handles:

| Handle | Used by | Notes |
|---|---|---|
| `all` | Featured collection (Section B), "Explore collection" | Shopify provides `all` automatically. Section B shows newest first; put the strongest studio image first on each product (§7). |
| `hoodies`, `tracksuits`, `tops`, `bottoms`, `new-arrivals` | Shop by category (Section E) | If a handle doesn't exist the tile still renders its bundled image and links to `/collections`. Each tile's image can be replaced per block in the editor. |

Collection images: optional. Without one, the category grid uses the bundled stills (`sf-category-*`).

---

## 5. Pages (Online Store → Pages)

| Page | Template (right column, "Theme template") | Why |
|---|---|---|
| Contact | **`page.contact`** | Renders the contact form (`sf-contact-form`). With the default `page` template the page shows only its text. |
| Size guide | `page` | Then **Theme settings → Product information → Size guide page** = this page. Until it's set, the PDP size guide shows "Sizing information to be confirmed." |
| Shipping & returns | `page` | **Theme settings → Product information → Shipping and returns page** = this page. Until set: "Shipping and returns details to be confirmed." |

Write these pages with STEADFAST's real information only. The theme never invents measurements, delivery times or return windows.

---

## 6. Store settings the theme reads

| Where | What to fill | Shows up |
|---|---|---|
| Settings → Policies | Privacy, Refund, Shipping, Terms of service | Footer LEGAL column (`show_policies`), checkout |
| Theme settings → Social media | `social_instagram_link` (and TikTok / YouTube / X / Facebook if used) | Footer FOLLOW column; blank links are not rendered |
| Theme settings → Newsletter | `newsletter_consent` (default: "By subscribing you agree to receive emails. Unsubscribe a…"), `newsletter_success` | Newsletter band and footer form. Check the consent wording against the store's email-marketing terms and local law. Subscribers land in Customers with the `newsletter` tag and email-marketing consent. |
| Settings → Markets | Enable the markets / currencies to sell in | The currency selector appears only when more than one country is available (`show_currency_selector`). |
| Settings → Customer accounts | Classic or new customer accounts. Both work: **new** accounts use Shopify's hosted pages and Shopify's account component in the header (`<shopify-account>`, an avatar that opens the account sheet; menu chosen in Header → *Customer account menu*, default `customer-account-main-menu`); **classic** accounts use the theme's own login / register / account / order / addresses / activate / reset templates, which ship on purpose (ARCHITECTURE §12.8) | Account icon and `/account` pages. In the preview the component is never defined, so the plain `ACCOUNT` link is what you see; on a live store check the avatar appears on desktop and mobile once customer accounts are enabled. |
| Theme settings → Logo | Leave **blank** to use the bundled STEADFAST wordmark artwork (recommended), or upload a replacement | Header, footer, hero |

---

## 7. Products and media

The theme ships **no product data**. Create the products in Shopify admin with real titles, prices, variants (Size, Color) and inventory. The fixtures in `dev/preview/fixtures/` are placeholders and must not be imported.

Prepared product images (from the client's own photography; cropped, colour-managed, black-point clamped, retouched only where recorded in `media/processed/manifest.json`) are in **`media/processed/products/`**, named `{handle}--{view}-{width}.{webp|jpg}`. Upload the **largest JPG or WebP** of each view to the product's media in this order:

| Garment (as evidenced by the supplied assets) | Upload order |
|---|---|
| Zip hoodie, washed blue-grey | `--front` (the clean hood-up still), `--back`, then `--detail-chest-logo`, `--detail-neck-label` (neck label with the zip), `--detail-cuff-label` (the hanger has been painted out of all of them; the old front-alt, zip, shoulder and hem views are no longer published) |
| Tracksuit, black speckle with white piping | `--front`, `--back` (source is a phone screenshot: soft above ~900 px) |
| Stone tracksuit (campaign figure) | `--back` |
| Gothic hoodie | `--back-charcoal` (graded, sky burnt out), `--back-grey`; attach each to its colour variant as the variant image |
| Zip hoodie, black / Wide sweatpants, black | `--lifestyle` (only a night photograph exists; commission studio shots before launch) |

- The **first** media item is the card image, the PDP's LCP image and the social share image: use a studio or dark-graded frame, never a daylight or lifestyle frame when another view exists.
- Write alt text that describes what is visible (colour, view). Don't name fabrics, weights or construction (embroidered, appliqué, embossed, reflective, crystal) unless STEADFAST confirms them.
- Do not enter fabric composition, care, fit or shipping claims in descriptions until STEADFAST supplies them.

**Signature showcase (Section C):** `templates/index.json` binds the product handle `zip-hoodie-washed-blue-grey`. In **Customize → Home page → Signature showcase**, pick the real zip hoodie product (any handle). With no product, the CTA reads "Explore the collection" and links to all products.

**Dynamic checkout buttons** (Shop Pay etc.) are **off** by default (product page → Buy buttons block → *Show dynamic checkout buttons*). Turn on only if wanted; they render Shopify's real accelerated checkout. The local preview shows an inert stand-in.

---

## 8. Content that needs STEADFAST's input (placeholders shipped on purpose)

| Where | Default | Action |
|---|---|---|
| Hero eyebrow | blank (the italic campaign line stands alone); FIXED POINT remains the **proposed** campaign name | Optionally set a campaign name; it shows only with the campaign line |
| Brand story (Section F) text | blank (the wordmark alone) | Supply two or three sentences; no dates, origins or claims until confirmed |
| Campaign editorial line / body | "Under one light." / "The tracksuit in stone, seen from behind." | Approve or replace |
| Featured "next drop" tile | "Details to be announced." | Replace or hide |
| PDP size guide, shipping & returns | "… to be confirmed." | Link the pages from §5 |
| Social links, policies, newsletter consent | blank / default consent text | §6 |

---

## 9. Approvals before publishing

1. **Balaclava retouch.** In the campaign still (`campaign-back-embossed-set.png`) a small third-party swoosh on the model's balaclava has been toned down (diffusion fill from the surrounding knit, about 40×28 px). Before/after: `media/processed/_qa/campaign-balaclava-retouch.png`. The client must approve this retouch (or supply a clean frame) before the campaign image, the Tracksuits tile, the stone tracksuit product image and film shot S7 go live.
2. **Hanger retouch.** The plastic hanger has been painted out of the zip-hoodie stills (`media/processed/_qa/hanger-retouch-*.jpg`, before/after). Nothing about the garment was added. Confirm it is acceptable.
3. **Hero edit.** The bundled hero film is an **edit of the client's own phone footage and photography** (graded, slowed, slow moves on stills). It is not a commissioned campaign film, and no copy on the site says it is. Confirm it may be used, or replace it (§10).
4. **Proposed copy** in §8.
5. **Third-party marks**: fuel signage, a supercar, an SUV and sneaker logos are cropped, burnt to black or graded out of the hero, editorial and category images. Review the contact sheets (`media/processed/film/contact-sheet.jpg`, `media/processed/stills/_contact-sheet.jpg`).

Then preview the unpublished theme at desktop and phone widths, place a test order with a Shopify test payment gateway (or Bogus Gateway on a development store), and only then publish with the owner's written approval: **Online Store → Themes → (the theme) → Publish**.

---

## 10. Swapping in a commissioned film (no code changes)

The full spec for a real shoot is `FILM-STORYBOARD.md` Part B. When files exist:

1. **Content → Files → Upload** the H.264 intro and loop (desktop 16:9 and mobile 9:16) and the end-still JPEGs.
2. **Customize → Home page → Hero film**: `intro_video_desktop`, `intro_video_mobile`, `loop_video_desktop`, `loop_video_mobile`, `end_image_desktop`, `end_image_mobile`. Empty slots fall back to the bundled edit while `use_bundled_film` is on. A full-length campaign film can go in `campaign_film_desktop` / `campaign_film_mobile` and be opened by VIEW THE CAMPAIGN (`cta_secondary_action: film`).
3. The rules a replacement must meet are in `FILM-STORYBOARD.md` B7 (ends on ≥ 0.4 s of black, ≤ 14 s, UI-safe zones dark, end still = loop frame 0).

---

## 11. Regenerating media (developers only)

All derived media is reproducible from `media/source/` (never edited):

```bash
python3 -I tools/media/process_stills.py     # stills, logo, product images, QA overlays (~1 min)
python3 -I tools/media/build_film.py         # hero edit, loop, end stills (~10 min on 4 cores)
python3 -I tools/media/gen_asset_snippet.py  # copies bundled media into theme/assets, regenerates sf-asset-data
node dev/preview/tools/build-fixtures.mjs    # preview fixtures only (never uploaded)
```

Then re-run `theme check` and the Playwright suite (`npm --prefix dev test`; see `TEST-REPORT.md`) before pushing again.

---

## 12. Not covered / known limits

- WebKit / iOS Safari was **not** tested in this environment (Chromium only). Test on a real iPhone before publishing: muted inline autoplay, `100svh`, the drawer and the zoom.
- The local preview stubs some platform features (accelerated checkout, `model_viewer_tag`, the gift-card QR code); see `dev/tests/reports/INTEGRATION.md` §8. They render on Shopify but were not exercised here.
- Lighthouse and Core Web Vitals numbers in the reports come from the local preview, not from a Shopify store. Re-measure on the unpublished theme's preview URL.
