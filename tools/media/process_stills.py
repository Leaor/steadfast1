#!/usr/bin/env python3
"""STEADFAST still-image and logo pipeline (reproducible, idempotent).

Run from anywhere:
    python3 -I tools/media/process_stills.py            # everything
    python3 -I tools/media/process_stills.py logo stills # only some stages

Reads   media/source/photos/*  and two clips in media/source/footage/
Writes  media/processed/logo/      sf-logo-*, sf-favicon-*, sf-apple-touch-icon-180.png, sf-og-default.jpg
        media/processed/stills/    theme stills  ({base}-{width}.webp + one {base}-{w}.jpg), _contact-sheet.jpg
        media/processed/products/  fixture imagery ({handle}--{view}-{width}.webp + one JPG master)
        media/processed/frames/    selected video frames (tone-mapped PNG) + sharpness scores
        media/processed/_qa/       verification overlays (SVG trace check, back alignment check)
        media/processed/manifest.json  (merged: only keys/entries owned by this script are replaced)

Needs: Pillow, numpy, potracer (`import potrace`), ffmpeg with zscale. Optional: node + playwright
(chromium) for the browser render check of the traced SVG.

Rules applied (docs/BRIEF.md, docs/CONTEXT.md, docs/DESIGN.md §3.4/§5, docs/ARCHITECTURE.md §10):
- Product imagery is colour-true: crop, canvas extension on the photo's own black, exposure
  normalisation and export only. Editorial / lookbook / category / lifestyle-product imagery gets the
  DESIGN §5.4 grade, read from tools/media/grade.sh (the grade of record). Lifestyle crops burn third-party
  vehicles out at the frame edge (DESIGN §5.2/§5.3).
- Every still and product rendition is black-point clamped (luma <= 6 -> 0, smooth ramp to 12; DESIGN §5.3).
- After a run, `python3 -I tools/media/gen_asset_snippet.py` regenerates theme/snippets/sf-asset-data.liquid
  and copies the bundled files into theme/assets.
- No upscaling beyond 1.25x (1.5x for detail crops, the stated allowance). Widths a source can't
  support are dropped and listed in manifest `dropped_widths`.
- Nothing is invented: no generative fill. Retouches: toning down a third-party logo on the campaign balaclava
  (diffusion fill from the surrounding knit, ~40x28 px), the zip-hoodie hanger paint-out (HANGERS), and
  darkening only (never painting) of backgrounds: the night photo outside a traced figure matte, IMG_4376's
  pavement/foliage, and the campaign frame's own edges. All recorded in the manifest ops.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont, ImageOps
import PIL
import potrace

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "media/source/photos"
FOOT = ROOT / "media/source/footage"
OUT = ROOT / "media/processed"
D_LOGO, D_STILLS, D_PROD, D_FRAMES, D_QA = (OUT / d for d in ("logo", "stills", "products", "frames", "_qa"))
SCRIPT = "tools/media/process_stills.py"

WEBP_Q = 82
JPG_Q = 86
PRODUCT_WIDTHS = [1600, 1200, 800, 400]
MAX_UP = 1.25          # general upscale allowance
MAX_UP_DETAIL = 1.5    # ARCHITECTURE §10.1 allowance for detail crops

RECORDS: list[dict] = []        # every written file
DROPPED: list[dict] = []        # widths not produced
FIXTURES: list[dict] = []       # product fixture media for the preview harness
LOGO_INFO: dict = {}
FRAME_INFO: dict = {}
QA_INFO: dict = {}


# ----------------------------------------------------------------------------- helpers
def rel(p: Path) -> str:
    return str(Path(p).resolve().relative_to(ROOT))


def sha1(p: Path) -> str:
    return hashlib.sha1(Path(p).read_bytes()).hexdigest()


def load_srgb(path: Path) -> Image.Image:
    """Open an image and convert it to 8-bit sRGB (iPhone JPEGs carry Display P3)."""
    im = Image.open(path)
    icc = im.info.get("icc_profile")
    im = im.convert("RGB")
    if icc:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        dst = ImageCms.createProfile("sRGB")
        im = ImageCms.profileToProfile(im, src, dst, renderingIntent=ImageCms.Intent.PERCEPTUAL, outputMode="RGB")
    return im


def luminance(a: np.ndarray) -> np.ndarray:
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def border_color(im: Image.Image, box=None) -> tuple:
    a = np.asarray(im.crop(box) if box else im).astype(np.float32)
    b = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return tuple(int(round(v)) for v in np.median(b, 0))


def plate(im: Image.Image, box, fill=None, valid=None, feather=0) -> Image.Image:
    """Crop `box` (x0,y0,x1,y1, may exceed the image) from `im`.

    Pixels outside `valid` (default: the whole image) are the canvas `fill` colour (the photo's own
    background). With `feather` > 0, the photo fades into the fill over that many px on every side where
    fill shows, so the canvas extension has no seam."""
    x0, y0, x1, y1 = (int(round(v)) for v in box)
    W, H = x1 - x0, y1 - y0
    vx0, vy0, vx1, vy1 = valid if valid else (0, 0, im.width, im.height)
    if fill is None:
        fill = border_color(im, (vx0, vy0, vx1, vy1))
    canvas = Image.new("RGB", (W, H), fill)
    ix0, iy0, ix1, iy1 = max(x0, vx0), max(y0, vy0), min(x1, vx1), min(y1, vy1)
    region = im.crop((ix0, iy0, ix1, iy1))
    if feather <= 0:
        canvas.paste(region, (ix0 - x0, iy0 - y0))
        return canvas
    rw, rh = region.size
    xs = np.arange(rw, dtype=np.float32)
    ys = np.arange(rh, dtype=np.float32)
    mx = np.ones(rw, np.float32)
    my = np.ones(rh, np.float32)
    if ix0 > x0:
        mx = np.minimum(mx, smoothstep(0, feather, xs))
    if ix1 < x1:
        mx = np.minimum(mx, smoothstep(0, feather, (rw - 1) - xs))
    if iy0 > y0:
        my = np.minimum(my, smoothstep(0, feather, ys))
    if iy1 < y1:
        my = np.minimum(my, smoothstep(0, feather, (rh - 1) - ys))
    m = (my[:, None] * mx[None, :] * 255).astype(np.uint8)
    base = Image.new("RGB", region.size, fill)
    canvas.paste(Image.composite(region, base, Image.fromarray(m, "L")), (ix0 - x0, iy0 - y0))
    return canvas


def resize(im: Image.Image, w: int, sharpen=False) -> Image.Image:
    h = max(1, int(round(w * im.height / im.width)))
    if (w, h) == im.size:
        return im.copy()
    out = im.resize((w, h), Image.LANCZOS, reducing_gap=3.0 if w < im.width / 3 else None)
    if sharpen and w < im.width * 0.7:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=30, threshold=2))
    return out


def ffmpeg_filter(im: Image.Image, vf: str) -> Image.Image:
    """Run an ffmpeg filter chain on an RGB image (raw pipes, no temp files)."""
    w, h = im.size
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-sws_flags", "lanczos+accurate_rnd+full_chroma_int",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-i", "-",
           "-vf", vf + ",format=rgb24", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    out = subprocess.run(cmd, input=im.convert("RGB").tobytes(), capture_output=True, check=True).stdout
    return Image.frombytes("RGB", (w, h), out)


# DESIGN §5.4: tools/media/grade.sh is the single grade of record. Its LOOK, mono mixer and per-clip pre
# stages are read from the script itself (never copied), so film and stills can't drift apart.
GRADE_SH = ROOT / "tools/media/grade.sh"


def _grade_sh(expr: str) -> str:
    return subprocess.run(["bash", "-c", f'source "{GRADE_SH}"; {expr}'], capture_output=True, text=True,
                          check=True).stdout.strip()


_GRADE_CACHE: dict = {}


def grade_part(key: str) -> str:
    """'look', 'mono:<wr> <wg> <wb> <amount>', or 'pre:<clip id>' (the clip pre stage after its HLG tone-map,
    i.e. what applies to an already tone-mapped RGB frame)."""
    if key not in _GRADE_CACHE:
        if key == "look":
            v = _grade_sh('echo "$STEADFAST_LOOK"')
        elif key.startswith("mono:"):
            v = _grade_sh("steadfast_mono " + key[5:])
        elif key.startswith("pre:"):
            v = _grade_sh("steadfast_pre " + key[4:])
            v = v.split("format=yuv420p,", 1)[1] if "format=yuv420p," in v else v
        else:
            raise KeyError(key)
        _GRADE_CACHE[key] = v
    return _GRADE_CACHE[key]


# Still "pre" stages (DESIGN §5.4): flash stills get an exposure curve + mono mix and an extra vignette.
def pre_flash() -> str:
    return "curves=m='0/0 0.3/0.18 0.6/0.46 1/0.82'," + grade_part("mono:0.30 0.55 0.15 0.92")


def grade(im: Image.Image, pre: str, extra: str = "") -> Image.Image:
    """grade.sh chain on a single RGB frame: pre (gbrp) -> LOOK (yuv444p) [-> extra]. No grain on stills."""
    return ffmpeg_filter(im, "format=gbrp," + pre + ",format=yuv444p," + grade_part("look") + extra)


def grade_ops(name: str) -> list:
    return [f"grade.sh pre ({name}) + STEADFAST_LOOK (no grain)"]


def burn(im: Image.Image, f0: float, f1: float, side="right", floor=0.0) -> Image.Image:
    """Edge burn: multiply towards black past f0 (fraction of the width/height) reaching `floor` at f1.
    Used to remove third-party vehicles at the frame edge (DESIGN §5.2/§5.3, FILM S5's right burn)."""
    a = np.asarray(im).astype(np.float32)
    n = a.shape[1] if side in ("right", "left") else a.shape[0]
    t = np.arange(n, dtype=np.float32) / n
    if side in ("right", "bottom"):
        f = 1 - (1 - floor) * smoothstep(f0, f1, t)
    else:
        f = 1 - (1 - floor) * (1 - smoothstep(f0, f1, t))
    f = f[None, :, None] if side in ("right", "left") else f[:, None, None]
    return Image.fromarray(np.clip(a * f + 0.5, 0, 255).astype(np.uint8))


# DESIGN §5.3 binding black-point clamp: luma <= 6 -> 0 with a smooth ramp to luma 12. rgb *= w(Y) with
# w = smoothstep(6, 12, Y): continuous, monotonic (t' = w + Y w' >= 0), slope 1 at 12, hue preserved.
CLAMP_LO, CLAMP_HI = 6.0, 12.0
CLAMP_OP = "black-point clamp luma<=6 -> 0, smooth ramp to 12"


def black_clamp(im: Image.Image) -> Image.Image:
    if im.mode != "RGB":
        return im
    a = np.asarray(im).astype(np.float32)
    w = smoothstep(CLAMP_LO, CLAMP_HI, luminance(a))
    return Image.fromarray(np.clip(a * w[..., None] + 0.5, 0, 255).astype(np.uint8))


def black_knee(im: Image.Image, lo: float, hi: float) -> Image.Image:
    """Stronger black point for lifted (JPEG/phone) blacks: rgb *= smoothstep(lo, hi, Y). Hue preserved."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    w = smoothstep(lo, hi, luminance(a))
    return Image.fromarray(np.clip(a * w[..., None] + 0.5, 0, 255).astype(np.uint8))


def plate_edge_delta(im: Image.Image, band=6) -> dict:
    """Mean luma of the outer `band` px on each side (the fill is #000, so this is the edge-to-fill delta)."""
    Y = luminance(np.asarray(im).astype(np.float32))
    return {"top": round(float(Y[:band].mean()), 2), "bottom": round(float(Y[-band:].mean()), 2),
            "left": round(float(Y[:, :band].mean()), 2), "right": round(float(Y[:, -band:].mean()), 2),
            "max_px_row_mean": round(float(max(Y[:band].mean(1).max(), Y[-band:].mean(1).max(),
                                                Y[:, :band].mean(0).max(), Y[:, -band:].mean(0).max())), 2)}


def record(path: Path, *, group, base, purpose, source, crop=None, ops=(), notes="", theme_asset=False,
           extra=None):
    if path.suffix == ".svg":
        w = h = None
        fmt = "svg"
    else:
        im = Image.open(path)
        w, h, fmt = im.width, im.height, im.format.lower()
    r = {
        "path": rel(path), "file": path.name, "group": group, "base": base,
        "width": w, "height": h, "bytes": path.stat().st_size, "sha1": sha1(path),
        "format": fmt, "source": source, "purpose": purpose,
        "crop": crop, "ops": list(ops), "notes": notes, "theme_asset": theme_asset,
        "owner": SCRIPT,
    }
    if extra:
        r.update(extra)
    RECORDS.append(r)
    return r


def crop_dict(box, src_size):
    x0, y0, x1, y1 = (int(round(v)) for v in box)
    W, H = src_size
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
            "frac": [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)],
            "extends_beyond_source": x0 < 0 or y0 < 0 or x1 > W or y1 > H}


