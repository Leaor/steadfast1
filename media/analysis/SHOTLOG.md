# STEADFAST footage shot log and grade notes

Footage analysis of the four client phone clips in `media/source/footage/`. The hero film is edited later from `docs/FILM-STORYBOARD.md`. This log tells the edit which seconds are usable, how to crop them, and how to grade, slow, stabilise and encode them. The grade itself is in `tools/media/grade.sh`. Before/after frames are in `media/analysis/grade-tests/`.

Coordinates: crop rectangles are `x,y,w,h` as fractions of the **upright** frame (after autorotation). That frame is 720×1280 for the HEVC clips and 540×960 for IMG_4409, and both are 9:16.
- **9:16 crop**: since the source is also 9:16, `w == h`. Scale the result to the mobile output size (720×1280 or 540×960).
- **Desktop 4:5 panel**: `w = 1.422·h`. Use it for a centered single panel on black, or as one tile of a triptych. A triptych of three 9:16 crops at 608×1080 + 24 px gaps also tested well on a 1920×1080 canvas (see Encode).
- Full-bleed 16:9 from these portrait clips is **not recommended**. A 16:9 crop is at most 720×405 px, so it needs a ≥2.7× upscale for 1080p and goes visibly soft.

## 1. Probe summary

| Clip | Codec / bit depth | Transfer / primaries | Coded size → upright | fps | Dur | Video kbps | Rotation | Audio |
|---|---|---|---|---|---|---|---|---|
| IMG_4913-day-embossed-closeup | HEVC Main10, yuv420p10le | **HLG (arib-std-b67) / BT.2020** | 1280×720 → **720×1280** | 30 | 6.98 s (210 f) | 2330 | display matrix −90 | AAC + 2nd audio (spatial); strip |
| IMG_4376-night-back-grey-embossed-hoodie | HEVC Main10 | HLG / BT.2020 | 1280×720 → 720×1280 | 30 | 5.36 s (161 f) | 2342 | −90 | AAC; strip |
| IMG_4374-night-profile-car | HEVC Main10 | HLG / BT.2020 | 1280×720 → 720×1280 | 30 | 4.25 s (128 f) | 2360 | −90 | AAC; strip |
| IMG_4409-night-red-pump-hoodie | H.264 Main, 8-bit | BT.709 SDR | 960×540 → **540×960** | 30 | 5.57 s (167 f) | 1264 | −90 | AAC; strip |

Notes:
- ffmpeg autorotates on decode, so never add `transpose`. Every crop below is measured on the upright frame.
- **The three HEVC clips are HDR (HLG).** A naive decode clips the overcast sky and the forecourt lights to white. `grade.sh` tone-maps them to BT.709 first: `zscale` → linear → `tonemap=hable` → BT.709. That keeps the highlight detail the silver rolloff needs. Every clip also carries Apple metadata/data tracks, so map only the video stream (`-an`, or `-map 0:v:0`).
- IMG_4409 is a lower-resolution (540×960) 8-bit SDR clip. It holds up only as a small or heavily cropped texture moment, and its 9:16 crops need about 1.7× upscaling.

## 2. Method

- Frames were extracted every 0.25 s at 270×480 for viewing (scratchpad `footage/<clip>/f_*.jpg`) and every frame at 180×320 gray for metrics. All frames were tone-mapped first. Contact sheets were reviewed visually for each clip, along with gridded full-res key frames.
- **Sharpness** is the variance of the Laplacian per frame at 180×320, averaged per segment. It is only comparable *within* a clip: night sensor noise inflates the value, and content changes it too.
- **Camera motion** comes from FFT phase correlation between consecutive frames, giving the global translation in px at 720 px width.
  - *pan* = mean |translation| per frame.
  - *jitter* = RMS deviation of the cumulative trajectory from a 15-frame (0.5 s) moving average. This is handheld shake, as opposed to an intended move.
  - *resid* = mean abs difference after alignment, which measures subject/parallax motion.

| Clip | Whole-clip jitter RMS | Mean pan px/f | Verdict |
|---|---|---|---|
| IMG_4913 | 11.9 px (peak 47 px at 4.0–4.3 s) | 7.4 | Shaky in the 3.2–5.9 s move; 0–3.0 s is OK |
| IMG_4376 | 5.0 px (peaks ~8 px) | 3.1 | Noticeable handheld float; stabilise |
| IMG_4374 | 0.4 px | 0.25 | Essentially locked off; no stabilisation needed |
| IMG_4409 | 1.9 px (5 px in last 0.5 s) | 1.0 | Steady except the final 0.5 s |

