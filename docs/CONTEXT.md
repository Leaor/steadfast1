# Project Context: shared facts for every agent

Read `docs/BRIEF.md` first. This file adds the environment facts, the asset inventory, and the decisions the orchestrator already made. Don't re-litigate them; flag them in your output if you think one is wrong.

## Repository layout (target)

```
theme/                 Shopify Online Store 2.0 theme (the deliverable). layout/ templates/ sections/ snippets/ blocks/ assets/ config/ locales/
dev/preview/           Local Shopify-emulating preview server (liquidjs) + fixtures. Dev-only, never shipped in the theme.
dev/tests/             Playwright test suite + reports/screenshots
media/source/          Client originals (never modify)
media/processed/       Optimized stills, logo derivatives, film renders, posters (+ manifest.json)
tools/media/           Reproducible scripts (python/ffmpeg) that build media/processed from media/source
docs/                  BRIEF, CONTEXT, DESIGN, ARCHITECTURE, FILM-STORYBOARD, DEPLOYMENT, TEST-REPORT
claude-skills/, .claude/skills/   Claude tooling (don't touch unless asked)
```

## Decisions already made (by the orchestrator)

1. **Architecture.** A from-scratch Online Store 2.0 theme in `theme/`. Liquid, JSON templates, sections, blocks, section groups, theme settings. Vanilla JS with custom elements (Web Components) and **no build step**. Shopify's **Dawn** theme is cloned read-only at `/tmp/claude-0/-home-user-steadfast1/f40abf06-e805-58bf-a13c-abdbc1278e9d/scratchpad/src/dawn` as a *correctness reference* for Shopify patterns (facets, cart Ajax API, section rendering API, customer templates, localization forms, predictive search). Do not copy its look. Don't copy large chunks verbatim; reimplement in our own design.
2. **Animation.** GSAP 3.15 core + ScrollTrigger, vendored as minified files in `theme/assets/` (source: npm `gsap` dist). Loaded `defer`, only used where timeline/scroll control is justified. CSS for micro-interactions. **No Lenis or any scroll hijacking.** Respect `prefers-reduced-motion` everywhere.
3. **3D.** No 3D garment model exists, so Three.js/R3F fails the 3D gate and is **not used**. The signature showcase is image-based (GSAP scroll with perspective, masks, crossfades, detail crops) and never claims to be 360°. Product pages support Shopify's native 3D model media (`model_viewer_tag`) automatically if the merchant ever uploads a GLB.
4. **Hero film.** No authorized video-generation tool exists in this environment, so none is used. The hero film is an **edit of the client's own supplied footage and photography** (graded, slowed, slow camera moves on stills, logo reveal), rendered with ffmpeg in desktop (16:9) and mobile (9:16) variants with posters. Docs and UI copy must never claim it is a professionally shot campaign film. Also deliver a production-ready storyboard and asset spec (`docs/FILM-STORYBOARD.md`) for a real shoot the client can commission, plus theme settings to swap in Shopify-hosted videos later.
5. **Fonts.** Self-hosted OFL woff2 files in `theme/assets` (fetch from npm `@fontsource/*` packages), so the look is deterministic. The logo is **always the client's wordmark artwork**, never type.
6. **Data honesty.** The theme contains no product data. The preview harness uses **fixtures** derived only from garments visible in the supplied assets. Fixture prices, sizes, and inventory are **placeholders**, marked `"placeholder": true` in the fixture files, and the preview server shows a visible "PREVIEW · SAMPLE DATA" ribbon. Don't invent reviews, ratings, scarcity, brand history, fabric compositions, or shipping times. Theme copy uses restrained, editable placeholder text where information is missing (e.g. "Shipping details to be confirmed").
7. **Store.** No Shopify store is connected. Never publish or contact a live store. Validate with `npx shopify theme check` (works offline) and the local preview + Playwright.

## Environment

- Node 22, npm, Python 3 (+Pillow, numpy, potracer), ffmpeg/ffprobe (libx264, libx265, libvpx-vp9, libsvtav1, libaom), ImageMagick `convert`. Chromium + Playwright 1.63 preinstalled (`require('playwright')`, `chromium.launch()`). Never run `playwright install`.
- Shopify CLI 5.0.1 via `npx @shopify/cli` (or `npx shopify` inside a package that depends on `@shopify/cli`). `shopify theme check --path theme` works offline.
- Network is unrestricted (npm, GitHub).
- Skills to load (Skill tool, or read the SKILL.md directly):
  - `premium-web-experience` (~/.claude/skills/premium-web-experience/SKILL.md + references/patterns.md)
  - `steadfast-premium` (/home/user/steadfast1/.claude/skills/steadfast-premium/SKILL.md). Its default palette and mood are generic placeholders, and **the BRIEF's identity overrides them**.
  - `frontend-design` (/root/.claude/plugins/synced/7e43668b-3fc1-48b3-b5f5-b87274790cbb_db98feea-6149-486a-ba4d-7a42f9fb7a77/2ca4e30e-2482-4c94-8644-6c26adf27391/skills/frontend-design/SKILL.md)
  - `ui-ux-pro-max` (~/.claude/skills/ui-ux-pro-max/SKILL.md; search script `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<q>" --design-system` or `--domain <d>`)
  - `gsap-scrolltrigger`, `motion-framer`, `modern-web-design`, `web3d-integration-patterns`, `lottie-animations`, `rive-interactive` (~/.claude/skills/<name>/SKILL.md)
  - rampstack-starter: `design-standards`, `accessibility-audit`, `performance-optimization`, `qa-testing`, `frontend-component-build` (/root/.claude/plugins/synced/7e43668b-3fc1-48b3-b5f5-b87274790cbb_db98feea-6149-486a-ba4d-7a42f9fb7a77/86fbbbf0-0aba-4966-8d98-e2dc4909bbeb/skills/<name>/SKILL.md)

