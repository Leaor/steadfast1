#!/usr/bin/env python3
"""STEADFAST hero edit: reproducible film build (FILM-STORYBOARD.md Part A).

What it makes
    An edit of the client's own phone footage and photography (graded, slowed, slow camera moves on
    stills). It is not a commissioned campaign film and no metadata written here calls it one.

        media/processed/film/sf-film-desktop.mp4        intro 12.8 s, 1920x1080, aperture composite (FILM A2/A3)
        media/processed/film/sf-film-mobile.mp4         intro 12.8 s, 720x1280 plates
        media/processed/film/sf-film-loop-desktop.mp4   loop 5.6 s ping-pong (FILM A7)
        media/processed/film/sf-film-loop-mobile.mp4
        media/processed/film/sf-film-end-{desktop,mobile}-{w}.{webp,jpg}   end stills = loop frame 0, no grain, no logo
        media/processed/film/edit-decision-list.json, contact-sheet.jpg
        media/processed/manifest.films.json             (ARCHITECTURE §15: film renders write this file only)
        theme/assets/<same names>                       (stage `install`)

Run (from anywhere; idempotent; ~10 min on 4 cores):
    python3 -I tools/media/build_film.py                      # all stages
    python3 -I tools/media/build_film.py plates masters        # some stages
    STEADFAST_FILM_WORK=/path python3 -I tools/media/build_film.py   # work dir (default: $TMPDIR/steadfast-film-work)

Stages: prep (footage: decode, HLG->BT.709 tone-map + pre grade, vidstab, hqdn3d, 0.5x minterpolate)
        plates (per shot and variant: sub-pixel crop moves in Pillow -> grade.sh LOOK + per-shot grade + luma grain)
        masters (burns, exposure envelopes, dips/cuts, aperture composite, black clamp; lossless FFV1)
        encode (H.264 High, CRF searched in 23..28 to meet the weight budgets)
        stills (end stills) · qa (frame every 0.5 s + contact sheets) · manifest · install

The grade of record is tools/media/grade.sh: its pre stages, denoise, LOOK and grain strings are read from it
at run time (bash `source`), so a change there flows into this build. Per-shot layers (burns, extra crush,
exposure) are FILM-STORYBOARD A4's and live here.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FOOT = ROOT / "media/source/footage"
PHOTOS = ROOT / "media/source/photos"
OUT = ROOT / "media/processed/film"
ASSETS = ROOT / "theme/assets"
MANIFEST = ROOT / "media/processed/manifest.films.json"
GRADE_SH = ROOT / "tools/media/grade.sh"
SCRIPT = "tools/media/build_film.py"
WORK = Path(os.environ.get("STEADFAST_FILM_WORK") or Path(tempfile.gettempdir()) / "steadfast-film-work")

FPS = 30
TITLE = "STEADFAST hero edit — supplied footage"
COMMENT = "Edit of client-supplied phone footage and photography. Not a commissioned campaign film."

VARIANTS = {"d": dict(name="desktop", W=1920, H=1080, plate=(608, 1080), plate_x=656),
            "m": dict(name="mobile", W=720, H=1280, plate=(720, 1280), plate_x=0)}
FEATHER = 120                    # aperture edge feather, px (FILM A2; 72 -> 120, CD-04)
# CD-04: the 16:9 desktop video is contained in 16:10 viewports, so the plate's bottom row was cut at the
# letterbox line. Desktop plates (shaft + S7 full frame) fade to black over the top 6 % and bottom 14 %.
V_FEATHER_TOP, V_FEATHER_BOTTOM = 0.06, 0.14
EDGE_CRUSH_PX, EDGE_CRUSH_LUMA = 60, 30   # within 60 px of the shaft edges, luma < 30 is crushed to black
BLACK_HOLD = 12                  # 0.40 s black tail (handoff to the DOM logo reveal)

# Weight budgets, bytes (ARCHITECTURE §6.1 / §10.1; FILM A8). 1 MB = 1,000,000 B (conservative vs MiB).
BUDGET = {"sf-film-desktop.mp4": 3_500_000, "sf-film-mobile.mp4": 2_400_000,
          "sf-film-loop-desktop.mp4": 1_500_000, "sf-film-loop-mobile.mp4": 1_000_000}
CRF_RANGE = range(23, 29)        # ARCHITECTURE range 23-28; lowest CRF that fits (with 3% headroom) wins

# ----------------------------------------------------------------------------- edit decision list (FILM A3)
# crop boxes are (x0, y0, x1, y1) fractions of the upright source frame; (start, end).
# head/tail: ("fade", s) exposure fade from black · ("cut",) hard cut on matched darkness · ("dip", s) through black
SHOTS = [
    dict(id="S1", beat=1, kind="clip", clip="IMG_4913", src=(0.50, 1.60), dur=2.20, stab=True, win=(0.00, 3.00),
         crop={"*": ((0.000, 0.240, 0.560, 0.800), (0.021, 0.261, 0.539, 0.779))},
         head=("fade", 1.20), tail=("cut",), desc="Extreme close-up: hood ornament and lettering"),
    # CD-01: the hanger is painted out of the still (process_stills.remove_hanger) and the tilt opens on the
    # neck label and pull (y 0.30), not on the hood cavity; it ends on the pocket (0.40-0.95).
    dict(id="S2", beat=2, kind="still", still="zip-hoodie-blue-grey-front.png", dur=1.80,
         crop={"*": ((0.4137, 0.30, 0.5863, 0.85), (0.4137, 0.40, 0.5863, 0.95))},
         head=("cut",), tail=("cut",), desc="Tilt down the zip: neck label and pull, logo, pocket"),
    dict(id="S3", beat=3, kind="clip", clip="IMG_4913", src=(3.15, 3.65), dur=1.00, stab=True, win=(2.60, 3.75),
         crop={"*": ((0.000, 0.180, 0.700, 0.880),) * 2},
         head=("cut",), tail=("cut",), desc="The camera passes across the word on the back"),
    dict(id="S4", beat=4, kind="clip", clip="IMG_4374", src=(1.40, 2.10), dur=1.40, stab=False, win=(1.00, 2.50),
         crop={"*": ((0.220, 0.230, 0.760, 0.770), (0.250, 0.250, 0.760, 0.760))},
         head=("cut",), tail=("dip", 0.30), desc="Side profile, push toward hood and shoulder"),
    dict(id="S5", beat=5, kind="still", still="black-tracksuit-night.jpg", dur=1.60,
         crop={"*": ((0.250, 0.400, 0.650, 0.800), (0.250, 0.320, 0.650, 0.720))},
         head=("dip", 0.30), tail=("cut",), desc="Tilt up the black tracksuit from the drawcords to the hood"),
    dict(id="S6", beat=6, kind="clip", clip="IMG_4376", src=(3.70, 4.50), dur=1.60, stab=True, win=(2.40, 5.10),
         crop={"*": ((0.040, 0.000, 0.800, 0.760),) * 2},
         head=("cut",), tail=("dip", 0.30), desc="The figure turns slightly; back design"),
    dict(id="S7", beat=7, kind="still", still="campaign-back-embossed-set.png", dur=2.80, move_s=2.30,
         crop={"d": ((0.315, 0.140, 0.685, 0.510), (0.0, 0.0, 1.0, 1.0)),
               "m": ((0.4336, 0.170, 0.5664, 0.590), (0.3418, 0.000, 0.6582, 1.000))},
         head=("dip", 0.30), tail=("collapse", 1.90), desc="Pull back into darkness; the aperture opens"),
]
LOOP = dict(id="LOOP", kind="clip", clip="IMG_4376", src=(3.40, 4.80), dur=2.80, stab=True, win=(2.40, 5.10),
            crop={"*": ((0.040, 0.000, 0.800, 0.760),) * 2}, frames=85,  # 85 fwd + 83 back = 168 = 5.6 s
            desc="Hero loop: IMG_4376 3.40-4.80 at 0.5x, ping-pong")

CLIP_FILES = {p.name.split("-")[0]: p for p in FOOT.glob("IMG_*.MOV")}
SLOMO = {"mci": "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
         "blend": "framerate=fps=30:interp_start=0:interp_end=255:scene=100"}
SHOT_SLOMO = {"S3": os.environ.get("STEADFAST_S3_SLOMO", "mci")}   # FILM A5: QA S3; switch to blend if it warps


def log(*a):
    print("[film]", *a, flush=True)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.stderr.write(r.stderr[-4000:])
        raise SystemExit(f"command failed: {' '.join(map(str, cmd))[:400]}")
    return r


# ----------------------------------------------------------------------------- grade.sh (grade of record)
def gsh(expr: str) -> str:
    return run(["bash", "-c", f'source "{GRADE_SH}"; {expr}']).stdout.strip()


G = {}
_GLOCK = __import__("threading").Lock()


def grade_strings():
    with _GLOCK:
        return _grade_strings()


def _grade_strings():
    if not G:
        G["DENOISE"] = gsh('echo "$STEADFAST_DENOISE"')
        G["LOOK"] = gsh('echo "$STEADFAST_LOOK"')
        G["GRAIN"] = gsh("steadfast_grain 3")
        for c in ("IMG_4913", "IMG_4376", "IMG_4374"):
            G["pre_" + c] = gsh(f"steadfast_pre {c}")
        G["mono_still"] = gsh("steadfast_mono 0.30 0.55 0.15 0.92")
        G["mono_zip"] = gsh("steadfast_mono 0.30 0.55 0.15 0.80")
        assert "vignette=angle=0.5" in G["LOOK"], "grade.sh LOOK changed: update the S7 vignette hook"
    return G


def pre_chain(clip: str) -> str:
    g = grade_strings()
    p = g["pre_" + clip]
    if clip == "IMG_4376":
        p += ",eq=gamma=1.15"          # FILM A4 per-shot layer (S6 / loop): the clip is underexposed
    return p


def still_pre(shot_id: str) -> str:
    g = grade_strings()
    return {"S2": "format=gbrp," + g["mono_zip"],
            "S5": "format=gbrp,curves=m='0/0 0.3/0.18 0.6/0.46 1/0.82'," + g["mono_still"],
            "S7": "format=gbrp," + g["mono_still"]}[shot_id]


# grain on 4:4:4: identical luma-only temporal grain (c0 = Y); 4:4:4 because plates are composited before 4:2:0
def grain_chain() -> str:
    return grade_strings()["GRAIN"].replace("format=yuv420p", "format=yuv444p")


# ----------------------------------------------------------------------------- easing / moves
def sine_in_out(p):
    return 0.5 - 0.5 * math.cos(math.pi * min(max(p, 0.0), 1.0))


def power3_out(p):
    p = min(max(p, 0.0), 1.0)
    return 1 - (1 - p) ** 3


def box_at(a, b, e):
    """Interpolate crop box a->b at eased progress e. Same-size boxes translate linearly; zooms are a homothety
    about their fixed point with the scale interpolated geometrically, so the move reads as one steady camera pull."""
    wa, wb = a[2] - a[0], b[2] - b[0]
    if abs(wa - wb) < 1e-6:
        return tuple(a[i] + (b[i] - a[i]) * e for i in range(4))
    kb = wb / wa
    k = kb ** e
    fx = (b[0] - kb * a[0]) / (1 - kb)
    fy = (b[1] - kb * a[1]) / (1 - kb)
    return (fx + k * (a[0] - fx), fy + k * (a[1] - fy), fx + k * (a[2] - fx), fy + k * (a[3] - fy))


def shot_crop(shot, v):
    return shot["crop"].get(v) or shot["crop"]["*"]


def nframes(shot):
    return shot.get("frames") or int(round(shot["dur"] * FPS))


# ----------------------------------------------------------------------------- raw frame IO
def reader(path: Path, w: int, h: int):
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)  # early close = broken pipe, expected
    n = w * h * 3
    try:
        while True:
            buf = p.stdout.read(n)
            if len(buf) < n:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    finally:
        p.stdout.close()
        p.wait()


def writer(path: Path, w: int, h: int, vf: str | None = None):
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
           "-r", str(FPS), "-i", "-"]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp", str(path)]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def probe_size(path: Path):
    r = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,nb_frames",
             "-count_frames", "-of", "json", str(path)])
    s = json.loads(r.stdout)["streams"][0]
    return int(s["width"]), int(s["height"]), int(s.get("nb_read_frames") or s.get("nb_frames") or 0)


# ----------------------------------------------------------------------------- stage: prep (footage)
def prep_key(shot):
    return f"{shot['clip']}_{shot['win'][0]:.2f}-{shot['win'][1]:.2f}_{SHOT_SLOMO.get(shot['id'], 'mci')}"


def prep_one(shot):
    key = prep_key(shot)
    out = WORK / f"prep_{key}.mkv"
    meta = WORK / f"prep_{key}.json"
    clip = CLIP_FILES[shot["clip"]]
    w0, w1 = (int(round(t * FPS)) for t in shot["win"])
    # the slowed range covers every window this prep serves (S6 and LOOP share IMG_4376 2.40-5.10)
    users = [s for s in SHOTS + [LOOP] if s.get("clip") == shot["clip"] and s.get("win") == shot["win"]
             and SHOT_SLOMO.get(s["id"], "mci") == SHOT_SLOMO.get(shot["id"], "mci")]
    a = min(int(round(s["src"][0] * FPS)) for s in users) - 1
    b = max(int(round(s["src"][1] * FPS)) for s in users) + 2
    cfg = dict(clip=clip.name, win=[w0, w1], a=a, b=b, pre=pre_chain(shot["clip"]), stab=shot["stab"],
               slomo=SHOT_SLOMO.get(shot["id"], "mci"), denoise=grade_strings()["DENOISE"])
    if out.exists() and meta.exists() and json.loads(meta.read_text()) == cfg:
        log("prep cached", key)
        return
    head = f"trim=start_frame={w0}:end_frame={w1},setpts=PTS-STARTPTS,{cfg['pre']}"
    chain = head
    if shot["stab"]:
        trf = WORK / f"{key}.trf"
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(clip), "-map", "0:v:0", "-an", "-vf",
             f"{head},format=yuv444p,vidstabdetect=shakiness=6:accuracy=15:result={trf}", "-f", "null", "-"])
        chain += f",format=yuv444p,vidstabtransform=input={trf}:smoothing=20:optzoom=1:interpol=bicubic"
    chain += (f",{cfg['denoise']},trim=start_frame={a - w0}:end_frame={b - w0},setpts=PTS-STARTPTS,"
              f"setpts=2.0*PTS,{SLOMO[cfg['slomo']]},format=gbrp")
    log("prep", key, "...")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(clip), "-map", "0:v:0", "-an", "-vf", chain,
         "-c:v", "ffv1", "-level", "3", str(out)])
    meta.write_text(json.dumps(cfg))
    log("prep done", key, probe_size(out))


def stage_prep():
    WORK.mkdir(parents=True, exist_ok=True)
    seen, jobs = set(), []
    for s in SHOTS + [LOOP]:
        if s["kind"] == "clip" and prep_key(s) not in seen:
            seen.add(prep_key(s))
            jobs.append(s)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(prep_one, jobs))


# ----------------------------------------------------------------------------- stills pre stage
STILL_RETOUCH_REV = "|retouch:balaclava+hanger-v1"   # bump to invalidate cached still pre stages
def load_still(shot) -> Image.Image:
    """Still pre stage (no tone-map, no vidstab, no minterpolate), cached as PNG in the work dir."""
    out = WORK / f"still_{shot['id']}.png"
    ok = WORK / f"still_{shot['id']}.ok"
    if out.exists() and ok.exists() and ok.read_text() == still_pre(shot["id"]) + STILL_RETOUCH_REV:
        return Image.open(out).convert("RGB")
    sys.path.insert(0, str(ROOT / "tools/media"))
    from process_stills import load_srgb, retouch_balaclava_logo, HANGERS, remove_hanger  # same conversion + retouches
    im = load_srgb(PHOTOS / shot["still"])
    if shot["id"] == "S7":
        im, _ = retouch_balaclava_logo(im)        # MEDIA's derivative: third-party balaclava mark toned down
    for _name, poly, boundary in HANGERS.get(shot["still"], []):
        im, _ = remove_hanger(im, poly, boundary)  # CD-01: the hanger is painted out (same retouch as the stills)
    tmp = WORK / f"still_{shot['id']}_src.png"
    im.save(tmp)
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(tmp), "-vf", still_pre(shot["id"]) + ",format=rgb24",
         str(out)])
    ok.write_text(still_pre(shot["id"]) + STILL_RETOUCH_REV)
    return Image.open(out).convert("RGB")


# ----------------------------------------------------------------------------- per-shot layers (FILM A4)
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def plate_mask(shot_id, w, h):
    """Burn masks in plate coordinates (1 = untouched, 0 = black)."""
    x = (np.arange(w, dtype=np.float32) + 0.5) / w
    y = (np.arange(h, dtype=np.float32) + 0.5) / h
    X, Y = np.meshgrid(x, y)
    m = np.ones((h, w), np.float32)
    if shot_id in ("S1", "S3"):          # top-right corner burn (residual sky / trees), 30 % feather
        xa, yb = (0.75, 0.20) if shot_id == "S1" else (0.78, 0.30)
        fx, fy = 0.30 * xa, 0.30 * (1 - yb)  # feather reaches 30 % of the way into the picture
        corner = smoothstep(xa - fx, xa, X) * (1 - smoothstep(yb, yb + fy, Y))
        m *= 1 - corner
    elif shot_id == "S4":                # plate-top burn: black above y 0.20, linear feather to 0.32
        m *= np.clip((Y - 0.20) / 0.12, 0, 1)
    elif shot_id == "S5":                # right burn (car door): black for x > 0.85, feather 0.10
        m *= 1 - smoothstep(0.75, 0.85, X)
    elif shot_id in ("S6", "LOOP"):      # safety burns: left, top 6 %
        # left: the vidstab reframe and the camera float bring lit paving, a kerb and a post into the left ~15 % of
        # the plate (3.9-4.8 s); black to 0.07, feather to 0.20 (CD-04: the kerb at 0.08-0.15 read as a bar).
        m *= smoothstep(0.07, 0.20, X) * smoothstep(0.0, 0.06, Y)
    return m


def source_mask(shot_id, w, h):
    """S4 safety burn in source coordinates (fuel canopy x < 0.30, y < 0.22). The window starts at y 0.23."""
    if shot_id != "S4":
        return None
    x = (np.arange(w, dtype=np.float32) + 0.5) / w
    y = (np.arange(h, dtype=np.float32) + 0.5) / h
    X, Y = np.meshgrid(x, y)
    return 1 - (1 - smoothstep(0.30, 0.36, X)) * (1 - smoothstep(0.22, 0.26, Y))


def extra_chain(shot_id, n):
    """Per-shot grade additions after the LOOK (run inside ffmpeg, before grain)."""
    if shot_id in ("S1", "S3"):
        # FILM A4 "extra crush curves=m='0/0 0.08/0 1/1'": that 3-point natural spline overshoots (it takes the
        # S1 plate from mean luma 31 to 4, i.e. black). Same end points as a monotone toe instead:
        # y = x - 0.1027*(1-x)^3 (0.08 -> 0, 1 -> 1, mids within 2 %).
        toe = "clip(val-26.19*pow(1-val/255\\,3)\\,0\\,255)"
        return f"lutrgb=r='{toe}':g='{toe}':b='{toe}'"
    if shot_id == "S5":
        return "vignette=angle=PI/3.4"
    return ""


def look_chain(shot_id, n):
    look = grade_strings()["LOOK"]
    if shot_id == "S7":
        # exposure collapse 1.9-2.8 s: the vignette tightens from angle 0.5 to PI/2.1 (power2.in)
        t0, t1 = 1.90 * FPS, (n - 1)
        expr = f"if(lt(n,{t0}),0.5,0.5+(PI/2.1-0.5)*pow(min((n-{t0})/{t1 - t0},1),2))"
        look = look.replace("vignette=angle=0.5", f"vignette=angle='{expr}':eval=frame")
    return look


# ----------------------------------------------------------------------------- stage: plates
def plate_path(shot_id, v, grain=True):
    return WORK / f"plate_{shot_id}_{v}{'' if grain else '_nograin'}.mkv"


def source_frames(shot, count):
    """Yield source frames (PIL RGB) for each output frame."""
    if shot["kind"] == "still":
        im = load_still(shot)
        for _ in range(count):
            yield im
        return
    key = prep_key(shot)
    meta = json.loads((WORK / f"prep_{key}.json").read_text())
    k0 = 2 * (int(round(shot["src"][0] * FPS)) - meta["a"])
    w, h, _ = (720, 1280, 0)
    smask = source_mask(shot["id"], w, h)
    got = 0
    for i, f in enumerate(reader(WORK / f"prep_{key}.mkv", w, h)):
        if i < k0:
            continue
        if got >= count:
            break
        if smask is not None:
            f = (f.astype(np.float32) * smask[..., None] + 0.5).astype(np.uint8)
        yield Image.fromarray(f)
        got += 1
    if got < count:
        raise SystemExit(f"{shot['id']}: prep has only {got} of {count} frames from k0={k0}")


def render_plate(shot, v, grain=True, count=None):
    n = nframes(shot)
    count = count or n
    out = plate_path(shot["id"], v, grain)
    if shot["id"] == "S7" and v == "d":
        pw, ph = 1920, 1080
    else:
        pw, ph = VARIANTS[v]["plate"]
    a, b = shot_crop(shot, v)
    move_n = shot.get("move_s", None)
    vf = "format=yuv444p," + look_chain(shot["id"], n)
    ex = extra_chain(shot["id"], n)
    if ex:
        vf += "," + ex
    if grain:
        vf += "," + grain_chain()
    vf += ",format=gbrp"
    wp = writer(out, pw, ph, vf)
    for i, src in enumerate(source_frames(shot, count)):
        if move_n:
            p = (i / FPS) / move_n
        else:
            p = i / max(n - 1, 1)
        x0, y0, x1, y1 = box_at(a, b, sine_in_out(p))
        W, H = src.size
        box = (max(0.0, x0 * W), max(0.0, y0 * H), min(float(W), x1 * W), min(float(H), y1 * H))  # float-noise guard
        fr = src.resize((pw, ph), Image.Resampling.LANCZOS, box=box)
        wp.stdin.write(fr.tobytes())
    wp.stdin.close()
    if wp.wait():
        raise SystemExit(f"plate encode failed {out}")
    log("plate", out.name)


def stage_plates():
    for s in SHOTS:                    # still pre stage once, before the parallel plate renders
        if s["kind"] == "still":
            load_still(s)
    jobs = [(s, v, True, None) for s in SHOTS + [LOOP] for v in "dm"]
    jobs += [(LOOP, v, False, 1) for v in "dm"]          # end stills: loop frame 0 without grain
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda j: render_plate(*j), jobs))


# ----------------------------------------------------------------------------- stage: masters
def srgb_to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055) * 255.0


def exposure(shot, i, n):
    """Linear-light gain for frame i of n (FILM A3 transitions)."""
    t = i / FPS                              # time since the shot's first frame
    tau = (n - 1 - i) / FPS                  # time to the shot's last frame
    stops, fade = 0.0, 1.0
    head, tail = shot["head"], shot["tail"]
    if head[0] == "cut" and t < 0.20:
        stops += -0.5 * (1 - sine_in_out(t / 0.20))
    elif head[0] in ("fade", "dip"):
        fade *= sine_in_out(t / head[1]) ** 2.2          # display-space ease = linear-light power 2.2
    if tail[0] == "cut" and tau < 0.20:
        stops += -0.5 * (1 - sine_in_out(tau / 0.20))
    elif tail[0] == "dip":
        fade *= sine_in_out(tau / tail[1]) ** 2.2
    elif tail[0] == "collapse" and t > tail[1]:
        p = (t - tail[1]) / ((n - 1) / FPS - tail[1])
        fade *= (1 - p * p) ** 2.2                       # power2.in to black on the last frame
    return fade * 2 ** stops


def apply_gain(img_u8, gain, mask=None):
    if gain >= 0.9999 and mask is None:
        return img_u8
    if gain <= 1e-6:
        return np.zeros_like(img_u8)
    lin = srgb_to_lin(img_u8.astype(np.float32))
    lin *= gain
    if mask is not None:
        lin *= (mask ** 2.2)[..., None]                  # burns are drawn in display space
    return (lin_to_srgb(lin) + 0.5).astype(np.uint8)


def black_clamp(img_u8):
    """DESIGN §5.3 black-point clamp: luma <= 6 -> 0, smooth ramp to 12, so the film's blacks merge with #000."""
    f = img_u8.astype(np.float32)
    Y = f[..., 0] * 0.2126 + f[..., 1] * 0.7152 + f[..., 2] * 0.0722
    k = smoothstep(6.0, 12.0, Y)
    return (f * k[..., None] + 0.5).astype(np.uint8)