## 3. Brief beats (for "usable-for")

1. ECU embroidered fabric · 2. zipper + garment texture reveal · 3. STEADFAST branding close-up · 4. side profile · 5. full tracksuit reveal · 6. turn revealing back design · 7. pull back into darkness · 8. logo · 9. shop UI.

## 4. Per-clip segment tables

### IMG_4913: day, embossed charcoal hoodie (best footage)

Overcast daylight in a car park. The garment is a washed-charcoal hoodie with a tonal embossed blackletter "steadfast" across the right shoulder blade, ornamental (paisley/scroll) embossing on the hood, and an arched embossed back panel. The goggle strap carries a "Steadfast" script logo.

| In–Out (s) | Description | Framing | Sharpness (lapvar, mean) | Shake (pan / jitter px) | Third-party marks (where) | Usable for | 9:16 crop x,y,w,h | Desktop 4:5 crop x,y,w,h |
|---|---|---|---|---|---|---|---|---|
| 0.00–1.60 | Hoodie back/hood. Embossed "steadfast" diagonal at the centre, hood scroll embossing upper-left; slow drift | ECU / macro | 450–490 (good, consistent) | 0.7–2.7 / 1.3–3.4 (steady) | **Yellow supercar** (gull-wing door, blue trim) right side x>0.60, y 0.30–0.80; overcast sky top y<0.30 at x>0.35 | **1, 3** (strongest fabric/emboss detail) | `0.00,0.28,0.60,0.60` | `0.00,0.36,0.60,0.42` |
| 1.60–3.00 | Camera rises slowly up the hood; emboss text stays in frame; goggle strap with "Steadfast" script enters at the top ~2.5 s | ECU → CU | 390–460 (slightly softer 1.7–2.4 s) | 1.5–3.9 / 2.8–6.3 | Supercar right x>0.62; sky top | **2** (texture reveal, slow vertical move), 3 | `0.00,0.22,0.62,0.62` | `0.00,0.32,0.63,0.44` |
| 3.00–3.75 | Wider across the shoulders: the **full word "steadfast" reads horizontally** (best at 3.25–3.55 s); goggle strap logo at top | CU (back + shoulders) | 500–640 (sharpest close-up) | 10–16 / 10–14 (moving, some shake) | Supercar right x>0.70; trees/sky | **3, 6** (back design). Hold 3.25–3.55 s; slow to 0.5x and stabilise | `0.00,0.15,0.72,0.72` | `0.00,0.30,0.71,0.50` |
| 3.75–4.40 | Fast whip as the subject turns; sleeve emboss, car wheel/red caliper, yellow motorbike | MCU, motion-blurred | 440–520 (motion blur) | 20–28 / **18–47 (peak)** | Supercar wheel + caliper large mid-right; motorbike; "S7" monogram head wrap/goggles | **Not usable** (whip pan, heavy shake) | — | — |
| 4.40–5.60 | Subject revealed: grey balaclava, black open zip hoodie over a dark crewneck with contrast piping, black sweatpants with cream drawcords; adjusts the drawcord | MS, handheld | 650–890 | 13–15 / 0.6–17 | Supercar left/right edges 4.5–5.3 s; unidentified sleeve text ("pro…") at the sleeve hem 4.5 s; repeating "S7" monogram on the goggles/wrap | Weak 5 (outfit), mostly cut | `0.10,0.18,0.80,0.80` | `0.00,0.24,1.00,0.70` |
| 5.60–7.00 | Settled full-figure: crewneck with "Steadfast" chest script + chain, open black zip hoodie, sweatpants; park/trees behind | MS / full-ish (feet cut) | 630–700 | 0.7–7.6 / 1.3–12 (calms after 6.4 s) | Park, houses, overcast sky; "S7" monogram on goggles | 5 (outfit reveal; daylight, not a tracksuit, so secondary). Best 6.40–7.00 s | `0.02,0.18,0.78,0.78` | `0.00,0.22,1.00,0.70` |

