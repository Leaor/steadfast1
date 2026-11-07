# STEADFAST: Design System and Art Direction

Owner: Creative Director + Motion Director. Status: **v2** (design-review revisions applied; see §15 for the reviewer notes and §14 for the cross-doc rulings).

**Order of authority.** `BRIEF.md`, then `CONTEXT.md`. Between this file and `ARCHITECTURE.md`:
- **This file wins on every visual and motion value**: colour values, type families, sizes, weights, spacing values, layout, imagery, crops, grades, easing, durations, choreography and default copy.
- **`ARCHITECTURE.md` wins on ownership, names and mechanics**: file ownership, file and asset names, setting IDs, CSS custom property names, JS APIs, events, the allowed Liquid surface, the preview harness and the tests.
- So ARCHITECTURE owns the *name* of every token and this file owns its *value*. §13 maps every custom property name in ARCHITECTURE §3.4 to its value. Where ARCHITECTURE currently states a visual value that differs from this file, this file applies, and §14 lists the ARCHITECTURE edits needed so the two read the same.

Every value here is meant to be copied as written. If you need a value that isn't here, use the nearest token; don't invent one. **[PLACEHOLDER]** in this document marks editable default copy the store owner must approve. The tag itself is a doc marker and is never rendered. Rendered defaults never contain instructions to the owner; instructions go in the setting's `info` text.

---

## 0. How this was derived (evidence, so nobody re-litigates it)

- **Wordmark** (`steadfast-wordmark.png`, 1561×1007). Classical wedge-serif capitals with crossbar-less, Λ-shaped A's, set on black (#040404). Letter colour: median **#F5EBDB** (MEDIA manifest), edge average about #EFE6D6. The letters are near-solid cream; the distress lives in the diagonal streaks around them.
  - **Letter box** (MEDIA manifest, confirmed on the source): x 242–1358, y 448–603, so **1115×154 px, aspect 7.24:1**. The traced SVG (`sf-logo-wordmark.svg`) has `viewBox="0 0 1115 154"`, the same box.
  - **Textured asset** (letters + streaks, `sf-logo-textured-*`): source box x 188–1398, y 315–726, so **1210×411 px native, aspect 2.944:1**. Inside it the letters sit at **x 0.045–0.9665, y 0.3248–0.6995** of the image (letters = 92.15% of its width, 37.47% of its height).
  - The streaks rake diagonally up and to the right. That diagonal is the brand's only "gesture", and the motion language borrows it (§8.2).
- **Signature hoodie** (`zip-hoodie-blue-grey-front.png`). Upper body sampled at **#768282** (washed grey-teal). The hem sinks to **#041D32** (navy-black). The background is true black.
- **Campaign still** (`campaign-back-embossed-set.png`). Background #020102 (true black). Garment stone #6C645D. A single overhead spot, a reflective cracked black floor, the figure centred at x 0.42–0.58.
- **Footage.** iPhone portrait 720×1280, 30 fps, HDR (HLG) for the three HEVC clips. The tested grade is `tools/media/grade.sh` (see `media/analysis/SHOTLOG.md`); it is the single grade for film and editorial stills (§5.4). The edit is in `FILM-STORYBOARD.md`.
- **UI UX Pro Max** suggested "Liquid Glass + gold accent + Cormorant/Montserrat, Playfair/Inter", a light background and a feature-card grid. **All rejected**: glass, gold and a cream page are generic luxury tells, and they contradict the brief (no glassmorphism, a dark palette). Kept from it: at most one pinned section per page, `ScrollTrigger.refresh()` after media loads, staggers of no more than 8 children, small reveal offsets (8–16 px), and a pre-delivery checklist (focus, reduced motion, 375/768/1024/1440).

---

## 1. Creative concept

### Campaign: **FIXED POINT** (proposed campaign name; owner to approve)

> Everything moves except the one who stands still.
> In a black room, a single light circles a figure who never steps out of place.
> We see the garment the way the light finds it: a seam, a zip, a word in the cloth, a back turned toward us.
> Then the light lets go, the room falls dark, and only the name is left.
> STEADFAST: the fixed point.

**Why it's ours.** The name means *unmoving*. In the concept the figure is the constant, and **the light and the camera do the moving**. That gives the design one governing rule:

**Light, not movement.** Things are *revealed by exposure* (darkness lifting, an aperture opening, a sweep of light). They don't slide, bounce or fly in. Translations are tiny (≤16 px) and only support an exposure change. Nothing spins. The film's portrait "aperture" (a vertical shaft of image in a black field) comes back in the hero loop, the editorial reveal and the showcase. It's the brand's visual signature.

**The feeling:** a cold room at 2 a.m., one lamp, total composure. Expensive because it's quiet.

### Anti-patterns (each one is grounds for rejection in review)