def aperture_alpha(L, R, W=1920):
    x = np.arange(W, dtype=np.float32) + 0.5
    return smoothstep(L, L + FEATHER, x) * (1 - smoothstep(R - FEATHER, R, x))


def vertical_alpha(H=1080):
    y = (np.arange(H, dtype=np.float32) + 0.5) / H
    return smoothstep(0.0, V_FEATHER_TOP, y) * (1 - smoothstep(1.0 - V_FEATHER_BOTTOM, 1.0, y))


V_ALPHA = vertical_alpha()
# 120 px smooth ramps inside the 608 px plate (horizontal) x the top/bottom fade (vertical)
PLATE_ALPHA = aperture_alpha(0, 608, 608)[None, :] * V_ALPHA[:, None]
# edge crush weight: 1 at the shaft edge, 0 from 60 px inside it
_xe = np.arange(608, dtype=np.float32) + 0.5
EDGE_W = 1 - smoothstep(0, EDGE_CRUSH_PX, np.minimum(_xe, 608 - _xe))


def edge_crush(plate_u8):
    """CD-04: near the shaft edges, luma below 30 goes to black (smoothly), so lit paving or a kerb dissolves
    into the feather instead of reading as a bar."""
    f = plate_u8.astype(np.float32)
    Y = f[..., 0] * 0.2126 + f[..., 1] * 0.7152 + f[..., 2] * 0.0722
    k = 1 - EDGE_W[None, :] * (1 - smoothstep(EDGE_CRUSH_LUMA * 0.5, EDGE_CRUSH_LUMA, Y))
    return f * k[..., None]