Notes:
- The grade (blue-weighted mono mix, −1 stop) turns the yellow car into a dark grey shape, but it is still a recognisable car silhouette. Crop it out where you can: every crop above keeps x ≤ 0.62–0.72 during 0–3.75 s.
- The sky renders as stormy dark grey, which works.
- 9:16 crops at 0.60–0.72 width are 432–518 px wide, i.e. a 1.4–1.7× upscale to 720×1280. The grade's grain and clarity hide this well (see `grade-tests/IMG_4913_*_after-crop916.jpg`).

### IMG_4376: night, washed-grey embossed hoodie from behind

Night gas-station forecourt. The subject is seen from behind in a washed-grey hoodie with an embossed blackletter "steadfast" across the right shoulder and an arched (gothic arch) back panel, plus a black cap with a "Steadfast" script on the back strap. Dark trousers.

| In–Out (s) | Description | Framing | Sharpness | Shake (pan / jitter) | Third-party marks (where) | Usable for | 9:16 crop | Desktop 4:5 crop |
|---|---|---|---|---|---|---|---|---|
| 0.00–1.10 | Wider back view; camera pushes in toward the subject. Bright white pillar and lit store interior | MS (head to knees) | 410–520 | 0.4–4.9 / 3–8 | **Red fuel-brand sign/pump topper** at x 0.70–0.80, y 0.15–0.35; storefront signage behind x 0.55–0.95, y 0.25–0.40; fire extinguisher | **7** (reverse this push-in at 0.5x = pull back into darkness, then fade); 6 | `0.05,0.00,0.90,0.90` (the subject fills x 0.08–0.95, so a tighter crop clips the shoulder; the pump sign stays in but grades to a dark grey panel behind the shoulder) | `0.00,0.04,1.00,0.70` |
| 1.10–3.30 | Closer; subject centred against black; arch panel and shoulder emboss visible; cap logo. Slight sway | MCU back | 277–410 (softest part, 1.3–1.9 s) | 2.9–4.9 / 4–8 | Red **car tail-lights** at right x>0.78 from ~2.7 s; a small light in the tree top-right | **6** (back design). Stabilise; prefer 2.1–3.3 s | `0.08,0.00,0.80,0.80` | `0.06,0.02,0.80,0.56` |
| 3.30–5.10 | Most stable section (jitter <2 px at 3.7–4.6 s); subject turns the head slightly left, then right | MCU back | 450–510 | 0.3–5 / 0.8–4.6 | Tail-lights right x>0.80; car boot interior right, a teal object (bag) at x>0.85, y 0.35–0.45 at 4.5–5.0 s | **6** (best: "turns slightly revealing the back"), 7 | `0.04,0.00,0.76,0.76` | `0.06,0.02,0.80,0.56` |
| 5.10–5.37 | Camera starts moving | — | 306–450 | 4.5–8.3 / 5–11 | — | Not usable | — | — |

### IMG_4374: night, side profile by black SUV

Night. The subject leans by an open SUV tailgate in a grey zip hoodie over a white tee, with a cap and a patterned head wrap/goggles. Profile faces right. The camera is effectively locked off (0.4 px jitter). Sharpness rises steadily through the clip (780 → 1080), so focus settles; best from 1.3 to 3.5 s.

| In–Out (s) | Description | Framing | Sharpness | Shake | Third-party marks (where) | Usable for | 9:16 crop | Desktop 4:5 crop |
|---|---|---|---|---|---|---|---|---|
| 0.00–1.30 | Profile, subject still; focus settling | MS profile | 780–890 | ~0 / 0.3 | **Fuel-brand canopy ("Synergy", red)** top-left x<0.30, y<0.22, growing to x<0.45 by 3 s; small **yellow car** x 0.85–0.95, y 0.28–0.31; **SUV** (third-party vehicle) fills the right half; **operator reflection in the car window** bottom y>0.78 | 4 | `0.16,0.21,0.56,0.56` | `0.06,0.22,0.71,0.50` |
| 1.30–3.50 | Sharpest. Slight head turn toward camera ~3.0 s; the "S7" monogram on the goggles is legible | MS profile | 930–1080 | ~0 / 0.1–0.7 | Same; canopy larger | **4** (best side profile) | `0.16,0.21,0.56,0.56` | `0.06,0.22,0.71,0.50` |
| 3.50–4.25 | Subject shifts; hand reflection moves in the window | MS | 950–1050 | 0.3–0.6 / 0.7–1.1 | Same | 4 (tail) | same | same |