1. **Typing the logo.** Never set "STEADFAST" in a font as a logo, a heading or a hero headline. The wordmark artwork is the only logo, and its streaks are never cropped off at large sizes.
2. **A second "hero headline".** The hero has no big slogan. The wordmark and the film carry it.
3. **Warmth creeping in.** No gold, tan, terracotta or warm cream page backgrounds. Bone (#F1E9DA) is for text, rules and the one primary button. **It is never a background of a section, band or tone.**
4. **Generic e-commerce chrome.** No rounded pills, no soft drop shadows, no card lifts, no "SALE" bursts, star ratings, countdowns, "only 3 left", trust-badge or payment-icon rows, or emoji.
5. **Effects pretending to be production value.** No glow, lens flares, light leaks, RGB split, glitch, particle dust, fake 3D spin of a flat photo or "360°" language. No CSS noise overlays across the site. The film carries grain baked in, and nothing else does.
6. **Template rhythm.** Not every section fades up. No identical card grids for categories. No numbered 01/02/03 markers (or "CAMPAIGN 01"-style series numbers) unless the content really is a sequence. No eyebrow label over every heading. No `→` glued to link text. No meta strings joined with middle dots.
7. **Third-party marks.** Fuel signage, the supercar, the SUV, the swoosh on the balaclava, sneaker logos and the unidentified "S7" monogram on the goggles never appear legibly in hero, editorial or category crops.
8. **Invented facts.** No fabric weights, compositions, construction terms (embroidered, appliqué, embossed, reflective, crystal) in rendered copy, origins, dates, "limited" claims, reviews or delivery promises. Captions describe only what is visible.
9. **Over-animation.** At most one choreographed moment per viewport. Text reveals are allowed in exactly three places (§8.4).
10. **Generic luxury type.** No Playfair, Cormorant, Didot clones or Montserrat. No all-caps serif headlines. Spectral is never set in caps.

---

## 2. Color

All names below are ARCHITECTURE §3.4 names. The full name→value map, including every non-colour token, is §13.

### 2.1 Palette and semantic tokens

```css
:root {
  /* Raw palette (defaults of the colour settings in ARCHITECTURE §2.1) */
  --sf-ink:         #000000; /* setting color_ink: page, hero, film field (true black, so footage blacks merge) */
  --sf-charcoal:    #141619; /* setting color_charcoal: raised surfaces (drawers, dialogs, menus, quick view) */
  --sf-graphite:    #24272B; /* setting color_graphite: hairlines on black; hover rows on charcoal */
  --sf-washed-grey: #8B9096; /* setting color_washed_grey: muted text, meta, inactive nav, form-control borders */
  --sf-steel:       #7C91A5; /* setting color_steel: cold steel accent (active indicators, selected ring, progress) */
  --sf-silver:      #C3C8CD; /* setting color_silver: secondary text, icons, active state of bone UI */
  --sf-bone:        #F1E9DA; /* setting color_bone: wordmark cream; primary text and the primary button. Never a background of a section. */

  /* Semantic (tone "ink", the default for every section) */
  --sf-bg:          var(--sf-ink);
  --sf-bg-raised:   var(--sf-charcoal);   /* drawers, dialogs, menu panels, quick view, next-drop tile */
  --sf-bg-sunken:   #000000;              /* image wells, zoom viewer, video stage */
  --sf-fg:          var(--sf-bone);
  --sf-fg-muted:    var(--sf-silver);     /* secondary text */
  --sf-fg-subtle:   var(--sf-washed-grey);/* muted text and form-control borders */
  --sf-line:        var(--sf-graphite);   /* 1px hairlines */
  --sf-line-strong: #3A3E43;              /* drawer/dialog inner edge, disabled fills. Decorative: never text */
  --sf-accent:      var(--sf-steel);
  --sf-accent-fg:   var(--sf-bone);       /* text on --sf-selection chips */
  --sf-focus:       #A9BBCB;              /* steel-hi: focus ring, body-link hover */
  --sf-scrim:       rgb(0 0 0 / 0.6);
  --sf-error:       #E06C75;              /* cool red, hue 355° (was #D9776B, too close to the warm terracotta tell) */
  --sf-success:     #8DB39B;
  --sf-selection:   #2C3A47;              /* steel-deep: ::selection, selected filter chips */
  color-scheme: dark;
}
```

**Tones** (ARCHITECTURE `tone` setting → `.sf-tone-{tone}`):
- `ink` (default for **every** section, including the newsletter band): the values above.
- `charcoal` (merchant opt-in only, never a default): `--sf-bg: var(--sf-charcoal); --sf-bg-raised: var(--sf-graphite);` everything else unchanged. A charcoal band is a coloured band, which §4.2 forbids on the homepage defaults, so no preset uses it.
- **There is no `bone` tone.** Bone is never a background (anti-pattern 3). The option is deleted.
- There is no light theme.

**Component-private values** (CORE declares these inside the component as `--_*` per ARCHITECTURE §3.4; they are not global names):
| Component | Private prop | Value |
|---|---|---|
| Primary button hover | `--_btn-bg-hover` | `#FBF7EF` ("light hits it"; 19.65:1 with black text) |
| Primary button active | `--_btn-bg-active` | `var(--sf-fg-muted)` |
| Secondary button border | `--_btn-line` | `color-mix(in srgb, var(--sf-fg) 55%, transparent)`; hover `var(--sf-fg)`; hover bg `color-mix(in srgb, var(--sf-fg) 6%, transparent)`; active bg 12% |
| Swatch inner border | `--_swatch-line` | `color-mix(in srgb, var(--sf-fg) 25%, transparent)` |

### 2.2 Contrast checks (WCAG 2.x, computed)

| Foreground / Background | Ratio | Allowed use |
|---|---|---|
| bone #F1E9DA / ink #000 | **17.41** | all text |
| bone / charcoal #141619 | **15.03** | all text in drawers and dialogs |
| bone / graphite #24272B | 12.43 | text on hover rows |
| silver #C3C8CD / ink | 12.46 | secondary text |
| silver / charcoal | 10.76 | secondary text |
| washed-grey #8B9096 / ink | **6.53** | muted text ≥ 12px; form-control borders (UI ≥ 3:1) |
| washed-grey / charcoal | 5.63 | muted text; control borders in drawers |
| washed-grey / graphite | 4.66 | muted text on hover rows (≥ 14px) |
| steel #7C91A5 / ink | 6.45 | accent text, indicators |
| focus #A9BBCB / ink | 10.66 | focus ring, link hover |
| black / bone (primary button) | **17.41** | button label |
| black / #FBF7EF (hover) | 19.65 | button label |
| **error #E06C75 / charcoal** | **5.67** | error text (≥ 4.5:1 ✓) |
| error / ink | 6.57 | error text on the page |
| error / graphite | 4.69 | error text on hover rows (≥ 4.5:1 ✓) |
| success #8DB39B / charcoal | 7.81 | success text |
| success / ink | 9.05 | success text on the page |
| bone / selection #2C3A47 | 9.65 | text on selected chip |
| line-strong #3A3E43 / ink | 1.95 | **decorative only, never text or a required boundary** |

Text placed on photography always sits over a scrim (§5.5), and its ratio is checked against the darkest-likely image area. Washed-grey text over images isn't allowed.

---

## 3. Typography

### 3.1 Families and files (both OFL, self-hosted from npm)

| Role (ARCH token) | Family | Package | Files in `theme/assets/` (ARCHITECTURE §10.1 naming) |
|---|---|---|---|
| `--sf-font-display`: editorial display (headlines, editorial lines, PDP title, large menu links) | **Spectral** (Production Type), weight 300 + 300 italic | `@fontsource/spectral@5.3.0` | `sf-font-display-300.woff2` (≈22 KB), `sf-font-display-300-italic.woff2` (≈24 KB) |
| `--sf-font-text`: UI and body text (body, prices, forms, product names) | **Archivo** (Omnibus-Type), static instances at wdth 100 | `@fontsource-variable/archivo@5.3.0`, instanced | `sf-font-text-400.woff2`, `sf-font-text-500.woff2` (500 = `<strong>` and selected states, so there is no faux bold) |
| `--sf-font-label`: uppercase labels (nav, buttons, micro labels, tabs) | **Archivo** static instance at **wght 500, wdth 115**, declared as its own family `"Archivo Label"` | same, instanced | `sf-font-label-500.woff2` |

- **Five files, each ≤ 40 KB** (ARCHITECTURE §6.1 budget). MEDIA instances Archivo with `fontTools.varLib.instancer` (`wght=400 wdth=100`, `wght=500 wdth=100`, `wght=500 wdth=115`) and subsets to Latin. If instancing is impossible, record it as an open issue; don't ship the 90 KB variable file under three names.
- **Preload exactly two:** `sf-font-text-400.woff2` and `sf-font-label-500.woff2` (labels and nav are above the fold on every template, including the hero). Spectral swaps in with a metric-matched fallback (no CLS). ARCHITECTURE §6.1 currently names `sf-font-display-400`; that file name changes (§14).
- The final list goes in `manifest.json → fonts`, and CORE's `@font-face` must match it.

**Why these two:**
- The wordmark is a sharp, classical, high-waisted serif in capitals. **Spectral Light**, used *only in sentence case* and mostly at large sizes, shares its sharpness but none of its letter shapes (its A has a crossbar; its proportions are bookish rather than monumental). So it sits *beside* the logo without imitating it. Its light italic is the editorial voice for campaign lines.
- **Archivo** at a semi-expanded width (115) and tracked gives labels a precise, industrial, garment-label feel. Body text runs at the normal width. It's a grotesque from a type foundry, not Inter or Roboto, and its tabular figures suit prices.

**Never:** a third family, monospace labels, all-caps Spectral, faux bold or faux italic, or Archivo below 400.

### 3.2 @font-face (metric-matched fallbacks; metrics measured from the files)

```css
@font-face { font-family: "Spectral"; src: url("{{ 'sf-font-display-300.woff2' | asset_url }}") format("woff2");
  font-weight: 300; font-style: normal; font-display: swap; }
@font-face { font-family: "Spectral"; src: url("{{ 'sf-font-display-300-italic.woff2' | asset_url }}") format("woff2");
  font-weight: 300; font-style: italic; font-display: swap; }
@font-face { font-family: "Archivo"; src: url("{{ 'sf-font-text-400.woff2' | asset_url }}") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Archivo"; src: url("{{ 'sf-font-text-500.woff2' | asset_url }}") format("woff2");
  font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Archivo Label"; src: url("{{ 'sf-font-label-500.woff2' | asset_url }}") format("woff2");
  font-weight: 500; font-style: normal; font-display: swap; }
/* Fallbacks: Archivo asc .878 desc .210; Spectral asc 1.059 desc .463 (UPM-normalised) */
@font-face { font-family: "Archivo Fallback"; src: local("Arial"), local("Liberation Sans");
  size-adjust: 101%; ascent-override: 87%; descent-override: 21%; line-gap-override: 0%; }
@font-face { font-family: "Archivo Label Fallback"; src: local("Arial"), local("Liberation Sans");
  size-adjust: 110%; ascent-override: 80%; descent-override: 19%; line-gap-override: 0%; }
@font-face { font-family: "Spectral Fallback"; src: local("Times New Roman"), local("Liberation Serif");
  size-adjust: 106%; ascent-override: 100%; descent-override: 44%; line-gap-override: 0%; }
```
Spectral styles always set `font-weight: 300` explicitly (the only weight shipped). The Archivo Label fallback values are an estimate for the 115 width; CORE re-measures them from the instanced file and records the final numbers in its handoff.

### 3.3 Fluid type scale (rem = 16px; checked at 375 and 1440 viewports)

Every size is multiplied by the `type_scale` setting: `font-size: calc(<value> * var(--sf-type-scale))`.

| Token (ARCH name) | Value | Family / weight | Line-height | Tracking | Case | Use |
|---|---|---|---|---|---|---|
| `--sf-display-xl` | `clamp(2.75rem, 1.8rem + 4.2vw, 6rem)` (44→89px @1440) | Spectral 300 | tight 1.04 | tight -0.02em | Sentence | Section D line, Section F lead line (max one per page) |
| `--sf-display-lg` | `clamp(2.25rem, 1.6rem + 2.8vw, 4.5rem)` (36→66px) | Spectral 300 | tight | tight | Sentence | Collection/page titles, search term |
| `--sf-display-md` | `clamp(2rem, 1.5rem + 2.2vw, 3.5rem)` (32→56px) | Spectral 300 | tight | tight | Sentence | Section headings |
| `--sf-display-sm` | `clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)` (28→40px) | Spectral 300 | snug 1.2 | normal 0 | Sentence | Mobile menu links, category index names |
| `--sf-text-xl` | `clamp(1.375rem, 1.2rem + 0.8vw, 1.875rem)` (22→30px) | Spectral 300 (italic allowed) | snug | normal | Sentence | PDP title, sub-heads, hero campaign line, newsletter heading |
| `--sf-text-lg` | `clamp(1.125rem, 1rem + 0.5vw, 1.375rem)` (18→22px) | Spectral 300 | body 1.55 | normal | Sentence | Editorial paragraphs, brand story |
| `--sf-text-base` | `clamp(0.9375rem, 0.9rem + 0.15vw, 1rem)` (15→16px) | Archivo 400 | body | normal | Sentence | Body, descriptions, accordions; PDP price |
| `--sf-text-sm` | `0.875rem` (14px) | Archivo 400 | 1.4 | normal | **As entered** | **Product names (cards, cart, search, quick view)**, prices, helper text, cart meta, legal, footer links |
| `--sf-text-xs` | `0.75rem` (12px) | Archivo Label 500 | snug | label 0.16em | **UPPERCASE** | Nav, buttons, filter names, tabs, accordion summaries |
| `--sf-text-2xs` | `0.6875rem` (11px) | Archivo Label 500 | snug | label 0.16em | **UPPERCASE** | Micro labels: badges, counters, captions, "SKIP INTRO", form labels, column titles |

Rules:
- **Product names are never uppercased.** Cards, cart lines, predictive search and quick view show `product.title` at `--sf-text-sm`, Archivo 400, sentence case as the merchant entered it, at most 2 lines (`-webkit-line-clamp: 2`). Long garment names in tracked caps wrap to 2–3 lines and make the grid read like a template.
- **Uppercase is for Archivo Label only** (nav, buttons, micro labels), at `--sf-text-xs` or `--sf-text-2xs`, always with `--sf-tracking-label`. Never uppercase body text or more than about 6 words.
- Prices and counters: `font-variant-numeric: tabular-nums`, tracking `--sf-tracking-wide` (0.04em).
- Body measure is at most `--sf-measure` (62ch) for Archivo and 54ch for Spectral lead. Body is left-aligned. Centred text is only for the hero mobile block, the Section F block and empty states.
- `--sf-display-transform` is always `none`. ARCHITECTURE's `type_display_case` setting should be removed; if it is kept, its default is `as_written` and it never uppercases Spectral (§14).
- One `h1` per page. On the homepage the `h1` **is the hero wordmark** (ARCHITECTURE §5.2: `<h1>` wrapping `sf-logo` textured with `alt="{{ shop.name }}"`). There is no separate visually hidden h1.
- Italic Spectral only for campaign or editorial lines (hero campaign line, Section D line). Never for UI.

### 3.4 The logo (wordmark artwork): always artwork, never type

**Geometry (binding; from §0).** Use these boxes for every `width`/`height` attribute and `aspect-ratio`, or the mark is stretched or causes layout shift.

| Asset | Intrinsic box | `aspect-ratio` | Letters inside the box |
|---|---|---|---|
| Traced SVG `sf-logo-wordmark.svg` (flat) | 1115 × 154 | `1115 / 154` (7.24:1) | the whole box |
| Textured raster `sf-logo-textured-*` | 1210 × 411 native | `1210 / 411` (2.944:1) | x 4.50%–96.65%, y 32.48%–69.95% |
| Streak-only raster `sf-logo-streaks-*` (new, §3.4 layered lockup) | 1210 × 411 | `1210 / 411` | letters knocked out (alpha 0 under the SVG letter mask dilated 1px) |

**Sizes.** All widths are the **CSS width of the asset box** (for textured, that includes the streaks; the letters are 92.15% of it).

| Context | Asset | Box width | Letter width that results |
|---|---|---|---|
| Header ≥990 | SVG, `color: var(--sf-fg)` | `logo_width_desktop` = **148px** (condensed 120px) | same |
| Header <990 | SVG | `logo_width_mobile` = **112px** | same |
| Hero (Section A) desktop | Textured raster | **`min(44vw, 640px)`** (hard cap 640) | ≤ 590px |
| Hero mobile (<990) | Textured raster | **`min(84vw, 640px)`** | ≈ 77vw |
| Brand story (Section F) <990 | Textured raster | `min(84vw, 880px)` | |
| Brand story (Section F) ≥990 | **Layered lockup**: streak-only raster + SVG letters on top | **`min(60vw, 880px)`** (hard cap 880) | ≤ 811px |
| Footer bottom bar | SVG | 148px | same |
| Next-drop tile | SVG at 30% opacity | 40% of the tile | same |
| Film logo reveal (DOM) | = hero size | = hero | |

- **Resolution rule.** The textured raster is 1210 px wide natively. It may render at most **1.5× its native pixels** (device px ≤ 1815). The hero cap (640 CSS px → 1280 device px at DPR 2) stays near 1×. The plain raster never renders above **900 CSS px**.
- **Layered lockup** (Section F at ≥990, and anywhere a box would exceed 900 CSS px): a wrapper with `aspect-ratio: 1210 / 411` holds the streak-only raster as the bottom layer and the inline SVG letters (`fill: var(--sf-bone)`) absolutely positioned at `left: 4.5%; top: 32.48%; width: 92.15%; height: 37.47%`. The source letters are near-solid cream, so the vector letters lose nothing, and their edges stay crisp at any size. The light sweep mask (§8.2) goes on the wrapper, so both layers sweep together.
- **Raster renditions** (MEDIA): textured `sf-logo-textured-{600,800,1000,1200,1800}.webp` (+ `-1200.png` fallback; 800/1000 fill the gap so a 634 CSS px desktop hero and a 984 device-px phone hero don't pull the 1200; WebP alpha quality 60, PERF-04) and streak-only `sf-logo-streaks-{1200,1800}.webp`. **Drop the 2000 and 2400 widths** (they're 1.65–2× upscales). The 1600 and 1800 widths are upscales of 1.32× and 1.49×; keep them only if recorded in the manifest as upscaled. ARCHITECTURE §10.1 lists `-2000`; it becomes `-1800` (§14).
- **Clear space** is the letter cap-height **H** on all sides, measured from the letters, not the streaks.
  - SVG: H = 0.138 × box width (154/1115). Header 148px → H 20.4px; 3H = 61px fits the 72px header. Condensed 120px → 50px of 56. Mobile 112px → 46px of 56.
  - Textured: H = 0.1273 × box width. The streaks already cover most of it, so the **minimum margin around the textured box** is 0.083 × box width left and right and 0.017 × box width top and bottom. Streaks may overlap neighbours only in the hero and Section F.
- Never recolour except bone (or `currentColor` = bone) on black. Never outline, add effects, rotate, stretch, or crop the letters.
- Below 200px rendered width, always use the traced SVG. The texture turns to mush at small sizes.
- Hero instance: inside the `h1`, `alt="{{ shop.name }}"`. Header logo: `<a aria-label="{{ shop.name }} home">`.

---

## 4. Layout system

### 4.1 Breakpoints (min-width, mobile-first; the same literals as ARCHITECTURE §3.3)

| Name | Min width | Columns | `--sf-gutter` (page side margin) | `--sf-grid-gap` |
|---|---|---|---|---|
| base (phone) | 0 | 4 | 16px | 12px |
| `md` | 750px | 8 | 32px | 16px |
| `lg` (desktop layouts start) | 990px | 12 | clamp(40px, 4vw, 64px) | 24px |
| `xl` | 1200px | 12 | 64px | 24px |
| `2xl` | 1600px | 12 | 64px | 32px |

Content max width is `--sf-page-max` from the `page_width` setting (default 1600px), centred.

```css
:root { --sf-gutter: 16px; --sf-grid-gap: 12px; --sf-header-h: 56px; }
@media (min-width: 750px)  { :root { --sf-gutter: 32px; --sf-grid-gap: 16px; } }
@media (min-width: 990px)  { :root { --sf-gutter: clamp(40px, 4vw, 64px); --sf-grid-gap: 24px; --sf-header-h: 72px; } }
@media (min-width: 1200px) { :root { --sf-gutter: 64px; } }
@media (min-width: 1600px) { :root { --sf-grid-gap: 32px; } }
```
Full-bleed media (hero, Section D, showcase stage, category tiles on mobile) ignores the gutter. Everything else aligns to the grid's outer edge.

### 4.2 Spacing scale (4px base)

`--sf-space-1: 4px; -2: 8px; -3: 12px; -4: 16px; -5: 24px; -6: 32px; -7: 48px; -8: 64px; -9: 96px; -10: 128px; -11: 192px; -12: 256px`.

- `--sf-section-pad-y` (from the `spacing` setting): `standard` = `clamp(96px, 10vw + 40px, 176px)` (default for every homepage section), `compact` = `clamp(64px, 6vw + 24px, 112px)`, `generous` = `clamp(128px, 12vw + 64px, 240px)`, `none` = 0. **Sections are separated by space on the one black field, never by boxes or coloured bands.**
- Heading to content: `--sf-space-7` (48px) on desktop, `--sf-space-6` (32px) on mobile.
- Product grid: column gap **4px** (`--sf-space-1`), images edge to edge like a contact sheet. Row gap `--sf-space-7` desktop, `--sf-space-6` mobile. Card text has a 12px inset from the image edge on desktop and 0 on mobile.
- Inside components, stick to 8/12/16/24.

### 4.3 Radii, borders, shadows, layers

- **Radius: 0 everywhere** (`--sf-radius: 0`, `--sf-radius-input: 0`). Swatches and badges are square.
- **Hairline:** `var(--sf-hairline) solid var(--sf-line)` for dividers, accordion rules and the header bottom edge (solid state only). **Strong edge:** `1px solid var(--sf-line-strong)` on the inner edge of a drawer or dialog. **Control:** `1px solid var(--sf-fg-subtle)`.
- **Shadows: none.** `--sf-shadow-drawer: none`. Elevation comes from the scrim and the raised surface. No `box-shadow` anywhere except the focus-ring separator (§6.7).
- **No `backdrop-filter` anywhere**, including the solid header (performance, and the brief's no-glass rule).
- z-index: ARCHITECTURE's scale applies as written (§13). Dialogs and drawers live in the top layer (`showModal()`), so they need no z-index.

---

## 5. Imagery

### 5.1 Aspect ratios

| Use | Ratio | Notes |
|---|---|---|
| Product card, PDP gallery, quick view, cart thumb | **4:5** (`--sf-ratio-card: 4 / 5`, setting `card_image_ratio` default `tall`) | `object-fit: cover`, `object-position: 50% 30%` |
| Hero film / loop | desktop 16:9 file, `object-fit: contain` on black; mobile 9:16 file, `object-fit: cover` | The aperture composition makes contain bars invisible (FILM A2) |
| Campaign editorial (Section D) | desktop 16:9 full-bleed; mobile **4:5** | mobile crop x 0.275–0.725 of the campaign still |
| Category stage and tiles (Section E) | 4:5 | |
| Signature showcase stage | full viewport (desktop); 4:5 tiles (mobile) | |
| Collection banner (optional) | 21:9 desktop, 4:5 mobile | |
| Mega-menu tiles | 3:4 | |

### 5.2 Product photo crops from the supplied stills (media pipeline and fixtures)

Crop notation in this file is **(x0, y0, x1, y1)** as fractions of the source width and height, unless a table says otherwise.
- Zip hoodie front, from `zip-hoodie-blue-grey-front.png`: **(0.276, 0.0, 0.723, 1.0)** → 4:5.
- From `...-front-back.png`: front **(0.030, 0.0, 0.477, 1.0)**, back **(0.527, 0.0, 0.973, 1.0)**.
- Reflective tracksuit screenshot: strip the phone UI (keep y 0.26–0.735), then split into front (x 0.0–0.5) and back (x 0.5–1.0). Low resolution: serve at no more than 560–900px wide (whatever the source supports at ≤1.5×).
- Black tracksuit night: lifestyle crop **(0.25, 0.22, 0.65, 0.80)** then 4:5; burn the right edge (car door at x > 0.61) and keep the sneaker side marks illegible (§5.3).

### 5.3 Treatment policy

- **Product shots (studio stills) are colour-true.** No stylistic grade, no runtime CSS filters, no grain. Only crop, exposure normalisation, the black-point clamp below, and export. Customers buy colour.
- **Lifestyle views** (product media cut from night photos or footage, e.g. `heavyweight-zip-hoodie-black`, `wide-sweatpants-black`, `embossed-gothic-hoodie--back-grey`) are **not** colour-true. They get the editorial grade, a tighter crop that removes third-party vehicles at the edges, and the view label `lifestyle` in the manifest and alt text. They are never the first gallery image when a studio view exists.
- `embossed-gothic-hoodie--back-charcoal` is a 720px daylight video frame: cap it at 720w, and never use it as the LCP image or the first gallery image at a large size.
- **Editorial, lifestyle, category and film imagery use the cold near-monochrome grade** (§5.4). The blue-grey hoodie is the only "colour" moment on the homepage, and it's allowed to read steel-blue.
- **Black-point clamp (binding).** Every image designed to sit on the page's #000 (signature hero/back and front/back, campaign, editorial, category stills on black, film end stills/posters, the showcase details) is clamped so **luma ≤ 6 → 0**, with a smooth ramp to luma 12 (no posterised edge). The `sf-signature-hero` and `-back` stills currently carry a lifted, garbled noise band over the bottom ~130px (luma 2–2.4 against 1.0 above), which shows as a rectangle edge on OLED screens and in the 2.4× zooms. The clamp removes it.
- **Grain** is baked into the film only. No site-wide noise overlay. If the hero markup keeps a `.sf-hero__grain` layer (ARCHITECTURE §5.2), it is `display: none` by default. It is never animated.
- **Runtime "exposure"** (darkening and lifting) is always a black overlay `::after` with animated `opacity`. It's never `filter: brightness()`, which repaints large images every frame.
- Formats: Shopify `image_url` + `image_tag` with `widths` (AVIF/WebP negotiated by the CDN); bundled stills are WebP + one JPG per ARCHITECTURE §10.1. Every `<img>` has explicit `width`/`height` and `sizes`. The LCP image is never lazy and gets `fetchpriority="high"`.

### 5.4 The grade (one look for film and editorial stills)

**`tools/media/grade.sh` is the single source of truth** (tested and documented in `media/analysis/SHOTLOG.md` §5). Its LOOK:

```
unsharp=9:9:0.35:9:9:0,
curves=m='0/0 0.07/0.01 0.2/0.10 0.45/0.37 0.7/0.66 0.9/0.86 1/0.92',
colorbalance=rs=-0.03:gs=-0.005:bs=0.045:rm=-0.02:bm=0.025:rh=-0.015:bh=0.015,
vignette=angle=0.5
```
preceded by a per-source **pre** stage (HLG→BT.709 tone-map for the HEVC clips, an exposure curve, and a near-mono channel mix keeping 4–8% colour) and followed, for film only, by luma-only grain `noise=c0s=3:c0f=t`.

- Blacks crush below ~7%; whites cap at 0.92 (silver, never paper-white); shadows and mids lean cold.
- **Stills** run through the same chain as single frames, with a still pre stage (no tone-map): flash stills (`black-tracksuit-night`) `curves=m='0/0 0.3/0.18 0.6/0.46 1/0.82'` + mono mix (0.30/0.55/0.15 at 0.92) and an extra `vignette=angle=PI/3.4`; the campaign still mono mix at 0.92 only (it is already graded); the blue-grey hoodie when used editorially, mono amount 0.80 so its steel-blue survives. No grain on stills.
- The darker crush and corner burns used for individual film shots are **per-shot layers on top of grade.sh** (FILM-STORYBOARD A4), not a second grade.
- Editorial stills already produced with the v1 chain (`eq/colorbalance bs=0.07/curves/vignette PI/4.2`) are re-rendered through grade.sh when MEDIA regenerates them for the black-point clamp.

### 5.5 Scrims (for text legibility on imagery; the only gradients allowed)

- Header over hero: `linear-gradient(to bottom, rgb(0 0 0 / .55), rgb(0 0 0 / 0))` over 160px.
- Mobile hero bottom: `linear-gradient(to top, rgb(0 0 0 / .75) 0%, rgb(0 0 0 / 0) 45%)`.
- Category tile label (mobile): `linear-gradient(to top, rgb(0 0 0 / .6), transparent 40%)`.

### 5.6 Category default stills (five different garments)

| Category (`sf-category-*`) | Source | Treatment | Widths |
|---|---|---|---|
| Hoodies | **black heavyweight zip hoodie**, `black-tracksuit-night.jpg` upper crop (crown to mid-thigh, 4:5 box y 0.21–0.63, centred x 0.45). Not the zip hoodie: the signature showcase owns that garment, and five tiles mean five garments | flash grade (as Bottoms); right-edge burn (car door); soft left burn | 540, 900, 1080 (source-limited; the 1080 cap replaces 1200) |
| Tracksuits | stone campaign figure crop (already produced; balaclava retouch, see DEPLOYMENT) | campaign grade | 540, 900, 1200 |
| Bottoms | black sweatpants, `black-tracksuit-night.jpg` lower crop | flash grade; right-edge burn (car door); sneaker side marks illegible | 540, 900, 1200 |
| New Arrivals | embossed charcoal hoodie close-up (from `sf-lookbook-embossed-hoodie`, IMG_4913 frame) | film grade | 540, 720 (source-limited) |
| Tops | reflective tracksuit **front, top crop** (the hoodie top with its chest script), phone UI removed | colour-true + black-point clamp | 400, 560 (source-limited) |

The blue-grey zip hoodie appears once on the homepage as a hero garment: in the signature showcase (and as featured card 1 when it is the newest product). Hoodies, Tops and New Arrivals are regenerated from the sources above, and the header mega-menu tile default (`sf-category-hoodies`) therefore shows the black hoodie too. All zip-hoodie stills have the **hanger painted out** (MEDIA, FILM-STORYBOARD A1). A clean IMG_4913 crewneck frame is **not** used for Tops: the crewneck isn't one of the five evidenced garments (CONTEXT), and the frame carries the unidentified "S7" monogram.

---

## 6. Iconography and primitives

### 6.1 Icons
- Custom inline SVG on a 24×24 grid, rendered at 20px (header) or 16px (inline). **Stroke 1.5** in grid units (≈1.25 px at 20px), `stroke-linecap: square`, `stroke-linejoin: miter`, no fills, `currentColor`. Sharp ends match the wordmark's wedges.
- ARCHITECTURE's `sf-icon` names apply. Drawing notes: `menu` (two horizontal lines 14px apart, 18px long, no third line), `close`, `search`, `account` (head + shoulders arc), `bag` (square body, single handle arc; used for the cart), `plus`, `minus`, `chevron-down`, `chevron-right`, `play`, `pause`, `zoom` (magnifier with a plus), `instagram`, `arrow-left`/`arrow-right` (rail controls only). **Missing from ARCHITECTURE and needed:** `filter` (two horizontal lines with offset ticks) and `chevron-left` (§14).
- On desktop, header actions are **text labels** (`SEARCH`, `ACCOUNT`, `CART (2)`) in `--sf-text-xs`. On mobile they're icons with `aria-label`s. ARCHITECTURE's markup order and data attributes stay; only the inner content differs by breakpoint. Tap targets are at least 44×44.

### 6.2 Buttons (radius 0, `--sf-text-xs`, Archivo Label 500, tracking 0.16em, uppercase)

| Variant | Spec | Hover (pointer: fine) | Active | Disabled |
|---|---|---|---|---|
| **Primary** | bg bone, text black, height 52px, padding 0 32px, no border | bg → `--_btn-bg-hover` (`--sf-dur-instant`) | bg → silver | bg `--sf-line-strong`, text washed-grey, `cursor: not-allowed` |
| **Secondary** | transparent, 1px `--_btn-line`, text bone, 52px | border → bone, bg 6% bone | bg 12% bone | border line-strong, text washed-grey |
| **Text link-button** | no box, text bone, 1px underline `currentColor` at 55% opacity, `text-underline-offset: 6px` | underline 100% | n/a | washed-grey |
| **Icon button** | 44×44 hit area, icon 20px silver | icon → bone | n/a | line-strong |

- Full-width on mobile for the main actions: hero primary, Add to cart, Checkout, Newsletter submit.
- Hero: **EXPLORE COLLECTION** = Primary. **VIEW THE CAMPAIGN** = Text link-button.
- **Vocabulary is "cart"**, as in the brief: `ADD TO CART`, `CART (n)`, "added to cart". ARCHITECTURE's locale keys keep their names (`product_card.add_to_bag`, `products.add_to_bag`), but their values are "Add to cart" / "{{ title }} added to cart" (§14).
- Add to cart states: `ADD TO CART` → `ADDING…` (aria-busy) → opens the cart drawer. Sold out: `SOLD OUT`, disabled. Unavailable combination: `UNAVAILABLE`, disabled.
- No arrows inside button text. No icons in primary buttons.
- **No accelerated checkout buttons by default.** The PDP `buy_buttons` block's `show_dynamic_checkout` defaults to **false**: Shopify's branded buttons break the monochrome primary-button system. It stays a merchant opt-in.

### 6.3 Links
- Inline body links: bone, 1px underline at 40% opacity, offset 4px. Hover: `--sf-focus` text.
- Nav links: `--sf-text-xs`, silver. Hover and current: bone, plus a 1px bone rule 6px below the text, drawn with `transform: scaleX(0→1)` from the left (`--sf-dur-fast`, `--sf-ease-standard`). `aria-current="page"` keeps the rule.

### 6.4 Forms
- Label above the field: `--sf-text-2xs`, washed-grey, uppercase, 8px gap.
- Input: height 52px, bg transparent, `1px solid var(--sf-fg-subtle)`, padding 0 16px, `--sf-text-base` bone, placeholder washed-grey. Hover border silver. Focus border bone plus the focus ring.
- Error: border `--sf-error`, message `--sf-text-sm` in `--sf-error` below, prefixed with the `error` icon, linked with `aria-describedby`. Copy says what's wrong and what to do ("Enter a valid email address."). Errors don't apologise.
- Checkbox and radio: 18px square, 1px control border. Checked: bone fill with a black tick.
- Select: the native select styled as an input with a `chevron-down` at 16px. Filters use checkboxes.
- Quantity stepper: three 44px cells (− | value | +), 1px control border, value tabular-nums.

### 6.5 Badges (from real data only)
- `NEW` (product tag `new`, merchant-set), `SOLD OUT` (no variant available), `PRE-ORDER` (merchant-set tag only). Never "LIMITED", "HOT" or percentages. A real compare-at price shows struck through in washed-grey; no percentage badge.
- Style: `--sf-text-2xs`, bone on black, padding 5px 8px, no border, top-left of the image at 12px inset.

### 6.6 Swatches
- 14×14 squares (hit area 32×32 on card, 44×44 on PDP). The fill comes from Shopify swatch data (`product_option_value.swatch.color`, in the allowed Liquid surface), otherwise a colour-name map in CORE's snippet. 1px `--_swatch-line` inner border so black swatches show on black. **No metafield source** (metafields are outside ARCHITECTURE §8.6).
- Selected: a 1px steel ring offset 3px. Unavailable: a diagonal 1px washed-grey slash.
- Card shows at most 4 swatches, then `+N` in `--sf-text-2xs`.

### 6.7 Focus
```css
:focus-visible { outline: 2px solid var(--sf-focus); outline-offset: 2px; box-shadow: 0 0 0 4px var(--sf-ink); }
```
The black separator keeps the ring at ≥ 3:1 over imagery and next to bone buttons. Never remove focus. Inside image cards the ring goes on the card's link box.

---

## 7. Component specs

### 7.1 Header
- **Desktop (≥990):** a 3-zone grid `1fr auto 1fr`. Left: primary nav (`SHOP`, `CAMPAIGN`, plus merchant menu items, at most 5). Centre: the wordmark SVG (148px). Right: `SEARCH`, `ACCOUNT`, `CART (n)`, plus the localization selector only if `show_localization` is on. Height **72px**, condensed **56px**.
- **Mobile:** left menu icon, centre wordmark (112px), right search icon and bag icon with the count as `--sf-text-2xs` text (not a bubble). Height 56px.
- **States:**
  1. *Transparent / minimal* (homepage while the hero is under the header, **from t = 0, including during the intro**): no background, header scrim (§5.5), text bone, every nav item and action visible and usable. **The logo slot is empty** (the SVG is present at `opacity: 0`, its box reserved, so nothing shifts), because the hero wordmark is the logo.
  2. *Solid*: bg `--sf-bg`, bottom hairline, condensed height 56px, logo 120px, which fades in (`--sf-dur-base`). It switches when ARCHITECTURE's hero sentinel (`[data-sf-header-sentinel]`, IntersectionObserver) stops intersecting. Every other template is solid from load. **There is no logo "dock" animation and no GSAP in the header or hero.**
  3. *Hidden* (`sticky_behavior: on-scroll-up`): `translateY(-100%)` while scrolling down past the hero (home) or past 2× header height (elsewhere). It reappears on any scroll up, on focus inside, or while a menu or drawer is open.
- Skip link to `#MainContent` is the first focusable element.

### 7.2 Mega menu (desktop, `SHOP`)
- Opens on click, Enter or Space, or on hover with a 120ms intent delay. Closes on Esc, click outside, or 200ms after the pointer leaves. The trigger is a `<button aria-expanded>`; disclosure pattern, not ARIA menu roles.
- Full width under the header, bg `--sf-bg`, hairline top, padding `--sf-space-8` × gutter. Grid: cols 1–3 `CATEGORIES` (Hoodies, Tracksuits, Tops, Bottoms, New arrivals) at `--sf-text-xs`, 18px row gap. Cols 4–6 `COLLECTIONS` (merchant menu). Cols 7–12: up to two 3:4 tiles from the header's `menu_promo` blocks, name in `--sf-text-2xs` under each.
- Scrim under the panel covers the page (black 50%).

### 7.3 Mobile menu
- **Full-screen black panel** (`<sf-dialog data-sf-dialog-type="fullscreen">`; ARCHITECTURE currently says `drawer-left`, see §14). Because the dialog sits in the top layer, the panel repeats the 56px header row itself: the close icon in exactly the menu icon's position, the wordmark, search and bag icons. So it reads as the header staying put while the menu opens under it.
- Primary links in Spectral at `--sf-display-sm`, sentence case, left-aligned, 8px row gap. Items with children open a nested level as a slide-over (`translateX` 100%→0, with a back button `‹ SHOP` at `--sf-text-xs`).
- Below the links, after a hairline: `ACCOUNT`, `SEARCH`, `INSTAGRAM` (if set), then the country/currency and language selectors.
- Focus trap, Esc closes, inert background (native `showModal`). Scroll lock via `Steadfast.scrollLock` with `scrollbar-gutter: stable`.

### 7.4 Search overlay
- A top sheet over a scrim, bg `--sf-bg`, padding `--sf-space-8` (desktop) or `--sf-space-5` (mobile). Bare input with a bottom 1px control rule, Spectral 300 at `--sf-text-xl`, placeholder "Search" (washed-grey), and a `CLOSE` text button.
- Predictive results: `PRODUCTS` (up to 4: 4:5 thumbs, name at `--sf-text-sm` as entered, price), `SUGGESTIONS`, `COLLECTIONS`, and `SEARCH FOR "query"`. Arrow keys move through results, Enter goes. Results announce through an `aria-live="polite"` count.
- Search results page: the collection grid, with the term in Spectral `--sf-display-lg`.

### 7.5 Product card
```
┌───────────────┐  image well 4:5, bg black
│ NEW           │  badge top-left 12px
│               │
│   primary     │  hover → secondary image crossfade
│               │
└───────────────┘
 Washed zip hoodie        ← product.title as entered: --sf-text-sm, Archivo 400, bone, ≤ 2 lines
 €000.00                  ← price --sf-text-sm silver, tabular (compare-at struck in washed-grey)
 ■ ■ ■  +1                ← swatches
 QUICK VIEW   ADD TO CART ← actions: text link-buttons, --sf-text-2xs (desktop: visible on hover/focus-within, always in DOM)
```
- **Markup and behaviour follow ARCHITECTURE §4.6** (one stretched link on the title; actions are separate controls above it). Quick add uses ARCHITECTURE's contract: a single-variant product adds directly; a product with options opens quick view with `intent: 'add'` (sizes chosen there). There are no inline size cells on the card.
- Hover (pointer: fine): the secondary image crossfades in (opacity, `--sf-dur-slow`, `--sf-ease-in-out`). No card lift, no shadow, no scale on the card.
- Touch (pointer: coarse): no hover image; the actions row is always visible under the price.
- Swatch click swaps the card image to that colour's featured media if variant media exists; otherwise it links to the PDP with the variant pre-selected.

### 7.6 Quick view
- Desktop: a dialog `min(1080px, 92vw)` × `min(720px, 88vh)`, `--sf-bg-raised`, strong edge, 70% scrim. Grid 7/5: left a 4:5 gallery (scroll-snap, counter `1 / 4` in `--sf-text-2xs`); right title (Spectral `--sf-text-xl`, as entered), price, colour and size selectors (PDP component), Add to cart, `VIEW FULL DETAILS` text link. Close top-right (44px).
- Mobile: a bottom sheet at 90svh, a 32×2px washed-grey handle bar, content stacked.
- Focus moves to the dialog title and returns to the trigger on close.

### 7.7 Cart drawer
- Right side, `min(440px, 100vw)`, `--sf-bg-raised`, strong left edge, full height.
- Header row: `CART` + count (`--sf-text-xs`) and a `CLOSE` text button.
- Line item: 88px-wide 4:5 thumb, **name at `--sf-text-sm` Archivo 400, as entered**, variant (`--sf-text-sm` washed-grey), price (tabular), quantity stepper, `REMOVE` text link (`--sf-text-2xs`). 24px vertical rhythm, hairline separators.
- Footer (sticky): Subtotal row (`--sf-text-xs` + price), the `cart_note_text` line (`--sf-text-sm` washed-grey), optional order note, **CHECKOUT** primary full width, `VIEW CART` text link.
- Empty: Spectral `--sf-text-xl` "Your cart is empty." and a Primary `EXPLORE COLLECTION` button.
- No free-shipping bar, no upsell carousel.
- Ajax errors (inventory) appear inline under the line item in `--sf-error`.

### 7.8 Product page (PDP)
- **Desktop (≥990):** cols 1–7 hold the gallery as a **vertical stack of 4:5 images at full column width** (every media item, in order). Cols 9–12 hold the info column, `position: sticky; top: calc(var(--sf-header-h) + 32px)`.
- **Mobile:** a full-bleed horizontal scroll-snap gallery (4:5), a 1px progress bar (steel on graphite) and the counter `1 / 5`. Info stacks below with gutters.
- **Info column order** (ARCHITECTURE `product.json` blocks): Title (Spectral `--sf-text-xl`, as entered). Price (`--sf-text-base`, bone; compare-at in washed-grey). Tax note (`--sf-text-sm` washed-grey). Colour selector (label `COLOUR` left; selected name right in silver; swatches below). Size selector (cells ≥ 52×48px, 5-up grid, `--sf-text-xs`; sold-out cells slashed but focusable). `SIZE GUIDE` text link right-aligned on the size label row. Add to cart (primary, full width; **no dynamic checkout by default**). Accordions.
- **Accordions** (`<details>`, hairline between, `--sf-text-xs` summary with plus/minus): `DETAILS` (product description), `SIZE & FIT` and `CARE` as `collapsible` blocks whose content is a page or richtext the merchant sets (hidden if empty; **no metafield sources**), `SHIPPING & RETURNS` (`source: shipping_returns`, global setting; default "Shipping and returns details to be confirmed.").
- **Zoom:** clicking or Enter on a gallery image opens a full-screen black viewer: the `width=2400` rendition (capped at the image's own width), drag/scroll to pan on desktop, native pinch on touch, arrow keys prev/next, `CLOSE`, counter. No hover lens.
- **Size guide:** a right drawer with the page from `size_guide_page`, else `size_guide_fallback` ("Sizing information to be confirmed."). Never invented measurements.
- **Related:** Shopify recommendations, heading (Spectral `--sf-display-md`) **"You may also like"** (ARCHITECTURE default). A rail of product cards.
- **3D:** if model media exists, `model_viewer_tag` appears in its gallery position with a poster. Never the wording "360°".

### 7.9 Collection page
- Header: title Spectral `--sf-display-lg`, description (`--sf-text-lg`, max 54ch, washed-grey) only if it exists, count `24 PIECES` (`--sf-text-2xs`, from `products_count`). Optional banner 21:9 / 4:5, graded editorial.
- Toolbar, sticky under the header (bg `--sf-bg`, hairlines, 48px): left `FILTER (n)` (with the `filter` icon on mobile) opens the filter drawer; right `SORT: FEATURED` (native select styled as a text button) and a density toggle (desktop 2/4 columns, mobile 1/2), persisted in `localStorage` (try/catch).
- Grid: `columns_desktop` (default 4 in DESIGN; ARCHITECTURE's default 3 should become 4), 2 on mobile, gaps from §4.2.
- **Filter drawer:** left, `min(420px, 100vw)`, `--sf-bg-raised`. Each filter a `<details>` with checkboxes, price as two number inputs, active filters as removable `--sf-selection` chips (`--sf-text-2xs`, × icon), footer `CLEAR ALL` + `SHOW n RESULTS` (primary). Desktop applies live (debounced 300ms); mobile on submit.
- Pagination: numbered pager (`--sf-text-xs`) by default.
- Empty result: "No pieces match these filters." plus a `CLEAR ALL` secondary button.

### 7.10 Newsletter (Section G band; `sf-newsletter`, footer group)
- **One instance only**: the band above the footer (ARCHITECTURE decision 3, footer group). It is not repeated inside the footer columns.
- Tone **`ink`** (on the black field, like every section). Hairline top, `--sf-section-pad-y` compact.
- Desktop: heading in cols 1–5, form in cols 7–12, on the same baseline. Mobile: stacked.
- Copy defaults: heading (Spectral `--sf-text-xl`) **"New pieces, by email."**; `text` blank (hidden); eyebrow blank; button `SUBSCRIBE` (primary, 52px; inline with the input on desktop, sharing its border, no gap); consent line (`--sf-text-sm` washed-grey) "By subscribing you agree to receive emails. Unsubscribe at any time." (ARCHITECTURE default).
- Native `{% form 'customer' %}` with `contact[tags]=newsletter`. Success replaces the form with **"You're subscribed."** in `--sf-success` and moves focus to it. Errors inline.
- No discount-code promise unless the merchant writes one.

### 7.11 Footer
- Black, hairline top, padding `--sf-space-9` top and `--sf-space-7` bottom. **No newsletter here.**
- **Desktop grid (12 col):** cols 1–3 the wordmark SVG (148px). Then four link columns: cols 5–6 **SHOP** (menu block: Hoodies, Tracksuits, Tops, Bottoms, New arrivals), cols 7–8 **HELP** (menu block: Shipping, Returns, Contact, Size guide), cols 9–10 **LEGAL** (Shopify policies via `show_policies`: Privacy, Refund, Shipping, Terms), cols 11–12 **FOLLOW** (social block: Instagram and any other set handle). Column titles `--sf-text-2xs` washed-grey; links `--sf-text-sm` silver, hover bone, 12px row gap.
- **Bottom bar** (hairline above, 24px padding): left the country/currency `localization` form and language selector (native selects, `--sf-text-2xs`); right `© {{ 'now' | date: '%Y' }} {{ shop.name }}` (`--sf-text-2xs` washed-grey), and the motion toggle if enabled.
- **No payment icons** (they need `payment_type_svg_tag`, which ARCHITECTURE §8.6 forbids, and they're a trust-badge row).
- Mobile: wordmark, then the four link groups as `<details>` accordions, then the bottom bar stacked.

---

## 8. Motion language

### 8.1 Tokens (ARCH names; values here)

| Token | CSS | GSAP equivalent | Use |
|---|---|---|---|
| `--sf-ease-out` | `cubic-bezier(0.19, 1, 0.22, 1)` | `"expo.out"` | Reveals, logo settle, image scale-downs: things coming to rest |
| `--sf-ease-standard` | `cubic-bezier(0.215, 0.61, 0.355, 1)` | `"power3.out"` | UI enters: drawers, menus, header |
| `--sf-ease-in-out` | `cubic-bezier(0.445, 0.05, 0.55, 0.95)` | `"sine.inOut"` | Exposure changes, crossfades, film moves, **all exits and closes** (at the faster duration) |
| scrub | n/a | `ease: "none"`, `scrub: 0.8` | Every scroll-linked tween |

| Duration token | Value | Use |
|---|---|---|
| `--sf-dur-instant` | 120ms | Colour, underline, icon state |
| `--sf-dur-fast` | 240ms | Closes and exits, nav underline, results fade |
| `--sf-dur-base` | 320ms | Header state, scrims, dropdowns, logo fade |
| `--sf-dur-slow` | 480ms | Drawers, mega panel, sheets, card image crossfade |
| `--sf-dur-cinematic` | 1200ms | Large exposure lifts, loop fade, wordmark sweep. Mask reveals use `calc(var(--sf-dur-cinematic) * 0.75)` = 900ms |

- `--sf-stagger`: 40ms (list items); cards and blocks use 2× (80ms). **No more than 8 staggered children**; after that they share one tween.
- `--sf-reveal-distance`: 12px.
- `--sf-motion`: `1` (`full`), `0.5` (`subtle`), `0` (`reduced`). CSS durations are written `calc(var(--sf-dur-x) * var(--sf-motion))`.
- **Motion levels.** `full`: everything in this section. `subtle`: no pin, no scrubbed sequences (C uses the stacked layout; D and F show their final state with a single 900ms opacity reveal), the intro and loop still play. `reduced` (OS setting or visitor toggle): §8.5.
- Exits are about 30% faster than entrances and never stagger.
- No springs, bounce, elastic, overshoot or `back` eases.
- **Rotation:** none, except the 45° menu-to-close icon lines and the signature showcase's perspective tilt, **|rotateX/rotateY| ≤ 6°** (§10). No `rotateZ` on content.
- Translate distances: 8–16px max (drawers and sheets travel their own size).
- **Parallax: none** (the scrubbed scale-down in D is the only depth cue).
- **Animatable properties:** `transform`, `opacity`, `clip-path`, and the `--sweep` mask variable on the wordmark. **Never `filter`** (including `brightness()`), `width`, `height`, `top` or `left` (header height on the fixed header is the one exception).
- Every reveal plays **once**. Nothing re-hides on scroll up.

### 8.2 Signature devices (reuse these; don't invent new ones)

1. **Exposure lift:** a black overlay `::after` goes from opacity 1 (or 0.85) to 0 over `--sf-dur-cinematic` with `--sf-ease-in-out`, while the image scales 1.06→1.00 with `--sf-ease-out`. "Darkness lifting."
2. **Aperture open:** `clip-path: inset(a% b% a% b%)` → `inset(0)`. A vertical shaft widens to a frame. Used in the film (beat 7), Section D and the menu panels (top-down variant `inset(0 0 100% 0)` → `inset(0)`).
3. **Light sweep:** a CSS mask on the wordmark, `mask-image: linear-gradient(105deg, #000 0%, #000 calc(var(--sweep) - 15%), transparent calc(var(--sweep) + 15%))`, `--sweep` animated from -30% to 130%. The 105° follows the wordmark's streaks. Used **only on the wordmark** (film beat 8 in the DOM, Section F).

### 8.3 Choreography by section and component

**A. Hero (intro eligible: first visit in the session, motion `full` or `subtle`, not save-data).** The store is never behind the film: from the first cut (film `t ≥ 2.2s`) the CTA row is present at opacity 0.8 (1 on hover or focus) and clickable; before that it has `pointer-events: none`. Only the wordmark waits for beat 8, and the eyebrow and line for beat 9. The hero uses **no GSAP**: CSS transitions/keyframes keyed off ARCHITECTURE's `data-state` plus two beat classes the hero script sets from `timeupdate`. Film details: `FILM-STORYBOARD.md`.
- `t = 0` (`data-state="playing"`): the header is already visible in its minimal transparent state (§7.1): nav, search, account and cart usable, logo slot empty. The film plays inside the black stage. The hero content (wordmark `h1`, eyebrow, campaign line, CTAs) is **in the DOM and focusable**, visually at `opacity: 0` (never `visibility: hidden` or `display: none`). `SKIP INTRO` fades to 1 at t = 0.8s (`--sf-dur-slow`).
- **Ending the intro early.** Any of these ends it at once: `SKIP INTRO`; **focus entering the hero content** (e.g. tabbing to a CTA); **any keydown**; **any scroll** of the page (or wheel/touchmove); the pause toggle. The hero jumps to the end of beat 9 in `--sf-dur-base`: film opacity → 0, end still/loop visible, wordmark at rest, eyebrow/line/CTAs visible. It writes `sf:intro-seen`. Nothing blocks scrolling at any time. (ARCHITECTURE's skip behaviour, focus to the primary CTA, applies to `SKIP INTRO`.)
- `t = duration − 0.4s` (12.4s for the bundled 12.8s edit; the film always ends on ≥ 0.4s of black): **beat 8** (`.is-beat-8`). The hero wordmark appears centred with the light sweep (`--sweep` −30%→130% over `--sf-dur-cinematic`, `--sf-ease-in-out`), opacity 0→1 over the first 500ms, scale 1.035→1 over 1600ms `--sf-ease-out`.
- `t = duration + 0.6s` (13.4s): **beat 9** (`data-state="ended"` + `.is-beat-9`). The loop fades in over the end still (opacity, `--sf-dur-cinematic`). The wordmark glides from centre to its rest position (900ms, `--sf-ease-out`). Eyebrow, campaign line and CTAs: opacity 0→1 and y 12→0, 700ms `--sf-ease-out`, stagger 80ms, starting at 13.7s. `SKIP INTRO` crossfades to the `PAUSE` toggle. The header does not change here (it has been visible since t = 0).
- **Not eligible** (`data-state="static"`: seen this session, reduced, save-data, no film): no intro. End still + full UI at rest immediately; under `full`/`subtle` the loop fades in over 600ms once it can play; under `reduced` it does not autoplay (§8.5).
- **Header logo:** fades in (`--sf-dur-base`) when the header turns solid (sentinel). No dock.

**B. Featured collection:** one trigger when the section top crosses 80% of the viewport. Visible cards (≤5) run the *exposure lift* (overlay 1→0 over 900ms `--sf-ease-in-out`, image scale 1.06→1 over 1200ms `--sf-ease-out`), stagger 80ms. Name, price and swatches fade in (opacity, 400ms) 300ms after each image. Rail scrolling is native `scroll-behavior: smooth`.

**C. Signature showcase:** a pinned scroll timeline (§10).

**D. Campaign editorial:** *aperture open*, scrubbed: `start: "top 90%", end: "top 15%", scrub: 0.8`. A **vertical shaft only**: `clip-path: inset(0 30%)` → `inset(0)` on the frame (never inset top or bottom, so no horizontal edge crosses the haze); the inner image scales 1.15→1.00. The two side edges are feathered: 96px gradients from the section background to transparent ride the moving edges (translate) and fade to 0 over the last 30% of the scrub. Mobile: `inset(0 14%)` → `inset(0)`. If GSAP arrives after the section has already crossed `top 90%` (anchor jump, fast fling, slow network), the frame and text stay in their final state; nothing on screen shrinks or re-hides (the same rule applies to the brand-story sweep at `top 75%`). The text block reveals once at `start: "top 40%"` with `clip-path: inset(0 0 100% 0)` → `inset(0)`, 900ms `--sf-ease-out`. No parallax.

**E. Shop by category (desktop index):** hover or focus on a name changes it washed-grey → bone (`--sf-dur-instant`). The stage crossfades to that category's image (opacity 480ms `--sf-ease-in-out`) and the incoming image scales 1.03→1 (900ms `--sf-ease-out`). Mobile tiles: press state only (overlay +0.15, `--sf-dur-instant`).

**F. Brand story:** *light sweep* on the wordmark lockup, scrubbed: `start: "top 75%", end: "center 55%", scrub: 0.8`, `--sweep` −30%→130%. A base copy of the lockup sits under it at opacity 0.14, so the mark never reads as empty. The lead paragraph reveals once (clip mask, 900ms) when the sweep passes 70%.

**G. Newsletter and footer:** no scroll motion. Only hover, focus and form-state transitions.

**Header:** background opacity 0→1 and height 72→56 (`--sf-dur-base`, `--sf-ease-standard`); logo opacity in the same 320ms. Hide `translateY(-100%)` in `--sf-dur-fast` (`--sf-ease-in-out`), show in `--sf-dur-base` (`--sf-ease-standard`).

**Mega menu:** panel `clip-path: inset(0 0 100% 0)` → `inset(0)`, `--sf-dur-slow` `--sf-ease-out`. Columns opacity 0→1 and y 8→0, 40ms stagger (≤8). Tiles fade 600ms. Scrim 0→0.5 in `--sf-dur-base`. Close: opacity 1→0, `--sf-dur-fast`, no stagger.

**Mobile menu:** panel `clip-path` top-down open, 360ms `--sf-ease-out`. Links opacity + y 8→0, 280ms each, starting at 80ms, 25ms stagger (≤8), so **≤ 560ms total**. The menu icon's two lines rotate ±45° and meet (`--sf-dur-base`). Close: `--sf-dur-fast`, everything together.

**Search overlay:** sheet y −16→0 + opacity, `--sf-dur-base` `--sf-ease-standard`. Scrim `--sf-dur-base`. Results fade `--sf-dur-fast` on every update.

**Cart drawer:** panel `translateX(100%)` → 0, `--sf-dur-slow` `--sf-ease-standard`. Scrim 0→0.6, `--sf-dur-base`. Line items opacity + y 8→0, stagger 40ms from 160ms. Close: `--sf-dur-base`. A removed line goes opacity 1→0 (`--sf-dur-fast`) and is then removed. The header count crossfades.

**Quick view:** dialog opacity 0→1 and scale 0.985→1, 360ms `--sf-ease-standard`. Mobile sheet y 100%→0, `--sf-dur-slow`.

**PDP:** no entrance animation. Selector changes swap images with a 200ms crossfade. Zoom viewer opacity `--sf-dur-base`.

**Page transitions:** cross-document View Transitions, `@view-transition { navigation: auto; }`, root crossfade 240ms. Only under `prefers-reduced-motion: no-preference` and motion level `full`.

### 8.4 Text reveals (exactly three places)
1. Hero eyebrow, campaign line and CTAs (block fade + 12px, beat 9).
2. Section D editorial line (clip mask).
3. Section F lead paragraph (clip mask).
Never letter-by-letter or per-word. No SplitText.

### 8.5 Reduced motion (`html[data-sf-motion="reduced"]`, the single switch; plus the CSS media query as a no-JS net)

| Feature | Reduced-motion behaviour |
|---|---|
| Intro film | Not loaded or played. The hero shows the end still (= loop first frame) with the full UI and the wordmark at rest. A `PLAY` control plays the loop on request. |
| Loop video | No autoplay. Still only, play on request. |
| Header logo | Visible whenever the header is solid; no fades. |
| Section B exposure | Off. Content visible as rendered. |
| Section C pin | **No pin.** Static stacked layout (§10.3). |
| Section D aperture | Off. Full frame, static. |
| Section F sweep | Off. Wordmark fully visible. |
| Menus, drawers, dialogs | Instant (0ms). Opacity crossfades ≤ 150ms are allowed (ARCHITECTURE §3.4). |
| Hover crossfades | Instant swap. |
| View transitions | Off. |

### 8.6 Mobile simplifications (< 990px)
- No pinning anywhere. No parallax. No dock.
- The film and the loop use the 9:16 files (ARCHITECTURE `MOBILE_MQ`).
- Exposure lifts are kept (opacity only) but limited to two cards visible at a time.
- `ScrollTrigger.config({ ignoreMobileResize: true })`; `svh` units for full-height blocks.
- Save-Data or 2g: no intro and no loop (end still only).

### 8.7 Performance rules (binding)
- `will-change` is set by JS right before a tween and removed in `onComplete`. Never in static CSS.
- GSAP + ScrollTrigger load lazily through `Steadfast.loadGsap()` when the first GSAP section approaches (ARCHITECTURE §4.5). **Never on the LCP path; never in the hero.** PDP and collection pages don't load GSAP.
- Homepage ScrollTriggers: B 1, C 1 (the only pin), D 2, F 2 = **6** (cap 10).
- All GSAP code runs inside `gsap.matchMedia()` (`{ full: html[data-sf-motion="full"] && (prefers-reduced-motion: no-preference), desktop: "(min-width: 990px)" }`), scoped per section with `gsap.context()`, reverted on `disconnectedCallback` / `shopify:section:unload`.
- `ScrollTrigger.refresh()` after images inside the pinned section `decode()` and after `document.fonts.ready`.
- Videos: `muted playsinline`, started by JS (no `autoplay` attribute; ARCHITECTURE §5.2), `preload="none"` until needed. Pause out of view and when the tab is hidden.
- No scroll listeners except ARCHITECTURE's single rAF-throttled header listener. The hero's "scroll ends the intro" uses that same signal or the sentinel.

---

## 9. Homepage art direction, A–G

Copy voice: plain, short, present tense, no superlatives, no claims. Spectral lines are sentence case. Micro labels are Archivo Label caps. Defaults below are what renders; the "info" column is the setting's editor help text, which never renders on the storefront.

### A. Cinematic hero (full viewport, `100svh`, minimum 560px)

**Assets:** the intro film (`sf-film-desktop.mp4` / `sf-film-mobile.mp4`, supplied-footage edit), the loop (IMG_4376 back shot inside the aperture; names pending, §14), and the end stills `sf-film-end-desktop/-mobile` (= the loop's first frame, graded, no logo baked in). All specified in `FILM-STORYBOARD.md`.

Desktop (≥990):
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SHOP  CAMPAIGN                    (logo slot empty)       SEARCH ACCOUNT CART (0) │ header 72, transparent, visible from t=0
│                                    ┊░░░░░░░░░┊                                │
│                                    ┊░ aper- ░┊                                │ loop: 16:9 file, contain on black,
│ FIXED POINT                        ┊░ ture  ░┊                                │ aperture centred
│ The figure stays. The light moves. ┊░ loop  ░┊                                │
│                                    ┊░░░░░░░░░┊                                │
│                 ▓▓▓  S T E Λ D F Λ S T  (wordmark h1, textured) ▓▓▓           │ wordmark centre at y 66%
│                                    ┊░░░░░░░░░┊                                │
│ [ EXPLORE COLLECTION ]   VIEW THE CAMPAIGN                            ‖ PAUSE │ bottom row at 56px
└──────────────────────────────────────────────────────────────────────────────┘
```
- Left text column starts at the gutter, cols 1–3, at y 44%: the **eyebrow** (`--sf-text-2xs`, washed-grey) "FIXED POINT", then 12px below it the **campaign line** (Spectral 300 italic, `--sf-text-xl`, bone) "The figure stays. The light moves."
- Wordmark: textured, box `min(44vw, 640px)`, centred, crossing the lower third of the aperture.
- Bottom row: EXPLORE COLLECTION (Primary) and VIEW THE CAMPAIGN (Text link-button), left-aligned, 32px gap. `SKIP INTRO` / `PAUSE` at the right (`--sf-text-2xs`, 44px hit area).

Mobile (<990):
```
┌──────────────────────┐
│ ≡                ⌕ ⊡ │  header 56, minimal, logo slot empty
│                      │
│   loop 9:16 cover    │
│                      │
│  STEΛDFΛST artwork   │  box min(84vw, 640px), centre at y 58%
│     FIXED POINT      │  eyebrow only (Archivo Label), centred, 16px under
│ [ EXPLORE COLLECTION ]│ full width, 52px, 24px under
│   VIEW THE CAMPAIGN  │  centred link
│                   ‖  │  pause, bottom-right
└──────────────────────┘
```
- **No Spectral italic line on mobile.** Stacking the italic line directly under the serif wordmark puts two serifs head to head. The campaign line exists only in the desktop left column (`display: none` below 990).
- Bottom scrim (§5.5). CTAs sit 24px above `env(safe-area-inset-bottom)`.
- Below 990 the hero is `min-height: max(100svh, 560px)` and grows with its content; the bottom row of the PAUSE control is reserved under the CTAs, so at 200% zoom or with large text the CTAs never sit under PAUSE and are never clipped.
- Landscape phones (`orientation: landscape` and height ≤ 500px): hero exactly `100svh`, wordmark `min(60vw, 30svh × 2.944)` placed under the header, eyebrow 12px below, then both CTAs in one centred row (24px gap), so lockup, eyebrow and both CTAs fit the first screen.
- EXPLORE COLLECTION → `cta_primary_link`, default `routes.all_products_collection_url`. VIEW THE CAMPAIGN → **`cta_secondary_action: link`** (default; ARCHITECTURE currently defaults to `replay`, §14), link default `#campaign` (Section D). `replay` remains an option.
- The eyebrow is the **only** campaign label on the page. Section D has no eyebrow by default.

| Setting (ARCH id) | Default | Info text (editor only) |
|---|---|---|
| `eyebrow` | `FIXED POINT` | "Proposed campaign name. Approve or replace." |
| `subheading` | `The figure stays. The light moves.` | "Desktop only. One short line. No claims." |
| `logo_width` | 640 (range 240–640) | "Width of the textured wordmark box on desktop. Capped at 640 to stay sharp." |

### B. Featured collection

- **Desktop:** heading row: left Spectral `--sf-display-md` **"The collection"**; right, on the heading baseline, the count `24 PIECES` (`--sf-text-2xs` washed-grey) and `VIEW ALL` (text link-button). Below, a full-bleed **rail** (left edge on the gutter, running off the right edge), card width `calc((100vw - 2 * var(--sf-gutter)) / 3.6)`, 4px gap, native horizontal scroll with `scroll-snap-type: x proximity`. Prev/next 44px arrow buttons bottom-right under the rail, a 1px progress line (steel on graphite, 160px) bottom-left.
- **Mobile:** heading stacked over `VIEW ALL`. Card width 78vw, mandatory snap.
- Products come from the merchant's collection; nothing is invented.
- **Next-drop tile** (`drop_teaser` block, last in the rail): a 4:5 well in `--sf-bg-raised` holding the wordmark SVG at 40% width and 30% opacity, `NEXT DROP` (`--sf-text-2xs`), Spectral `--sf-text-xl` "Details to be announced.", and a `GET NOTIFIED` text link to `#newsletter`. No dates. (ARCHITECTURE's default `image` for this block, `sf-signature-hero`, is not used by the default design; the tile is typographic.)

### C. Signature product showcase. See §10.

- Desktop: a pinned black stage with the zip hoodie stills (front, then back). Caption column at the left (cols 1–4). CTA at the end.
- Mobile: a stacked sequence, no pin.

### D. Campaign editorial (`id="campaign"`)

- **Asset:** `sf-campaign-back` (16:9) / `sf-campaign-back-portrait` (4:5, crop x 0.275–0.725), black-point clamped. Desktop full-bleed `100vw`, height `56.25vw` (max 100svh, centred crop).
- **Desktop composition:** the figure stays centred. Text lives in the black void at the **left**, cols 1–4, **vertically centred** (`text_position: middle-left`, a new option and the default, §14), over the image (the void is #020102, so bone text has ≥ 17:1):
  - eyebrow: blank by default (the hero carries the only label).
  - Spectral 300 italic `--sf-display-xl`: **"Under one light."**
  - `--sf-text-sm` silver, max 32ch: **"The tracksuit in stone, seen from behind."**
- **Mobile:** image first; the text block below it with gutters, same order.
- **Nothing else goes in this section.** No lookbook blocks (ARCHITECTURE's `look` blocks are removed from the preset, §14), no CTA button. An optional `link_label`/`link` text link (e.g. `VIEW THE LOOK`) renders only if set.

| Setting | Default | Info text |
|---|---|---|
| `heading` | `Under one light.` | "One short editorial line." |
| `text` | `<p>The tracksuit in stone, seen from behind.</p>` | "Describe only what's in the photo. No dates, origins, materials or claims until STEADFAST supplies them." |

### E. Shop by category

- Five merchant blocks (collection + image + optional title override): Hoodies, Tracksuits, Tops, Bottoms, New Arrivals.
- **Desktop "index" layout** (`layout: index`, new default, §14): cols 1–5 a vertical list of names in Spectral `--sf-display-sm` (washed-grey; active/hover/focus bone), each a real link to its collection, with the product count right-aligned in `--sf-text-2xs` washed-grey. Rows 72px with hairlines between. **Stage** in cols 7–12, right-aligned, `position: sticky; top: calc(var(--sf-header-h) + 48px)`:
  ```css
  .sf-category-grid__stage { height: calc(100svh - var(--sf-header-h) - 96px); aspect-ratio: 4 / 5; width: auto; max-width: 100%; }
  ```
  Sized by **height**, so it always fits the viewport and sticky can hold it (at 1440×900 with the condensed 56px header: 748px tall × 598px wide). This also keeps the lower-resolution stills (720px, 560px) near 1× at DPR 1. It shows the active category's image (the first by default; it follows hover and focus).
- The section heading "Shop by category" is a **visually hidden `h2`** (the `heading` setting). The list is the visible heading.
- **Mobile:** a stack of full-width 4:5 tiles (4px gap), name bottom-left in Spectral `--sf-text-xl` over a scrim, count in `--sf-text-2xs`.
- **Default imagery:** five different garments, §5.6.

### F. Brand story

- A black field. The **wordmark** is the subject: textured raster at `min(84vw, 880px)` below 990px; the **layered lockup** (streak-only raster + crisp SVG letters) at `min(60vw, 880px)` at ≥990px (§3.4). Below it, after `--sf-space-8`, a centred lead paragraph (Spectral `--sf-text-lg`, silver, max 46ch).
- Default text: **blank.** The wordmark alone carries the section until STEADFAST supplies two or three sentences (BRIEF §4F: no invented brand copy; a client input in DEPLOYMENT). When text is set it is centred under the mark, `max-width: 46ch` on the Spectral paragraph itself (≈ 610px at 22px; not on the Archivo wrapper), `text-wrap: balance`. Don't open it with the brand name: the lockup above already says STEADFAST.
- Optional `link_label`/`link` text link (hidden if not set).
- Motion: the light sweep (§8.3 F).

| Setting | Default | Info text |
|---|---|---|
| `text` | blank | "Blank by default: the wordmark carries the section. Add two or three sentences supplied by STEADFAST; no dates, origins or claims until they are confirmed." |
| `logo_display` | `textured` | |

### G. Newsletter and footer

- The newsletter band (§7.10) is the footer group's first section (`id="newsletter"`), tone ink, on the black field.
- Footer as §7.11: SHOP / HELP / LEGAL / FOLLOW plus the bottom bar.

### Default copy summary (all editable; owner approval needed)

| Where | Rendered default | Owner action |
|---|---|---|
| Hero eyebrow / campaign line | FIXED POINT / The figure stays. The light moves. | Approve the campaign name or replace |
| B heading | The collection | Optional |
| B next-drop tile | Details to be announced. | Replace or hide |
| D line / body | Under one light. / The tracksuit in stone, seen from behind. | Supply |
| F lead | (blank; the wordmark alone) | Supply two or three sentences of brand story |
| Newsletter heading / success | New pieces, by email. / You're subscribed. | Optional |
| PDP size guide / shipping & returns | Sizing information to be confirmed. / Shipping and returns details to be confirmed. | Supply the policies |
| Related heading | You may also like | Optional |
| Showcase captions | Zip and neck label / Distressed chest logo / Shoulder embellishment / Sleeve label | Confirm; add construction terms only when supplied |

---

## 10. Signature showcase (Section C): scroll storyboard

Image-based. Stills: `sf-signature-hero` (front, 16:9) and `sf-signature-hero-back` (back aligned to the front: ×1.034 about the centre axis, hem and shoulders aligned; the hood height differs, which the crossfade "in the dark" covers). Both black-point clamped. **No 3D, no "360°", no invented views.** The section never says "rotate" or "explore in 3D".

### 10.1 Stage (desktop ≥990, motion `full`)

- Pinned: `ScrollTrigger { trigger: section, start: "top top", end: "+=300%" (scroll_length standard; short = 200%), pin: true, pinSpacing: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }`.
- Stage `100vw × 100svh`, black. Image layer 16:9 at `height: 100svh`, `width: max(100vw, 177.78svh)`, centred. `perspective: 1600px` on the wrapper; rotations on a middle wrapper (`transform-origin: 50% 50%`); zoom and translate on the inner image layer (`transform-origin: 0 0`). The image gets an exposure overlay `::after` and a radial vignette layer (`radial-gradient(circle at 62% 50%, transparent 0 22%, #000 70%)`, opacity animated).
- Caption column: cols 1–4, vertically centred, absolute. Each caption: a 32px steel hairline, the `--sf-text-2xs` label (block `title`), and an optional `--sf-text-sm` silver line (block `text`, default empty). One caption visible at a time (opacity crossfade).
- Detail target point: the detail centre lands at stage **(x 0.62, y 0.50)**.
- Zoom maths: with the image layer's rendered size (W, H) and offset (imgLeft, imgTop) at scale 1, for detail centre (cx, cy) and zoom z: `tx = 0.62 * stageW - imgLeft - cx * W * z`, `ty = 0.50 * stageH - imgTop - cy * H * z`; tween `{ x: tx, y: ty, scale: z }` from functions so refresh recalculates.

### 10.2 Keyframes (progress 0→1 over the pin; all tweens `ease: "none"`)

Rects are (x0, y0, x1, y1) fractions of `sf-signature-hero`.

| Progress | Beat | Image layer | Exposure overlay | Caption / UI |
|---|---|---|---|---|
| before the pin (`top 85%` → `top top`, scrub 0.8) | **Arrive** | scale 0.86→0.88 | 1→0.45 (the hoodie is dimly present as the section arrives; never an empty black stage) | Title at left |
| 0.00–0.10 | **Enter** | scale 0.88→0.94, y 4%→0 | 0.45→0.15 | Title at left: `--sf-text-2xs` eyebrow "SIGNATURE PIECE" over Spectral `--sf-display-md` heading (default "The zip hoodie", or the product title) |
| 0.10–0.22 | **Perspective** | rotateY −6°→3°, rotateX 2°→0°, scale 0.94→1.0 | 0.15→0 | Title holds |
| 0.22–0.36 | **Detail 1** (block `zip`): rect (0.445, 0.17, 0.555, 0.47), centre (0.50, 0.32) | rotate→0, **z = 2.2** | vignette layer →0.6 | Title out. Caption "ZIP AND NECK LABEL" |
| 0.36–0.50 | **Detail 2** (`chest-logo`): rect (0.375, 0.36, 0.625, 0.66), centre (0.50, 0.51) | **z = 1.8** | vignette 0.6 | "DISTRESSED CHEST LOGO" |
| 0.50–0.63 | **Detail 3** (`shoulder`): rect (0.365, 0.17, 0.475, 0.43), centre (0.42, 0.30) | **z = 2.4** | vignette 0.6 | "SHOULDER EMBELLISHMENT" |
| 0.63–0.74 | **Detail 4** (`cuff-label`): rect (0.625, 0.76, 0.705, 0.90), centre (0.665, 0.83) | **z = 2.4** (cap; the source is dark and soft here) | vignette 0.5 | "SLEEVE LABEL" |
| 0.74–0.80 | **Return** | z →1.0, centred | vignette →0 | Caption out |
| 0.80–0.90 | **Front → back** ("a cut in the dark", sequential, never a double exposure) | 0.80–0.85: front rotateY 0→−6°, opacity 1→0. 0.85–0.90: back rotateY 6°→0, opacity 0→1. Both faces are 0 at 0.85 | overlay 0→0.92 over 0.80–0.85, 0.92→0 over 0.85–0.90 | No caption |
| 0.90–1.00 | **CTA** | back holds, scale 1.0→0.96 | 0 | Right column (cols 9–12, centred): product title (Spectral `--sf-text-xl`), live price, Primary CTA (`cta_label`, default "Shop the zip hoodie"), `--sf-text-2xs` "FRONT / BACK" segmented control |

- **Detail blocks.** The preset has **4** blocks: `zip` "Zip and neck label", `chest-logo` "Distressed chest logo", `shoulder` "Shoulder embellishment", `cuff-label` "Sleeve label". The `neck-label` crop stays available as an optional fifth block (not in the preset). The produced `hem` crop is not used. **No construction terms** in default titles ("appliqué", "embroidered", "crystal" only if the merchant edits a caption with confirmed facts; ARCHITECTURE's "Chest appliqué" becomes "Distressed chest logo", §14).
- At each detail, at most 1.5× source upscaling at DPR 1 (use `sf-signature-hero-2730`, the native width, lazy, starting when the section is within one viewport).
- Section `aria-label` "Signature piece: {{ product.title }}". Captions are real text in DOM order; the CTA is reachable by keyboard without scrolling the pin. Captions and the buy block are faded with `opacity` only (never `visibility`/`autoAlpha`), so they stay in the accessibility tree and FRONT / BACK and the CTA stay in the tab order; focusing one shows the block at once and moves the pin to its end. The block takes pointer events only from progress 0.90. The detail list is a tab stop only while it is a horizontal scroller (stacked rail).

### 10.3 Mobile, `subtle` and reduced motion (static, no pin)

```
[ SIGNATURE PIECE / heading ]
[ front 4:5 ]                    ← exposure lift once (mobile) / static (reduced)
[ FRONT | BACK toggle ]          ← directly under the image it crossfades (200ms), 16px gap
[ title  price  CTA ]
[ detail 1 ][ detail 2 ] →       ← horizontal snap rail of the 1:1 `sf-signature-detail-*` crops, caption under each, 64px above
```
The toggle sits with the image it swaps (a control 400px below its image looks broken). Desktop stacked (≥990, `subtle`/reduced/pin off): image cols 1–6, toggle + title + price + CTA cols 8–12 beside it, details as one row below. DOM order matches the visual order.
The 1:1 detail crops are MEDIA's `sf-signature-detail-{zip,chest-logo,shoulder,cuff-label}` (in a live store, merchant-uploaded block images).

---

## 11. Accessibility and quality floor (checked in review)

- Keyboard reaches everything with a visible focus ring (§6.7). Menus, drawers and dialogs trap and restore focus and close on Esc.
- The hero intro never traps focus or scroll: navigation is usable from t = 0, and focusing hero content ends the intro.
- Autoplaying video over 5s has a visible PAUSE control whose label names the action (PAUSE ↔ PLAY; no `aria-pressed`, which would contradict the swapped label). The merchant's `show_skip` setting hides only SKIP INTRO, never PAUSE / PLAY.
- Every image has meaningful `alt` (products: title plus view, e.g. "Washed zip hoodie, back"; lifestyle views say so). Decorative film/loop video is `aria-hidden="true"`.
- Content is visible with JS disabled. Hidden-initial states are applied only under `html.js`.
- Tap targets ≥ 44×44. No hover-only information.
- Review at 375, 768, 1024, 1280, 1440 and 1920, plus 390×844 Safari. No horizontal scroll.

---

## 12. Review checklist for the design reviewer

1. Does every screen read as the same brand: one black field, bone text, Spectral in sentence case, Archivo Label micro-caps, product names in sentence case, zero radius, no shadows, no coloured bands?
2. Is the logo the artwork everywhere, at the §3.4 aspect ratios, never stretched, never typed, never above its resolution caps?
3. Does any motion move content around instead of *lighting* it? If so, cut it.
4. Count the text reveals on the homepage. There should be 3.
5. Any third-party mark (incl. "S7" monogram, sneaker logos) legible in hero, editorial or category crops? Reject.
6. Any number, claim, construction term or review not coming from Shopify data or approved placeholder copy? Reject. Does any rendered default read like an instruction? Reject.
7. Run reduced motion: is it a complete, beautiful static site?
8. Can a first-time visitor reach the nav, search and cart during the intro?

---

## 13. Token map: every ARCHITECTURE §3.4 custom property → value

ARCHITECTURE owns these names; these are the values. CORE emits them from `sf-css-tokens`. Values marked "settings" come from `config/settings_schema.json`, whose defaults are listed.

| Group | Custom property | Value |
|---|---|---|
| Palette | `--sf-ink` | `#000000` (setting `color_ink` default) |
| | `--sf-charcoal` | `#141619` (`color_charcoal`) |
| | `--sf-graphite` | `#24272B` (`color_graphite`) |
| | `--sf-washed-grey` | `#8B9096` (`color_washed_grey`) |
| | `--sf-steel` | `#7C91A5` (`color_steel`) |
| | `--sf-silver` | `#C3C8CD` (`color_silver`) |
| | `--sf-bone` | `#F1E9DA` (`color_bone`) |
| Semantic (tone ink; charcoal-tone overrides in brackets) | `--sf-bg` | `var(--sf-ink)` [charcoal: `var(--sf-charcoal)`] |
| | `--sf-bg-raised` | `var(--sf-charcoal)` [charcoal: `var(--sf-graphite)`] |
| | `--sf-bg-sunken` | `#000000` |
| | `--sf-fg` | `var(--sf-bone)` |
| | `--sf-fg-muted` | `var(--sf-silver)` |
| | `--sf-fg-subtle` | `var(--sf-washed-grey)` (also form-control borders) |
| | `--sf-line` | `var(--sf-graphite)` |
| | `--sf-line-strong` | `#3A3E43` |
| | `--sf-accent` | `var(--sf-steel)` |
| | `--sf-accent-fg` | `var(--sf-bone)` |
| | `--sf-focus` | `#A9BBCB` |
| | `--sf-scrim` | `rgb(0 0 0 / 0.6)` |
| | `--sf-error` | `#E06C75` |
| | `--sf-success` | `#8DB39B` |
| | `--sf-selection` | `#2C3A47` |
| Font families | `--sf-font-display` | `"Spectral", "Spectral Fallback", Georgia, serif` |
| | `--sf-font-text` | `"Archivo", "Archivo Fallback", Arial, sans-serif` |
| | `--sf-font-label` | `"Archivo Label", "Archivo Label Fallback", Arial, sans-serif` |
| Type scale | `--sf-type-scale` | `calc(type_scale / 100)`, default `1` |
| | `--sf-text-2xs` | `0.6875rem` (11px) |
| | `--sf-text-xs` | `0.75rem` (12px) |
| | `--sf-text-sm` | `0.875rem` (14px) |
| | `--sf-text-base` | `clamp(0.9375rem, 0.9rem + 0.15vw, 1rem)` |
| | `--sf-text-lg` | `clamp(1.125rem, 1rem + 0.5vw, 1.375rem)` |
| | `--sf-text-xl` | `clamp(1.375rem, 1.2rem + 0.8vw, 1.875rem)` |
| | `--sf-display-sm` | `clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)` |
| | `--sf-display-md` | `clamp(2rem, 1.5rem + 2.2vw, 3.5rem)` |
| | `--sf-display-lg` | `clamp(2.25rem, 1.6rem + 2.8vw, 4.5rem)` |
| | `--sf-display-xl` | `clamp(2.75rem, 1.8rem + 4.2vw, 6rem)` |
| Type details | `--sf-leading-tight` | `1.04` |
| | `--sf-leading-snug` | `1.2` |
| | `--sf-leading-body` | `1.55` |
| | `--sf-tracking-tight` | `-0.02em` |
| | `--sf-tracking-normal` | `0` |
| | `--sf-tracking-wide` | `0.04em` (prices, counters) |
| | `--sf-tracking-label` | `0.16em` (all uppercase labels) |
| | `--sf-weight-regular` | `400` (Spectral styles set `300` explicitly; it's the only display weight) |
| | `--sf-weight-medium` | `500` |
| | `--sf-display-transform` | `none` (always) |
| Spacing | `--sf-space-1` … `--sf-space-12` | 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256 px |
| | `--sf-gutter` | 16px; ≥750 32px; ≥990 `clamp(40px, 4vw, 64px)`; ≥1200 64px |
| | `--sf-section-pad-y` | standard `clamp(96px, 10vw + 40px, 176px)`; compact `clamp(64px, 6vw + 24px, 112px)`; generous `clamp(128px, 12vw + 64px, 240px)`; none `0` |
| | `--sf-grid-gap` | 12px; ≥750 16px; ≥990 24px; ≥1600 32px |
| | `--sf-page-max` | settings `page_width`: `1440px` \| `1600px` (default) \| `none` |
| | `--sf-measure` | `62ch` |
| Runtime-measured | `--sf-header-h` | CSS default 56px; ≥990 72px (56px condensed); then JS-measured |
| | `--sf-announcement-h` | CSS default `0px`; JS-measured |
| | `--sf-vh` | `1svh` fallback, JS-set |
| Media | `--sf-ratio-card` | `4 / 5` (setting `card_image_ratio` default `tall`) |
| | `--sf-ratio-hero-desktop` | `16 / 9` |
| | `--sf-ratio-hero-mobile` | `9 / 16` |
| Motion | `--sf-ease-out` | `cubic-bezier(0.19, 1, 0.22, 1)` |
| | `--sf-ease-in-out` | `cubic-bezier(0.445, 0.05, 0.55, 0.95)` |
| | `--sf-ease-standard` | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| | `--sf-dur-instant` | `120ms` |
| | `--sf-dur-fast` | `240ms` |
| | `--sf-dur-base` | `320ms` |
| | `--sf-dur-slow` | `480ms` |
| | `--sf-dur-cinematic` | `1200ms` |
| | `--sf-stagger` | `40ms` |
| | `--sf-reveal-distance` | `12px` |
| | `--sf-motion` | `1` full · `0.5` subtle · `0` reduced |
| Shape and elevation | `--sf-radius` | `0` |
| | `--sf-radius-input` | `0` |
| | `--sf-hairline` | `1px` |
| | `--sf-shadow-drawer` | `none` |
| Z-index (ARCHITECTURE's values, adopted) | `--sf-z-base` / `-sticky` / `-header` / `-drawer` / `-modal` / `-toast` / `-skip` | `1` / `10` / `50` / `100` / `110` / `120` / `200` |

Names used in v1 of this file are retired: `--color-*`, `--fs-*`, `--sp-*`, `--ease-*`, `--dur-*`, `--z-*`, `--page-margin`, `--gutter` (now `--sf-grid-gap`; note that ARCHITECTURE's `--sf-gutter` is the page side margin), `--section-y`, `--sf-black`, `--sf-ash`, `--sf-smoke`, `--sf-bone-hi`, `--sf-steel-hi`, `--sf-steel-deep`, `--sf-control`.

---

## 14. Cross-doc rulings (DESIGN v2 ↔ ARCHITECTURE v1)

Each line is the decision and the side that changes. "ARCH edit" items are requests to the architect/orchestrator; until ARCHITECTURE is updated, builders follow this table for visual values and ARCHITECTURE for names and APIs.

| # | Topic | Ruling | Change needed |
|---|---|---|---|
| 1 | Precedence | DESIGN wins on visual and motion values; ARCH on ownership, names, IDs, APIs, Liquid surface, harness, tests | ARCH edit: replace "this file > DESIGN.md for visual values only" |
| 2 | Token names | ARCH names everywhere; values in §13 | Done here |
| 3 | Palette defaults | §13 values (#000, #141619, #24272B, #8B9096, #7C91A5, #C3C8CD, #F1E9DA). Raised surfaces = charcoal; graphite = hairlines/hover | ARCH edit §2.1 provisional hex and the "graphite = raised surfaces" note |
| 4 | Tones | `ink` default everywhere; `charcoal` opt-in; **no `bone`** | ARCH edit: tone options `[ink, charcoal]`; `sf-newsletter` tone default `ink`; delete `.sf-tone-bone` |
| 5 | `type_display_case` | Spectral never uppercased; `--sf-display-transform: none` | ARCH edit: remove the setting (or default `as_written`, Archivo-only effect) |
| 6 | Card ratio | 4:5 | ARCH edit: `card_image_ratio` default `tall` |
| 7 | Hero model | Intro 12.8s (`sf-film-*`), then a 5.6s loop, end still = loop frame 0, beats 8–9 in DOM via CSS, no GSAP; header visible from t=0; content focusable from t=0, visually revealed at beat 9; focus/key/scroll/skip ends the intro | ARCH edit §5: add loop slot (`loop_video_desktop`, `loop_video_mobile` settings; bundled `sf-film-loop-desktop.mp4`, `sf-film-loop-mobile.mp4`), `.is-beat-8/9` classes, early-end triggers; `content_delay` → reveal at film end by default; duration 16–24s → 12.8s; fps 24 → 30 |
| 8 | Codecs / media query | H.264 only (ARCH decision 5); ARCH `MOBILE_MQ` | FILM edited |
| 9 | Secondary CTA | `link` → `#campaign` default; `replay` optional | ARCH edit: `cta_secondary_action` default `link`; test 08(h) sets `replay` explicitly |
| 10 | Hero h1 | ARCH's: the textured wordmark inside the `h1` | DESIGN edited |
| 11 | Logo dock | Dropped. Sentinel → solid header → logo fades in | DESIGN edited |
| 12 | Header actions | Desktop text labels; mobile icons; ARCH markup/order kept | ARCH edit: note the label content |
| 13 | Mobile menu | Full-screen top-down clip, ≤ 560ms | ARCH edit: `data-sf-dialog-type="fullscreen"`, timing ≤ 560ms |
| 14 | Allowed animation | No `filter` animation, no parallax, no `backdrop-filter`; rotation only the showcase tilt ≤ 6° | ARCH edit §3.3 (header backdrop), §4.5 (brightness, ±3°, parallax), §4.8 (showcase "brightness 0.4→1" → overlay; D "≤8% parallax" → none; F "left→right 1.2s" → scrubbed 105° sweep with 0.14 base) |
| 15 | Shadows / z-index | `--sf-shadow-drawer: none`; ARCH z values adopted | none |
| 16 | Section D | No lookbook blocks; text middle-left; defaults §9 D | ARCH edit: remove `look` blocks from preset (or the block type); add `text_position` option `middle-left` as default |
| 17 | Section E | `index` layout with sticky stage, hidden h2 | ARCH edit: `layout` options `[index, row]`, default `index`; heading rendered visually hidden in `index` |
| 18 | Quick add | **ARCH's contract** (single-variant direct add, else quick view intent add) | DESIGN edited (no inline size cells) |
| 19 | Vocabulary | "Cart" (brief): Add to cart, added to cart. Related: "You may also like". Newsletter: §7.10. Fallbacks: ARCH strings | ARCH edit: locale values; `sf-newsletter` defaults heading "New pieces, by email.", text "", `newsletter_success` "You're subscribed." |
| 20 | Icons | Stroke 1.5 (grid units); add `filter`, `chevron-left` | ARCH edit §1.3 icon list and stroke |
| 21 | Fonts | §3.1 five files, preload text-400 + label-500 | ARCH edit §6.1 preload names, §10.1 file list |
| 22 | Footer | SVG logo; SHOP/HELP/LEGAL/FOLLOW; no payment icons; newsletter only as the band | ARCH edit: `show_logo` uses flat; footer-group preset blocks `[shop, help, social]` + policies column; drop the "contact" text block |
| 23 | PDP metafields | None. Size & fit / Care = `collapsible` blocks with page/richtext; swatches from `product_option_value.swatch` | none (§8.6 unchanged) |
| 24 | Dynamic checkout | `show_dynamic_checkout` default **false** | ARCH edit §2.4 `buy_buttons` |
| 25 | Signature details | 4 preset blocks with §10.2 titles; neck-label optional; hem unused | ARCH edit: preset titles, no "appliqué"; MEDIA may drop the hem crop |
| 26 | Category defaults | §5.6 | ARCH edit §10.1 sources for tracksuits (campaign ✓), tops (reflective front top crop, 400/560), new-arrivals (embossed close-up, 540/720) |
| 27 | Logo renditions | textured 600/800/1000/1200/1800 + streak-only 1200/1800; aspect from §3.4 | ARCH edit §10.1; MEDIA regenerates |
| 28 | Grade | grade.sh is the single look | FILM edited; MEDIA re-renders editorial stills |
| 29 | Hero logo width setting | `logo_width` range 240–640, default 640; mobile `min(84vw, logo_width)` | ARCH edit |
| 30 | End stills | Loop frame 0, no logo baked; desktop widths 960/1600/1920 (2400 would be an upscale) | ARCH edit §10.1 |

---

## 15. Reviewer notes (design review v1 → v2)

All reviewer revisions to this file and to `FILM-STORYBOARD.md` were applied. Where a revision was applied differently from how it was worded, the reason is below.

1. **F layered lockup threshold.** The reviewer asked for the SVG-over-streaks layering "above ~900 CSS px", but the requested F cap (880px) means a box never reaches 900. At DPR 2, an 880px box is 1760 device px, 1.45× the 1210px native raster, right at the limit. So the layered lockup is the default on F at ≥990px viewport, and the 900 CSS px rule stays as a hard ceiling for the plain raster anywhere else.
2. **D body copy.** Used "The tracksuit in stone, seen from behind." instead of the suggested "The embossed tracksuit in stone, under a single light." "Embossed" is a construction term that the client hasn't confirmed (the same rule the reviewer applied to Part B), and "light" would repeat the D line "Under one light."
3. **Single campaign label.** Kept the label in the hero (it's the only text under the wordmark on mobile) and removed it from D. The label reads "FIXED POINT" (the proposed campaign name) instead of "CAMPAIGN": on mobile it stands alone under the wordmark, and "CAMPAIGN" by itself says nothing. The desktop italic line became "The figure stays. The light moves." so that it doesn't repeat the label.
4. **Tops still.** Chose the reflective tracksuit front (top crop), not the IMG_4913 crewneck. The crewneck isn't one of the five garments evidenced for fixtures (CONTEXT), so a "Tops" tile showing it would imply a product that may not exist. The usable frames also carry the unidentified "S7" monogram.
5. **Storyboard rhythm.** The revision says "make S1→S2 and S5→S6 hard cuts" and "keep the dips only into S2 (still) and S7". These conflict, since S1→S2 *is* the cut into S2. I read "S2" as "S5", the other still. Result: dips only into S5 (footage → still) and S7. The other four transitions are hard cuts on matched darkness, and total runtime stays 12.8s. If the reviewer meant a dip into S2, swap S1→S2 to a dip and make S4→S5 a hard cut; the runtime doesn't change.
6. **S6 / loop window.** Verified on graded renders at 3.4–5.0s with the SHOTLOG crop (0.04, 0, 0.80, 0.76): **no tail-light** anywhere in the plate. But a bright light pole enters the plate's left edge (plate x < 0.04, y 0.21–0.28) from about **4.85s**. So the loop uses 3.40–**4.80** (still 5.6s ping-pong), with a safety burn on the left 6% and top 6%. S6 uses 3.70–4.50, which contains the head turn.
7. **S3 "full word readable".** On graded renders the full "steadfast" never fits inside one 9:16 plate at 3.15–3.65. The camera passes across it ("steadf…" → "…adfast"). The shot keeps the reviewer's trimmed range and is framed as a pass across the word, with a wider plate (0.00, 0.18, 0.70, 0.88) that stays left of the supercar (x > 0.70).
8. **S4 framing.** Beyond the reviewer's 1.40–2.10 and the drift toward the hood and shoulder: at the old window top (y0 0.19) the "S7" goggle pattern is fully legible, and the fuel-canopy sign enters at the top-left (verified on renders). The window now starts at y0 0.23, and a plate-top burn (black above plate y 0.20, feathered to 0.32) keeps the eyes in shadow. The top-left corner burn is kept as a safety.
9. **S5 crop.** Chose "burn the right 15%" over shifting to x ≤ 0.61, because x ≤ 0.61 clips the figure's right arm and shoe. The tilt now starts at the drawcords and pant break, not the shoes: the sneakers carry a side mark that may be third party.
10. **Cross-doc items the reviewer listed without a verdict** were settled in §14. Three of them went ARCHITECTURE's way, since they are API or architecture choices: quick add (no inline size cells), the hero `h1` (wordmark inside the `h1`), and no GSAP in the hero (the logo dock was dropped).