def composite(plate_u8, v, alpha=None):
    """Desktop: plate centred in the black field with feathered edges (all four sides); mobile: the plate is the frame."""
    if v == "m":
        return plate_u8
    canvas = np.zeros((1080, 1920, 3), np.uint8)
    x0 = VARIANTS["d"]["plate_x"]
    canvas[:, x0:x0 + 608] = (edge_crush(plate_u8) * PLATE_ALPHA[..., None] + 0.5).astype(np.uint8)
    return canvas


def s7_masks(i):
    """Aperture opening: the side masks slide out over 0.0-0.9 s (power3.out) from the 608 px shaft."""
    e = power3_out((i / FPS) / 0.9)
    L = 656 + (-FEATHER - 656) * e
    R = 1264 + (1920 + FEATHER - 1264) * e
    return aperture_alpha(L, R)


def master_path(name, v):
    return WORK / f"master_{name}_{v}.mkv"


def build_intro_master(v):
    V = VARIANTS[v]
    wp = writer(master_path("intro", v), V["W"], V["H"])
    nt = 0
    for shot in SHOTS:
        n = nframes(shot)
        full = shot["id"] == "S7" and v == "d"
        pw, ph = (1920, 1080) if full else V["plate"]
        burn = plate_mask(shot["id"], pw, ph)
        burn = None if np.all(burn >= 0.9999) else burn
        for i, fr in enumerate(reader(plate_path(shot["id"], v), pw, ph)):
            g = exposure(shot, i, n)
            fr = apply_gain(fr, g, burn)
            if full:
                a = s7_masks(i)[None, :] * V_ALPHA[:, None]       # the aperture also fades top and bottom
                fr = (fr.astype(np.float32) * a[..., None] + 0.5).astype(np.uint8)
            else:
                fr = composite(fr, v)
            wp.stdin.write(black_clamp(fr).tobytes())
            nt += 1
        assert i == n - 1, (shot["id"], v, i, n)
    black = np.zeros((V["H"], V["W"], 3), np.uint8).tobytes()
    for _ in range(BLACK_HOLD):
        wp.stdin.write(black)
        nt += 1
    wp.stdin.close()
    wp.wait()
    assert nt == 384, nt
    log("master intro", v, nt, "frames")


