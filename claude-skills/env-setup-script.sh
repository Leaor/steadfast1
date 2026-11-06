# Premium web skill stack -> ~/.claude/skills (pinned, reviewed). Non-fatal on failure.
cat > /tmp/skill-bootstrap.sh <<'BOOT'
#!/usr/bin/env bash
# Installs the premium web skill stack into ~/.claude/skills (personal scope).
# Idempotent. Pinned to reviewed commits. No credentials. Safe as a cloud setup script.
# Usage: bash bootstrap.sh            (third-party skills only)
#        bash bootstrap.sh --custom   (also premium-web-experience from this repo)
set -euo pipefail
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo .)"
DS_REPO=https://github.com/freshtechbro/claudedesignskills
DS_SHA=1da73febff0c3e1dfefc07f8a5ef8f7d1dfdb6cd
UX_REPO=https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
UX_SHA=b7d5353e0130feb8c5574ef1251f8a1db1873ccb
REV=2  # bump when the install transform changes
DS_SKILLS="threejs-webgl react-three-fiber gsap-scrolltrigger motion-framer spline-interactive"
DS_SKILLS="$DS_SKILLS rive-interactive lottie-animations modern-web-design web3d-integration-patterns"
MARK=.installed-by-premium-bootstrap
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

fetch() { # repo sha dir
  git init -q "$3" && git -C "$3" fetch -q --depth 1 "$1" "$2" && git -C "$3" checkout -q FETCH_HEAD
}
synced() { # true if the skill already arrives via claude.ai account sync
  grep -qs "\"name\": *\"$1\"" "$DEST"/synced/*/manifest.json
}
place() { # name srcdir version
  local t="$DEST/$1"
  if synced "$1"; then echo "skip  $1 (account-synced)"; return; fi
  if [ -d "$t" ] && [ ! -f "$t/$MARK" ]; then echo "keep  $1 (existing, not ours)"; return; fi
  if [ -f "$t/$MARK" ] && [ "$(cat "$t/$MARK")" = "$3" ]; then echo "ok    $1"; return; fi
  rm -rf "$t" && cp -RL "$2" "$t" && echo "$3" > "$t/$MARK" && echo "inst  $1"
}

fetch "$DS_REPO" "$DS_SHA" "$TMP/ds"
for s in $DS_SKILLS; do place "$s" "$TMP/ds/plugins/individual/$s/skills/$s" "$DS_SHA-$REV"; done

fetch "$UX_REPO" "$UX_SHA" "$TMP/ux"
UXD="$TMP/ux/.claude/skills/ui-ux-pro-max"
cp -RL "$UXD" "$TMP/uxp"   # dereference symlinks, then point script paths at the skill dir
sed -i.bak 's#${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max#${CLAUDE_SKILL_DIR}#g' "$TMP/uxp/SKILL.md"
rm -f "$TMP/uxp/SKILL.md.bak"
place ui-ux-pro-max "$TMP/uxp" "$UX_SHA-$REV"

if [ "${1:-}" = "--custom" ] && [ -d "$HERE/skills" ]; then
  for d in "$HERE"/skills/*/; do
    n="$(basename "$d")"; v="local-$(cat "$d"/SKILL.md "$d"/references/* 2>/dev/null | cksum | cut -d' ' -f1)"
    place "$n" "$d" "$v"
  done
fi
echo "done: skills in $DEST"
BOOT
bash /tmp/skill-bootstrap.sh || echo "skill bootstrap failed (non-fatal)"