def plan_widths(native_w, widths, max_up, quality_cap=None, add_cap=False):
    limit = native_w * max_up
    if quality_cap:
        limit = min(limit, quality_cap)
    ok = sorted({w for w in widths if w <= limit + 0.5})
    dropped = sorted({w for w in widths if w > limit + 0.5})
    if add_cap and dropped:
        cap = int(limit) // 2 * 2
        if not ok or cap >= ok[-1] * 1.15:
            ok.append(cap)
    return ok, dropped, limit


def emit(img: Image.Image, folder: Path, base: str, widths, jpg_width, *, group, purpose, source, crop,
         ops=(), notes="", max_up=MAX_UP, quality_cap=None, add_cap=False, sharpen=False, theme_asset=False,
         fixture=None, clamp=True):
    """Write WebP at each allowed width plus one JPG. Returns {width: path}.

    `clamp` (default on): DESIGN §5.3's black-point clamp on every rendition (all stills and product images
    here sit on the page's #000). `fixture` = (handle, view[, kind]) with kind 'studio' (default) or
    'lifestyle' (DESIGN §5.3: graded, never the first gallery image)."""
    folder.mkdir(parents=True, exist_ok=True)
    ok, dropped, limit = plan_widths(img.width, widths, max_up, quality_cap, add_cap)
    for w in dropped:
        DROPPED.append({"base": base, "width": w, "native_width": img.width,
                        "max_width_allowed": int(limit), "owner": SCRIPT,
                        "reason": f"source supports at most {int(limit)} px wide "
                                  f"({'quality cap' if quality_cap and quality_cap <= img.width * max_up else f'{max_up}x upscale limit'})"})
    if jpg_width == "max" or jpg_width not in ok:
        cands = [w for w in ok if jpg_width == "max" or w <= jpg_width]
        jw = max(cands) if cands else max(ok)
    else:
        jw = jpg_width
    paths = {}
    for w in ok:
        r = resize(img, w, sharpen)
        scale = round(w / img.width, 4)
        o = list(ops) + [f"resize lanczos x{scale}"] + (["unsharp 0.6/30"] if sharpen and scale < 0.7 else [])
        if clamp and r.mode == "RGB":
            r = black_clamp(r)
            o.append(CLAMP_OP)
        p = folder / f"{base}-{w}.webp"
        r.save(p, "WEBP", quality=WEBP_Q, method=6)
        rec = record(p, group=group, base=base, purpose=purpose, source=source, crop=crop, ops=o, notes=notes,
                     theme_asset=theme_asset, extra={"scale": scale, "upscaled": scale > 1.0})
        paths[w] = p
        if w == jw:
            pj = folder / f"{base}-{w}.jpg"
            r.save(pj, "JPEG", quality=JPG_Q, optimize=True, progressive=True)
            record(pj, group=group, base=base, purpose=purpose + " (JPG fallback/master)", source=source,
                   crop=crop, ops=o, notes=notes, theme_asset=theme_asset, extra={"scale": scale, "upscaled": scale > 1.0})
            paths[f"jpg{w}"] = pj
        if fixture:
            FIXTURES.append({"file": rel(p), "handle": fixture[0], "view": fixture[1], "width": r.width,
                             "height": r.height, "format": "webp", "source": source, "owner": SCRIPT,
                             "kind": fixture[2] if len(fixture) > 2 else "studio"})
    if fixture:
        pj = paths[f"jpg{jw}"]
        FIXTURES.append({"file": rel(pj), "handle": fixture[0], "view": fixture[1], "width": jw,
                         "height": Image.open(pj).height, "format": "jpg", "source": source, "owner": SCRIPT,
                         "kind": fixture[2] if len(fixture) > 2 else "studio"})
    return paths


def clean(folder: Path):
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True, exist_ok=True)


# ----------------------------------------------------------------------------- 1. logo
def min_filter(m: Image.Image, k):
    return m.filter(ImageFilter.MinFilter(k))


def svg_path_from_potrace(plist, fx, fy, nd=1):
    """Potrace curves -> compact relative SVG path data. Absolute positions are rounded first and the
    deltas taken between rounded points, so rounding never accumulates. fx/fy map bitmap -> viewBox coords."""
    q = 10 ** nd

    def R(pt):
        return (round(fx(pt.x) * q), round(fy(pt.y) * q))

    def num(v):
        s_ = f"{v / q:.{nd}f}".rstrip("0").rstrip(".")
        s_ = "0" if s_ in ("-0", "") else s_
        return s_

    def pair(p, o):
        return num(p[0] - o[0]) + " " + num(p[1] - o[1])

    parts = []
    for curve in plist:
        cur = R(curve.start_point)
        parts.append("M" + num(cur[0]) + " " + num(cur[1]))
        last = None
        for seg in curve.segments:
            if seg.is_corner:
                c, e = R(seg.c), R(seg.end_point)
                parts.append(("l" if last != "l" else " ") + pair(c, cur) + " " + pair(e, c))
                last, cur = "l", e
            else:
                c1, c2, e = R(seg.c1), R(seg.c2), R(seg.end_point)
                parts.append(("c" if last != "c" else " ") + pair(c1, cur) + " " + pair(c2, cur) + " " + pair(e, cur))
                last, cur = "c", e
        parts.append("z")
    d = "".join(parts)
    return re.sub(r" -", "-", d)


