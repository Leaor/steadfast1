---
name: premium-web-experience
description: Standards and decision rules for building polished, high-performance marketing websites and landing pages with premium visual design, smooth scrolling, tasteful motion (GSAP/ScrollTrigger, Motion/Framer Motion, CSS), and selective 3D (Three.js, React Three Fiber, Spline). Use whenever building, redesigning, or reviewing a website, landing page, hero section, scroll-driven story, page transition, animated component, or any 3D/WebGL element on a site; also when choosing between GSAP, Motion, CSS, Lottie, Rive, Spline, or Three.js; and when a page feels generic, janky, slow, or "AI-looking". Pairs with frontend-design (aesthetic direction) and the stack-specific skills (gsap-scrolltrigger, motion-framer, react-three-fiber, threejs-webgl, spline-interactive, rive-interactive, lottie-animations, ui-ux-pro-max) when they are installed.
---

# Premium Web Experience

The goal is a site that feels designed by a respected studio: intentional, credible, fast, and calm under the hand. Polish comes from restraint and precision, not from adding effects.

## How to use this skill

1. **Decide direction before code.** Write 3–5 lines covering audience, the one feeling the site should leave, the typographic voice, the palette (with roles), and the 1–3 "signature moments" that get the motion/3D budget. If a brand or project preset exists (e.g. `steadfast-premium`), it overrides the generic defaults here.
2. **Build the static page first:** semantic, responsive, accessible, fast, with motion off. It must already look finished.
3. **Layer motion in tiers** (see "Motion budget"). Add 3D only where it passes the 3D gate.
4. **Verify** with the checklist at the end, in a real browser at phone and desktop widths.

When stack-specific skills are available, defer to them for API details. This skill decides *what* and *how much*. They cover *how*.

## Design principles

**Typography carries the brand.**
- At most 2 families. A characterful display face plus a highly legible text face, or one variable family used at two personalities. Avoid the defaults everyone uses (Inter/Roboto/Arial/system as the display face, and the "safe" trendy pick of the month).
- Use a modular type scale (≈1.2–1.333 ratio) with fluid sizes via `clamp()`. Display headings get tight tracking (−0.01 to −0.03em) and line-height 1.0–1.15. Body text gets 1.5–1.7 line-height and a 60–75ch measure.
- Hierarchy comes from size, weight, and space, not color alone. One clear H1 per page.
- `font-display: swap`, preload the 1–2 critical font files, subset where possible, `size-adjust` fallbacks to kill layout shift.

**Space and hierarchy.**
- Use an 8px base spacing scale. Section padding is generous and fluid (`clamp(4rem, 10vw, 9rem)`).
- Each section has one job and one primary action. If everything is emphasized, nothing is.
- Align to a real grid (12-col desktop, 4–6 col mobile). Break the grid deliberately, not accidentally.

**Color.**
- Define tokens with roles (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--accent-contrast`, `--border`). One dominant neutral field plus one confident accent beats a rainbow.
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries).
- Gradients only when they carry meaning (light, material, depth), and subtle when used.

**Imagery and depth.**
- Real photography or crafted illustration over stock clichés. Consistent art direction (crop, grade, angle).
- Depth via layering, scale contrast, soft shadows with realistic falloff, and subtle parallax. Not glow.
- Use responsive `<picture>`/`srcset` with AVIF/WebP and explicit `width`/`height`. Lazy-load everything below the fold, and never the LCP image (`fetchpriority="high"` on it).

## Avoid (the "generic AI site" tells)

- Purple-to-blue gradients, neon glows, glassmorphism everywhere, floating blobs/orbs, sparkle particles
- Every element fading up on scroll. Staggered letter-by-letter text on every heading
- Centered-everything layouts with identical card grids and emoji icons
- Scroll hijacking, scroll-jacked "slides", or anything that changes scroll speed or direction against the user
- Heavy motion blur, long (>800ms) UI transitions, bouncy springs on serious content
- A full-screen WebGL canvas behind a page that is mostly text
- Animation that delays navigation, hides content until JS runs, or traps focus
- Shipping GSAP + Motion + Three + Lottie + Rive on one page "just in case"

## Motion system

**Principles.** Motion explains (where did this come from, what changed, what is related) or rewards (a signature moment). If it does neither, cut it.

**Durations.** Micro (hover, press): 120–200ms. Component (menus, cards, accordions): 250–450ms. Section/hero choreography: 600–1200ms total, with individual tweens rarely over 800ms. Exits are ~20–30% faster than entrances.

**Easing.** No linear for UI movement. Defaults:
- Enter / decelerate: `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out-like). GSAP: `"expo.out"` or `"power3.out"`
- Exit / accelerate: `cubic-bezier(0.55, 0, 1, 0.45)`. GSAP: `"power2.in"`
- Move / both: `cubic-bezier(0.65, 0, 0.35, 1)`. GSAP: `"power2.inOut"`
- Springs (Motion): `{ type: "spring", stiffness: 300–500, damping: 30–40 }` for UI. Low bounce for anything professional.
- Scroll-scrubbed: `scrub: 0.5–1` (smoothed, not raw) and `ease: "none"` on the tween itself.

**Properties.** Animate `transform` and `opacity` (plus `filter` sparingly, and `clip-path` for reveals). Never animate `width/height/top/left/margin` or box-shadow size on scroll. Use `will-change` only during the animation, never globally.

**Motion budget per page (tiers).**
1. *Baseline (always):* hover/focus/press states, menu open/close, smooth anchor scrolling, subtle section reveals (short distance, ≤24px translate, opacity).
2. *Enhancement (most pages):* one choreographed hero entrance, image parallax (≤10–15% offset), sticky/pinned storytelling for one section, refined page/section transitions.
3. *Signature (1–3 per site):* a pinned scroll narrative, an interactive 3D object, a Rive/Lottie illustration that responds to the user. These get the design and performance attention.

