# STEADFAST: Hero Film Storyboard

Status: **v2** (design-review revisions applied; reasons for any deviation are in `DESIGN.md` §15). Campaign concept: **FIXED POINT** (`DESIGN.md` §1). The figure doesn't move. Only the light and the camera move.

This document has two parts:

- **Part A: Hero film edit from supplied assets.** This is what ships in the theme now. It is **an edit of the client's own phone footage and photography**: graded, slowed, with slow camera moves on stills. It is **not a produced campaign film**, and no copy, alt text, file metadata or doc may describe it as one. No video generation was used.
- **Part B: Production storyboard.** A shoot-ready plan for a real commissioned film that can replace Part A through theme settings without code changes.

The brief's 9 camera beats are the spine of both parts.

**Sources of truth.** Footage analysis, crops, stabilisation and the grade come from `media/analysis/SHOTLOG.md` and `tools/media/grade.sh`. File names, setting IDs and the player behaviour come from `ARCHITECTURE.md` (§5, §10). Where this file and SHOTLOG disagree on a fact about the footage, SHOTLOG wins; this v2 has been reconciled with it.

**Crop notation.** Every crop in this file is labelled. **(x0, y0, x1, y1)** = left, top, right, bottom as fractions of the upright source frame. **[x, y, w, h]** = SHOTLOG / `grade.sh` notation (left, top, width, height as fractions). For the 9:16 footage, a 9:16 plate has w = h.

---

# PART A: Hero film edit from supplied assets

## A1. Source audit (verified on extracted, tone-mapped and graded frames; times in seconds)

| File | Native | Usable for this edit | Rejected / why |
|---|---|---|---|
| `IMG_4913-day-embossed-closeup.MOV` | 720×1280, 30fps, HEVC Main10 **HLG** | **0.50–1.60** extreme close-up of the washed-charcoal hood: paisley/scroll ornament plus the diagonal blackletter "steadf…" (steady, jitter 1.3–3.4px). **3.15–3.65** the camera passes across the shoulders and the full word "steadfast" moves through frame (best read 3.25–3.55); stabilise | Supercar at x > 0.60–0.70 throughout 0–3.75. **3.75–4.40 whip pan** (jitter peak 47px) and the `mci` smear zone: never used. 4.4–7.0 daylight wide, "S7" monogram on the goggles |
| `IMG_4374-night-profile-car.MOV` | 720×1280, 30fps, HEVC HLG | **1.40–2.10** side profile, locked off (0.4px jitter); focus has settled (it is still settling before 1.3) | Fuel-canopy signage top-left (x < 0.30, y < 0.22, growing to x < 0.45 by 3s). Operator reflection below y 0.78. "S7" monogram on the patterned goggles is legible in tight framings. SUV fills the right half |
| `IMG_4376-night-back-grey-embossed-hoodie.MOV` | 720×1280, 30fps, HEVC HLG | **3.40–4.80** the most stable span (jitter < 2px at 3.7–4.6), the head turns slightly, the back panel and shoulder lettering hold. Stabilise | Red car **tail-lights on the RIGHT** (x > 0.78 from ~2.7s; x > 0.80 in 3.3–5.1). A light pole enters the left edge of the plate from ~4.85s. Teal bag x > 0.85 at 4.5–5.0. 0–1.1 lit forecourt and fuel-brand sign |
| `IMG_4409-night-red-pump-hoodie.MOV` | 540×960, 30fps, H.264 SDR | none | Fuel-brand signage in every frame, red cast, low resolution. **Not used.** |
| `zip-hoodie-blue-grey-front.png` | 2752×1536 | Zip, neck label, chest logo, shoulder embellishment | n/a |
| `black-tracksuit-night.jpg` | 1450×2576 | Black zip hoodie and wide sweatpants with cream drawcords | Car door at x > 0.61 (y 0.32–0.62); parking lot; sneaker side marks at y 0.80–0.86; patterned goggles at y 0.27–0.33 |
| `campaign-back-embossed-set.png` | 3840×2160 | Figure under the overhead spot in a void, on a reflective cracked black floor, at x 0.42–0.58 | The balaclava swoosh is retouched in MEDIA's derivative (`_qa/campaign-balaclava-retouch.png`; client to approve, see DEPLOYMENT). Never zoom past the S7 start framing |
| `steadfast-wordmark.png` | 1561×1007 | Logo reveal (beat 8). **Letters x 242–1358, y 448–603 (1115×154, 7.24:1).** Textured crop x 188–1398, y 315–726 (1210×411, 2.944:1) | n/a |

