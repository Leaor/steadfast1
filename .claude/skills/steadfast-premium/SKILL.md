---
name: steadfast-premium
description: Design preset for the STEADFAST luxury streetwear Shopify theme in this repo. Use for any design, build, redesign, content, or review work on STEADFAST pages, sections, components, navigation, the hero film, product cards, motion, imagery, or copy. Applies premium-web-experience with STEADFAST's established brand system (FIXED POINT concept, black field, Spectral + Archivo, the client's wordmark artwork) and its data-honesty rules.
---

# STEADFAST Premium Preset

STEADFAST is a dark, cinematic, underground luxury streetwear label. The site should read like a fashion film crossed with a quiet digital showroom: **intentional, restrained, mysterious, expensive**. Photography, composition, type, and light carry it, never effects.

Load `premium-web-experience` alongside this preset. The system is already built, so read the docs before changing anything:

| Doc | Owns |
|---|---|
| `docs/BRIEF.md` | Client brief (source of truth) |
| `docs/DESIGN.md` | Every visual and motion value (tokens §13, type §3, motion §8, homepage §9, signature showcase §10) |
| `docs/ARCHITECTURE.md` | File ownership, names, IDs, APIs, allowed Liquid surface §8.6, budgets §6, rulings §15 |
| `docs/FILM-STORYBOARD.md` | Hero edit (Part A) and the commissioned-shoot storyboard (Part B) |
| `docs/DEPLOYMENT.md` | Store setup and publishing |
| `docs/TEST-REPORT.md` | Latest executed test results |

## Brand system (summary; DESIGN.md has the values)

- **Concept: FIXED POINT.** The figure stays and the light moves. Reveals happen through darkness lifting, a widening vertical aperture, or a light sweep, never through slides, spins, or bounces. ("FIXED POINT" is a proposed campaign name awaiting the owner's approval.)
- **Field:** true black `#000`. Charcoal `#141619` for raised surfaces, graphite `#24272B` for hairlines, washed grey `#8B9096`, steel `#7C91A5` (sparing accent), silver `#C3C8CD`, bone `#F1E9DA` (matches the wordmark cream; used for text and the primary button, never as a background band).
- **Type:** Spectral 300 (+ italic) for display and editorial lines, never uppercased. Archivo for UI, with Archivo Label for tracked uppercase micro-labels. All five woff2 files are self-hosted.
- **Logo:** always the client's wordmark artwork. Use the textured raster at large sizes and the traced flat SVG (`sf-logo-wordmark.svg`, 7.24:1) below 200 px. Never retype it, redraw it, or set "STEADFAST" in a font as the logo.
- **Imagery:** use only the client's photos and footage, graded with `tools/media/grade.sh` (cold, near-monochrome, crushed blacks, luma-only grain). Every still that sits on `#000` gets a black-point clamp and feathered edges, so no hard rectangle edges show on black. Product stills are 4:5. No stock photography, no invented garment views.
- **Motion:** GSAP + ScrollTrigger only where a timeline earns it (the signature showcase pin, the campaign aperture, the brand-story sweep). CSS for everything else. No scroll hijacking, no filter animation, no parallax. Every effect has a reduced-motion state.
- **Vocabulary:** "Add to cart" / "Cart" (never "bag").

## Data honesty (non-negotiable)

- The theme ships no product data. Prices, sizes, stock and reviews come from Shopify. The preview fixtures in `dev/preview/fixtures` are placeholders.
- Never claim construction or materials (embroidered, appliqué, embossed, reflective, crystal), brand history, scarcity, ratings, or "360°" until the owner confirms them.
- The hero film is an **edit of the client's own phone footage and stills**. Never call it a campaign film, or say it was shot or directed by anyone.

## Working on it

- Run the preview with `npm --prefix dev run preview` (http://localhost:9292, sample data). Run tests with `npm --prefix dev test`. Validate with `npx --prefix dev shopify theme check --path theme`.
- Regenerate media with `tools/media/process_stills.py`, `build_film.py`, `build_fonts.py`, then `gen_asset_snippet.py`. Regenerate locales with `tools/locales/merge-locales.mjs`.
- Before calling work done: theme check reports 0 errors, the suite passes, and you've looked at screenshots at 1440×900 and 390×844.
- Get the owner's approval before changing the logo, palette, campaign name, or any default copy that states a fact.