Notes:
- Always crop y ≤ 0.78: the window edge sits at y ≈ 0.80, and the reflection below it shows the camera operator's arm/face.
- The 9:16 crop is 403×717 px, a 1.8× upscale. It is acceptable at mobile size (see `grade-tests/IMG_4374_*_after-crop916.jpg`).

### IMG_4409: night, red-lit hoodie at the fuel pump (weakest)

Night. The subject is seen from behind/three-quarter in a dark hoodie with an embossed shoulder emblem (crest) and a hood with a script mark, under red canopy light. A fuel pump and its screens sit left. Source is 540×960 SDR.

| In–Out (s) | Description | Framing | Sharpness | Shake | Third-party marks (where) | Usable for | 9:16 crop | Desktop 4:5 crop |
|---|---|---|---|---|---|---|---|---|
| 0.00–1.60 | Pump nozzle left, hoodie shoulder and hood | MCU | 750–780 | 0.3–1.3 / 0.6–1.8 | **Fuel pump + nozzle, "Synergy"/"Esso"-style branding** x<0.35, full height; "Medals" promo topper top x 0.45–0.75, y<0.08; **mint/teal bag** bottom-right x>0.85, y>0.70 | 1 (texture only, tight crop) | `0.40,0.14,0.58,0.58` | `0.40,0.14,0.58,0.41` |
| 1.60–3.30 | Camera arcs; pump screens/price buttons come into view left | MCU | 625–735 | 0.3–1.2 / 0.6–1.1 | Pump screens/QR/price buttons x<0.42 | 1 (tight crop) | `0.40,0.14,0.58,0.58` | `0.40,0.14,0.58,0.41` |
| 3.30–5.00 | Steady hold on the shoulder crest emboss and hood | MCU | 510–610 | 0.2–0.9 / 0.3–1.6 | Pump x<0.45 (QR code at x 0.36–0.42 near the top) | **1** (abstract dark texture under the grade) | `0.40,0.14,0.58,0.58` | `0.40,0.14,0.58,0.41` |
| 5.00–5.57 | Camera moves | — | 400–510 | 3.3–5.6 / 5 | — | Not usable | — | — |

Under the mono grade (low red weight), the red cast becomes deep shadow, and the crest emboss reads as an abstract steel texture. Use at most ~1 s, or not at all.

### Beat coverage summary

| Beat | Best footage source | Gap / recommendation |
|---|---|---|
| 1 ECU fabric | IMG_4913 0.0–1.6 (0.5x, mci); alt. IMG_4409 3.3–5.0 | Good |
| 2 Zipper + texture | IMG_4913 1.6–3.0 (texture rise) | **No zipper close-up exists in the footage.** Use a slow push on a detail crop of `zip-hoodie-blue-grey-front.png` (photo) |
| 3 Branding CU | IMG_4913 3.25–3.55 (full word), 0.0–1.6 | Good; slow and stabilise 3.0–3.6 |
| 4 Side profile | IMG_4374 1.3–3.5 | Good (locked off, sharp); keep the crop off the canopy and reflection |
| 5 Full tracksuit | IMG_4913 6.4–7.0 (daylight outfit, not a tracksuit) | **No full-tracksuit footage.** Prefer a slow move on `campaign-back-embossed-set.png` |
| 6 Turn / back design | IMG_4376 3.3–5.1 (head turn), 2.1–3.3; IMG_4913 3.0–3.6 | Good |
| 7 Pull back into darkness | IMG_4376 0.0–1.1 **reversed** at 0.5x + fade to black; or a slow zoom-out on `campaign-back-embossed-set.png` | OK |
| 8 Logo | Wordmark artwork (stills) | n/a for footage |
| 9 Shop UI | — | n/a |

## 5. Grade: `tools/media/grade.sh`

```bash
source tools/media/grade.sh
steadfast_vf IMG_4913 0,0.28,0.60,0.60 720x1280   # prints the full -vf chain
tools/media/grade.sh tests                         # regenerates media/analysis/grade-tests/
```

Chain order: **pre** (HLG→SDR tone-map for HEVC clips, per-clip exposure curve, near-mono channel mix keeping 4–8 % colour) → **denoise** (`hqdn3d=2:1.5:4:4`, at source res before any upscale) → **crop + lanczos scale** → **LOOK** → **grain** (always last).