## A2. Composition strategy

**Mobile (9:16, master 720×1280, 30fps).** Every shot is a native 9:16 window ("plate"). Footage stays near native resolution (plates 367–518px wide, upscaled 1.4–2.0×; the grain hides it). Display: `object-fit: cover`.

**Desktop (16:9, master 1920×1080, 30fps): "the Aperture."** Each 9:16 plate sits **centred in a black 1920×1080 field as a vertical shaft of light**: plate scaled to **608×1080** at x = 656, left and right edges feathered into black over **72px**. It reads as one spotlight in a dark studio, not as pillarboxing.
- **Beat 7 opens the aperture.** The campaign still is native 16:9 4K. The shot starts inside the same 608px shaft and the black side masks slide outward to full frame while the framing pulls back.
- Display: `object-fit: contain` on a black container. Every edge of the frame is black, so bars are invisible at any aspect ratio.
- **File selection** uses ARCHITECTURE's single constant `MOBILE_MQ = (max-width: 749px), (orientation: portrait) and (max-width: 1100px)`: mobile file when it matches, desktop file otherwise.
- **The field must stay exactly #000.** Grain is applied to each plate before it is composited (A4), so the black field and the feathered edges carry no noise and merge with the page.

## A3. Edit decision list: intro (theme version, 12.80s, 30fps, ends on black, no logo baked in)