def loop_frames(v, grain=True):
    pw, ph = VARIANTS[v]["plate"]
    burn = plate_mask("LOOP", pw, ph)
    out = []
    for fr in reader(plate_path("LOOP", v, grain), pw, ph):
        out.append(black_clamp(composite(apply_gain(fr, 1.0, burn), v)))
    return out


def build_loop_master(v):
    V = VARIANTS[v]
    fw = loop_frames(v)
    assert len(fw) == LOOP["frames"], len(fw)
    seq = fw + fw[-2:0:-1]                    # ping-pong without doubled frames at the turns: 85 + 83 = 168
    wp = writer(master_path("loop", v), V["W"], V["H"])
    for fr in seq:
        wp.stdin.write(fr.tobytes())
    wp.stdin.close()
    wp.wait()
    log("master loop", v, len(seq), "frames")


def stage_masters():
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda f: f(), [lambda v=v: build_intro_master(v) for v in "dm"] +
                    [lambda v=v: build_loop_master(v) for v in "dm"]))


# ----------------------------------------------------------------------------- stage: encode
def encode(src: Path, dst: Path, v: str, crf: int):
    lvl, maxrate, buf = ("4.1", "3500k", "7000k") if v == "d" else ("3.1", "2000k", "4000k")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src),
         "-map_metadata", "-1", "-map_chapters", "-1", "-an", "-r", str(FPS),
         "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p",
         "-pix_fmt", "yuv420p", "-c:v", "libx264", "-profile:v", "high", "-level", lvl, "-preset", "slow",
         "-crf", str(crf), "-maxrate", maxrate, "-bufsize", buf, "-x264-params", "aq-mode=3",
         "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
         "-movflags", "+faststart", "-metadata", f"title={TITLE}", "-metadata", f"comment={COMMENT}", str(dst)])


