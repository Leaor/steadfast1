#!/usr/bin/env python3
"""STEADFAST font pipeline (reproducible, idempotent). DESIGN §3.1/§3.2, ARCHITECTURE §10.1.

    python3 -I tools/media/build_fonts.py

Fetches the two OFL packages from npm (pinned versions, `npm pack` into a temp dir), then writes the
five static woff2 files the theme uses to media/processed/fonts/ (plus the OFL licence texts) and
records them under `fonts` in media/processed/manifest.json (only that key is replaced).

  sf-font-display-300.woff2         Spectral 300 normal           @fontsource/spectral@5.3.0 (latin), re-subset
  sf-font-display-300-italic.woff2  Spectral 300 italic           same
  sf-font-text-400.woff2            Archivo wght=400 wdth=100     @fontsource-variable/archivo@5.3.0, instanced
  sf-font-text-500.woff2            Archivo wght=500 wdth=100     same
  sf-font-label-500.woff2           "Archivo Label" wght=500 wdth=115   same (own family name)

Each file is subset to the fontsource Latin range (+ the punctuation the UI needs), hinting dropped,
layout features kept (kern, liga, tnum, pnum, frac, …), and must be <= 40 KB. The script also
measures the vertical metrics and the average advance against Liberation Sans / Serif (metric
clones of Arial / Times New Roman) so CORE can check DESIGN §3.2's fallback overrides.

Needs: fonttools + brotli (`pip install fonttools brotli`), npm.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "media/processed/fonts"
MANIFEST = ROOT / "media/processed/manifest.json"
SCRIPT = "tools/media/build_fonts.py"
BUDGET = 40 * 1024

PKG_SPECTRAL = "@fontsource/spectral@5.3.0"
PKG_ARCHIVO = "@fontsource-variable/archivo@5.3.0"

# fontsource "latin" unicode-range (same for both packages)
LATIN = ("U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
         "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD")
FEATURES = ["kern", "liga", "clig", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "pnum", "lnum", "onum",
            "frac", "numr", "dnom", "case", "rvrn"]

FALLBACK_SANS = Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")
FALLBACK_SERIF = Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf")
SAMPLE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "


def npm_fetch(spec: str, work: Path) -> Path:
    d = work / spec.replace("/", "_").replace("@", "")
    if (d / "package").exists():
        return d / "package"
    d.mkdir(parents=True, exist_ok=True)
    out = subprocess.run(["npm", "pack", spec, "--silent", "--pack-destination", str(d)], capture_output=True,
                         text=True, check=True).stdout.strip().splitlines()[-1]
    with tarfile.open(d / out) as tf:
        tf.extractall(d, filter="data")
    return d / "package"


def parse_range(r: str):
    cps = []
    for part in r.split(","):
        part = part.strip().upper().replace("U+", "")
        if "-" in part:
            a, b = part.split("-")
            cps.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            cps.append(int(part, 16))
    return cps


def subset_font(font: TTFont, out: Path):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.hinting = False
    opts.desubroutinize = True
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=parse_range(LATIN))
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)


def rename_family(font: TTFont, family: str, style: str = "Regular"):
    """Give an instanced font a stable family/style name (nameIDs 1, 2, 4, 6, 16, 17)."""
    name = font["name"]
    full = f"{family} {style}" if style != "Regular" else family
    ps = (family + "-" + style).replace(" ", "")
    for nid, val in ((1, family), (2, style), (4, full), (6, ps), (16, family), (17, style)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    # drop variation-specific names that no longer apply
    for nid in (25,):
        name.removeNames(nameID=nid)


def avg_advance(font: TTFont) -> float:
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    ws = [hmtx[cmap[ord(c)]][0] for c in SAMPLE if ord(c) in cmap]
    return sum(ws) / len(ws) / upm


def metrics(path: Path, fallback: Path | None):
    f = TTFont(path)
    upm = f["head"].unitsPerEm
    os2, hhea = f["OS/2"], f["hhea"]
    m = {
        "units_per_em": upm,
        "hhea_ascent": round(hhea.ascent / upm, 4), "hhea_descent": round(-hhea.descent / upm, 4),
        "hhea_line_gap": round(hhea.lineGap / upm, 4),
        "typo_ascender": round(os2.sTypoAscender / upm, 4), "typo_descender": round(-os2.sTypoDescender / upm, 4),
        "cap_height": round(getattr(os2, "sCapHeight", 0) / upm, 4),
        "x_height": round(getattr(os2, "sxHeight", 0) / upm, 4),
        "avg_advance_em": round(avg_advance(f), 4),
        "glyphs": len(f.getGlyphOrder()),
        "features": sorted({fr.FeatureTag for fr in f["GSUB"].table.FeatureList.FeatureRecord}) if "GSUB" in f else [],
    }
    if fallback and fallback.exists():
        fb = TTFont(fallback)
        k = m["avg_advance_em"] / avg_advance(fb)
        m["fallback"] = {
            "font": fallback.name,
            "size_adjust_pct": round(k * 100, 1),
            # with size-adjust applied, the overrides are relative to the adjusted em
            "ascent_override_pct": round(m["hhea_ascent"] / k * 100, 1),
            "descent_override_pct": round(m["hhea_descent"] / k * 100, 1),
            "line_gap_override_pct": round(m["hhea_line_gap"] / k * 100, 1),
        }
    return m


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="sf-fonts-"))
    try:
        sp = npm_fetch(PKG_SPECTRAL, work)
        ar = npm_fetch(PKG_ARCHIVO, work)
        records = []

        jobs = [
            ("sf-font-display-300.woff2", "Spectral", 300, "normal", None, sp / "files/spectral-latin-300-normal.woff2",
             PKG_SPECTRAL, None, FALLBACK_SERIF),
            ("sf-font-display-300-italic.woff2", "Spectral", 300, "italic", None,
             sp / "files/spectral-latin-300-italic.woff2", PKG_SPECTRAL, None, FALLBACK_SERIF),
            ("sf-font-text-400.woff2", "Archivo", 400, "normal", {"wght": 400, "wdth": 100},
             ar / "files/archivo-latin-standard-normal.woff2", PKG_ARCHIVO, ("Archivo", "Regular"), FALLBACK_SANS),
            ("sf-font-text-500.woff2", "Archivo", 500, "normal", {"wght": 500, "wdth": 100},
             ar / "files/archivo-latin-standard-normal.woff2", PKG_ARCHIVO, ("Archivo", "Medium"), FALLBACK_SANS),
            ("sf-font-label-500.woff2", "Archivo Label", 500, "normal", {"wght": 500, "wdth": 115},
             ar / "files/archivo-latin-standard-normal.woff2", PKG_ARCHIVO, ("Archivo Label", "Medium"), FALLBACK_SANS),
        ]
        for fname, family, weight, style, axes, src, pkg, rename, fb in jobs:
            font = TTFont(src)
            ops = [f"source {pkg} files/{src.name}"]
            if axes:
                font = instancer.instantiateVariableFont(font, axes, inplace=False, updateFontNames=False)
                ops.append("fontTools.varLib.instancer " + " ".join(f"{k}={v}" for k, v in axes.items()))
                font["OS/2"].usWeightClass = weight
                font["OS/2"].usWidthClass = 7 if axes.get("wdth", 100) >= 112.5 else 5
                if rename:
                    rename_family(font, *rename)
                    ops.append(f"named '{rename[0]}' / '{rename[1]}'")
            p = OUT / fname
            subset_font(font, p)
            ops.append("pyftsubset-equivalent: fontsource latin range, hinting dropped, layout features kept")
            size = p.stat().st_size
            if size > BUDGET:
                raise SystemExit(f"{fname}: {size} bytes > {BUDGET} budget")
            records.append({
                "file": fname, "family": family, "weight": weight, "style": style,
                "axes": axes or {"static": True}, "unicode_range": LATIN.replace("U+", "U+"),
                "source_pkg": pkg, "bytes": size, "sha1": hashlib.sha1(p.read_bytes()).hexdigest(),
                "path": str(p.relative_to(ROOT)), "ops": ops, "metrics": metrics(p, fb), "owner": SCRIPT,
                "licence": "OFL-1.1",
            })
            print(f"{fname:36s} {size:6d} B  {family} {weight} {style} {axes or ''}")

        shutil.copyfile(sp / "LICENSE", OUT / "OFL-Spectral.txt")
        shutil.copyfile(ar / "LICENSE", OUT / "OFL-Archivo.txt")

        data = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
        data["fonts"] = records
        tv = data.get("tool_versions") or {}
        import fontTools
        tv["fonttools"] = fontTools.version
        data["tool_versions"] = tv
        data["fonts_generated_at"] = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
        tmp = MANIFEST.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=1))
        os.replace(tmp, MANIFEST)
        total = sum(r["bytes"] for r in records)
        print(f"total {total} B; licences: OFL-Spectral.txt, OFL-Archivo.txt")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