Camera moves on stills interpolate start→end with `sine.inOut` (`0.5 − 0.5·cos(πp)`). Two transition types only:
- **Hard cut on matched darkness:** a straight cut. The last 0.20s of the outgoing shot and the first 0.20s of the incoming shot each ramp exposure by −0.5 stop toward the cut, so both sides meet at a similar low level. It never reaches black.
- **Dip:** a fade through pure black (fade-out tail plus fade-in head, inside each shot's duration).

There are **two dips** (into S5 and into S7) and four hard cuts. No dissolves between images, no wipes, no zoom transitions.

| Shot | Beat | Record in–out | Dur | Source | Source in–out | Speed | Plate crop (x0, y0, x1, y1): start → end | In / Out |
|---|---|---|---|---|---|---|---|---|
| **S1** | 1. Extreme close-up of fabric (hood ornament and lettering) | 0.00–2.20 | 2.20 | IMG_4913 | 0.50–1.60 | 0.5× | (0.000, 0.240, 0.560, 0.800) → (0.021, 0.261, 0.539, 0.779) (push 1.00→1.08 about (0.28, 0.52)) | **Exposure fade from black, 1.20s** / hard cut |
| **S2** | 2. Slow reveal of zipper and texture | 2.20–4.00 | 1.80 | zip-hoodie-blue-grey-front.png | still | n/a | (0.4137, 0.10, 0.5863, 0.65) → (0.4137, 0.36, 0.5863, 0.91) (tilt **down** the zip: neck label and pull → logo → pocket) | hard cut / hard cut |
| **S3** | 3. Close-up of branding (the camera passes across "steadfast") | 4.00–5.00 | 1.00 | IMG_4913 | **3.15–3.65** (vidstab) | 0.5× | (0.000, 0.180, 0.700, 0.880), static; the clip's own move is the move | hard cut / hard cut |
| **S4** | 4. Side profile | 5.00–6.40 | 1.40 | IMG_4374 | **1.40–2.10** | 0.5× | (0.220, 0.230, 0.760, 0.770) → (0.250, 0.250, 0.760, 0.760) (push 1.00→1.06 **toward the hood and shoulder**, never toward the head) | hard cut / **dip 0.30** |
| **S5** | 5. Slow reveal of the full tracksuit (wide pants, cream drawcords, black zip hoodie) | 6.40–8.00 | 1.60 | black-tracksuit-night.jpg | still | n/a | (0.250, 0.400, 0.650, 0.800) → (0.250, 0.320, 0.650, 0.720) (tilt **up** from the drawcords and pant break to the hood; the head stays out of frame) | **dip-in 0.30** / hard cut |
| **S6** | 6. The figure turns slightly; back design revealed | 8.00–9.60 | 1.60 | IMG_4376 | **3.70–4.50** (vidstab) | 0.5× | (0.040, 0.000, 0.800, 0.760), static (= SHOTLOG [0.04, 0, 0.76, 0.76]) | hard cut / **dip 0.30** |
| **S7** | 7. Pull back into darkness | 9.60–12.40 | **2.80** | campaign-back-embossed-set.png (retouched derivative) | still | n/a | **Desktop** 16:9 framing (0.315, 0.140, 0.685, 0.510) → (0, 0, 1, 1) over 0.0–2.3s (sine.inOut); aperture masks open from 608px to 1920px over 0.0–0.9s (`power3.out`). **Mobile** 9:16 (0.4336, 0.170, 0.5664, 0.590) → (0.3418, 0.000, 0.6582, 1.000) over 0.0–2.3s | **dip-in 0.30** / **exposure collapse 1.9–2.8s** |
| — | (black hold: handoff to the DOM logo reveal) | 12.40–12.80 | 0.40 | black | — | — | — | — |
| **(8)** | 8. Logo appears | — | — | **DOM, not in the file** | — | — | Textured wordmark with the light sweep, starting at `duration − 0.4s` | A6 |
| **(9)** | 9. Shopping interface becomes visible | — | — | **DOM** | — | — | Loop fades in; eyebrow, line and CTAs reveal (the header has been visible since t = 0) | `DESIGN.md` §8.3 A |

**Intro file total: 12.80s.** The time saved by trimming S3 (0.40s) went to S7. Perceived intro including beats 8–9: about 14.3s. The navigation is usable from t = 0. `SKIP INTRO` shows from 0.8s, and skipping, scrolling, any key or focusing the hero CTAs ends the intro at once. It plays once per session.

**S7 exposure collapse ("the light lets go"):** from 1.9s to 2.8s into the shot, global exposure falls to black (`power2.in`) while the per-shot vignette tightens from `angle=0.5` to `angle=PI/2.1`. The spotlight cone on the figure is the last thing to go dark.

**Plate checks (done on graded renders, 2026-11-06; redo after vidstab, because `optzoom=1` reframes 3–5%):**
- S3: supercar stays right of the plate (x > 0.70) at 3.15–3.65.
- S4: at the old window top (y0 0.19) the "S7" goggle pattern was fully legible and the canopy sign entered top-left. The new window plus the plate-top burn (A4) puts the head in shadow.
- S5: the car door is removed by the right burn; the sneakers are out of frame.
- S6 and loop: **no tail-light in the plate** at any frame 3.40–4.90; the light pole at the plate's left edge from ~4.85s lies outside the loop window (ends 4.80) and is also covered by the left safety burn.

## A4. Pipeline and grade (single source of truth: `tools/media/grade.sh`)

The SHOTLOG chain is the pipeline. Order per footage shot:

1. **Decode** with `-map 0:v:0 -an` (drop audio and Apple data tracks). ffmpeg autorotates; never add `transpose`.
2. **pre** (`steadfast_pre <clip>`): **HLG → BT.709 tone-map first** for the three HEVC clips (`zscale` → linear → `tonemap=hable` → BT.709), then the per-clip exposure curve and the near-mono channel mix.
3. **vidstab** (two-pass) for IMG_4913 and IMG_4376 only, on the full upright frame before any crop: `vidstabdetect=shakiness=6:accuracy=15`, then `vidstabtransform=smoothing=20:optzoom=1:interpol=bicubic`.
4. **denoise** `STEADFAST_DENOISE` (`hqdn3d=2:1.5:4:4`), at source resolution.
5. **slow-motion** `setpts=2.0*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1` (A5).
6. **crop + scale** to the plate (lanczos), per A3 (crop moves rendered per frame, see A5).
7. **LOOK** `STEADFAST_LOOK`: luma clarity, crush/rolloff S-curve (white cap 0.92), cold split-tone `bs=0.045`, `vignette=angle=0.5`.
8. **Per-shot layer** (below): burns and extra crush, as fixed masks multiplied over the plate.
9. **Grain** last, luma only, on YUV: `format=yuv420p,noise=c0s=3:c0f=t` (`steadfast_grain 3`). On desktop it is applied to the plate **before** the aperture composite.

Stills (S2, S5, S7) are rendered as per-frame sub-pixel moves in Python (A5), piped to ffmpeg as raw RGB, and then run through steps 6–9 with a still pre stage (no tone-map, no vidstab, no minterpolate):
- S2: mono mix 0.30/0.55/0.15 at amount **0.80**, so the hoodie keeps a faint steel-blue cast.
- S5 (flash still): `curves=m='0/0 0.3/0.18 0.6/0.46 1/0.82'` + mono mix at 0.92, plus `vignette=angle=PI/3.4` in its per-shot layer (kills the bright asphalt).
- S7: mono mix at 0.92 only (the campaign still is already graded).

This replaces the v1 master grade (`eq` + `colorbalance bs=0.07` + `curves` + `vignette=PI/4.2` + `noise=alls=4`). That chain had no tone-map, so the HLG highlights clipped, and `alls` grained the chroma planes too.

**Per-shot layer** (on top of grade.sh; plate coordinates unless noted):
| Shot | Layer |
|---|---|
| S1 | Top-right corner burn: black for plate x > 0.75 and y < 0.20, 30% feather (residual sky); extra crush `curves=m='0/0 0.08/0 1/1'` |
| S2 | none |
| S3 | Top-right corner burn: plate x > 0.78 and y < 0.30, 30% feather (sky, trees); extra crush as S1 |
| S4 | **Plate-top burn**: black above plate y 0.20, linear feather to 0.32 (head and goggles in shadow, no legible "S7"). **Top-left corner burn** in source coordinates x < 0.30, y < 0.22 (fuel canopy; a safety even though the window starts at y 0.23) |
| S5 | **Right burn**: black for plate x > 0.85, feather 0.10 (the car door at source x > 0.61); `vignette=angle=PI/3.4` |
| S6 / loop | `eq=gamma=1.15` in the pre stage (the clip is underexposed). Safety burns: left 6% and top 6% of the plate |
| S7 | Exposure collapse and vignette tightening (A3) |

**Desktop composite:** `color=c=black:s=1920x1080:r=30` base; plate `scale=608:1080` (already grained); alpha from a static mask PNG (608×1080, white with 72px linear ramps at left and right); `overlay=x=656:y=0`. For S7, the side masks are two black 640×1080 rects with 72px feathered inner edges animated outward (x from 16→−640 and 1264→1920 over 0.9s, `power3.out`). Grain on S7 is applied to the image layer under the masks.

No LUT files, no film-emulation plugins, no light leaks, no flicker.

## A5. Slow motion and camera-move policy

- Footage is slowed to **exactly 0.5×** (S1, S3, S4, S6, loop). Never slower, no speed ramps, no reverse in the intro.
- `mci` is safe where pan ≤ ~5px/frame (SHOTLOG §6): S1, S4, S6 and the loop. **S3 (3.15–3.65) pans 10–16px/frame**, so QA it frame by frame. If the lettering warps or smears, switch S3 to frame blending: `setpts=2.0*PTS,framerate=fps=30:interp_start=0:interp_end=255:scene=100`.
- Still moves (S2, S5, S7) and footage crop moves (S1, S4) use **sub-pixel resampling**: a per-frame affine crop in Python/Pillow (`Image.transform(..., Image.Transform.AFFINE, resample=BICUBIC)`) piped to ffmpeg as raw frames. Don't use ffmpeg `zoompan` on the original, which jitters from integer rounding.
- All moves are slow and monotonic: one direction per shot, ≤ 8% scale change, no rotation.

## A6. Logo reveal (beat 8) using the wordmark artwork

**In the theme (live DOM, the default):** at `duration − 0.4s` the textured wordmark (`sf-logo-textured-*`, transparent, cream preserved, streaks intact; box aspect **1210/411**) appears centred on black:
- **Light sweep:** `mask-image: linear-gradient(105deg, #000 0, #000 calc(var(--sweep) - 15%), transparent calc(var(--sweep) + 15%))`, with `--sweep` −30%→130% over 1.2s `sine.inOut`. The 105° follows the wordmark's diagonal streaks.
- Opacity 0→1 over the first 0.5s. Scale 1.035→1.000 over 1.6s `expo.out`.
- Size: the hero rest size, box `min(44vw, 640px)` desktop and `min(84vw, 640px)` mobile (letters are 92.15% of the box), so beat 9 only has to translate it.
- CSS only (no GSAP in the hero, ARCHITECTURE §4.5).

**Baked version (optional full film for social/download; not bundled in the theme):**
1. Black-point the source: `curves=all='0.02/0 1/1'` (the source background #040404 becomes #000).
2. Scale the textured crop so the **letters** span **38%** of frame width: desktop letters 730px → textured image width 730 / 0.9215 = **792px**; mobile letters 76% of 720 = 547px → image width **594px**. Both are downscales of the 1210px native crop.
3. Sweep alpha per pixel: `a = clip((p(t) − u)/0.30 + 0.5, 0, 1)`, `u = (x·cos15° + y·sin15°)` normalised to 0–1 across the image, `p(t)` −0.3→1.3 over 1.2s sine.inOut.
4. Never grade, grain or vignette the wordmark beyond the black-point step.

## A7. Hero loop, end stills, audio

**Loop (5.6s, seamless).** IMG_4376 **3.40–4.80** at 0.5× = 2.8s, then the same reversed (ping-pong) = 5.6s. Plate (0.040, 0.000, 0.800, 0.760) = SHOTLOG [0.04, 0, 0.76, 0.76], vidstab, S6 per-shot layer, grain 3. Desktop is the aperture composite; mobile is the full plate. It plays muted, looped and inline after the intro and on every later page view. The reversal at 0.5× reads as a held breath around the head turn. Tail-light check: done (A3).

**End stills** (ARCHITECTURE `sf-film-end-desktop` / `-mobile`): the **loop's first frame** (source 3.40s), graded, no grain, **no logo baked in** (the DOM wordmark sits over it), black-point clamped (luma ≤ 6 → 0). They are the LCP image when the hero is static and the reduced-motion / save-data still, and they sit under the loop so the loop's fade-in is seamless.
| Still | Sizes |
|---|---|
| `sf-film-end-desktop` | 1920×1080 composite; WebP 960, 1600, 1920 (2400 would upscale the composite; record it as dropped); JPG 1600 |
| `sf-film-end-mobile` | 720×1280 plate; WebP 480, 720 (1080 is a 1.5× upscale; keep only if recorded); JPG 720 |

The intro `<video>` has no poster attribute (ARCHITECTURE §5.1). The stage background `#000` is frame 0, and the film opens on black.

**Audio:** none. Every web file is encoded with `-an`.

## A8. Renders and encodes (supplied edit; **H.264 only**, ARCHITECTURE decision 5)

| File (`media/processed/film/` → `theme/assets/`) | Content | Size | Target weight |
|---|---|---|---|
| `sf-film-desktop.mp4` | A3 intro, aperture composite | 1920×1080, 30p, 12.8s | ≤ 3.5 MB |
| `sf-film-mobile.mp4` | A3 intro, plates | 720×1280, 30p, 12.8s | ≤ 2.4 MB |
| `sf-film-loop-desktop.mp4` (name pending ARCH, `DESIGN.md` §14 #7) | A7 loop | 1920×1080, 30p, 5.6s | ≤ 1.5 MB |
| `sf-film-loop-mobile.mp4` (name pending ARCH) | A7 loop | 720×1280, 30p, 5.6s | ≤ 1.0 MB |
| `sf-film-end-desktop-*`, `sf-film-end-mobile-*` | A7 end stills | see A7 | WebP 1600 ≤ 200 KB, mobile 720 ≤ 110 KB |
| `edit-decision-list.json`, `contact-sheet.jpg` | A3 as data; one frame per shot | n/a | n/a |

First visit totals (intro + loop): desktop ≤ 5.0 MB, mobile ≤ 3.4 MB, within ARCHITECTURE §6.1 (6.0 / 3.5 MB). Later visits load the loop only. Static visitors load neither.

Encode settings, all files:
```
-map_metadata -1 -map_chapters -1 -an -r 30 -pix_fmt yuv420p
-c:v libx264 -profile:v high -preset slow -g 60 -keyint_min 60 -sc_threshold 0
-color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart
-metadata title="STEADFAST hero edit — supplied footage"
-metadata comment="Edit of client-supplied phone footage and photography. Not a commissioned campaign film."
```
- Desktop: `-crf 25 -maxrate 3500k -bufsize 7000k -level 4.1`. Mobile: `-crf 25 -maxrate 2000k -bufsize 4000k -level 3.1`.
- `-map_metadata -1` also strips the iPhone source metadata (device, capture location) before the honesty title is written.
- If a file misses its weight target, raise CRF by 1–2 (within ARCHITECTURE's 23–28 range). Never lower the resolution and never raise the grain.
- One `<source type="video/mp4">` per breakpoint, as in ARCHITECTURE §5.2. No HEVC, AV1 or WebM files, and no codec source ordering.

**Honesty note for UI, docs and files:** the hero may carry an optional caption setting (default empty). No string, alt text or file metadata anywhere may call this "a campaign film", "shot by" or "directed by". The exported files carry the title tag above. FILM-STORYBOARD and DEPLOYMENT describe it as an edit of supplied footage.

---

# PART B: Production storyboard (commissioned shoot)

## B1. Concept

**FIXED POINT.** A figure in a black STEADFAST tracksuit stands on a polished black floor under one overhead light. For the length of the film they hardly move: a breath, a quarter turn, nothing more. The camera and the light do the travelling. They find the garment piece by piece (stitch, zip, name, profile, silhouette, the back) and then withdraw. The light lets go and only the name remains. It's an original concept: no reference film's shots, music or assets are reused.

Design every frame so the hero UI can live on it: **the subject is centre-weighted, and the left 30% and bottom 20% of the 16:9 frame stay in shadow** (text and CTAs go there).

## B2. Shot list (all 9 beats)

Camera: **RED V-RAPTOR [X] 8K VV** (or ARRI ALEXA 35 with a vertical B-camera; see B6), REDCODE HQ, 8K 17:9, frame lines for 16:9 **and a centred 9:16 extraction** (2430×4320 → 2160×3840). Lenses: Zeiss Supreme Prime Radiance or Cooke S7/i (full frame). Shutter 180°. Base ISO 800. Stop f/2.8 unless noted. Capture **48fps** for every shot meant for 0.5× playback and 24fps otherwise. The edit timeline is **24p** (a production choice for the commissioned master; Shopify re-encodes uploads, and the bundled Part A edit stays 30p).

| # | Beat | Framing | Lens | Camera move & speed | Capture → screen time | Notes |
|---|---|---|---|---|---|---|
| 1 | Extreme close-up of the chest logo / fabric | Logo construction fills the frame. The plane of focus grazes the fibre | **100mm macro** (1:1), f/4 | Motion-control slider, lateral **8 cm over 4.0s (2 cm/s)**. A rake light sweeps 10° across the surface on a dimmer cue | 48fps, 4.0s → **2.0s** | Opens from black. Exposure rises with the light sweep |
| 2 | Slow reveal of the zipper and garment texture | Zip pull to the hem, tight, 1/3 frame off-centre | **65mm macro**, f/4 | Vertical tilt-down on a head, **25 cm of travel over 5.0s** | 48fps, 3.6s → **1.8s** | The zip pull catches a silver kick at the start |
| 3 | Close-up of STEADFAST branding | Back logo, chest to shoulder width | **75mm**, f/2.8 | Dolly push-in **15 cm over 3.0s** | 48fps, 2.8s → **1.4s** | A coaxial ring light at 5–10%; any light-catching trim reads softly |
| 4 | Side profile of the model | Medium close-up, profile left, hood up, eyes in shadow, a sliver of rim on the nose and chin | **85mm**, f/2 | Lateral track **30 cm over 5.0s (6 cm/s)** | 48fps, 3.2s → **1.6s** | Overhead key gives skull-top light only. The silver kick from 135° camera-right traces the profile. No patterned or branded eyewear |
| 5 | Slow reveal of the full tracksuit | Starts on the shoes and pant break and ends full length, head at the top third | **35mm**, f/2.8 | Pedestal / jib **up 1.2 m over 4.0s** with a matching tilt | 48fps, 3.6s → **1.8s** | The floor reflection is in frame at the start. Unbranded footwear |
| 6 | The model turns slightly, revealing the back design | Full length to 3/4, centred | **50mm**, f/2.8 | Locked off, plus a **10° dolly arc** opposite to the turn. The model turns **a quarter, over 3.0s** | 48fps, 3.6s → **1.8s** | The back logo meets the backlight at the end of the turn. No spin past 180° |
| 7 | Camera pulls back into darkness | From medium (back) to an extreme wide, the figure small in the cone | **24mm**, f/2.8 | Technocrane (or dolly + jib) **pull back 4.0 m and rise 1.0 m over 6.0s** while the key dims **100%→10%** on a 4s fade | 24fps, 2.4s → **2.4s** | It ends on near-black. Keep the last 0.4s fully black in the edit |
| 8 | The STEADFAST logo appears | Black frame. The **wordmark artwork** is composited (not filmed, not typed) | n/a | Light-sweep reveal (A6) | n/a → **2.4s** in the full film; live DOM in the theme | Never recreate the logo in 3D or as projected type |
| 9 | Homepage interface becomes visible | n/a | n/a | Theme choreography (`DESIGN.md` §8.3 A) | n/a | Requires the intro master to end on ≥ 0.4s of black |
| L | **Hero loop plate** | Full length, centred, under the cone | **35mm** | **Locked off.** Haze drifts. The key "breathes" ±8% on a 6s sine dimmer cycle. The model is still | 24fps, record 40s, select 6–8s | Loop it in the edit with a 1.0s crossfade of the tail into the head. No ping-pong needed |

Intro edit target: **12–13s** of picture + 0.4s of black. Keep dips to black to at most two (A3 rhythm). Full campaign film: 16–18s with the logo end card.

## B3. Lighting plan

```
                 [KEY: overhead, 4.5 m, pointing straight down]
                 Fresnel 2K (or LED fresnel) + snoot + 1/2 grid, 4300K, spot ~2.2 m pool
                                  │
   [KICK L] ◄ 135° ──────── ( MODEL ) ──────── 135° ► [KICK R]
   1×LED tube 1.2 m, 6500K,       ▲                 1×LED tube 1.2 m, 6500K,
   40° grid, 15%                  │                 40° grid, 12%
                                  │
   [NEG] black 4×4 floppies both sides at 1.5 m (kill spill)
                                  │
                           [CAMERA] + coaxial LED ring (5–10%, beats 3 & 6 only)
   [RAKE] small LED on a slider at floor/garment level, beat 1 only, dimmer-cued
   [HAZE] water-based hazer, low continuous density, one fan for slow drift (not smoke clouds)
```
- Contrast ratio key:fill is about 16:1 (no fill light; the floor bounce is the fill).
- The kicks are cooler than the key (6500K vs 4300K). In the grade this reads as **silver edges on a steel-cold body**.
- Every shot must have a pure black region somewhere in frame, and black means black.

## B4. Set

- A black-box studio (minimum 12 × 10 m, 6 m grid height for the overhead key and the beat-7 crane rise). Walls draped in black duvetyne. Haze makes the far wall vanish.
- Floor: a **4 × 4 m polished black surface** (high-gloss black acrylic or black-marble-effect vinyl, wet-wiped before each take) for the reflection seen in the campaign still. Everything outside it is matte black.
- No props, no furniture, no signage. Nothing third party.

## B5. Wardrobe, talent, styling

- **Hero look (beats 1–7, loop): the client chooses it.** It must be a black STEADFAST tracksuit. Two candidates are visible in the supplied photography:
  - the **black speckle tracksuit with white piping** and script logos at the chest, back and pocket (seen in the supplied product screenshot);
  - the **black zip hoodie with wide sweatpants and cream drawcords** (seen in the night photo).
  The storyboard doesn't recommend one or describe either by construction or material. Test both under the kick lights on a camera-test day if possible. The client supplies production samples in the model's size, plus a steamed backup set.
- **Texture inserts (optional, beats 1–2 alternates):** the washed blue-grey zip hoodie (zip, distressed chest logo, shoulder embellishment) on a form, or the hoodie with tonal lettering on the back. Shot as separate inserts on the same set.
- Captions, voice-over and copy name construction or materials (embroidered, appliqué, embossed, reflective and so on) **only after the client confirms them in writing**.
- Accessories: an **unbranded** black balaclava or hood up with the face in shadow. No patterned or monogrammed eyewear. Unbranded black footwear (tape over marks). No jewellery logos.
- **Talent direction:** stillness is the performance. Weight on the heels, chin slightly down, hands loose or in the hoodie pocket. Breathe out on "action". The turn (beat 6) is a quarter turn on a slow three-count. Never look at the lens, never pose, never smile. Casting brief: any build that fits the sample size and holds still for 40s.

## B6. Deliverables spec

**Masters**
| Deliverable | Spec |
|---|---|
| Desktop master | **3840×2160**, 24p, ProRes 422 HQ, Rec.709 / gamma 2.4, no grain baked in (deliver grained and clean) |
| Mobile master | **2160×3840**, 24p, ProRes 422 HQ. From the 8K VV centred 9:16 frame lines (2430×4320), or a vertical B-camera on the same rig |
| Versions per orientation | `intro` (12–13s + 0.4s black, no logo) · `film` (full, with the logo end card) · `loop` (6–8s seamless) · textless/clean |
| Stills | Graded stills from the masters: loop first frame (the end still), the beat-7 wide, plus 3 hero stills at 6000px long edge (sRGB JPEG, max quality) |

**Web encodes: H.264 only** (all muted `-an`, `+faststart`, BT.709 tagged, closed GOP 2s, metadata stripped and titled honestly). Shopify makes its own renditions from an uploaded MP4, so upload the highest-quality H.264.
| File | Resolution | H.264 High | Weight cap |
|---|---|---|---|
| Intro desktop | 1920×1080 | 4.0 Mbps VBR, max 6 | ≤ 6.5 MB (≈13s) |
| Intro mobile | 1080×1920 | 3.5 Mbps, max 5 | ≤ 5.7 MB |
| Loop desktop / mobile | 1920×1080 / 1080×1920 | 3.0 / 2.5 Mbps | ≤ 3 MB / ≤ 2.5 MB (8s) |
| Full film | 1920×1080 / 1080×1920 | 4.0 / 3.5 Mbps | n/a |

If these files are ever bundled as theme assets instead of uploaded, they must meet ARCHITECTURE §6.1's film budget (≤ 6.0 MB desktop, ≤ 3.5 MB mobile per visit).

**File naming** (lowercase, no spaces, unique; bump the version instead of re-uploading the same name):
`steadfast_fp_{intro|film|loop|still}_{desktop|mobile}_{WxH}_{fps}p_v{NN}.{mp4|jpg}`
Examples: `steadfast_fp_intro_desktop_1920x1080_24p_v01.mp4`, `steadfast_fp_loop_mobile_1080x1920_24p_v01.mp4`, `steadfast_fp_still_desktop_1920x1080_v01.jpg`.

## B7. Dropping the film into the theme (no code changes)

1. **Shopify admin → Content → Files → Upload** the H.264 intro and loop files (desktop and mobile) and the still JPEGs.
2. **Online Store → Themes → Customize → Home page → Hero film (Section A).** Setting IDs are ARCHITECTURE's (§2.4 A):
   - `video_desktop`, `video_mobile` (the intro)
   - `loop_video_desktop`, `loop_video_mobile` (the loop; settings pending ARCH, `DESIGN.md` §14 #7)
   - `end_image_desktop`, `end_image_mobile` (the end stills; also the reduced-motion and save-data still)
   - `use_bundled_film` (fallback to Part A when a slot is empty), `play_once_per_session`, `show_skip`, `show_logo`
   - `cta_primary_label` = `EXPLORE COLLECTION`, `cta_primary_link`; `cta_secondary_label` = `VIEW THE CAMPAIGN`, `cta_secondary_action` (`link` → `#campaign` by default, or `replay`), `cta_secondary_link`
3. Rules the theme relies on, which any replacement film must meet:
   - The intro **ends on ≥ 0.4s of pure black**. The theme starts the logo reveal at `duration − 0.4s`, read from the video metadata.
   - The intro is **≤ 14s**.
   - The desktop file is 16:9 and the mobile file is 9:16. The UI-safe zones (left 30% and bottom 20% on desktop; bottom 35% on mobile) stay dark.
   - The end still matches the loop's first frame.
   - If a slot is empty, the theme falls back to the bundled supplied-footage edit (Part A) while `use_bundled_film` is on. If that's missing too, it shows the end still.
4. Preview in the theme editor at a desktop and a mobile width. Test with reduced motion turned on (still only) and confirm `SKIP INTRO` works. Then publish (only with the owner's approval).
