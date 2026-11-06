#!/usr/bin/env bash
# STEADFAST film grade — ffmpeg -vf filter chains for the client's iPhone footage.
#
# Look: cold steel near-monochrome, crushed blacks, silver (soft-clipped) highlights,
# fine temporal luma grain, gentle vignette, clean S-curve contrast (no halation/glow).
#
# Usage as a library (source it):
#   source tools/media/grade.sh
#   vf=$(steadfast_vf IMG_4913 0,0.28,0.60,0.60 540x960)        # crop = x,y,w,h fractions of the upright 720x1280 frame
#   ffmpeg -i media/source/footage/IMG_4913-day-embossed-closeup.MOV -an -vf "$vf" ...
#
# Usage as a command:
#   tools/media/grade.sh vf IMG_4376 0.04,0,0.76,0.76 720x1280   # print the chain
#   tools/media/grade.sh tests                                    # render before/after jpgs to media/analysis/grade-tests/
#
# Notes
# - The three HEVC clips (4913, 4376, 4374) are 10-bit HLG / BT.2020. They are tone-mapped to
#   BT.709 SDR with zscale + hable (keeps highlight detail that a naive decode clips).
#   IMG_4409 is 8-bit H.264 BT.709 and needs no conversion.
# - All clips carry a -90 display matrix; ffmpeg autorotates on decode, so filters see 720x1280
#   (IMG_4409: 540x960) upright frames. Do not add transpose.
# - Grain is applied last, after the final scale, so its size is tied to output pixels.
#   Never scale after STEADFAST_GRAIN.
# - Per-clip "pre" stages normalise exposure and set the mono mix weights; the LOOK is shared.

STEADFAST_HLG_TO_SDR="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# Mono mix with partial colour retention: steadfast_mono wr wg wb amount(0..1)
steadfast_mono() {
  awk -v r="$1" -v g="$2" -v b="$3" -v m="$4" 'BEGIN{k=1-m;
    printf "colorchannelmixer=rr=%.3f:rg=%.3f:rb=%.3f:gr=%.3f:gg=%.3f:gb=%.3f:br=%.3f:bg=%.3f:bb=%.3f",
      k+m*r,m*g,m*b, m*r,k+m*g,m*b, m*r,m*g,k+m*b }'
}

# Map a file path or clip id to the clip id (IMG_xxxx)
steadfast_clip_id() { local b; b=$(basename "$1"); echo "${b%%-*}" | sed 's/\.[A-Za-z0-9]*$//'; }

# Decode/normalise stage per clip (output: gbrp, still at source resolution)
steadfast_pre() {
  local id; id=$(steadfast_clip_id "$1")
  case "$id" in
    # Overcast daylight: pull exposure down ~1 stop, compress the sky, blue-filter mono mix
    # (darkens the yellow car + green foliage relative to the grey garment).
    IMG_4913) echo "$STEADFAST_HLG_TO_SDR,format=gbrp,curves=m='0/0 0.3/0.22 0.6/0.52 0.85/0.76 1/0.84',$(steadfast_mono 0.22 0.50 0.28 0.96)" ;;
    # Night forecourt, garment sits low: lift mids, keep blacks down.
    IMG_4376) echo "$STEADFAST_HLG_TO_SDR,format=gbrp,curves=m='0/0 0.03/0.02 0.12/0.23 0.35/0.57 0.65/0.84 1/0.96',$(steadfast_mono 0.30 0.55 0.15 0.92)" ;;
    IMG_4374) echo "$STEADFAST_HLG_TO_SDR,format=gbrp,curves=m='0/0 0.04/0.02 0.15/0.24 0.4/0.58 0.7/0.86 1/0.97',$(steadfast_mono 0.25 0.55 0.20 0.94)" ;;
    # Red-lit SDR: low red weight in the mono mix kills the red cast instead of rendering it as glow.
    IMG_4409) echo "format=gbrp,curves=m='0/0 0.06/0.02 0.25/0.30 0.55/0.66 1/0.95',$(steadfast_mono 0.12 0.58 0.30 0.95)" ;;
    *) echo "format=gbrp,$(steadfast_mono 0.30 0.55 0.15 0.92)" ;;
  esac
}

