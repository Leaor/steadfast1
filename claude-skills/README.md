# Premium Web Skill Stack for Claude

A reusable skill environment for Steadfast, MapleCore LawnCare, and future websites. This folder is tooling for Claude, not part of the website.

## What's here

| Path | Purpose |
|---|---|
| `skills/premium-web-experience/` | Custom global skill: premium design, motion, 3D, a11y, and performance standards |
| `../.claude/skills/steadfast-premium/` | Steadfast design preset (project-scoped, loads automatically in this repo) |
| `bootstrap.sh` | Idempotent installer into `~/.claude/skills`, pinned to reviewed commits |
| `env-setup-script.sh` | The same installer wrapped as a cloud-environment setup script (non-fatal on failure) |
| `package.sh` | Rebuilds `dist/*.zip` for upload to claude.ai |
| `dist/*.zip` | Upload-ready skills (validated: skill folder at the top level, `name` matches, allowed frontmatter only) |

## Skills in the stack

| Skill | Source (pinned) | Covers |
|---|---|---|
| premium-web-experience | this repo | Design and motion principles, tool choice, 3D gate, budgets, checklist |
| steadfast-premium | this repo (project) | Steadfast preset |
| threejs-webgl, react-three-fiber, gsap-scrolltrigger, motion-framer | freshtechbro/claudedesignskills @ `1da73feb` (the `core-3d-animation` bundle minus Babylon.js) | 3D and animation |
| spline-interactive, rive-interactive, lottie-animations | same repo | Authored 3D and vector animation |
| modern-web-design, web3d-integration-patterns | same repo (= the `meta-skills` bundle) | Design patterns and multi-library integration |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill @ `b7d5353e` | Searchable styles, palettes, fonts, UX rules (Python script; script paths rewritten to `${CLAUDE_SKILL_DIR}`) |

These were already on your account through claude.ai plugin sync, so they were not duplicated: **frontend-design** (Anthropic), **rampstack-starter** (accessibility-audit, performance-optimization, qa-testing, design-standards…), **rampstack-seo**, **superpowers**, **data**.

Security review: neither third-party repo ships hooks or MCP servers. The scripts in the selected skills make no network calls. Babylon.js, A-Frame, PlayCanvas, PixiJS, Barba, Blender, and Substance were left out as unneeded.

## Manual steps (only you can do these)

1. **Upload `premium-web-experience` to your account (required for desktop and other environments).**
   claude.ai → **Customize → Skills** (claude.ai/customize/skills) → **+** → *Upload a skill* → `dist/premium-web-experience.zip`.
   Account skills sync to cloud sessions and to Claude Code signed in with your claude.ai account (into `~/.claude/skills/synced/`).
2. **Third-party skills, outside the `steadfastweb` cloud environment.** Pick one:
   - *Account-wide (recommended for MapleCore and desktop):* upload the other 10 zips the same way. If you do, **remove the `steadfastweb` setup script** (Settings → Environments), or cloud sessions there get two copies.
   - *Per environment:* paste `env-setup-script.sh` as the setup script of `maplecoreweb` or any other cloud environment.
   - *Per desktop or terminal machine:* run `bash claude-skills/bootstrap.sh --custom` once. It skips anything already account-synced.
3. **Optional browser tooling.**
   - Playwright MCP: enable "playwright" (Microsoft) from the Anthropic Directory in claude.ai plugins. Cloud containers already include Playwright and Chromium for scripted checks.
   - Chrome DevTools MCP (desktop or terminal only, per machine):
     `claude mcp add --transport stdio --scope user chrome-devtools -- npx -y chrome-devtools-mcp@latest`

Third-party GitHub plugin marketplaces cannot be added at the claude.ai account level, and cloud sessions don't load locally installed plugins. That's why this stack ships as skills instead of plugins.

## Using it in future projects

- Ask naturally ("build the hero", "add scroll storytelling", "review this page's motion"). The skill descriptions trigger automatically. You can also invoke them explicitly: `/premium-web-experience`, `/ui-ux-pro-max`, `/gsap-scrolltrigger`.
- For a new brand, copy `.claude/skills/steadfast-premium/` into that repo as `<brand>-premium` and rewrite its sections 1–4.
- Suggested `CLAUDE.md` line for each website repo:
  `For any UI work, load premium-web-experience (and the <brand>-premium preset) before writing code; verify with Playwright at 375px and 1440px plus reduced motion.`

## Updating

Bump `DS_SHA` / `UX_SHA` in `bootstrap.sh` after reviewing the new upstream commits, then run `bash package.sh` and re-upload any zips you use.