## Asset inventory (`media/source/`)

Stills (`media/source/photos/`):
| File | Size | What it shows | Intended use |
|---|---|---|---|
| `steadfast-wordmark.png` | 1561×1007 RGB | **Primary logo.** "STEADFAST" in a sharp classical serif with distinctive crossbar-less A's (Λ-like), cream/off-white (#efe6d6-ish), with diagonal distressed light-streak texture, on pure black | Logo everywhere (derive transparent versions; a traced SVG of the letterforms for small sizes; never retype) |
| `campaign-back-embossed-set.png` | 3840×2160 | Model from behind under an overhead spotlight in a dark void on cracked black marble. Stone/bone tracksuit (hoodie + wide pants) with tonal embossed gothic arches and blackletter "Steadfast" on the back, script on the sleeves. Black balaclava with a small third-party swoosh logo. | Campaign editorial (Section D), hero end frame / "pull back into darkness", lookbook |
| `zip-hoodie-blue-grey-front-back.png` | 2752×1536 RGBA | Washed blue-grey zip hoodie on a hanger, front and back side by side, ombré fading to navy at the hem, distressed black appliqué metal-style "STEADFAST" logo on the chest, crystal/rhinestone flourishes on shoulders and sleeves, woven sleeve labels, "STEADFAST" neck label. Black background. | Product gallery front/back (split), signature showcase front↔back |
| `zip-hoodie-blue-grey-front.png` | 2752×1536 | Same hoodie, front only, centered, dramatic dark lighting | Signature showcase hero image, detail crops (zipper, logo, rhinestones, cuff label) |
| `black-tracksuit-night.jpg` | 1450×2576 | Night flash photo at a gas station. Person (masked, goggles) in a black heavyweight zip hoodie + wide black sweatpants with thick cream drawcords, white tee, worn sneakers. Third-party car/storefront in background. | Lookbook / black tracksuit product lifestyle (crop tight) |
| `reflective-tracksuit-screenshot.jpg` | 1186×2576 | **Phone screenshot** (status bar + UI chrome) of a product photo: black speckled/glitter tracksuit with white reflective piping and a script "Steadfast" logo (chest, back, pocket). Front on a model (left) and back (right). | Crop out the phone UI; split front/back for the product images. Lower resolution, so use smaller. |

Footage (`media/source/footage/`, iPhone portrait 720×1280 after rotation, 30fps, HEVC/H.264, with audio). Strip audio for web:
| File | Dur | Content | Notes |
|---|---|---|---|
| `IMG_4913-day-embossed-closeup.MOV` | 7.0s | Overcast daytime. 0–4s: extreme close-up of a **washed-charcoal hoodie back with embossed blackletter "steadfast" and ornamental hood embossing** (best fabric/branding close-up). Then the camera rises to a masked person; ends wide on a contrast-sleeve crewneck + sweatpants. Yellow supercar and park in background. | Best "embroidered fabric" and "branding" close-ups. Grade dark/cool to remove the daylight look. Avoid the supercar where possible. |
| `IMG_4376-night-back-grey-embossed-hoodie.MOV` | 5.4s | Night, gas station. Person from behind in a **washed-grey hoodie with embossed blackletter "steadfast" across the shoulders** and an arched back panel; "Steadfast" script on the cap. | "Model turns slightly, revealing the back design" |
| `IMG_4374-night-profile-car.MOV` | 4.3s | Night. Side profile of a person in a grey zip hoodie leaning by a black SUV. The bottom third has a reflection of the camera operator, so crop it out. Gas station canopy (third-party brand) top left. | "Side profile" (tight crop) |
| `IMG_4409-night-red-pump-hoodie.MOV` | 5.6s | Night, red-lit, heavy third-party fuel-pump branding. Dark hoodie with embossed details. | Weakest; use only short heavily-cropped texture moments, or not at all |

Third-party marks appear in the footage and photos (fuel brand signage, a supercar, an SUV, a sportswear swoosh on a balaclava). Crop, grade, or avoid them in hero and editorial use where possible.

## Garments evidenced by the assets (the only basis for fixtures)
1. Zip hoodie, washed blue-grey ombré (distressed appliqué logo, rhinestones)
2. Reflective-piping tracksuit, black speckle (hoodie + pants)
3. Embossed gothic tracksuit, stone/bone (hoodie + wide pants)
4. Embossed gothic hoodie, washed charcoal/grey (footage only, so stills must come from video frames)
5. Black heavyweight zip hoodie + wide sweatpants (night photo)

## File ownership (build phase)
Exact ownership lives in `docs/ARCHITECTURE.md`. One owner per file, and shared snippets/CSS/JS have a single owner with a documented contract.
