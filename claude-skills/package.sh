#!/usr/bin/env bash
# Builds claude.ai-uploadable skill zips (Customize > Skills > Upload) into ./dist.
# Each zip contains <skill-name>/SKILL.md at its top level, as claude.ai requires.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
CLAUDE_SKILLS_DIR="$STAGE" bash "$HERE/bootstrap.sh" --custom >/dev/null
rm -rf "$HERE/dist" && mkdir -p "$HERE/dist"
cd "$STAGE"
for d in */; do
  n="${d%/}"; rm -f "$n/.installed-by-premium-bootstrap"
  (zip -qr -X "$HERE/dist/$n.zip" "$n" -x '*/__pycache__/*' '*.pyc' '*/tests/*') && echo "dist/$n.zip"
done