ENCODE_LOG = {}


def encode_one(job):
    name, v, fname = job
    src, dst = master_path(name, v), OUT / fname
    budget = BUDGET[fname] * 0.97
    for crf in CRF_RANGE:
        encode(src, dst, v, crf)
        size = dst.stat().st_size
        log(f"encode {fname} crf {crf}: {size:,} B (budget {BUDGET[fname]:,})")
        if size <= budget:
            ENCODE_LOG[fname] = crf
            return
    raise SystemExit(f"{fname} misses its budget at CRF {CRF_RANGE[-1]}")


def stage_encode():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [("intro", "d", "sf-film-desktop.mp4"), ("intro", "m", "sf-film-mobile.mp4"),
            ("loop", "d", "sf-film-loop-desktop.mp4"), ("loop", "m", "sf-film-loop-mobile.mp4")]
    with ThreadPoolExecutor(2) as ex:
        list(ex.map(encode_one, jobs))
    (WORK / "encode_crf.json").write_text(json.dumps(ENCODE_LOG, indent=1))


# ----------------------------------------------------------------------------- stage: end stills
END_STILLS = {"d": dict(base="sf-film-end-desktop", webp=[960, 1600, 1920], jpg=1600),
              "m": dict(base="sf-film-end-mobile", webp=[480, 720], jpg=720)}
