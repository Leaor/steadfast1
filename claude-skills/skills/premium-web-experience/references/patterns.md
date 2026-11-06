# Premium Web Experience: Implementation Patterns

Copy-ready starting points. Adapt names and values to the project's tokens.

## 1. Motion tokens (CSS)

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 160ms;
  --dur-ui: 320ms;
  --dur-reveal: 700ms;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-micro: 0ms; --dur-ui: 0ms; --dur-reveal: 0ms; }
  html { scroll-behavior: auto; }
}
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

## 2. CSS scroll-driven reveal (no JS) with safe fallback

```css
.reveal { opacity: 1; transform: none; }
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 30%;
    }
  }
}
@keyframes reveal {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: none; }
}
```

## 3. GSAP + ScrollTrigger, reduced-motion safe, with cleanup

```js
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function initMotion(root = document) {
  const mm = gsap.matchMedia();
  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      desktop: "(min-width: 900px)",
    },
    (ctx) => {
      const { motion, desktop } = ctx.conditions;
      if (!motion) return; // reduced motion: content is already visible

      // Hero entrance
      gsap.timeline({ defaults: { ease: "expo.out", duration: 0.9 } })
        .from(".hero__eyebrow", { y: 16, opacity: 0 })
        .from(".hero__title", { y: 28, opacity: 0 }, "-=0.7")
        .from(".hero__cta", { y: 16, opacity: 0, stagger: 0.08 }, "-=0.6");

      // Image parallax (subtle)
      gsap.utils.toArray(".parallax img").forEach((img) => {
        gsap.fromTo(img, { yPercent: -6 }, {
          yPercent: 6, ease: "none",
          scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: 0.6 },
        });
      });

      // Pinned story only on larger screens
      if (desktop) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: ".story", start: "top top", end: "+=150%", pin: true, scrub: 0.8 },
        });
        tl.to(".story__panel--2", { opacity: 1, y: 0 })
          .to(".story__panel--3", { opacity: 1, y: 0 });
      }
    }
  );
  return () => mm.revert(); // call on route change / unmount
}
```

React: use `useGSAP(() => initMotionScoped(), { scope: ref })` from `@gsap/react` so everything reverts automatically.

## 4. Lenis smooth scroll synced to ScrollTrigger (opt-in)

Only when the design really benefits from it. Skip it on touch devices and for reduced motion.

```js
import Lenis from "lenis";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
if (!reduce && !coarse) {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
```

## 5. Motion (React) reveal component

```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
```

Menu or overlay: `AnimatePresence` + `motion.nav` with `initial/animate/exit`, focus trap, `Esc` to close, and `inert` on the background.

## 6. Low-power / capability detector

```js
export function canUseRich3D() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (navigator.connection?.saveData) return false;
  if ((navigator.hardwareConcurrency ?? 8) <= 4) return false;
  if ((navigator.deviceMemory ?? 8) <= 4) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
```

## 7. Lazy React Three Fiber scene with poster fallback

```tsx
import { lazy, Suspense, useEffect, useRef, useState } from "react";
const Scene = lazy(() => import("./Scene")); // the 3D chunk is split out

export function Hero3D({ poster, alt }: { poster: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!canUseRich3D()) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShow(true), io.disconnect()), { rootMargin: "200px" });
    ref.current && io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="hero3d">
      <img src={poster} alt={alt} className="hero3d__poster" fetchPriority="high" />
      {show && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
    </div>
  );
}

// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, Preload, useGLTF } from "@react-three/drei";
export default function Scene() {
  return (
    <Canvas aria-hidden dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, powerPreference: "high-performance" }}>
      <PerformanceMonitor />
      <AdaptiveDpr pixelated />
      {/* model, a few lights or an environment map, and subtle pointer-driven rotation */}
      <Preload all />
    </Canvas>
  );
}
```

Crossfade the poster out on the canvas's first frame (`onCreated`). Keep the poster in the DOM for the fallback case.

## 8. Spline, production-safe

- Show a poster first. Load `@splinetool/react-spline` (or the `<spline-viewer>` web component) lazily near the viewport.
- Reduce the scene in the Spline editor (fewer objects, baked lighting, compressed textures) before export.
- For anything performance-critical, export glTF from Spline and render it with R3F.

## 9. Lottie / Rive

- Lottie: prefer `.lottie` (dotLottie) files, lazy-load `@lottiefiles/dotlottie-web`, pause offscreen, and respect reduced motion (show the first or last frame).
- Rive: `@rive-app/react-canvas`, drive state machines from real UI state (hover, progress, success), and size the canvas to its container.

## 10. Playwright verification snippet

```js
// node verify.mjs http://localhost:3000
import { chromium } from "playwright";
const url = process.argv[2];
const browser = await chromium.launch();
for (const [name, opts] of [
  ["mobile", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 }],
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ["reduced", { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }],
]) {
  const page = await (await browser.newContext(opts)).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.screenshot({ path: `shot-${name}.png`, fullPage: true });
  console.log(name, { overflow, errors });
}
await browser.close();
```
