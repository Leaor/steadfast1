#!/usr/bin/env python3
"""Generate theme/snippets/sf-asset-data.liquid and sync bundled media into theme/assets (ARCHITECTURE §10.3).

    python3 -I tools/media/gen_asset_snippet.py              # generate + copy (idempotent; exit 0)
    python3 -I tools/media/gen_asset_snippet.py --check      # verify only: exit 1 if anything is stale/missing
    python3 -I tools/media/gen_asset_snippet.py --include-pending   # also emit asset_alts.json "pending" bases

Reads
  media/processed/manifest.json        stills/logo/fonts (tools/media/process_stills.py, build_fonts.py)
  media/processed/manifest.films.json  films + end stills (tools/media/build_film.py); optional, may land later
  tools/media/asset_alts.json          default alts per base (+ "pending" records)
Writes
  theme/snippets/sf-asset-data.liquid  one `when` per raster base: webp_widths|fallback_width|fallback_ext|width|height|alt
  theme/assets/<file>                  every bundled file (stills, logo, favicons, og, grain, fonts, films), exact names;
                                       copied only when missing or different (sha1), so re-runs are no-ops.
                                       Stale MEDIA-owned files (in our prefixes, no longer in a manifest) are removed.

Raster bases are those whose files follow `{base}-{width}.{ext}` (sf-image builds `{base}-{fallback_width}.{ext}`).
The fallback is the base's one JPG/PNG (else a WebP width <= 1200); width/height are that file's intrinsic size.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "media/processed/manifest.json"
MANIFEST_FILMS = ROOT / "media/processed/manifest.films.json"
ALTS = ROOT / "tools/media/asset_alts.json"
SNIPPET = ROOT / "theme/snippets/sf-asset-data.liquid"
ASSETS = ROOT / "theme/assets"

# MEDIA-owned name prefixes in theme/assets (stale-file pruning never touches anything else, e.g. CSS/JS).
MEDIA_PREFIXES = ("sf-logo-", "sf-category-", "sf-signature-", "sf-lookbook-", "sf-campaign-", "sf-editorial-",
                  "sf-grain", "sf-favicon-", "sf-apple-touch-icon-", "sf-og-", "sf-font-", "sf-film-")
MEDIA_EXTS = {".webp", ".jpg", ".png", ".svg", ".woff2", ".mp4"}
NAME_RE = re.compile(r"^(?P<base>.+)-(?P<w>\d+)\.(?P<ext>webp|jpg|png)$")


def sha1(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()


def load(p: Path, required: bool):
    if not p.exists():
        if required:
            sys.exit(f"missing {p.relative_to(ROOT)}")
        print(f"note: {p.relative_to(ROOT)} not found (skipped)")
        return {}
    return json.loads(p.read_text())


def collect(include_pending: bool):
    m = load(MANIFEST, True)
    mf = load(MANIFEST_FILMS, False)
    alts_doc = load(ALTS, True)
    alts, pending = alts_doc.get("alts", {}), alts_doc.get("pending", {})

    files: dict[str, Path] = {}       # theme/assets name -> source path
    entries = []                      # (file, base, width, height, alt-or-None)

    def add(name, path, src_label):
        src = ROOT / path
        if not src.exists():
            sys.exit(f"{src_label}: {path} listed but missing")
        if name in files and files[name].resolve() != src.resolve() and sha1(files[name]) != sha1(src):
            sys.exit(f"conflict: {name} listed by two manifests with different content")
        files[name] = src

    for e in m.get("theme_assets", []):
        add(e["file"], e["path"], "manifest.json")
        entries.append((e["file"], e.get("base"), e.get("width"), e.get("height"), e.get("alt")))
    for f in m.get("fonts", []):
        add(f["file"], f["path"], "manifest.json fonts")
    for e in mf.get("theme_assets", []):
        add(e["file"], e["path"], "manifest.films.json")
        entries.append((e["file"], e.get("base"), e.get("width"), e.get("height"), e.get("alt")))
    for f in mf.get("films", []):
        if f.get("path"):
            add(f["file"], f["path"], "manifest.films.json films")

    # group raster files by base
    bases: dict[str, dict] = {}
    for name, base, w, h, alt in entries:
        mm = NAME_RE.match(name)
        if not mm or not base or mm.group("base") != base:
            continue                                  # svg, favicons, og image, sf-grain.webp: not srcset assets
        b = bases.setdefault(base, {"webp": {}, "other": {}, "alt": None})
        width = int(mm.group("w"))
        (b["webp"] if mm.group("ext") == "webp" else b["other"])[width] = (mm.group("ext"), int(w), int(h))
        if alt is not None and b["alt"] is None:
            b["alt"] = alt

    records = {}
    for base, b in sorted(bases.items()):
        webp = sorted(b["webp"])
        if b["other"]:
            fw = sorted(b["other"])[0] if len(b["other"]) == 1 else min(b["other"], key=lambda x: abs(x - 1200))
            ext, iw, ih = b["other"][fw]
        else:
            cands = [w for w in webp if w <= 1200] or webp
            fw = max(cands)
            ext, iw, ih = b["webp"][fw]
        alt = alts.get(base, b["alt"] if b["alt"] is not None else "")
        if alt is None:
            alt = ""
        if "|" in alt or "{" in alt or "%" in alt:
            sys.exit(f"alt for {base} contains a forbidden character: {alt!r}")
        if base not in alts:
            print(f"warning: no default alt for {base} in asset_alts.json (using '{alt}')")
        records[base] = {"webp_widths": webp, "fallback_width": fw, "fallback_ext": ext, "width": iw, "height": ih,
                         "alt": alt}

    for base, p in pending.items():
        if base in records:
            continue
        if include_pending:
            records[base] = dict(p, alt=alts.get(base, ""))
            print(f"pending: emitted {base} (files not yet in a manifest)")
        else:
            print(f"pending: {base} not in any manifest yet; not emitted")
    return files, dict(sorted(records.items()))


def render(records) -> str:
    lines = [
        "{%- doc -%}",
        "  GENERATED by tools/media/gen_asset_snippet.py from media/processed/manifest.json (+ manifest.films.json)",
        "  and tools/media/asset_alts.json. Do not edit: re-run the generator (ARCHITECTURE §10.3).",
        "",
        "  Outputs exactly one line `webp_widths|fallback_width|fallback_ext|width|height|alt` for a bundled",
        "  asset base (ARCHITECTURE §10.1), or nothing for an unknown base. Files are `{base}-{width}.webp` plus",
        "  `{base}-{fallback_width}.{fallback_ext}`; width/height are the fallback file's intrinsic size.",
        "",
        "  @param {string} asset - Bundled asset base name, e.g. 'sf-signature-hero'.",
        "",
        "  @example",
        "  {%- capture rec -%}{% render 'sf-asset-data', asset: 'sf-signature-hero' %}{%- endcapture -%}",
        "  {%- assign parts = rec | strip | split: '|' -%}",
        "{%- enddoc -%}",
        "{%- comment -%} GENERATED — do not edit. {%- endcomment -%}",
        "{%- case asset -%}",
    ]
    for base, r in records.items():
        line = "|".join([",".join(str(w) for w in r["webp_widths"]), str(r["fallback_width"]), r["fallback_ext"],
                         str(r["width"]), str(r["height"]), r["alt"]])
        lines.append(f"  {{%- when '{base}' -%}}{line}")
    lines.append("{%- endcase -%}")
    return "\n".join(lines) + "\n"


def main(argv):
    check = "--check" in argv
    files, records = collect("--include-pending" in argv)
    problems = []

    text = render(records)
    if not SNIPPET.exists() or SNIPPET.read_text() != text:
        if check:
            problems.append("sf-asset-data.liquid is stale")
        else:
            SNIPPET.parent.mkdir(parents=True, exist_ok=True)
            SNIPPET.write_text(text)
            print(f"wrote {SNIPPET.relative_to(ROOT)} ({len(records)} bases)")
    else:
        print(f"{SNIPPET.relative_to(ROOT)} up to date ({len(records)} bases)")

    ASSETS.mkdir(parents=True, exist_ok=True)
    copied = 0
    for name, src in sorted(files.items()):
        dst = ASSETS / name
        if dst.exists() and dst.stat().st_size == src.stat().st_size and sha1(dst) == sha1(src):
            continue
        if check:
            problems.append(f"theme/assets/{name} missing or different")
            continue
        shutil.copyfile(src, dst)
        copied += 1
    removed = []
    for p in sorted(ASSETS.iterdir()):
        if p.suffix in MEDIA_EXTS and p.name.startswith(MEDIA_PREFIXES) and p.name not in files:
            if p.name.startswith("sf-film-"):
                continue                              # film files are copied here but pruned only by build_film.py
            if check:
                problems.append(f"theme/assets/{p.name} is stale (not in a manifest)")
            else:
                p.unlink()
                removed.append(p.name)

    # every file a record points at must exist in theme/assets
    for base, r in records.items():
        need = [f"{base}-{w}.webp" for w in r["webp_widths"]] + [f"{base}-{r['fallback_width']}.{r['fallback_ext']}"]
        for n in need:
            if not (ASSETS / n).exists() and not check:
                problems.append(f"record {base} references missing theme/assets/{n}")

    media_bytes = sum((ASSETS / n).stat().st_size for n in files if (ASSETS / n).exists())
    all_bytes = sum(p.stat().st_size for p in ASSETS.iterdir() if p.is_file())
    print(f"assets: {len(files)} bundled media files ({media_bytes / 1e6:.2f} MB); copied {copied}; "
          f"removed {len(removed)}{' ' + ', '.join(removed) if removed else ''}")
    print(f"theme/assets total: {sum(1 for _ in ASSETS.iterdir())} files, {all_bytes / 1e6:.2f} MB")
    if problems:
        print("PROBLEMS:\n  " + "\n  ".join(problems))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