def parse_path(d: str):
    """Parser for the M/m L/l C/c Z/z path data this script writes (implicit command repetition allowed).
    Returns subpaths with absolute coordinates."""
    toks = re.findall(r"[MmLlCcZz]|-?\d*\.?\d+", d)
    subs, i, cur, cmd, pos = [], 0, None, None, (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in "MmLlCcZz":
            cmd = t
            i += 1
            if t in "Zz":
                if cur:
                    pos = cur["start"]
                continue
        k = 2 if cmd in "MmLl" else 6
        v = [float(x) for x in toks[i:i + k]]
        i += k
        rel_ = cmd.islower()
        pts = [(v[j] + (pos[0] if rel_ else 0), v[j + 1] + (pos[1] if rel_ else 0)) for j in range(0, k, 2)]
        if cmd in "Mm":
            cur = {"start": pts[0], "segs": []}
            subs.append(cur)
            pos = pts[0]
            cmd = "l" if rel_ else "L"
        elif cmd in "Ll":
            cur["segs"].append(("L", pts[0]))
            pos = pts[0]
        else:
            cur["segs"].append(("C", pts[0], pts[1], pts[2]))
            pos = pts[2]
    return subs


def rasterize_path(d: str, scale: float, size, offset=(0.0, 0.0), ss=4) -> np.ndarray:
    """Even-odd fill of the path, anti-aliased by supersampling. Returns float alpha 0..1 of `size`."""
    W, H = size
    acc = np.zeros((H * ss, W * ss), bool)
    k = scale * ss
    for sp in parse_path(d):
        pts = [sp["start"]]
        p0 = sp["start"]
        for seg in sp["segs"]:
            if seg[0] == "L":
                pts.append(seg[1]); p0 = seg[1]
            else:
                _, c1, c2, p = seg
                for t in np.linspace(0, 1, 17)[1:]:
                    mt = 1 - t
                    pts.append((mt**3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t**3 * p[0],
                                mt**3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t**3 * p[1]))
                p0 = p
        img = Image.new("1", (W * ss, H * ss), 0)
        ImageDraw.Draw(img).polygon([((x + offset[0]) * k, (y + offset[1]) * k) for x, y in pts], fill=1)
        acc ^= np.asarray(img, bool)
    a = Image.fromarray(acc.astype(np.uint8) * 255).resize((W, H), Image.BOX)
    return np.asarray(a).astype(np.float32) / 255


def chromium_render_svg(svg_path: Path, width_px: int, out_png: Path):
    """Render the SVG file in headless Chromium (Playwright) at a given CSS width, cream on black."""
    node = shutil.which("node")
    if not node:
        return None
    js = r"""
const { chromium } = require('playwright');
(async () => {
  const [svgFile, width, out] = process.argv.slice(2);
  const svg = require('fs').readFileSync(svgFile, 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:#000">
    <div id="w" style="width:${width}px;color:#fff;line-height:0">${svg}</div></body></html>`);
  await p.addStyleTag({ content: '#w svg{display:block;width:100%;height:auto}' });
  const el = await p.$('#w svg');
  await el.screenshot({ path: out, omitBackground: false });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
"""
    with tempfile.NamedTemporaryFile("w", suffix=".cjs", delete=False, dir=D_QA) as f:
        f.write(js)
        jsf = f.name
    try:
        r = subprocess.run([node, jsf, str(svg_path), str(width_px), str(out_png)], capture_output=True, text=True,
                           timeout=120)
        if r.returncode != 0:
            return {"error": r.stderr.strip()[-400:]}
        return {"ok": True}
    except Exception as e:  # pragma: no cover
        return {"error": str(e)}
    finally:
        os.unlink(jsf)


def stage_logo():
    clean(D_LOGO)
    D_QA.mkdir(parents=True, exist_ok=True)
    srcp = SRC / "steadfast-wordmark.png"
    src = Image.open(srcp).convert("RGB")
    a = np.asarray(src).astype(np.float32)
    L = luminance(a)
    Limg = Image.fromarray(np.clip(L, 0, 255).astype(np.uint8))

    # Letter cores: a 3x3 minimum filter kills the 1-2 px streak hatching, the solid strokes survive.
    core = np.asarray(min_filter(Limg, 3)) > 200
    cream = tuple(int(v) for v in np.median(a[core], 0))
    bp = float(np.percentile(L[:250], 99.5))           # background black point (pure-black rows above the art)
    Lc = float(np.percentile(L[core], 25))             # letter body level (alpha 1 from here up)

    # ---- (a) textured transparent wordmark: alpha from luminance against the black, colour = cream
    alpha = np.clip((L - bp) / (Lc - bp), 0, 1)
    sig = alpha > 0.04
    cols = np.where(sig.sum(0) >= 3)[0]
    rows = np.where(sig.sum(1) >= 3)[0]
    pad = 16
    tb = (int(cols.min()) - pad, int(rows.min()) - pad, int(cols.max()) + 1 + pad, int(rows.max()) + 1 + pad)
    al = alpha[tb[1]:tb[3], tb[0]:tb[2]]
    TW, TH = tb[2] - tb[0], tb[3] - tb[1]

    def textured(w):
        h = int(round(w * TH / TW))
        A = Image.fromarray(al.astype(np.float32), "F").resize((w, h), Image.LANCZOS)
        A = Image.fromarray(np.clip(np.asarray(A) * 255 + 0.5, 0, 255).astype(np.uint8), "L")
        im = Image.new("RGBA", (w, h), cream + (0,))
        im.putalpha(A)
        return im

    tex_ops = [f"alpha=clip((luma-{bp:.1f})/({Lc:.1f}-{bp:.1f}),0,1)", f"rgb=cream {'#%02X%02X%02X' % cream}",
               f"tight crop to alpha>0.04 + {pad}px pad"]
    tex_crop = crop_dict(tb, src.size)
    # DESIGN §3.4: renditions above 1.5x the native box are dropped (2000/2400 were 1.65-2x upscales);
    # 1800 (x1.49) is kept and recorded as upscaled. 1600 is not needed by any caller.
    for w in (1600, 2000, 2400):
        if w > TW * 1.5 or w == 1600:
            DROPPED.append({"base": "sf-logo-textured", "width": w, "native_width": TW, "max_width_allowed": int(TW * 1.5),
                            "owner": SCRIPT, "reason": ("over the 1.5x upscale limit (DESIGN §3.4)" if w > TW * 1.5
                                                        else "not used: theme set is 600/800/1000/1200/1800 (DESIGN §3.4, PERF-04)")})
    # PERF-04: 800 and 1000 fill the gap between 600 and 1200 (desktop 1440 needs ~634 CSS px -> the 800;
    # iPhone DPR 3 needs ~984 -> the 1000), so the hero no longer pulls the 1200 (106 KB) by default.
    for w in [400, 600, 800, 1000, 1200, 1800]:
        im = textured(w)
        scale = round(w / TW, 4)
        note = (f"upscaled x{scale} from the {TW}px source crop: the hatch texture softens; prefer <= 1200 for "
                f"crisp texture") if scale > 1.0 else ""
        p = D_LOGO / f"sf-logo-textured-{w}.webp"
        im.save(p, "WEBP", quality=90, alpha_quality=60, method=4)  # PERF-04: aq 60 halves the bytes; visually identical on black
        record(p, group="logo", base="sf-logo-textured", purpose="Textured transparent wordmark (hero, brand story)",
               source=rel(srcp), crop=tex_crop, ops=tex_ops + [f"resize lanczos x{scale}"], notes=note,
               theme_asset=w in (600, 800, 1000, 1200, 1800), extra={"scale": scale, "upscaled": scale > 1})
        if w in (400, 800, 1200):
            p = D_LOGO / f"sf-logo-textured-{w}.png"
            im.save(p, "PNG", optimize=True)
            record(p, group="logo", base="sf-logo-textured", purpose="Textured transparent wordmark, PNG fallback",
                   source=rel(srcp), crop=tex_crop, ops=tex_ops + [f"resize lanczos x{scale}"], notes=note,
                   theme_asset=w == 1200, extra={"scale": scale, "upscaled": scale > 1})

    # ---- (b) clean traced SVG of the letterforms only
    U = 4
    rb = (int(cols.min()) - 4, int(rows.min()) - 4, int(cols.max()) + 5, int(rows.max()) + 5)  # work region
    reg = Limg.crop(rb)
    coreR = np.asarray(min_filter(reg, 3)) > 200
    up = np.asarray(reg.resize((reg.width * U, reg.height * U), Image.BICUBIC)).astype(np.float32)
    mid = (bp + Lc) / 2                                        # the anti-aliased edge sits at half level
    allowed = up > mid
    m = np.asarray(Image.fromarray(coreR.astype(np.uint8) * 255).resize((reg.width * U, reg.height * U),
                                                                        Image.NEAREST)) > 0
    m &= allowed
    mi = Image.fromarray(m.astype(np.uint8) * 255)
    GROW = 6  # geodesic growth (1.5 source px) from the cores out to the half-level edge, not into streaks
    for _ in range(GROW):
        mi = Image.fromarray(((np.asarray(mi.filter(ImageFilter.MaxFilter(3))) > 0) & allowed).astype(np.uint8) * 255)
    mask = np.asarray(mi) > 0
    # 1 source-px blur + re-threshold: removes the 4x staircase/edge roughness so the path stays < 15 KB
    tmask = np.asarray(mi.filter(ImageFilter.GaussianBlur(4.0))) > 127
    ys, xs = np.where(mask)
    # letter box in source px (fractional, from the 4x mask)
    lx0, ly0 = rb[0] + xs.min() / U, rb[1] + ys.min() / U
    lx1, ly1 = rb[0] + (xs.max() + 1) / U, rb[1] + (ys.max() + 1) / U
    VW, VH = round(lx1 - lx0, 2), round(ly1 - ly0, 2)
    bm = potrace.Bitmap(~tmask)   # potracer fills False (dark) pixels
    plist = bm.trace(turdsize=400, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0,
                     opticurve=True, opttolerance=1.0)
    d = svg_path_from_potrace(plist, lambda x: rb[0] + x / U - lx0, lambda y: rb[1] + y / U - ly0, nd=1)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW:g} {VH:g}" fill="currentColor" '
           f'aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="{d}"/></svg>\n')
    svgp = D_LOGO / "sf-logo-wordmark.svg"
    svgp.write_text(svg)
    letter_box = (lx0, ly0, lx1, ly1)

    # verification 1: rasterize the written path data (independent parser) vs the source letter mask
    S2 = 2
    ref = Image.fromarray(mask.astype(np.uint8) * 255).resize((int(round(reg.width * S2)), int(round(reg.height * S2))),
                                                             Image.BOX)
    ref = np.asarray(ref).astype(np.float32) / 255
    off = (lx0 - rb[0], ly0 - rb[1])
    ras = rasterize_path(d, S2, (ref.shape[1], ref.shape[0]), offset=off)
    A_, B_ = ras > 0.5, ref > 0.5
    iou_mask = float((A_ & B_).sum() / (A_ | B_).sum())
    # vs. the raw source at half level inside the letter box (includes any streak pixels touching letters)
    raw = np.asarray(Limg.crop(rb).resize((ref.shape[1], ref.shape[0]), Image.BICUBIC)).astype(np.float32) > mid
    near = np.asarray(Image.fromarray(B_.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    raw &= near
    iou_raw = float((A_ & raw).sum() / (A_ | raw).sum())
    ov = np.zeros(ref.shape + (3,), np.uint8)
    ov[B_ & A_] = (235, 228, 214)
    ov[A_ & ~B_] = (255, 40, 40)
    ov[B_ & ~A_] = (40, 220, 255)
    Image.fromarray(ov).save(D_QA / "svg-trace-vs-source.png")

    # verification 2: the SVG file rendered by Chromium, compared with the source letters
    chrome = None
    cw = int(round(VW * S2))
    cpng = D_QA / "svg-chromium-render.png"
    res = chromium_render_svg(svgp, cw, cpng)
    if res and res.get("ok"):
        cr = np.asarray(Image.open(cpng).convert("L")).astype(np.float32) / 255
        refl = np.asarray(Image.fromarray((B_ * 255).astype(np.uint8)).crop(
            (int(round(off[0] * S2)), int(round(off[1] * S2)), int(round(off[0] * S2)) + cr.shape[1],
             int(round(off[1] * S2)) + cr.shape[0]))) > 127
        C_ = cr > 0.5
        hh, ww = min(C_.shape[0], refl.shape[0]), min(C_.shape[1], refl.shape[1])
        C_, refl = C_[:hh, :ww], refl[:hh, :ww]
        chrome = {"iou_vs_source_letters": round(float((C_ & refl).sum() / (C_ | refl).sum()), 4),
                  "render_px": [int(cr.shape[1]), int(cr.shape[0])]}
        o2 = np.zeros((hh, ww, 3), np.uint8)
        o2[C_ & refl] = (235, 228, 214); o2[C_ & ~refl] = (255, 40, 40); o2[refl & ~C_] = (40, 220, 255)
        Image.fromarray(o2).save(D_QA / "svg-chromium-vs-source.png")
    elif res:
        chrome = res
    record(svgp, group="logo", base="sf-logo-wordmark", purpose="Traced letterforms (header, footer, < 200px)",
           source=rel(srcp), crop=crop_dict(letter_box, src.size),
           ops=["luma min3>200 cores", f"4x bicubic, geodesic grow {GROW}px within luma>{mid:.0f} (half level)",
                "gaussian 1px + rethreshold", "potrace turdsize=400 alphamax=1.0 opttolerance=1.0 (4x units)", "fill=currentColor, evenodd"],
           notes="Trace of the artwork, not a redraw; streaks dropped.", theme_asset=True)
    RECORDS[-1].update({"width": VW, "height": VH, "format": "svg"})

    # ---- (b2) streak-only raster for the Section F layered lockup (DESIGN §3.4): the textured alpha with the
    # letters knocked out under the traced SVG letter mask dilated 1px, same 1210x411 box. The inline SVG
    # letters sit on top at left 4.5% / top 32.48% / width 92.15% / height 37.47%.
    loff = (lx0 - tb[0], ly0 - tb[1])
    for w in (1200, 1800):
        k = w / TW
        h = int(round(w * TH / TW))
        letters_a = rasterize_path(d, k, (w, h), offset=loff)
        dil = Image.fromarray(np.clip(letters_a * 255 + 0.5, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
        knock = np.asarray(dil).astype(np.float32) / 255
        base_im = textured(w)
        A = np.asarray(base_im.getchannel("A")).astype(np.float32) * (1 - knock)
        im = Image.new("RGBA", (w, h), cream + (0,))
        im.putalpha(Image.fromarray(np.clip(A + 0.5, 0, 255).astype(np.uint8), "L"))
        scale = round(w / TW, 4)
        p = D_LOGO / f"sf-logo-streaks-{w}.webp"
        im.save(p, "WEBP", quality=90, alpha_quality=60, method=4)  # PERF-04: aq 60 halves the bytes; visually identical on black
        record(p, group="logo", base="sf-logo-streaks", purpose="Streak-only raster (Section F layered lockup, >= 990px)",
               source=rel(srcp), crop=tex_crop,
               ops=tex_ops + ["letters knocked out: traced SVG mask, dilated 1px (MaxFilter 3)", f"resize lanczos x{scale}"],
               notes=("upscaled x%s from the %dpx source crop" % (scale, TW)) if scale > 1 else "",
               theme_asset=True, extra={"scale": scale, "upscaled": scale > 1})

    # ---- (c) favicons from the first letter S (artwork pixels; the 512 from the trace to avoid upscaling)
    letter_alpha = np.clip((L - bp) / (Lc - bp), 0, 1)
    full_mask = np.zeros(L.shape, bool)
    mdown = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((reg.width, reg.height), Image.BOX)) > 40
    full_mask[rb[1]:rb[3], rb[0]:rb[2]] = mdown
    gate = np.asarray(Image.fromarray(full_mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))
                      .filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    letters = letter_alpha * gate
    colsum = full_mask.sum(0)
    sx0 = int(np.argmax(colsum > 0))
    sx1 = sx0 + int(np.argmax(colsum[sx0:] == 0))           # first empty column after S = the S/T gap
    srows = np.where(full_mask[:, sx0:sx1].any(1))[0]
    sy0, sy1 = int(srows.min()), int(srows.max()) + 1
    s_alpha = letters[sy0:sy1, sx0:sx1]
    sh, sw = s_alpha.shape
    fill_ratio = 0.78
    fav_ops = ["S isolated from the letter mask (no streaks)", f"S height = {fill_ratio:.0%} of the square",
               f"cream {'#%02X%02X%02X' % cream} on #000000"]
    for size in (32, 180, 512):
        side_src = sh / fill_ratio
        if size <= 64:         # small: downscale the artwork pixels
            side = int(math.ceil(side_src))
            canvas = np.zeros((side, side), np.float32)
            oy, ox = (side - sh) // 2, (side - sw) // 2
            canvas[oy:oy + sh, ox:ox + sw] = s_alpha
            A = Image.fromarray(canvas, "F").resize((size, size), Image.LANCZOS)
            A = np.clip(np.asarray(A), 0, 1)
            how = "artwork pixels, downscaled"
        else:                  # render the traced S (vector): same letterform, no streak residue or upscaling blur
            k = size * fill_ratio / sh
            offx = -(sx0 - lx0) + (size / k - sw) / 2
            A = rasterize_path(d, k, (size, size), offset=(offx, -(sy0 - ly0) + (size / k - sh) / 2))
            A[:, int(math.ceil((sx1 - lx0 + offx) * k)) + 1:] = 0     # keep the S only (T starts after the gap)
            how = "traced S rendered at size (vector trace of the artwork S, source S is %dpx tall)" % sh
        rgb = np.zeros((size, size, 3), np.float32) + np.array(cream, np.float32) * A[..., None]
        im = Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), "RGB")
        names = [f"sf-favicon-{size}.png"] + (["sf-apple-touch-icon-180.png"] if size == 180 else [])
        for n in names:
            p = D_LOGO / n
            im.save(p, "PNG", optimize=True)
            record(p, group="logo", base=n[:-4], purpose="Favicon / touch icon (first letter S)", source=rel(srcp),
                   crop=crop_dict((sx0, sy0, sx1, sy1), src.size), ops=fav_ops + [how], theme_asset=True)

    # ---- OG default image 1200x630: textured wordmark on black
    og = Image.new("RGB", (1200, 630), (0, 0, 0))
    lw = 840
    t = textured(lw)
    og.paste(t, ((1200 - t.width) // 2, (630 - t.height) // 2), t)
    p = D_LOGO / "sf-og-default.jpg"
    og.save(p, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
    record(p, group="logo", base="sf-og-default", purpose="Default social share image", source=rel(srcp),
           crop=tex_crop, ops=[f"textured wordmark {lw}px wide centred on #000"], theme_asset=True)

    LOGO_INFO.update({
        "source": rel(srcp), "source_size": list(src.size),
        "cream_rgb": list(cream), "cream_hex": "#%02X%02X%02X" % cream,
        "background_black_point_luma": round(bp, 2), "letter_body_luma": round(Lc, 2),
        "letter_box_source_px": [round(v, 2) for v in letter_box],
        "letter_aspect_ratio": round((lx1 - lx0) / (ly1 - ly0), 4),
        "textured_box_source_px": list(tb), "textured_aspect_ratio": round(TW / TH, 4),
        "textured_native_size": [TW, TH],
        "letter_box_within_textured_frac": [round((lx0 - tb[0]) / TW, 4), round((ly0 - tb[1]) / TH, 4),
                                            round((lx1 - tb[0]) / TW, 4), round((ly1 - tb[1]) / TH, 4)],
        "svg_viewbox": [0, 0, VW, VH], "svg_bytes": svgp.stat().st_size, "svg_subpaths": len(plist),
        "theme_renditions": {"textured_webp": [600, 1200, 1800], "textured_png": [1200], "streaks_webp": [1200, 1800],
                             "max_upscale": 1.5},
        "svg_check": {"iou_vs_trace_input_mask": round(iou_mask, 4),
                      "iou_vs_raw_source_half_level_near_letters": round(iou_raw, 4),
                      "chromium": chrome,
                      "overlays": [rel(D_QA / "svg-trace-vs-source.png")] +
                                  ([rel(D_QA / "svg-chromium-vs-source.png")] if chrome and "iou_vs_source_letters" in chrome else [])},
        "favicon_letter_box_source_px": [sx0, sy0, sx1, sy1],
        "note": ("The textured raster and the SVG have different boxes: the textured one includes the streaks "
                 "(+16px pad), the SVG is tight to the letters. letter_box_within_textured_frac locates the "
                 "letters inside the textured image for alignment (e.g. a FLIP between the two)."),
    })


# ----------------------------------------------------------------------------- 2-4. photos
def darken_surround(im: Image.Image, cx, cy, rx, ry, strength=0.55, crush=5.0) -> Image.Image:
    """Lifestyle clean-up: keep the subject untouched, darken the surroundings with a soft elliptical falloff."""
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dd = np.sqrt(((xx / W - cx) / rx) ** 2 + ((yy / H - cy) / ry) ** 2)
    f = 1 - strength * smoothstep(1.0, 1.9, dd)
    a = a * f[..., None]
    a = np.clip((a - crush) / (255 - crush) * 255, 0, 255)
    return Image.fromarray((a + 0.5).astype(np.uint8))


def retouch_balaclava_logo(im: Image.Image):
    """Tone down the small third-party logo on the campaign balaclava: diffusion fill from the knit around it."""
    box = (2022, 364, 2066, 394)
    a = np.asarray(im).astype(np.float32).copy()
    reg = a[box[1]:box[3], box[0]:box[2]]
    Lr = luminance(reg)
    base = float(np.median(Lr))
    m = Lr > base + 22
    mI = Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))
    m = np.asarray(mI) > 0
    m[[0, -1], :] = False
    m[:, [0, -1]] = False
    fillv = reg.copy()
    fillv[m] = np.median(reg[~m], 0)
    for _ in range(400):
        nb = (np.roll(fillv, 1, 0) + np.roll(fillv, -1, 0) + np.roll(fillv, 1, 1) + np.roll(fillv, -1, 1)) / 4
        fillv[m] = nb[m]
    # keep a trace of the knit texture: add back high-frequency of the original darkened strongly
    reg_out = reg.copy()
    reg_out[m] = fillv[m]
    a[box[1]:box[3], box[0]:box[2]] = reg_out
    info = {"box": list(box), "pixels_changed": int(m.sum()), "method": "diffusion fill from surrounding knit"}
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)), info