The LOOK has four parts:
- Luma-only clarity: `unsharp 9×9 0.35`.
- Crush/rolloff S-curve: blacks crushed below ~7 %, white capped at 0.92 so highlights read **silver, not paper-white**.
- Cold steel split-tone: `colorbalance` shadows/mids pushed to blue −red, highlights barely cooled.
- Gentle `vignette=angle=0.5`. There is no glow or halation.

Per-clip mono weights:
- Blue-weighted (0.22/0.50/0.28) for the day clip, which darkens the yellow car and green foliage.
- Low red (0.12/0.58/0.30) for the red-lit IMG_4409, so the red cast falls into shadow.
- Near-Rec.709 weights for the other night clips.

Grain: temporal luma-only `noise=c0s=3:c0f=t`. It runs on YUV; on RGB/gbrp the c0 plane is green, which gives green speckle.
- Default strength is 3. The tests showed 6 looks richer but raises the H.264 bitrate by ~50 % (CRF 23: 1.41 → 2.12 Mbps), and HEVC/AV1 smooth most of it away anyway.
- For a stronger filmic texture, add a CSS/canvas grain overlay in the theme instead of baking more grain into the video.

Iteration log, judged on before/after frames:
1. v1: too dark, garment detail lost at night.
2. v2: mids lifted. The night clips went navy-blue rather than steel.
3. v3: split-tone reduced to `bs=0.045`, day colour retention reduced to 4 %. IMG_4913 mids were then lifted slightly and the IMG_4376 lift backed off for cross-clip consistency.

The final frames read as one consistent cold near-monochrome campaign across day and night sources (`grade-tests/grade-overview_before-after.jpg`).

## 6. Slow motion (IMG_4913, 1.5 s → 3.0 s at 0.5x)