END_BUDGET = {"sf-film-end-desktop-1600.webp": 200_000, "sf-film-end-desktop-1600.jpg": 220_000,
              "sf-film-end-mobile-720.webp": 110_000}


def stage_stills():
    OUT.mkdir(parents=True, exist_ok=True)
    for v, spec in END_STILLS.items():
        fr = loop_frames(v, grain=False)[0]
        im = Image.fromarray(fr)
        im.save(WORK / f"end_{v}_master.png")
        W, H = im.size
        for w in spec["webp"]:
            h = round(H * w / W)
            r = im if w == W else im.resize((w, h), Image.Resampling.LANCZOS)
            r = Image.fromarray(black_clamp(np.asarray(r)))
            for q in (84, 80, 76, 72, 68):
                f = OUT / f"{spec['base']}-{w}.webp"
                r.save(f, "WEBP", quality=q, method=6)
                if f.stat().st_size <= END_BUDGET.get(f.name, 10 ** 9):
                    break
        w = spec["jpg"]
        r = im if w == W else im.resize((w, round(H * w / W)), Image.Resampling.LANCZOS)
        r = Image.fromarray(black_clamp(np.asarray(r)))
        for q in (88, 85, 82, 78):
            f = OUT / f"{spec['base']}-{w}.jpg"
            r.save(f, "JPEG", quality=q, optimize=True, progressive=True, subsampling="4:2:0")
            if f.stat().st_size <= END_BUDGET.get(f.name, 10 ** 9):
                break
    log("end stills", sorted(p.name for p in OUT.glob("sf-film-end-*")))