# ----------------------------------------------------------------------------- zip-hoodie hanger retouch
# CD-01: the white lattice hanger in the zip-hoodie stills was the focal point of the signature detail
# frames and film S2 ("a stockroom photo, not a figure in a black room"). It is a prop, not part of the
# garment, so it is painted out: the lattice AND its holes inside a hand-traced polygon (source pixels),
# limited to neutral/dark pixels so the blue-grey fabric is never touched, filled by diffusion from the
# surrounding hood interior / background (Laplace fill), with grain matched to the surround and a 6px
# feathered, anti-aliased seam. Nothing about the garment is invented: only a hanger becomes shadow.
HANGERS = {
    # file: [(name, polygon in source px, boundary)]  boundary 'dark' = fill from the black background only
    "zip-hoodie-blue-grey-front.png": [
        ("front hood cavity", [(1250, 322), (1288, 290), (1305, 278), (1330, 289), (1355, 280), (1370, 275), (1395, 282),
                               (1430, 281), (1445, 278), (1495, 316), (1499, 325), (1480, 386), (1462, 386), (1440, 350),
                               (1400, 306), (1370, 297), (1330, 312), (1292, 352), (1277, 386), (1259, 386), (1253, 340)], "all"),
    ],
    "zip-hoodie-blue-grey-front-back.png": [
        ("front view, neck opening", [(697, 226), (712, 236), (722, 252), (733, 260), (812, 315), (815, 323), (802, 348),
                                      (788, 378), (768, 381), (770, 366), (702, 303), (697, 302), (630, 372), (612, 384),
                                      (596, 381), (586, 330), (584, 321)], "all"),
        ("back view, above the hood", [(2056, 222), (2064, 224), (2074, 236), (2082, 250), (2090, 260), (2100, 262),
                                       (2165, 318), (2160, 328), (2125, 342), (2090, 346), (2020, 347), (1985, 346),
                                       (1950, 336), (1940, 324)], "dark"),
    ],
}


def _gray_blur(ch: np.ndarray, r: float) -> np.ndarray:
    return np.asarray(Image.fromarray(np.clip(ch, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)


def remove_hanger(im: Image.Image, poly, boundary="all", *, chroma_max=13, hole_luma=48, grow=2, feather=6, seed=7):
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    pad = feather + grow + 4
    x0, y0 = max(0, min(xs) - pad), max(0, min(ys) - pad)
    x1, y1 = min(W, max(xs) + pad), min(H, max(ys) + pad)
    r = a[y0:y1, x0:x1].copy()
    pm = Image.new("L", (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(pm).polygon([(x - x0, y - y0) for x, y in poly], fill=255)
    pm = np.asarray(pm) > 0
    Y = luminance(r)
    blue, green = r[..., 2] - r[..., 0], r[..., 1] - r[..., 0]
    neutral = (blue < chroma_max) & (green < chroma_max)          # the hanger is neutral grey; the fabric is blue
    m = pm & (neutral | (Y < hole_luma))                           # lattice + its holes / outline
    mi = Image.fromarray((m * 255).astype(np.uint8))
    for _ in range(grow):
        mi = mi.filter(ImageFilter.MaxFilter(3))
    m = m | ((np.asarray(mi) > 0) & ((blue < chroma_max + 8) | (Y < hole_luma)))
    allowed = ~m if boundary == "all" else (~m) & (Y < 22)
    v = r.copy()
    v[m] = np.median(r[allowed], 0)
    src = allowed | m
    wu, wd = np.roll(src, 1, 0).astype(np.float32), np.roll(src, -1, 0).astype(np.float32)
    wl, wr = np.roll(src, 1, 1).astype(np.float32), np.roll(src, -1, 1).astype(np.float32)
    n = (wu + wd + wl + wr)[..., None]
    for _ in range(1500):                                          # Jacobi iterations of the Laplace fill
        s_ = (np.roll(v, 1, 0) * wu[..., None] + np.roll(v, -1, 0) * wd[..., None]
              + np.roll(v, 1, 1) * wl[..., None] + np.roll(v, -1, 1) * wr[..., None])
        nv = np.where(n > 0, s_ / np.maximum(n, 1), v)
        v[m] = nv[m]
    # grain matched to the surround (high-pass std in a 4px ring), scaled down in the shadows
    mI = Image.fromarray((m * 255).astype(np.uint8))
    ring = (np.asarray(mI.filter(ImageFilter.MaxFilter(9))) > 0) & ~m
    hp = r - np.stack([_gray_blur(r[..., c], 1.5) for c in range(3)], -1)
    sd = float(hp[ring].std()) if ring.any() else 1.0
    noise = np.random.default_rng(seed).normal(0, 1, r.shape[:2]).astype(np.float32)
    noise = (_gray_blur(noise * 20 + 128, 0.6) - 128) / 20 * sd
    filled = v + (noise * np.clip(luminance(v) / 40, 0.3, 1))[..., None]
    alpha = np.maximum(_gray_blur(np.asarray(mI.filter(ImageFilter.MaxFilter(3))).astype(np.float32), feather / 3) / 255,
                       m.astype(np.float32))
    out = r * (1 - alpha[..., None]) + np.where(m[..., None], filled, r) * alpha[..., None]
    band = (np.asarray(mI.filter(ImageFilter.MaxFilter(5))) > 0) & ~(np.asarray(mI.filter(ImageFilter.MinFilter(5))) > 0)
    ob = np.stack([_gray_blur(out[..., c], 0.9) for c in range(3)], -1)
    out = np.where(band[..., None], ob, out)
    a[y0:y1, x0:x1] = out
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)), {"box": [x0, y0, x1, y1], "pixels_changed": int(m.sum()),
                                                                        "boundary": boundary, "grain_sd": round(sd, 2)}


def retouch_hangers(im: Image.Image, src_name: str):
    """Apply HANGERS[src_name]; writes before/after QA crops. Returns (image, info list, ops list)."""
    info, ops = [], []
    for name, poly, boundary in HANGERS.get(src_name, []):
        before = im
        im, inf = remove_hanger(im, poly, boundary)
        inf["region"] = name
        info.append(inf)
        x0, y0, x1, y1 = inf["box"]
        bx = (max(0, x0 - 80), max(0, y0 - 80), min(im.width, x1 + 80), min(im.height, y1 + 80))
        pair = Image.new("RGB", ((bx[2] - bx[0]) * 2 + 8, bx[3] - bx[1]), (40, 40, 40))
        pair.paste(before.crop(bx), (0, 0))
        pair.paste(im.crop(bx), (bx[2] - bx[0] + 8, 0))
        D_QA.mkdir(parents=True, exist_ok=True)
        pair.save(D_QA / f"hanger-retouch-{Path(src_name).stem}-{len(info)}.jpg", quality=88)
        ops.append(f"hanger painted out ({name}): diffusion fill from the {'background' if boundary == 'dark' else 'hood interior'}, "
                   f"{inf['pixels_changed']} px, grain-matched, 6px feather")
    return im, info, ops


# ----------------------------------------------------------------------------- night photo figure matte (CD item 3)
# black-tracksuit-night.jpg is a flash photo: the lit pavement, garage fence, building and SUV made a grey
# rectangle with hard left/top edges in every crop. The background outside the figure is crushed to 10 % of its
# value (below luma 10 after the grade, then clamped), the figure itself is untouched. The matte is a hand-traced
# polygon (source px, ~12 px outside the figure) refined in a 30 px band by local foreground/background colour
# estimates (alpha = projection of the pixel onto F-B, steepened); where garment and background have the same
# brightness (hood against the lit garage) only the traced polygon is used. The matte is pulled 1 px inside the
# edge (the garment has a dark rim there) so no pavement rim survives. Nothing is painted, only darkened.
NIGHT_FIGURE = [(700, 700), (735, 655), (780, 638), (835, 642), (880, 668), (910, 700), (920, 740), (916, 765), (885, 790),
                (870, 815), (878, 845), (905, 868), (928, 898), (948, 945), (966, 1000), (972, 1060), (975, 1150), (975, 1250),
                (968, 1320), (952, 1368), (925, 1398), (902, 1408), (885, 1440), (878, 1462), (876, 1500), (879, 1600), (880, 1700),
                (876, 1800), (875, 1880),
                (882, 1915), (898, 1945), (903, 1990), (912, 2050), (916, 2120), (910, 2165), (890, 2185), (790, 2180), (750, 2140), (745, 2050),
                (740, 2000), (735, 1900), (725, 1800), (710, 1700), (704, 1650), (702, 1602), (697, 1650), (676, 1700), (660, 1750),
                (622, 1800), (608, 1850),
                (598, 1900), (592, 1950), (588, 2000), (600, 2040), (628, 2100), (632, 2150), (615, 2185), (520, 2185), (470, 2140),
                (445, 2080), (432, 2000), (428, 1900), (436, 1800), (460, 1700), (484, 1600), (486, 1500), (490, 1420), (497, 1388),
                (482, 1345), (462, 1305), (445, 1262), (432, 1200), (425, 1150), (430, 1100), (442, 1050), (458, 990), (484, 951),
                (503, 922), (523, 897), (543, 875), (563, 856), (583, 842), (604, 823), (640, 765), (690, 725)]
NIGHT_POLY_ONLY = [[(440, 800), (640, 800), (640, 960), (440, 960)],      # hood vs lit garage
                   [(850, 1430), (935, 1430), (935, 1960), (850, 1960)]]   # flash-lit right trouser edge vs lit pavement
NIGHT_BG_KEEP = 0.10


def _box_blur(a: np.ndarray, r: int, axis: int) -> np.ndarray:
    if r < 1:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    return ((np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis))
            / (2 * r + 1)).astype(np.float32)


def fblur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Float Gaussian approximation (three box passes) for 2-D float arrays (Pillow can't blur mode F)."""
    r = max(0, int(round((math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2)))
    a = a.astype(np.float32)
    for _ in range(3):
        a = _box_blur(_box_blur(a, r, 0), r, 1)
    return a


def figure_matte(im: Image.Image, poly, poly_only=(), band=30, sig=22) -> np.ndarray:
    W, H = im.size
    pm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pm).polygon(poly, fill=255)
    P = np.asarray(pm) > 0
    fg = np.asarray(pm.filter(ImageFilter.MinFilter(2 * band + 1))) > 0
    bg = ~(np.asarray(pm.filter(ImageFilter.MaxFilter(9))) > 0)
    I = np.asarray(im).astype(np.float32)

    def local_mean(mask):
        w = fblur(mask.astype(np.float32), sig) + 1e-5
        return np.stack([fblur(I[..., c] * mask, sig) / w for c in range(3)], -1)

    F, B = local_mean(fg), local_mean(bg)
    d = F - B
    dd = (d * d).sum(-1)
    al = np.clip(((I - B) * d).sum(-1) / np.maximum(dd, 1), 0, 1)
    al = np.clip((al - 0.22) / 0.5, 0, 1)
    conf = np.clip((np.sqrt(dd) - 12) / 30, 0, 1)
    zm = Image.new("L", (W, H), 0)
    for z in poly_only:
        ImageDraw.Draw(zm).polygon(z, fill=255)
    conf = conf * (1 - fblur(np.asarray(zm).astype(np.float32), 6) / 255)
    psoft = fblur(P.astype(np.float32), 3)
    a = np.where(fg, 1.0, np.where(bg, 0.0, conf * al + (1 - conf) * psoft))
    a = np.asarray(Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)))
    return np.clip(fblur(a.astype(np.float32), 0.8) / 255, 0, 1)


