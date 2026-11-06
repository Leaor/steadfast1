# STEADFAST hero edit (supplied footage)

**What this is.** An edit of the client's own iPhone footage and product/editorial photography. It is not a
commissioned or produced campaign film. Nothing was generated: no video generation, no generative fill, no
invented shots. Every frame comes from:

- 3 phone clips (`media/source/footage/IMG_4913`, `IMG_4374`, `IMG_4376`; `IMG_4409` is unused), graded,
  stabilised and slowed to exactly 0.5x with motion interpolation;
- 3 stills (`zip-hoodie-blue-grey-front.png`, `black-tracksuit-night.jpg`, `campaign-back-embossed-set.png`)
  with slow sub-pixel camera moves.

The only retouch is the one MEDIA already records for the campaign still (a small third-party mark on the
balaclava toned down by a diffusion fill). Every file carries the title tag "STEADFAST hero edit — supplied
footage". The edit follows `docs/FILM-STORYBOARD.md` Part A (A3 is the EDL; `edit-decision-list.json` holds the
same data).

## Files

| File | What | Size |
|---|---|---|
| `sf-film-desktop.mp4` | Intro, 12.8 s, 1920×1080, 30 fps. The 9:16 plates sit in a 608 px "aperture" in a pure #000 field; beat 7 opens to full frame. Ends on 0.4 s of black, no logo baked in | see `manifest.films.json` |
| `sf-film-mobile.mp4` | Intro, 12.8 s, 720×1280 | |
| `sf-film-loop-desktop.mp4` / `-mobile.mp4` | Loop, 5.6 s: IMG_4376 3.40–4.80 s at 0.5x, played forward then reversed (85 + 83 frames, no doubled frame at the turns) | |
| `sf-film-end-desktop-{960,1600,1920}.webp`, `-1600.jpg` | End still = loop frame 0, graded, no grain, no logo, black-point clamped | |
| `sf-film-end-mobile-{480,720}.webp`, `-720.jpg` | Same, 720×1280 plate | |
| `contact-sheet.jpg` | Middle frame of each shot, desktop over mobile | |

All video: H.264 High, yuv420p, BT.709-tagged, `+faststart`, 2 s GOP, no audio track, source metadata stripped
(including iPhone device and location data). Copies of the mp4s and end stills sit in `theme/assets/`
with the same names.

## Rebuild

```
python3 -I tools/media/build_film.py            # all stages, ~5 min on 4 cores
```
The grade is read at run time from `tools/media/grade.sh` (grade of record). Intermediate files go to
`$STEADFAST_FILM_WORK` (default: the system temp dir). CRF is searched from 23 to 28, and the lowest CRF that
fits the ARCHITECTURE §6.1 budget wins.

## Limits (honest)

- **Resolution.** The footage is 720×1280 phone video. Each 9:16 plate crops 367–518 px of width and is
  upscaled 1.4–2.0x, so the footage shots are soft next to the stills. The mobile files stay 720×1280; a
  1080×1920 render would only be a bigger upscale. On desktop the footage never fills the frame: it lives in the
  608 px aperture. Only the campaign still (native 4K) goes full frame.
- **Light and colour.** The source is phone HDR (HLG) at night and on an overcast day, tone-mapped to SDR. The
  cold near-monochrome grade makes the day and night clips match, but noise and compression in the source
  still show in the deep shadows (the light grain hides most of it).
- **Motion.** The 0.5x slow motion is interpolated (minterpolate, motion-compensated): half the frames are
  synthesised. On the shot that pans across the lettering (S3), checking it frame by frame shows no warping,
  but the fabric folds at the right edge can soften slightly at peak motion. The loop is a ping-pong, so its
  slow camera float reverses at the midpoint.
- **Content.** Third-party vehicles, fuel-station signage and an operator reflection exist in the sources.
  The crops and burns keep them out of frame (checked on every 0.5 s frame), and the "S7" goggle pattern is
  never legible. The striped headwear in the S6/loop shot shows no legible mark.
- **Not a campaign film.** A commissioned shoot (FILM-STORYBOARD Part B) can replace every file through the
  hero's theme settings without code changes.