**Tool choice.**

| Need | Use |
|---|---|
| Hover/focus/press, simple reveals, menu toggles | CSS transitions + `@starting-style`, or a tiny IntersectionObserver |
| Scroll-linked effects that only map scroll to style | CSS scroll-driven animations (`animation-timeline: view()`) with a JS fallback |
| Timelines, pinning, scrub, sequenced scroll stories, SVG path drawing | GSAP + ScrollTrigger (use `gsap.matchMedia()` and `gsap.context()`/`useGSAP` for cleanup) |
| React component enter/exit, layout and shared-element transitions, gestures | Motion (`motion/react`): `AnimatePresence`, `layout`, `layoutId`, `useReducedMotion` |
| Smooth/inertial scrolling | Lenis (light) synced to ScrollTrigger, only if it measurably improves feel. Never on touch devices by default, and never altering native scroll semantics |
| Designer-authored vector animation, playback only | Lottie (prefer dotLottie, lazy-load the player) |
| Interactive, stateful vector animation (hover/click/state machines) | Rive |
| A 3D scene authored by a designer, low code | Spline (lazy-load, poster image first, consider exporting to glTF for production) |
| Custom 3D with real interaction or brand geometry | Three.js / React Three Fiber (+ drei) |
| Page-to-page transitions | View Transitions API first, then framework router transitions, and Barba only for MPA sites that need it |

Pick one primary animation library per project (GSAP *or* Motion), and add the other only for a capability the first lacks.

## 3D gate: use WebGL only when it earns its place

Add a 3D scene only if **all** are true:
1. It shows something 2D cannot (a product, a spatial idea, a tactile brand object) or it *is* the signature moment.
2. It has a static fallback that is still beautiful (poster image or CSS/2D version).
3. It fits the budget: ≤ ~250KB gz for the 3D runtime + scene code on the page, models ≤ 1–2MB (Draco/Meshopt-compressed glTF, KTX2 textures), and it doesn't block LCP.
4. It holds ~60fps on a mid-range phone, or degrades gracefully there.

**3D rules:**
- Lazy-mount when near the viewport (`IntersectionObserver`), dynamic `import()` the 3D code, show the poster until the first frame renders.
- R3F: `frameloop="demand"` unless continuously animating, `dpr={[1, 1.5]}` (cap at 2), `<AdaptiveDpr>`/`<PerformanceMonitor>`, `<Preload>`, instancing for repeats, and dispose of resources on unmount.
- Pause rendering when offscreen or when the tab is hidden. Limit lights (bake when possible), avoid real-time shadows on mobile, and keep draw calls low.
- Never put essential content or navigation inside the canvas. The canvas is `aria-hidden` decoration unless it is the interactive product view, which then needs keyboard controls and a text alternative.
- Detect low power: `navigator.hardwareConcurrency <= 4`, `deviceMemory <= 4`, `prefers-reduced-motion`, `saveData`, or a failed WebGL context. Fall back to the poster.

## Accessibility and interaction (non-negotiable)

- Semantic landmarks (`header/nav/main/footer`), real `<button>` and `<a>` elements, logical heading order.
- Visible `:focus-visible` styles that match the brand (≥ 3:1 contrast, not removed). Keyboard path through menus, modals, and carousels. Focus trap and restore for overlays. Close on `Esc`.
- **Reduced motion:** wrap all non-essential motion in `@media (prefers-reduced-motion: no-preference)` / `gsap.matchMedia()` / `useReducedMotion()`. Reduced-motion users get instant or crossfade states, no parallax, no autoplaying 3D rotation, and no smooth-scroll library.
- Content must be visible without JS. Initial hidden states are applied by JS or by a `.js` class, never baked into the HTML.
- Tap targets ≥ 44×44px. Hover effects need a touch and keyboard equivalent. Never convey meaning by motion alone.
- Autoplaying motion longer than 5s needs a pause control.

## Performance budgets (mobile, 4G, mid-range device)

- LCP < 2.5s, INP < 200ms, CLS < 0.1. Lighthouse Performance ≥ 90 as a smoke test, not a goal.
- Initial JS ≤ ~150KB gz for a marketing page, excluding a lazily loaded 3D chunk. Code-split per route and per heavy component.
- Import only the GSAP plugins you use and register them once. Tree-shake Motion (`motion/react`, or `m` + `LazyMotion` for tiny bundles).
- No layout thrash in scroll handlers. Use ScrollTrigger, IntersectionObserver, or CSS scroll timelines instead of raw `scroll` listeners. Throttle with rAF.
- Self-host or `preconnect` fonts. Inline critical CSS and defer the rest.

## Implementation snippets

See `references/patterns.md` for copy-ready patterns: a reduced-motion-safe GSAP setup, Lenis + ScrollTrigger sync, a Motion reveal component, a lazy R3F canvas with poster fallback, a low-power detector, and CSS scroll-driven reveals.

## Verification checklist (run before calling it done)

- [ ] Looks finished with JS disabled / motion reduced
- [ ] Checked at 375px, 768px, 1280px, and 1920px: no horizontal scroll, no overlapping text, tap targets OK
- [ ] Keyboard-only pass: every interactive element is reachable, visibly focused, and operable, and menus and modals trap and restore focus
- [ ] `prefers-reduced-motion: reduce` emulated (Playwright `reducedMotion: 'reduce'` / DevTools Rendering panel): no parallax, pinning still readable
- [ ] Performance trace: no long tasks during scroll, no layout shifts from fonts or images, 3D chunk lazy-loaded
- [ ] Lighthouse / axe pass with no serious issues
- [ ] Each animation can be justified in one sentence. Delete the ones that can't.