# ----------------------------------------------------------------------------- stage: qa
def stage_qa():
    qa = WORK / "qa"
    if qa.exists():
        shutil.rmtree(qa)
    qa.mkdir(parents=True)
    for f in sorted(OUT.glob("sf-film-*.mp4")):
        d = qa / f.stem
        d.mkdir()
        run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(f), "-vf", "fps=2", "-q:v", "3", str(d / "t%03d.jpg")])
        frames = sorted(d.glob("t*.jpg"))
        ims = [Image.open(p) for p in frames]
        tw = 320 if ims[0].width > ims[0].height else 144
        th = round(ims[0].height * tw / ims[0].width)
        cols = 6 if tw == 320 else 9
        rows = math.ceil(len(ims) / cols)
        sheet = Image.new("RGB", (cols * (tw + 4), rows * (th + 4)), (40, 40, 40))
        for k, im in enumerate(ims):
            sheet.paste(im.resize((tw, th), Image.Resampling.LANCZOS), ((k % cols) * (tw + 4), (k // cols) * (th + 4)))
        sheet.save(qa / f"sheet_{f.stem}.jpg", quality=88)
    # contact sheet: the middle frame of every shot, desktop over mobile (deliverable, FILM A8)
    tiles = []
    for v in "dm":
        row = []
        for shot in SHOTS:
            full = shot["id"] == "S7" and v == "d"
            pw, ph = (1920, 1080) if full else VARIANTS[v]["plate"]
            n = nframes(shot)
            mid = n // 2
            for i, fr in enumerate(reader(plate_path(shot["id"], v), pw, ph)):
                if i == mid:
                    fr = apply_gain(fr, exposure(shot, i, n), plate_mask(shot["id"], pw, ph))
                    fr = fr if full else composite(fr, v)
                    row.append(Image.fromarray(black_clamp(fr)))
                    break
        tiles.append(row)
    tw_d, th_d, tw_m = 384, 216, 122
    sheet = Image.new("RGB", (7 * (tw_d + 8) + 8, th_d + 8 + 216 + 16), (24, 24, 24))
    for k, im in enumerate(tiles[0]):
        sheet.paste(im.resize((tw_d, th_d), Image.Resampling.LANCZOS), (8 + k * (tw_d + 8), 8))
    for k, im in enumerate(tiles[1]):
        sheet.paste(im.resize((tw_m, 216), Image.Resampling.LANCZOS), (8 + k * (tw_d + 8) + (tw_d - tw_m) // 2, th_d + 16))
    sheet.save(OUT / "contact-sheet.jpg", quality=86)
    log("qa sheets in", qa)


# ----------------------------------------------------------------------------- stage: manifest + EDL
def sha1(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()


def ffprobe_info(p: Path):
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "format=duration,bit_rate:format_tags=title:stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,nb_frames,color_transfer",
             "-of", "json", str(p)])
    return json.loads(r.stdout)


def edl():
    rec, rows = 0.0, []
    for s in SHOTS:
        src = s.get("clip") and CLIP_FILES[s["clip"]].relative_to(ROOT).as_posix() or (PHOTOS / s["still"]).relative_to(ROOT).as_posix()
        row = dict(shot=s["id"], beat=s["beat"], description=s["desc"], record_in=round(rec, 2), record_out=round(rec + s["dur"], 2),
                   duration_s=s["dur"], source=src, kind=s["kind"])
        if s["kind"] == "clip":
            row.update(source_in=s["src"][0], source_out=s["src"][1], speed=0.5,
                       slow_motion=SHOT_SLOMO.get(s["id"], "mci"), vidstab=s["stab"])
        if s["id"] == "S7":
            row["source_note"] = "balaclava third-party mark toned down (process_stills.retouch_balaclava_logo)"
            row["aperture"] = "side masks open from the 608 px shaft to full frame over 0.0-0.9 s (power3.out)"
        row["crop_x0y0x1y1"] = {k: [list(c[0]), list(c[1])] for k, c in s["crop"].items()}
        row["in"], row["out"] = list(s["head"]), list(s["tail"])
        rows.append(row)
        rec += s["dur"]
    rows.append(dict(shot="BLACK", record_in=round(rec, 2), record_out=round(rec + BLACK_HOLD / FPS, 2),
                     duration_s=BLACK_HOLD / FPS, source="black", description="black hold: handoff to the DOM logo reveal"))
    return rows


def tool_versions():
    import PIL
    return {"python": sys.version.split()[0], "pillow": PIL.__version__, "numpy": np.__version__,
            "ffmpeg": run(["ffmpeg", "-version"]).stdout.splitlines()[0]}


def stage_manifest():
    crf = json.loads((WORK / "encode_crf.json").read_text()) if (WORK / "encode_crf.json").exists() else {}
    rows = edl()
    (OUT / "edit-decision-list.json").write_text(json.dumps(
        {"title": TITLE, "note": COMMENT, "fps": FPS, "intro_duration_s": 12.8, "shots": rows,
         "loop": dict(source=CLIP_FILES["IMG_4376"].relative_to(ROOT).as_posix(), source_in=3.40, source_out=4.80,
                      speed=0.5, structure="85 frames forward + 83 frames reversed = 168 frames (5.6 s), seamless",
                      crop_x0y0x1y1=list(LOOP["crop"]["*"][0]))}, indent=1) + "\n")
    films = []
    for fname in BUDGET:
        p = OUT / fname
        if not p.exists():
            continue
        info = ffprobe_info(p)
        st, fm = info["streams"][0], info["format"]
        v = "d" if "desktop" in fname else "m"
        is_loop = "loop" in fname
        films.append(dict(
            file=fname, path=p.relative_to(ROOT).as_posix(), role="loop" if is_loop else "intro",
            variant=VARIANTS[v]["name"], width=st["width"], height=st["height"], fps=FPS,
            frames=int(st.get("nb_frames", 0)), duration_s=round(float(fm["duration"]), 3), bytes=p.stat().st_size,
            budget_bytes=BUDGET[fname], kbps=round(int(fm["bit_rate"]) / 1000), codec="h264", profile=st.get("profile"),
            pix_fmt=st.get("pix_fmt"), crf=crf.get(fname), audio=False, sha1=sha1(p), title=TITLE,
            composition=("aperture: 608x1080 plate centred at x 656 in a #000 field, 72 px feathered edges"
                         if v == "d" else "9:16 plates, full frame"),
            ends_on_black_s=None if is_loop else round(BLACK_HOLD / FPS, 2), logo_baked=False,
            segments=([dict(shot="LOOP", source="media/source/footage/" + CLIP_FILES["IMG_4376"].name,
                            source_in=3.40, source_out=4.80, speed=0.5, ping_pong=True)] if is_loop else
                      [dict(shot=r["shot"], record_in=r["record_in"], record_out=r["record_out"], source=r["source"],
                            **({"source_in": r["source_in"], "source_out": r["source_out"], "speed": 0.5}
                               if "source_in" in r else {})) for r in rows])))
    stills = []
    for v, spec in END_STILLS.items():
        for f in sorted(OUT.glob(spec["base"] + "-*")):
            im = Image.open(f)
            stills.append(dict(file=f.name, base=spec["base"], path=f.relative_to(ROOT).as_posix(), width=im.width,
                               height=im.height, bytes=f.stat().st_size, sha1=sha1(f),
                               source="media/source/footage/" + CLIP_FILES["IMG_4376"].name,
                               crop=[round(0.04 * 720), 0, round(0.76 * 720), round(0.76 * 1280)],
                               ops=["loop frame 0 (source 3.40 s)", "grade.sh pre + LOOK + S6 layer", "no grain",
                                    "no logo", "black-point clamp luma<=6 -> 0, ramp to 12"]
                               + (["aperture composite 1920x1080"] if v == "d" else []),
                               owner=SCRIPT, alt=""))
    m = dict(generated_at=_dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat(), generator=SCRIPT,
             tool_versions=tool_versions(),
             honesty=("Edit of client-supplied phone footage (4 iPhone clips, 3 used) and photography (3 stills). "
                      "Graded, slowed to 0.5x with motion interpolation, slow sub-pixel moves on stills. "
                      "Not a commissioned campaign film; no video generation."),
             films=films, theme_assets=stills,
             end_stills={spec["base"]: dict(webp_widths=spec["webp"], fallback_width=spec["jpg"], fallback_ext="jpg",
                                            width=(1920 if v == "d" else 720), height=(1080 if v == "d" else 1280),
                                            intrinsic_fallback=[spec["jpg"], round(spec["jpg"] * (1080 / 1920 if v == "d" else 1280 / 720))],
                                            alt="")
                         for v, spec in END_STILLS.items()},
             dropped_widths=[dict(base="sf-film-end-desktop", width=2400, native_width=1920,
                                  reason="would upscale the 1920x1080 composite (FILM A7)"),
                             dict(base="sf-film-end-mobile", width=1080, native_width=720,
                                  reason="1.5x upscale of the 720x1280 plate (FILM A7)")])
    MANIFEST.write_text(json.dumps(m, indent=1) + "\n")
    log("manifest", MANIFEST.relative_to(ROOT), len(films), "films", len(stills), "stills")


def stage_install():
    ASSETS.mkdir(parents=True, exist_ok=True)
    names = list(BUDGET) + [p.name for p in OUT.glob("sf-film-end-*")]
    for n in names:
        shutil.copy2(OUT / n, ASSETS / n)
    log("installed", len(names), "files into theme/assets")


STAGES = {"prep": stage_prep, "plates": stage_plates, "masters": stage_masters, "encode": stage_encode,
          "stills": stage_stills, "qa": stage_qa, "manifest": stage_manifest, "install": stage_install}


def main(argv):
    todo = argv or list(STAGES)
    bad = [s for s in todo if s not in STAGES]
    if bad:
        raise SystemExit(f"unknown stage(s) {bad}; stages: {' '.join(STAGES)}")
    WORK.mkdir(parents=True, exist_ok=True)
    log("work dir", WORK)
    for s in todo:
        STAGES[s]()


if __name__ == "__main__":
    main(sys.argv[1:])