Two segments were tested: gentle (1.0–2.5 s) and hard (3.0–4.5 s, whip start). Both were tested at 540×960 with `setpts=2*PTS` and then:
- **A:** `minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
- **B:** `framerate=fps=30` (frame blending)

Results:
- **Gentle segment: mci is clearly cleaner.** Interpolated frames are crisp, and the emboss lettering and hood scrollwork hold shape. Blend frames show double edges on hem and sleeve.
- **Hard segment: mci still beats blend on most frames.** Blend shows obvious ghosting ("dfast" doubled, goggle logo doubled). But mci produced **block-smear warping on high-contrast edges at peak motion** (goggle lens edge, ~3.9–4.1 s source).
- Comparison images: `grade-tests/slowmo_IMG_4913_1p0-2p5s_mci-vs-blend.jpg` and `grade-tests/slowmo_IMG_4913_3p0-4p5s_mci-vs-blend.jpg`.
- Cadence evenness (coefficient of variation of frame-to-frame difference) was identical (0.22 / 0.36), so the difference is artifacts, not judder.

**Recommendation:**
- Use `mci` on segments with pan ≤ ~5 px/frame: IMG_4913 0–3.4 s, IMG_4374 entire, IMG_4376 2.1–5.0 s, IMG_4409 0.3–4.8 s.
- Do not slow IMG_4913 3.75–4.4 s.
- Order: stabilise → minterpolate → crop/scale → LOOK → grain. Grain must never be interpolated.
- Cost: ~8 s of CPU per output second at 540p, roughly 2× that at 720p. This is fine offline.

## 7. Stabilisation

`vidstabdetect` / `vidstabtransform` **are available** in this ffmpeg 6.1.1 build. `deshake` is also present.

| Test | Jitter RMS before → after (px @720w) |
|---|---|
| IMG_4913 0–3.4 s, vidstab (shakiness=6, accuracy=15, smoothing=20, optzoom=1, bicubic) | 4.96 → **2.28** |
| IMG_4376 full, vidstab (same) | 4.98 → **2.89** |
| IMG_4913 0–3.4 s, deshake (rx/ry=32, mirror edges) | 4.96 → 7.25 (worse) |
| IMG_4376 full, deshake | 4.98 → 8.51 (worse) |

Recommendation: use **vidstab** (two-pass) for IMG_4913 and IMG_4376, and skip it for IMG_4374 and IMG_4409.
- `optzoom=1` adds a slight auto zoom (~3–5 %) with no black borders; see `grade-tests/stab_IMG_4376_orig-top_vidstab-bottom.jpg`.
- Run vidstab on the full upright frame **before** cropping, so it has margin to work with.

```bash
ffmpeg -i IN -an -vf "<pre>,vidstabdetect=shakiness=6:accuracy=15:result=clip.trf" -f null -
ffmpeg -i IN -an -vf "<pre>,vidstabtransform=input=clip.trf:smoothing=20:optzoom=1:interpol=bicubic,unsharp=5:5:0.4,..." OUT
```

## 8. Encode recommendations (web, muted autoplay, no audio)

Measured on graded masters:
- **Mobile:** IMG_4376 9:16 at 720×1280, 5.37 s.
- **Desktop:** triptych 1920×1080 (3 × 608×1080 panels from 4913/4376/4374), 4.2 s, grain 5.

| Variant | Settings | Mobile 720×1280 kbps (grain 3) | Est. size / 20 s mobile | Desktop 1920×1080 kbps | Est. size / 20 s desktop |
|---|---|---|---|---|---|
| **H.264 (baseline, must-have)** | `-c:v libx264 -profile:v high -preset slow -crf 23 -maxrate 2500k -bufsize 5000k -g 48 -pix_fmt yuv420p -movflags +faststart -an` (desktop: `-crf 25 -maxrate 3500k -bufsize 7000k`) | 1410 (grain 6: 2120; no grain: 1330) | **~3.5 MB** | 2930 (CRF 25) / 4480 (CRF 23) | **~7.3 MB** |
| **HEVC for Safari** | `-c:v libx265 -preset medium -crf 26 -x265-params vbv-maxrate=2000:vbv-bufsize=4000:keyint=48 -tag:v hvc1 -pix_fmt yuv420p -movflags +faststart -an` | 810 | ~2.0 MB | 2000 | ~5.0 MB |
| **VP9 webm** | `-c:v libvpx-vp9 -crf 34 -b:v 2000k -row-mt 1 -deadline good -cpu-used 2 -g 48 -pix_fmt yuv420p -an` (desktop `-b:v 4000k`) | 1070 | ~2.7 MB | 3100 | ~7.8 MB |
| **AV1 webm** | `-c:v libsvtav1 -preset 6 -crf 38 -g 48 -svtav1-params mbr=1800 -pix_fmt yuv420p -an` (desktop `mbr=3500`) | 600 | **~1.5 MB** | 1380 | **~3.4 MB** |

SSIM vs master (mobile, grain 3): H.264 0.952, HEVC 0.953, VP9 0.977, AV1 0.978. All four were visually indistinguishable on a 1:1 crop of the hoodie folds in the dark; HEVC smooths grain the most.

Recommendations:
- **`<source>` order:** AV1 webm (`video/webm; codecs=av01.0.05M.08` for 720×1280, `av01.0.08M.08` for 1080p) → HEVC mp4 (`video/mp4; codecs=hvc1`) → H.264 mp4 fallback. The `hvc1` tag is required for Safari to play HEVC in MP4.
- **Attributes:** `muted playsinline autoplay loop preload="metadata"` plus a `poster`.
- **Desktop:** CRF 25 H.264 keeps a 20 s film near 7 MB. AV1/HEVC halve that.
- **Mobile:** keep 720×1280 (the source resolution; do not upscale beyond it) and aim for ≤ 2.5 Mbps peak.
- **Keyframes:** a keyframe every 48 frames (1.6 s) gives clean looping and seek.
- **Delivery format:** always `yuv420p` 8-bit for delivery, `-an`, `+faststart`.
- **Grain:** keep baked grain at 3. Bigger grain multiplies the bitrate, so for more texture use an overlay in CSS instead.

## 9. Open issues

- No zipper close-up and no full-tracksuit footage exist (beats 2 and 5); these need stills.
- The **"S7" monogram** on the goggles/head wrap (IMG_4913 4.0–7.0 s, IMG_4374 throughout) is unidentified and could be a third-party mark. Keep it small or cropped. An unidentified sleeve-hem text appears at IMG_4913 ~4.5 s.
- All night clips contain fuel-brand signage and third-party vehicles. The crops above remove most of it, and the grade neutralises the colour, but not the shapes.
- The grade-test frames are single stills. The temporal behaviour of `hqdn3d` + grain should be checked on the first full render.