# Light denoise at source res before any crop/upscale (phone noise would otherwise be enlarged).
STEADFAST_DENOISE="format=yuv444p,hqdn3d=2:1.5:4:4"

# Shared look (runs after crop+scale): luma clarity, crush/rolloff S-curve (white caps at ~0.92 = silver,
# not paper white), cold steel split-tone, gentle vignette.
STEADFAST_LOOK="unsharp=9:9:0.35:9:9:0,curves=m='0/0 0.07/0.01 0.2/0.10 0.45/0.37 0.7/0.66 0.9/0.86 1/0.92',colorbalance=rs=-0.03:gs=-0.005:bs=0.045:rm=-0.02:bm=0.025:rh=-0.015:bh=0.015,vignette=angle=0.5"

# Fine temporal luma-only grain. Must run on YUV so c0 = luma (on gbrp it would be green-only).
STEADFAST_GRAIN_STRENGTH="${STEADFAST_GRAIN_STRENGTH:-3}"
steadfast_grain() { echo "format=yuv420p,noise=c0s=${1:-$STEADFAST_GRAIN_STRENGTH}:c0f=t"; }
STEADFAST_GRAIN="$(steadfast_grain)"

# Full chain: steadfast_vf <clip-id|file> [x,y,w,h fractions|full] [WxH]
steadfast_vf() {
  local clip="$1" crop="${2:-full}" size="${3:-720x1280}" cropf="" x y w h
  if [ "$crop" != "full" ]; then
    IFS=, read -r x y w h <<<"$crop"
    cropf=",crop=trunc(iw*$w/2)*2:trunc(ih*$h/2)*2:trunc(iw*$x):trunc(ih*$y)"
  fi
  echo "$(steadfast_pre "$clip"),$STEADFAST_DENOISE$cropf,scale=${size/x/:}:flags=lanczos,setsar=1,$STEADFAST_LOOK,$STEADFAST_GRAIN"
}

# Ungraded reference chain (tone-mapped only), for before/after comparisons
steadfast_vf_ref() {
  local id; id=$(steadfast_clip_id "$1")
  if [ "$id" = IMG_4409 ]; then echo "format=yuv420p"; else echo "$STEADFAST_HLG_TO_SDR"; fi
}

_steadfast_tests() {
  local root out src id t crop tag f
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  src="$root/media/source/footage"; out="$root/media/analysis/grade-tests"; mkdir -p "$out"
  # clip  time  9:16 crop (x,y,w,h)
  while read -r id t crop; do
    [ -z "$id" ] && continue
    f=$(ls "$src/$id"*.MOV); tag="${id}_${t/./p}s"
    ffmpeg -nostdin -v error -y -ss "$t" -i "$f" -frames:v 1 -vf "$(steadfast_vf_ref "$id"),scale=360:640:flags=lanczos,setsar=1" -q:v 4 "$out/${tag}_before.jpg"
    ffmpeg -nostdin -v error -y -ss "$t" -i "$f" -frames:v 1 -vf "$(steadfast_vf "$id" full 540x960),scale=360:640:flags=lanczos" -q:v 4 "$out/${tag}_after.jpg"
    ffmpeg -nostdin -v error -y -ss "$t" -i "$f" -frames:v 1 -vf "$(steadfast_vf "$id" "$crop" 540x960)" -q:v 4 "$out/${tag}_after-crop916.jpg"
    echo "$tag"
  done <<'EOF'
IMG_4913 0.5  0,0.28,0.60,0.60
IMG_4913 3.4  0,0.15,0.72,0.72
IMG_4913 6.5  0.02,0.18,0.78,0.78
IMG_4376 2.5  0.08,0,0.80,0.80
IMG_4376 4.25 0.04,0,0.76,0.76
IMG_4374 1.0  0.16,0.21,0.56,0.56
IMG_4374 3.0  0.16,0.21,0.56,0.56
IMG_4409 0.75 0.40,0.14,0.58,0.58
IMG_4409 4.0  0.40,0.14,0.58,0.58
EOF
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -euo pipefail
  case "${1:-}" in
    vf) shift; steadfast_vf "$@" ;;
    ref) shift; steadfast_vf_ref "$@" ;;
    tests) _steadfast_tests ;;
    *) sed -n '2,22p' "$0" ;;
  esac
fi