def crush_background(im: Image.Image, alpha: np.ndarray, keep=NIGHT_BG_KEEP) -> Image.Image:
    a = np.asarray(im).astype(np.float32)
    return Image.fromarray(np.clip(a * (alpha + (1 - alpha) * keep)[..., None] + 0.5, 0, 255).astype(np.uint8))


def feather_frame(im: Image.Image, top=0.0, sides=0.0, bottom=0.0) -> Image.Image:
    """Fade the frame's own edges to #000 (smoothstep over the given fraction of the height / width), so no
    straight edge of a lit area is left in the image itself (CD item 2: campaign haze column)."""
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    y = (np.arange(H, dtype=np.float32) + 0.5) / H
    x = (np.arange(W, dtype=np.float32) + 0.5) / W
    fy = np.ones(H, np.float32)
    fx = np.ones(W, np.float32)
    if top:
        fy *= smoothstep(0, top, y)
    if bottom:
        fy *= smoothstep(0, bottom, 1 - y)
    if sides:
        fx *= smoothstep(0, sides, x) * smoothstep(0, sides, 1 - x)
    return Image.fromarray(np.clip(a * (fy[:, None] * fx[None, :])[..., None] + 0.5, 0, 255).astype(np.uint8))


def stage_stills():
    for d in (D_STILLS, D_PROD):
        clean(d)
    D_QA.mkdir(parents=True, exist_ok=True)

    # ---------------- zip hoodie: single front still
    fp = SRC / "zip-hoodie-blue-grey-front.png"
    F = load_srgb(fp)
    F, hinfo, hops_f = retouch_hangers(F, fp.name)
    QA_INFO["hanger_retouch_front"] = hinfo
    fbg = border_color(F)
    # garment bbox (max channel > 12): x 900-1867, y 42-1431 -> centre (1383, 736)
    # Review r1 item 1: the product FRONT (PDP lead, cards, cart thumbnail) and sf-signature-front are this clean
    # hood-up still. The hood-down front of the front/back still kept two grey smudge 'horns' and a flat,
    # decapitated hood top after its hanger paint-out, so it is no longer published; the separate front-alt
    # view is gone with it (it was this same still).
    box_front = (743, -64, 2023, 1536)           # 1280x1600 4:5, canvas extended 64px on the photo's black
    p_front = plate(F, box_front, fill=fbg)
    cd = crop_dict(box_front, F.size)
    emit(p_front, D_PROD, "zip-hoodie-washed-blue-grey--front", PRODUCT_WIDTHS, "max", group="product",
         purpose="Product image: zip hoodie front, hood up (single studio still)", source=rel(fp), crop=cd,
         ops=hops_f + ["4:5 plate, black canvas extension"], sharpen=True, fixture=("zip-hoodie-washed-blue-grey", "front"),
         add_cap=True)
    emit(p_front, D_STILLS, "sf-signature-front", [600, 900, 1200], 900, group="signature",
         purpose="Signature showcase front (4:5, hood up)", source=rel(fp), crop=cd, ops=hops_f + ["4:5 plate"],
         sharpen=True, theme_asset=True)
    # sf-category-hoodies is NOT this garment (CD-18, DESIGN §5.6): the showcase already owns the zip hoodie,
    # so Hoodies is the black heavyweight zip hoodie (night photo, upper crop), see the night block below.

    box_hero = (11, 0, 2741, 1536)               # 16:9
    p_hero = plate(F, box_hero, fill=fbg)
    emit(p_hero, D_STILLS, "sf-signature-hero", [960, 1600, 2400, 2730], 1600, group="signature",
         purpose="Signature showcase stage, front (16:9)", source=rel(fp), crop=crop_dict(box_hero, F.size),
         ops=hops_f + ["16:9 crop"], sharpen=True, theme_asset=True)

    # sf-category-new-arrivals is cut from the IMG_4913 embossed close-up in stage_footage (DESIGN §5.6).

    # ---------------- zip hoodie: front/back side-by-side
    fbp = SRC / "zip-hoodie-blue-grey-front-back.png"
    FB = load_srgb(fbp)
    FB, hinfo, hops_fb = retouch_hangers(FB, fbp.name)
    QA_INFO["hanger_retouch_front_back"] = hinfo
    fbbg = border_color(FB)
    # garments (max channel > 12): front x 234-1178, back x 1593-2528; both y ~238-1412 (incl. hanger)
    box_b = (1420, 25, 2700, 1625)                # 1280x1600, centred on the back garment
    p_b = plate(FB, box_b, fill=fbbg, valid=(1376, 0, FB.width, FB.height))
    for view, pl, bx, hv in (("back", p_b, box_b, "back"),):   # the front half is not published (item 1)
        cdx = crop_dict(bx, FB.size)
        emit(pl, D_PROD, f"zip-hoodie-washed-blue-grey--{view}", PRODUCT_WIDTHS, "max", group="product",
             purpose=f"Product image: zip hoodie {view} (from the front/back still)", source=rel(fbp), crop=cdx,
             ops=hops_fb + ["split at x=1376", "4:5 plate, black canvas extension"], sharpen=True, add_cap=True,
             fixture=("zip-hoodie-washed-blue-grey", view))
        emit(pl, D_STILLS, f"sf-signature-{hv}", [600, 900, 1200], 900, group="signature",
             purpose=f"Signature showcase {hv} (4:5)", source=rel(fbp), crop=cdx, ops=hops_fb + ["4:5 plate"], sharpen=True,
             theme_asset=True)
    # sf-category-tops is the reflective tracksuit front, top crop (DESIGN §5.6), see the reflective block.

    # back aligned to the front still for the showcase front->back crossfade (DESIGN §10)
    fw = 1867 - 900 + 1
    bw = 2528 - 1593 + 1
    s = fw / bw
    cxF, cxB, botF, botB = (900 + 1867) / 2, (1593 + 2528) / 2, 1431, 1409
    # affine inverse map: output (x,y) -> source ((x - cxF)/s + cxB, (y - botF)/s + botB)
    back_src = FB.crop((1376, 0, FB.width, FB.height))
    inv = (1 / s, 0, cxB - 1376 - cxF / s, 0, 1 / s, botB - botF / s)
    aligned = back_src.transform(F.size, Image.AFFINE, inv, resample=Image.BICUBIC, fillcolor=fbbg)
    # anything mapped from outside the right half is background already (fillcolor)
    p_hero_b = plate(aligned, box_hero, fill=fbbg)
    emit(p_hero_b, D_STILLS, "sf-signature-hero-back", [960, 1600, 2400, 2730], 1600, group="signature",
         purpose="Signature showcase stage, back aligned to the front still (16:9)", source=rel(fbp),
         crop={"from": "right half of front-back", "scale": round(s, 4),
               "align": "garment centre x and lowest edge (cuffs) to the front still"},
         ops=hops_fb + [f"scale x{s:.4f} about garment centre", "hem/cuff line aligned", "16:9 crop"], sharpen=True,
         theme_asset=True, notes="Back is scaled x%.3f (source pixels upsampled by that factor)." % s)
    blend = Image.blend(F, aligned, 0.5)
    resize(blend, 1376).save(D_QA / "showcase-front-back-alignment.jpg", quality=85)
    QA_INFO["showcase_back_alignment"] = {"scale": round(s, 4), "overlay": rel(D_QA / "showcase-front-back-alignment.jpg")}

    # ---------------- detail crops (square), colour-true; exposure lift only where noted
    details = [
        ("zip", F, fp, (1374, 640), 540, 1.0, "Zip pull and teeth"),
        ("neck-label", F, fp, (1376, 450), 480, 1.0, "Neck label"),
        ("chest-logo", F, fp, (1379, 780), 700, 1.0, "Distressed chest logo"),
        ("shoulder", F, fp, (1630, 520), 480, 1.0, "Shoulder embellishment"),
        ("cuff-label", FB, fbp, (340, 1240), 480, 0.80, "Sleeve woven label"),
        ("hem", F, fp, (1376, 1210), 640, 1.0, "Hem ombre"),
    ]
    for name, im, sp, (cx, cy), size, gamma, label in details:
        bx = (cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2)
        pl = plate(im, bx, fill=border_color(im))
        ops = (hops_f if im is F else hops_fb) + [f"{size}px square crop"]
        if gamma != 1.0:
            lut = [int(round(255 * (i / 255) ** gamma)) for i in range(256)]
            pl = pl.point(lut * 3)
            ops.append(f"exposure lift gamma {gamma} (source is dark here)")
        cdx = crop_dict(bx, im.size)
        emit(pl, D_STILLS, f"sf-signature-detail-{name}", [400, 720, 800, 1200], 720, group="detail",
             purpose=f"Signature showcase detail: {label}", source=rel(sp), crop=cdx, ops=ops, max_up=MAX_UP_DETAIL,
             sharpen=True, theme_asset=True)

    # PDP gallery details (review r1 item 5): three details, all 4:5 like the product views, every tile filled
    # edge to edge with fabric (no silhouette against black, no plate edge). All from the hood-up studio still.
    # The sleeve label sits on the sleeve's outer edge and the sleeve hangs ~6 deg off vertical, so that crop is
    # rotated 6 deg about the label (framing only) to stand the sleeve upright; the label ends ~4 px inside it.
    pdp_details = [
        # name, box (x0, y0, x1, y1) in source px, rotation deg about (cx, cy) or None, gamma, label
        ("chest-logo", (1100, 470, 1660, 1170), None, 1.0, "Distressed chest logo"),
        ("neck-label", (1218, 362, 1538, 762), None, 1.0, "Neck label and zip"),
        ("cuff-label", (909, 980, 1189, 1330), (6.0, (976, 1271)), 0.85, "Sleeve woven label"),
    ]
    for name, bx, rot, gamma, label in pdp_details:
        src_im, ops = F, hops_f + [f"4:5 crop {bx[2] - bx[0]}x{bx[3] - bx[1]} inside the garment"]
        if rot:
            src_im = F.rotate(rot[0], resample=Image.BICUBIC, center=rot[1])
            ops.append(f"rotated {rot[0]} deg about {rot[1]} (sleeve upright; framing only)")
        pl = src_im.crop(bx)
        if gamma != 1.0:
            lut = [int(round(255 * (i / 255) ** gamma)) for i in range(256)]
            pl = pl.point(lut * 3)
            ops.append(f"exposure lift gamma {gamma} (source is dark here)")
        QA_INFO.setdefault("pdp_detail_edges", {})[name] = plate_edge_delta(pl)
        emit(pl, D_PROD, f"zip-hoodie-washed-blue-grey--detail-{name}", [800, 400], "max", group="product",
             purpose=f"Product detail: {label}", source=rel(fp), crop=crop_dict(bx, F.size), ops=ops,
             max_up=MAX_UP_DETAIL, add_cap=True, sharpen=True, fixture=("zip-hoodie-washed-blue-grey", f"detail-{name}"))

    # ---------------- reflective tracksuit (phone screenshot)
    rp = SRC / "reflective-tracksuit-screenshot.jpg"
    R = load_srgb(rp)
    ra = luminance(np.asarray(R).astype(np.float32))
    rowm = ra.mean(1)
    rows = np.where(rowm[600:2000] > 2.0)[0] + 600
    ry0, ry1 = int(rows.min()) + 4, int(rows.max()) - 3          # photo strip, phone UI removed
    sh_ = ry1 - ry0
    cw = int(round(sh_ * 0.8))
    # CD-03: the strip's JPEG-lifted black (luma 8-12) read as a grey rectangle on the #000 card well. Knee the
    # blacks first (luma <= 14 -> 0, smooth to 24, so the speckle survives), then plate on true black with a
    # 120 px feather, so the edge-to-fill delta is <= 2 luma on every side.
    R = black_knee(R, 14.0, 24.0)
    rfill = (0, 0, 0)
    gap_x0, gap_x1 = 660, 690                                    # empty street between the two figures
    for view, cxr, valid in (("front", 330, (0, ry0, gap_x0, ry1)), ("back", 940, (gap_x1, ry0, R.width, ry1))):
        bx = (cxr - cw // 2, ry0, cxr - cw // 2 + cw, ry1)
        pl = plate(R, bx, fill=rfill, valid=valid, feather=120)
        cdx = crop_dict(bx, R.size)
        ops = ["Display P3 -> sRGB", "black knee luma<=14 -> 0, smooth to 24", f"phone UI removed (photo strip y {ry0}-{ry1})",
               f"split at x {gap_x0}/{gap_x1}", "4:5 canvas on #000, 120px feather"]
        QA_INFO.setdefault("reflective_plate_edges", {})[view] = plate_edge_delta(pl)
        note = (f"Low-resolution source (phone screenshot of a product photo, strip {R.width}x{sh_}px, JPEG): "
                "served <= 900px wide; soft at large sizes.")
        emit(pl, D_PROD, f"reflective-piping-tracksuit-black-speckle--{view}", PRODUCT_WIDTHS, "max",
             group="product", purpose=f"Product image: reflective tracksuit {view}", source=rel(rp), crop=cdx,
             ops=ops, notes=note, quality_cap=900, fixture=("reflective-piping-tracksuit-black-speckle", view))
        emit(pl, D_STILLS, f"sf-lookbook-reflective-{view}", [400, 560], 560, group="lookbook",
             purpose=f"Lookbook: reflective tracksuit {view}", source=rel(rp), crop=cdx, ops=ops, notes=note,
             quality_cap=900, theme_asset=True)
    # Tops (DESIGN §5.6): the reflective tracksuit front, top crop = the hoodie top with its chest script,
    # crown-of-head to hem, phone UI removed. Colour-true + black-point clamp. 480px crop -> 400/560 (x1.17).
    box_tops = (90, 760, 570, 1360)
    emit(plate(R, box_tops, fill=rfill), D_STILLS, "sf-category-tops", [400, 560], 560, group="category",
         purpose="Category tile: Tops (reflective tracksuit front, top crop)", source=rel(rp),
         crop=crop_dict(box_tops, R.size), ops=["Display P3 -> sRGB", "black knee luma<=14 -> 0, smooth to 24", "phone UI excluded",
                                                "4:5 top crop (hoodie + chest script)"],
         notes="Low-resolution source (phone screenshot): served at <= 560px.", theme_asset=True)

    # ---------------- campaign still
    cp = SRC / "campaign-back-embossed-set.png"
    C = load_srgb(cp)
    C, rinfo = retouch_balaclava_logo(C)
    QA_INFO["campaign_retouch"] = rinfo
    resize(C.crop((1940, 300, 2140, 460)), 600).save(D_QA / "campaign-balaclava-retouch.png")
    cops = ["third-party logo on balaclava toned down (diffusion fill, %d px)" % rinfo["pixels_changed"]]
    # Review r1 item 2: the lit haze column ended in a hard rectangular top edge (luma 0 -> 33 at row 0) and, in
    # the mobile crops, near-vertical side edges. Each editorial frame fades to #000 over its own top 15 % and
    # sides 12 % (smoothstep), so no straight edge of the haze exists in the image itself. The figure (head at
    # >= 13 % of the height, body inside 24-76 % of the narrowest crop's width) is outside both ramps.
    FEATHER = dict(top=0.15, sides=0.12)
    fops = ["frame feather to #000: top 15 %, sides 12 % (smoothstep)"]
    emit(feather_frame(C, **FEATHER), D_STILLS, "sf-campaign-back", [828, 960, 1280, 1600, 1920, 2400, 2560, 3840], 1600,
         group="editorial", purpose="Campaign editorial, full frame 16:9 (Section D, desktop)", source=rel(cp),
         crop=crop_dict((0, 0, C.width, C.height), C.size), ops=cops + fops, sharpen=True, theme_asset=True,
         notes="Already graded at source (blacks ~#020102); no further grade.")
    for base, bx, widths, jw, purpose in (
            ("sf-campaign-back-portrait", (1056, 0, 2784, 2160), [540, 828, 900, 1200, 1600], 900,
             "Campaign editorial, mobile 4:5 (figure + spotlight)"),
            ("sf-campaign-back-916", (1312, 0, 2527, 2160), [640, 828, 1080], 828,
             "Campaign editorial, mobile 9:16 (figure + spotlight)")):
        emit(feather_frame(plate(C, bx), **FEATHER), D_STILLS, base, widths, jw, group="editorial", purpose=purpose,
             source=rel(cp), crop=crop_dict(bx, C.size), ops=cops + ["crop"] + fops, sharpen=True, theme_asset=True)
    box_fig = (1208, 190, 2632, 1970)            # 1424x1780 4:5, tight to the figure + reflection
    p_fig = plate(C, box_fig)
    emit(p_fig, D_PROD, "embossed-gothic-tracksuit-stone--back", PRODUCT_WIDTHS, "max", group="product",
         purpose="Product image: embossed stone tracksuit, back (campaign still)", source=rel(cp),
         crop=crop_dict(box_fig, C.size), ops=cops + ["4:5 crop to the figure"], sharpen=True,
         fixture=("embossed-gothic-tracksuit-stone", "back"))
    emit(p_fig, D_STILLS, "sf-category-tracksuits", [540, 900, 1200], 900, group="category",
         purpose="Category tile: Tracksuits", source=rel(cp), crop=crop_dict(box_fig, C.size),
         ops=cops + ["4:5 crop to the figure"], sharpen=True, theme_asset=True)

    # ---------------- black tracksuit, night flash photo
    np_ = SRC / "black-tracksuit-night.jpg"
    N = load_srgb(np_)
    NW, NH = N.size
    nops = ["Display P3 -> sRGB"]
    # Third-party marks (FILM-STORYBOARD source table): SUV door at x > 0.61 (y 0.32-0.62), storefront sign at
    # x >= 0.96, sneaker side marks at y 0.80-0.86. DESIGN §5.2: lifestyle crop (0.25, 0.22, 0.65, 0.80) -> 4:5,
    # burn the right edge (car door) and keep the sneakers illegible. DESIGN §5.3: lifestyle views get the
    # editorial grade (not colour-true) and the `lifestyle` kind.
    flash_extra = ",vignette=angle=PI/3.4"
    gops = ["grade.sh flash still pre (curves + mono 0.30/0.55/0.15 @0.92) + STEADFAST_LOOK + vignette PI/3.4"]

    # Review r1 item 3: background outside the figure crushed (figure matte, see NIGHT_FIGURE) before the grade,
    # so the lit pavement / garage fence / SUV no longer form a grey rectangle with hard edges in any crop. The
    # SUV door burn and the left burns stay as a second guard, now applied through the matte to the background
    # only, so the figure's right sleeve (which they used to darken) keeps its detail.
    nalpha = figure_matte(N, NIGHT_FIGURE, NIGHT_POLY_ONLY)
    Nc = crush_background(N, nalpha)
    QA_INFO["night_matte"] = {"polygon_points": len(NIGHT_FIGURE), "background_keep": NIGHT_BG_KEEP,
                              "figure_fraction": round(float((nalpha > 0.5).mean()), 4)}
    resize(Image.fromarray(np.clip(np.asarray(N).astype(np.float32) * 0.35 + np.stack([nalpha * 170, nalpha * 0, nalpha * 0], -1),
                                   0, 255).astype(np.uint8)), 725).save(D_QA / "night-figure-matte.jpg", quality=85)
    mops = [f"background outside the figure crushed to {int(NIGHT_BG_KEEP * 100)} % (traced figure matte, local "
            "F/B refinement, 1 px inside the edge)"]

    def alpha_box(bx):
        am = Image.fromarray(np.clip(nalpha * 255 + 0.5, 0, 255).astype(np.uint8), "L")
        return np.asarray(plate(am.convert("RGB"), bx, fill=(0, 0, 0)).getchannel(0)).astype(np.float32) / 255

    def over_background(fig_im, bg_im, ab):
        """Figure from fig_im, background from bg_im (the burnt version), through the matte crop ab."""
        f, b = np.asarray(fig_im).astype(np.float32), np.asarray(bg_im).astype(np.float32)
        return Image.fromarray(np.clip(f * ab[..., None] + b * (1 - ab[..., None]) + 0.5, 0, 255).astype(np.uint8))

    def night_plate(fx0, fy0, fx1, fy1, cxf, bottom_burn=None):
        """4:5 box spanning fy0..fy1 centred at cxf, background crushed, graded, car door burnt, left edge burnt."""
        w = int(round((fy1 - fy0) * NH * 0.8 / 4)) * 4        # exact 4:5 in whole pixels
        h = w * 5 // 4
        y0 = round(fy0 * NH)
        y1 = y0 + h
        x0 = round(cxf * NW - w / 2)
        bx = (x0, y0, x0 + w, y1)
        im = grade(plate(Nc, bx), pre_flash(), flash_extra)
        ab = alpha_box(bx)
        bim = burn(im, (0.59 * NW - x0) / w, (0.70 * NW - x0) / w, "right")            # SUV door
        bim = burn(bim, ((fx0 - 0.07) * NW - x0) / w, ((fx0 + 0.06) * NW - x0) / w, "left", floor=0.3)
        im = over_background(im, bim, ab)
        ops = nops + mops + [f"4:5 crop {int(w)}x{int(h)}"] + gops + ["right burn from x 0.59 (SUV door) to black at 0.70, "
                                                                       "soft left edge burn (to 30%): background only"]
        if bottom_burn:
            im = burn(im, (bottom_burn[0] * NH - y0) / h, (bottom_burn[1] * NH - y0) / h, "bottom", floor=0.25)
            ops.append("bottom burn (sneaker side marks kept illegible)")
        return im, crop_dict(bx, N.size), ops, ab

    # 0.20-0.825 rather than 0.22-0.80 so the 4:5 box is 1288px wide (keeps the 1600 rendition <= 1.25x);
    # the sneakers that enter at the bottom are burnt.
    life, cdl, lops, _ = night_plate(0.25, 0.20, 0.65, 0.825, 0.45, bottom_burn=(0.785, 0.825))
    emit(life, D_PROD, "heavyweight-zip-hoodie-black--lifestyle", PRODUCT_WIDTHS, "max", group="product",
         purpose="Product lifestyle: black heavyweight zip hoodie + wide sweatpants (night, graded)", source=rel(np_),
         crop=cdl, ops=lops, fixture=("heavyweight-zip-hoodie-black", "lifestyle", "lifestyle"), add_cap=True,
         notes="Lifestyle view (DESIGN §5.3): editorial grade, SUV door burnt out, sneakers cropped out.")
    emit(life, D_STILLS, "sf-lookbook-black-tracksuit", [540, 900, 1200], 900, group="lookbook",
         purpose="Lookbook: black tracksuit (graded, placeholder card 5)", source=rel(np_), crop=cdl, ops=lops,
         theme_asset=True)
    pants, cdp, pops, _ = night_plate(0.25, 0.375, 0.65, 0.846, 0.45, bottom_burn=(0.795, 0.846))
    # Hoodies (DESIGN §5.6, CD-18): the black heavyweight zip hoodie, upper crop (crown to mid-thigh), flash
    # grade, SUV door burnt. 4:5 box 0.21-0.63 of the height = 864x1080 px -> 540/900 + the 1080 cap.
    hood, cdh, hops, hab = night_plate(0.25, 0.21, 0.65, 0.63, 0.45)
    hood = over_background(hood, burn(hood, 0.02, 0.21, "left", floor=0.05), hab)   # lit garage/fence -> black
    hops = hops + ["left burn 0.02-0.21 to 5% (lit building behind the figure): background only"]
    emit(hood, D_STILLS, "sf-category-hoodies", [540, 900, 1200], 900, group="category",
         purpose="Category tile: Hoodies (black heavyweight zip hoodie, upper crop, graded)", source=rel(np_),
         crop=cdh, ops=hops, add_cap=True, theme_asset=True,
         notes="Not the showcase zip hoodie (DESIGN §5.6: five different garments). Source-limited to 1080 px.")
    emit(pants, D_PROD, "wide-sweatpants-black--lifestyle", PRODUCT_WIDTHS, "max", group="product",
         purpose="Product lifestyle: wide black sweatpants (night, graded)", source=rel(np_), crop=cdp, ops=pops,
         fixture=("wide-sweatpants-black", "lifestyle", "lifestyle"), add_cap=True,
         notes="Lifestyle view (DESIGN §5.3): editorial grade, SUV door burnt out, sneakers darkened.")
    emit(pants, D_STILLS, "sf-category-bottoms", [540, 900, 1200], 900, group="category",
         purpose="Category tile: Bottoms (graded)", source=rel(np_), crop=cdp, ops=pops, theme_asset=True)
    for base, fy0, fy1 in (("sf-editorial-black-tracksuit-4x5", 0.22, 0.86), ("sf-editorial-black-tracksuit-2x3", 0.15, 0.93)):
        r_ = (4, 5) if base.endswith("4x5") else (2, 3)
        w = int(round((fy1 - fy0) * NH * r_[0] / r_[1] / r_[0])) * r_[0]   # exact ratio in whole pixels
        h = w * r_[1] // r_[0]
        y0 = round(fy0 * NH)
        y1 = y0 + h
        x0 = round(0.45 * NW - w / 2)
        bx = (x0, y0, x0 + w, y1)
        im = grade(plate(Nc, bx), pre_flash(), flash_extra)
        bim = burn(im, (0.59 * NW - x0) / w, (0.70 * NW - x0) / w, "right")
        bim = burn(bim, (0.16 * NW - x0) / w, (0.30 * NW - x0) / w, "left", floor=0.3)
        im = over_background(im, bim, alpha_box(bx))
        im = burn(im, (0.795 * NH - y0) / h, (0.86 * NH - y0) / h, "bottom", floor=0.25)
        emit(im, D_STILLS, base, [800, 1200, 1600], 1200, group="editorial",
             purpose="Editorial: black tracksuit at night (graded, %s)" % base.rsplit("-", 1)[1],
             source=rel(np_), crop=crop_dict(bx, N.size),
             ops=nops + mops + ["crop"] + gops + ["right burn (SUV door) and left burn on the background only, bottom burn (sneakers)"], theme_asset=True)


# ----------------------------------------------------------------------------- 5. stills from footage
HLG_TO_SDR = ("zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,format=gbrpf32le,"
              "zscale=p=bt709,tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=pc,format=rgb24")


def lap_var(g: np.ndarray) -> float:
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def best_frame(clip: Path, t0, t1, roi, window):
    """Decode t0..t1 (tone-mapped, upright 720x1280), score every frame by Laplacian variance inside `roi`,
    return the sharpest frame inside `window` (seconds) plus all scores."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", str(clip), "-ss", str(t0), "-t", str(t1 - t0),
           "-vf", HLG_TO_SDR, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    pr = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    W, H = 720, 1280
    n, scores, best = 0, [], None
    while True:
        buf = pr.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        t = round(t0 + n / 30, 3)
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        g = luminance(fr[roi[1]:roi[3], roi[0]:roi[2]].astype(np.float32))
        sc = lap_var(g)
        scores.append({"frame": n, "t": t, "laplacian_var": round(sc, 1)})
        if window[0] <= t <= window[1] and (best is None or sc > best[0]):
            best = (sc, n, t, fr.copy())
        n += 1
    pr.wait()
    return best, scores


def burn_poly(im: Image.Image, poly_frac, feather=0.035) -> Image.Image:
    """Burn a polygon (fractions of the frame) to black with a Gaussian feather of `feather` x width.
    Used for the IMG_4913 sky + foliage behind the hood (CD-02/F6: the first card must not read as daylight)."""
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon([(x * w, y * h) for x, y in poly_frac], fill=255)
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(feather * w))).astype(np.float32) / 255
    a = np.asarray(im).astype(np.float32) * (1 - m)[..., None]
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))


# IMG_4913 crop (0,230,576,950): sky + trees right of the hood edge, down to the shoulder line; the supercar
# below it at x > 0.86 is burnt separately. Traced on the t=3.333 s frame (frames/IMG_4913-*.png).
SKY_4913 = [(0.645, -0.02), (1.02, -0.02), (1.02, 0.445), (0.93, 0.435), (0.80, 0.415), (0.762, 0.365),
            (0.742, 0.22), (0.70, 0.08)]


# IMG_4376 crop (0,262,640,1062), fractions of the 4:5 crop. Pavement/garment boundary measured per row on the 800 px
# rendition (last lit pavement px): 0.156 at y 0.50, 0.182 at 0.60, 0.25 at 0.70, 0.282 at 0.80, 0.29 at 0.90 (jeans
# below the hem). Foliage sits above the hood's top-left edge.
# The polygon runs ~1 % inside the garment's dark left flank so the feather leaves no lit rim against it.
PAVE_4376 = [(-0.02, 0.28), (0.15, 0.28), (0.158, 0.40), (0.163, 0.47), (0.165, 0.52), (0.172, 0.55), (0.18, 0.575),
             (0.19, 0.60), (0.21, 0.625), (0.233, 0.65), (0.248, 0.675), (0.258, 0.70), (0.262, 0.725), (0.276, 0.75),
             (0.284, 0.775), (0.293, 0.80), (0.299, 0.85), (0.302, 0.90), (0.308, 0.95), (0.316, 1.02), (-0.02, 1.02)]
FOLIAGE_4376 = [(-0.02, -0.02), (0.36, -0.02), (0.28, 0.065), (0.24, 0.09), (0.205, 0.13), (0.19, 0.17), (-0.02, 0.25)]


def luma_regions(im: Image.Image) -> dict:
    Y = luminance(np.asarray(im).astype(np.float32))
    H, W = Y.shape
    return {"left_30pct_mean": round(float(Y[:, :int(0.3 * W)].mean()), 2),
            "top_left_25pct_mean": round(float(Y[:int(0.25 * H), :int(0.25 * W)].mean()), 2)}


def desat_strong_colour(im: Image.Image, lo=0.16, hi=0.42, amount=0.85) -> Image.Image:
    """Neutralise strongly saturated background colour (supercar, foliage, tail-lights); the grey garment
    (low saturation) is unaffected."""
    hsv = np.asarray(im.convert("HSV")).astype(np.float32)
    s = hsv[..., 1] / 255
    hsv[..., 1] = np.clip(s * (1 - amount * smoothstep(lo, hi, s)), 0, 1) * 255
    return Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")


def stage_footage():
    clean(D_FRAMES)
    clips = [
        # id, file, decode range, sharpness ROI (garment core), selection window, crop (4:5), handle/view, purpose
        ("IMG_4913", "IMG_4913-day-embossed-closeup.MOV", (0.0, 4.0), (60, 300, 460, 900), (3.3, 3.8),
         (0, 230, 576, 950), ("embossed-gothic-hoodie", "back-charcoal"),
         "Embossed back close-up (washed charcoal): blackletter 'steadfast' + ornamental hood embossing"),
        # back-grey is a lifestyle view: the SUV + tail light (x > 0.78 of the frame) are burnt to black at the
        # right edge (crop kept at 640px so the published 400/800 renditions keep their names); graded with grade.sh.
        ("IMG_4376", "IMG_4376-night-back-grey-embossed-hoodie.MOV", (0.0, 5.4), (120, 250, 620, 900), (3.3, 5.3),
         (0, 262, 640, 1062), ("embossed-gothic-hoodie", "back-grey"),
         "Back view at night (washed grey): arched back panel, embossed lettering on the shoulders"),
    ]
    for cid, fn, (t0, t1), roi, window, bx, (handle, view), purpose in clips:
        clip = FOOT / fn
        best, scores = best_frame(clip, t0, t1, roi, window)
        sc, n, t, fr = best
        frame = Image.fromarray(fr)
        fpng = D_FRAMES / f"{cid}-t{t:.3f}s-f{n:03d}.png"
        frame.save(fpng, optimize=True)
        top = sorted(scores, key=lambda r: -r["laplacian_var"])[:8]
        (D_FRAMES / f"{cid}-sharpness.json").write_text(json.dumps(
            {"clip": rel(clip), "roi": roi, "selection_window_s": window, "picked": {"frame": n, "t": t, "laplacian_var": round(sc, 1)},
             "scores": scores}, indent=1))
        FRAME_INFO[cid] = {"clip": rel(clip), "frames_evaluated": len(scores), "range_s": [t0, t1],
                           "selection_window_s": list(window), "roi": list(roi),
                           "picked": {"frame": n, "t": t, "laplacian_var": round(sc, 1)},
                           "top_overall": top, "frame_png": rel(fpng)}
        record(fpng, group="frame", base=f"{cid}-frame", purpose="Selected source frame (tone-mapped, ungraded)",
               source=rel(clip), crop=None, ops=["HLG/BT.2020 -> BT.709 SDR (zscale + mobius)"])
        # light clean-up: spatial denoise, background colour neutralised, gentle sharpening
        cl = ffmpeg_filter(frame, "format=yuv444p,hqdn3d=1.5:1.5:0:0")
        cl = desat_strong_colour(cl)
        cl = cl.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
        pl = plate(cl, bx)
        ops = ["HLG -> SDR tone map", "hqdn3d 1.5 spatial denoise", "saturated background colour neutralised (garment untouched)",
               "unsharp 1.2/45", f"4:5 crop {bx[2]-bx[0]}x{bx[3]-bx[1]}"]
        note = (f"Video frame {n} at t={t:.3f}s (sharpest by Laplacian variance in the garment ROI within "
                f"{window[0]}-{window[1]}s, where the full lettering faces camera). Source is 720x1280 phone video "
                f"(HEVC): soft and noisy compared with the stills; max {int((bx[2]-bx[0])*MAX_UP)}px wide.")
        kind = "studio"
        if cid == "IMG_4913":
            # CD-02/F6: the daylight sky + foliage (top-right) made the first card read as a park photo. The
            # product still now gets the same film grade as the lookbook/category stills (grade.sh IMG_4913 pre
            # + LOOK), the sky/trees burnt to black behind the hood edge and the supercar burnt at the right.
            pl = grade(plate(frame, bx), grade_part("pre:IMG_4913"))
            pl = burn_poly(pl, SKY_4913)
            pl = burn(pl, 0.86, 0.98, "right", floor=0.15)
            ops = ["HLG -> SDR tone map", f"4:5 crop {bx[2]-bx[0]}x{bx[3]-bx[1]}"] + grade_ops("IMG_4913") + \
                  ["sky + foliage behind the hood burnt to black (traced polygon, 3.5% feather)",
                   "right burn 0.86-0.98 (supercar)"]
            kind = "lifestyle"
        if cid == "IMG_4376":
            # lifestyle (DESIGN §5.3): grade.sh IMG_4376 pre + LOOK; burn the SUV / tail light at the right edge
            pl = grade(plate(frame, bx), grade_part("pre:IMG_4376"))
            bw_ = bx[2] - bx[0]
            # CD-14: a 0.12-wide feather from x 540 px (the SUV's edge) so the sleeve fades instead of ending in a
            # straight cut; the lit kerb in the left 10 % goes down with a soft left burn (garment starts ~0.16).
            f0 = (540 - bx[0]) / bw_
            pl = burn(pl, f0, f0 + 0.12, "right")
            # Review r1 item 4: the frame still read as daylight (lit pavement strip in the left third, foliage
            # top-left). The pavement left of the hoodie / jeans and the foliage above the hood are burnt to black
            # through traced polygons (crop fractions, garment edge traced at 800 px; soft Gaussian feather), and
            # the left 30 % gets a soft burn (0 at x <= 0.04, full at 0.24): left third mean luma < 20, top-left
            # quarter mean < 20. The hoodie's dark left flank (x 0.16-0.24) fades with it; no garment is cut.
            pl = burn_poly(pl, PAVE_4376, feather=0.010)
            pl = burn_poly(pl, FOLIAGE_4376, feather=0.012)
            pl = burn(pl, 0.04, 0.24, "left", floor=0.0)
            QA_INFO["back_grey_left"] = luma_regions(pl)
            ops = ["HLG -> SDR tone map", f"4:5 crop {bw_}x{bx[3]-bx[1]}"] + grade_ops("IMG_4376") + \
                  [f"right burn x {f0:.3f}-{f0 + 0.12:.3f} (SUV + tail light, sleeve fades)",
                   "pavement left of the figure + foliage above the hood burnt to black (traced polygons, soft feather)",
                   "left burn 0.04-0.24 to black"]
            kind = "lifestyle"
        emit(pl, D_PROD, f"{handle}--{view}", PRODUCT_WIDTHS, "max", group="product",
             purpose=f"Product still from footage: {purpose}", source=rel(clip),
             crop=dict(crop_dict(bx, (720, 1280)), frame=n, t=t), ops=ops, notes=note, add_cap=True,
             fixture=(handle, view, kind))
        if cid == "IMG_4913":
            # graded close-up (grade.sh IMG_4913 pre + LOOK), the supercar edge (x > 0.80 of the crop) burnt
            g = pl  # the same graded, sky-burnt still as the product image (one look for one garment)
            gops = ops
            cdg = dict(crop_dict(bx, (720, 1280)), frame=n, t=t)
            emit(g, D_STILLS, "sf-lookbook-embossed-hoodie", [400, 720], 720, group="lookbook",
                 purpose="Lookbook: embossed lettering, washed charcoal hoodie (graded)", source=rel(clip),
                 crop=cdg, ops=gops, notes=note, theme_asset=True)
            # DESIGN §5.6 New Arrivals: the embossed charcoal hoodie close-up, film grade, 540/720 (source-limited)
            emit(g, D_STILLS, "sf-category-new-arrivals", [540, 720], 720, group="category",
                 purpose="Category tile: New Arrivals (embossed charcoal hoodie close-up, graded)", source=rel(clip),
                 crop=cdg, ops=gops, notes=note, theme_asset=True)


# ----------------------------------------------------------------------------- grain tile
def stage_grain():
    rng = np.random.default_rng(20251106)
    n = rng.normal(128, 26, (256, 256)).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(n, "L").convert("RGB")
    for name in ("sf-grain-256.webp", "sf-grain.webp"):
        p = D_STILLS / name
        im.save(p, "WEBP", quality=80, method=6)
        record(p, group="texture", base="sf-grain", purpose="Static grain tile (CSS background, <= 4% opacity)",
               source="generated (numpy normal noise, seed 20251106)", ops=["mid-grey luma noise sigma 26"],
               theme_asset=True, notes="sf-grain.webp is the name CSS references; sf-grain-256.webp follows the {base}-{width} rule.")


# ----------------------------------------------------------------------------- 6. contact sheet
def stage_contact_sheet():
    try:
        font = ImageFont.load_default(size=13)
        font_b = ImageFont.load_default(size=16)
    except TypeError:
        font = font_b = ImageFont.load_default()
    # one tile per base: the largest webp (or png/svg for logo items)
    by_base: dict = {}
    for r in RECORDS:
        if r["group"] == "frame":
            continue
        k = (r["group"], r["base"], r["path"].split("/")[2])
        if r["format"] in ("webp", "png", "svg") or r["base"].startswith("sf-og"):
            cur = by_base.get(k)
            if cur is None or (r["format"] != "svg" and (r["width"] or 0) > (cur["width"] or 0)):
                by_base[k] = r
    order = ["logo", "signature", "detail", "product", "editorial", "lookbook", "category", "texture"]
    items = sorted(by_base.values(), key=lambda r: (order.index(r["group"]) if r["group"] in order else 99, r["path"]))
    cols, cw_, ch_, lab = 6, 300, 375, 44
    rows = math.ceil(len(items) / cols)
    head = 70
    sheet = Image.new("RGB", (cols * cw_ + (cols + 1) * 10, head + rows * (ch_ + lab + 10) + 10), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    d.text((14, 16), "STEADFAST - processed stills contact sheet (tools/media/process_stills.py)", fill=(241, 233, 218), font=font_b)
    d.text((14, 42), f"{len(RECORDS)} files, {len(items)} renditions shown (largest of each). Generated "
                     f"{_dt.datetime.now(_dt.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", fill=(139, 144, 150), font=font)
    for i, r in enumerate(items):
        x = 10 + (i % cols) * (cw_ + 10)
        y = head + (i // cols) * (ch_ + lab + 10)
        cell = Image.new("RGB", (cw_, ch_), (0, 0, 0))
        p = ROOT / r["path"]
        if r["format"] == "svg":
            dd = re.search(r' d="([^"]+)"', p.read_text()).group(1)
            vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', p.read_text()).group(1).split()]
            k = (cw_ - 30) / vb[2]
            hh = int(vb[3] * k) + 2
            A = rasterize_path(dd, k, (cw_ - 30, hh))
            tile = Image.fromarray((A[..., None] * np.array([241, 233, 218])).astype(np.uint8))
        else:
            im = Image.open(p)
            if im.mode == "RGBA":
                bg = Image.new("RGB", im.size, (0, 0, 0))
                bg.paste(im, (0, 0), im)
                im = bg
            im = im.convert("RGB")
            tile = ImageOps.contain(im, (cw_, ch_), Image.LANCZOS) if im.width > cw_ or im.height > ch_ else im
        cell.paste(tile, ((cw_ - tile.width) // 2, (ch_ - tile.height) // 2))
        sheet.paste(cell, (x, y))
        name = r["base"] if r["format"] != "svg" else r["file"]
        d.text((x, y + ch_ + 4), name[:44], fill=(241, 233, 218), font=font)
        dims = f"{r['width']}x{r['height']} {r['format']}" + (f"  ({r['group']})")
        d.text((x, y + ch_ + 22), dims, fill=(139, 144, 150), font=font)
    p = D_STILLS / "_contact-sheet.jpg"
    sheet.save(p, "JPEG", quality=85, optimize=True, progressive=True)
    record(p, group="qa", base="_contact-sheet", purpose="Contact sheet of every processed still", source="(all)",
           ops=["largest rendition of each base"])


# ----------------------------------------------------------------------------- manifest
def tool_versions():
    v = {"python": sys.version.split()[0], "pillow": PIL.__version__, "numpy": np.__version__}
    try:
        from importlib.metadata import version
        v["potracer"] = version("potracer")
    except Exception:
        v["potracer"] = "unknown"
    try:
        v["ffmpeg"] = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.split("\n")[0]
    except Exception:
        pass
    return v


def write_manifest():
    mp = OUT / "manifest.json"
    data = {}
    if mp.exists():
        try:
            data = json.loads(mp.read_text())
        except Exception:
            data = {}
    mine = {r["file"] for r in RECORDS}
    now = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    data["generated_at"] = now
    tv = data.get("tool_versions") or {}
    tv.update(tool_versions())
    data["tool_versions"] = tv

    # theme_assets: replace this script's entries, keep everyone else's
    ta = [e for e in data.get("theme_assets", []) if e.get("owner") != SCRIPT and e.get("file") not in mine]
    for r in RECORDS:
        if r["theme_asset"]:
            c = r["crop"] if isinstance(r["crop"], dict) else None
            ta.append({"file": r["file"], "base": r["base"], "path": r["path"], "width": r["width"], "height": r["height"],
                       "bytes": r["bytes"], "sha1": r["sha1"], "source": r["source"],
                       "crop": [c["x"], c["y"], c["w"], c["h"]] if c and "x" in c else c,
                       "ops": r["ops"], "owner": SCRIPT})
    data["theme_assets"] = ta
    data["fixtures"] = [e for e in data.get("fixtures", []) if e.get("owner") != SCRIPT] + FIXTURES
    data["dropped_widths"] = [e for e in data.get("dropped_widths", []) if e.get("owner") != SCRIPT] + DROPPED
    data["stills"] = {
        "script": SCRIPT, "generated_at": now, "count": len(RECORDS),
        "logo": LOGO_INFO, "footage_frames": FRAME_INFO, "qa": QA_INFO,
        "quality_notes": [
            "reflective-tracksuit-screenshot.jpg is a JPEG phone screenshot of a product photo (photo strip ~1186x1212): "
            "its crops are served at <= 900px (products) / 560px (lookbook) and look soft when enlarged.",
            "Embossed gothic hoodie stills come from 720x1280 HEVC phone video: max 720/800px wide, softer and noisier "
            "than the studio stills.",
            "black-tracksuit-night.jpg is a phone flash photo with shadow noise; product version keeps the subject's "
            "colour and only darkens the surroundings, the lookbook/category/editorial versions carry the §5.4 grade.",
            "Logo textured/streak renditions at 1800px are x1.49 Lanczos upscales of the ~%spx source crop "
            "(2000/2400 dropped: over 1.5x, DESIGN §3.4)."
            % LOGO_INFO.get("textured_native_size", ["?"])[0],
            "Detail crops: the sleeve label is small and dark in both sources (exposure lift applied); 1200px detail "
            "widths are dropped where they would exceed the 1.5x allowance.",
            "sf-category-tops is the reflective tracksuit front, top crop (DESIGN §5.6); sf-category-new-arrivals is "
            "the graded IMG_4913 embossed close-up (same plate as sf-lookbook-embossed-hoodie, DESIGN §5.6).",
            "Every still and product image is black-point clamped (luma <= 6 -> 0, smooth ramp to 12; DESIGN §5.3). "
            "This removes the lifted noise band at the bottom of the signature stills.",
            "Lifestyle product views (heavyweight-zip-hoodie-black, wide-sweatpants-black, embossed-gothic-hoodie "
            "back-grey) carry the grade.sh editorial grade and edge burns that remove the third-party SUV/supercar; "
            "fixtures mark them kind=lifestyle (never the first gallery image).",
            "sf-campaign-* keep the source grade (already graded at source) + the clamp; grade.sh's campaign mono "
            "mix is the film's treatment of the still, not applied to the editorial stills.",
            "The campaign still had a small third-party logo on the balaclava; it was toned down by a diffusion fill "
            "(no other retouching).",
        ],
        "files": RECORDS,
    }
    tmp = mp.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=1))
    os.replace(tmp, mp)


def main(argv):
    stages = argv or ["logo", "stills", "footage", "grain", "sheet"]
    OUT.mkdir(parents=True, exist_ok=True)
    if set(stages) != {"logo", "stills", "footage", "grain", "sheet"}:
        # partial run: keep earlier records for untouched stages so the manifest stays complete
        mp = OUT / "manifest.json"
        if mp.exists():
            old = json.loads(mp.read_text()).get("stills", {})
            run_dirs = {"logo": ["logo/", "_qa/svg"], "stills": ["stills/sf-", "products/", "_qa/show", "_qa/camp"],
                        "footage": ["frames/", "products/embossed-gothic-hoodie", "stills/sf-lookbook-embossed", "stills/sf-category-new-arrivals"],
                        "grain": ["stills/sf-grain"], "sheet": ["stills/_contact"]}
            pref = [f"media/processed/{p}" for s in stages for p in run_dirs[s]]
            RECORDS.extend(r for r in old.get("files", []) if not any(r["path"].startswith(p) for p in pref))
            LOGO_INFO.update(old.get("logo", {}) if "logo" not in stages else {})
            FRAME_INFO.update(old.get("footage_frames", {}) if "footage" not in stages else {})
            QA_INFO.update(old.get("qa", {}))
            data = json.loads(mp.read_text())
            FIXTURES.extend(f for f in data.get("fixtures", []) if f.get("owner") == SCRIPT and not any(f["file"].startswith(p) for p in pref))
            DROPPED.extend(f for f in data.get("dropped_widths", []) if f.get("owner") == SCRIPT)
    if "logo" in stages:
        stage_logo()
    if "stills" in stages:
        stage_stills()
    if "footage" in stages:
        stage_footage()
    if "grain" in stages:
        stage_grain()
    if "sheet" in stages:
        RECORDS[:] = [r for r in RECORDS if r["base"] != "_contact-sheet"]
        stage_contact_sheet()
    # de-duplicate dropped widths
    seen, dd = set(), []
    for e in DROPPED:
        k = (e["base"], e["width"])
        if k not in seen:
            seen.add(k); dd.append(e)
    DROPPED[:] = dd
    write_manifest()
    print(f"wrote {len(RECORDS)} files; fixtures {len(FIXTURES)}; dropped widths {len(DROPPED)}")
    if LOGO_INFO:
        print("logo letters aspect %.4f, textured aspect %.4f, svg %d bytes, check %s" % (
            LOGO_INFO["letter_aspect_ratio"], LOGO_INFO["textured_aspect_ratio"], LOGO_INFO["svg_bytes"],
            json.dumps(LOGO_INFO["svg_check"])))


if __name__ == "__main__":
    main(sys.argv[1:])
