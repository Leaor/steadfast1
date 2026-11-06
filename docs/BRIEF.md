# STEADFAST — Cinematic Luxury Streetwear Shopify Website (Client Brief)

> Verbatim client brief, kept as the source of truth for every agent. Where any other doc conflicts with this brief, this brief wins.

Mission: design and build a complete, production-quality Shopify website for the clothing brand **STEADFAST**. The client provided reference images of Steadfast hoodies, tracksuits, branding, and fashion photography. These are the primary creative direction. The site must feel like an expensive, cinematic luxury streetwear brand, **not a generic Shopify template or an AI-generated storefront**. Think high-end fashion campaign meets interactive digital showroom.

## 1. Use all installed Claude skills
Audit globally installed skills; use UI UX Pro Max, Frontend Design, GSAP + ScrollTrigger, Three.js/R3F when appropriate, Motion/Rive/Lottie when useful, Playwright/browser testing for verification. Read the relevant skill instructions before implementing. Use subagents for creative direction, Shopify architecture, frontend, animation/3D, mobile, QA/performance. A design reviewer must critically evaluate and require revisions. Do not install unnecessary dependencies or force incompatible frameworks into Shopify.

## 2. Brand identity
Premium streetwear / luxury clothing. Palette: black, charcoal, washed grey, cold steel blue, silver, muted off-white. Feel: dark, mysterious, confident, cinematic, exclusive, minimal, premium, underground, fashion-forward. Use the uploaded STEADFAST wordmark as the primary branding reference. **Preserve its proportions, distinctive letterforms and distressed texture. Do not replace it with a generic font or invent a new logo.** The clothing photography guides product styling, garment proportions, lighting, presentation.

## 3. Cinematic homepage intro (most important)
A cinematic fashion-film experience with the atmosphere and dramatic pacing of high-end fashion visuals ("Amira-style"). Do not copy an existing film, its exact shots, soundtrack or proprietary assets. Create an original STEADFAST campaign concept.

Intro: screen begins almost black → subtle ambient light slowly reveals a model in a black STEADFAST tracksuit in a dark industrial studio. Lighting: focused overhead spotlight, deep shadows, subtle volumetric haze, cool silver highlights, cinematic contrast.

Camera direction: 1) extreme close-up of embroidered fabric; 2) slow reveal of zipper and garment texture; 3) close-up of STEADFAST branding; 4) side profile of the model; 5) slow reveal of the full tracksuit; 6) model turns slightly, revealing the back design; 7) camera pulls back into darkness; 8) STEADFAST logo appears; 9) homepage shopping interface becomes visible. Slow controlled camera movement; no excessive spinning, artificial effects or cheap transitions.

Video implementation: build the actual hero-video component and transitions. If no original video asset exists, create a detailed production-ready storyboard and asset specification. Use an authorized video-generation capability **only if one actually exists in the environment**; otherwise use the supplied photography (and footage) to create an elegant animated fallback **without pretending a real fashion film was generated**. Support desktop + mobile variants, muted autoplay, iOS inline playback, optimized formats, poster fallback, reduced-motion mode, skip-intro, smooth transition into shopping. **Do not block the store behind a long mandatory intro.**

## 4. Homepage structure
- **A — Cinematic hero:** full-screen campaign video, minimal nav overlay, STEADFAST logo, small editorial typography. Primary CTA **EXPLORE COLLECTION**, secondary **VIEW THE CAMPAIGN**. Navigation stays easy to access.
- **B — Featured collection:** animated product showcase (hoodies, black tracksuits, grey tracksuits, zip-ups, sweatpants, future drops). Use supplied imagery; **do not invent specs, prices or availability**. Cards: large editorial imagery, subtle hover, alternate-image reveal, name, price, colorways, quick view, add to cart.
- **C — Signature product showcase:** the blue-grey STEADFAST zip-up hoodie dramatically lit on black. On scroll: product enters frame, perspective changes subtly, details highlighted, fabric/embroidery revealed, front↔back transition, shopping CTA. True 3D only if a 3D model exists; otherwise a convincing image-based presentation **without claiming a 360° model**.
- **D — Campaign editorial:** the photo of the model in the STEADFAST tracksuit in a dark environment, full-width, large photography, minimal text, strong negative space, elegant scroll reveal, premium lookbook feel.
- **E — Shop by category:** Hoodies, Tracksuits, Tops, Bottoms, New Arrivals; oversized imagery, refined hover.
- **F — Brand story:** minimal editorial, STEADFAST as the central visual. No invented history or unsupported claims; restrained placeholder copy where info is missing.
- **G — Newsletter & footer:** newsletter signup, Instagram, contact, shipping, returns, privacy, terms, currency selector where supported. Real Shopify integrations and editable settings.

## 5. Shopify functionality
A real Shopify storefront. Prefer **Online Store 2.0** (Liquid, JSON templates, sections, blocks, theme settings) unless a strong documented reason for headless. Implement: homepage, collection pages, product pages, search, filtering, sorting, cart drawer, cart page, Shopify checkout, variants, size + color selection, inventory-aware purchase buttons, related products, customer accounts (supported Shopify functionality), mobile nav, newsletter. Native product/variant/inventory/checkout systems only. **No fake checkout.** Editable via the theme editor wherever practical.

## 6. Animation & motion
GSAP, ScrollTrigger, native CSS, Three.js where appropriate. Smooth section transitions, subtle parallax, product-image reveals, refined hovers, animated navigation, cart drawer transitions, editorial text reveals, image masking transitions, scroll-based product storytelling. Physically believable, natural easing; no excessive bounce/overshoot/random movement/loading animations. Exceptionally smooth on desktop and mobile. Don't override native scrolling unnecessarily. Respect prefers-reduced-motion.

## 7. Product page
Luxury presentation: large gallery, high-quality zoom, front/back photography, minimal info, clearly visible price, size + color selectors, add to cart, size guide, shipping & returns info, related products. Optional immersive viewer: rotation/inspection only if a valid 3D model exists; otherwise front/back/detail photography. **Do not fabricate garment views.** Simple purchasing.

## 8. Mobile
First-class: iPhone Safari, Android Chrome, touch, fast loading, responsive type, simplified animations, accessible menus, easy checkout, separate mobile video assets, no expensive 3D on weak devices. Mobile must feel as premium as desktop.

## 9. Performance
Strong Core Web Vitals, minimal CLS, responsive images, lazy-load below the fold, optimized video, efficient timelines, minimal JS, WebGL cleanup, no scroll jank, no console errors. Use Shopify CDN. Don't sacrifice usability for effects.

## 10. Design quality
Avoid: excessive glassmorphism, random glowing gradients, generic SaaS cards, unnecessary rounded corners, decorative buttons, excessive text animation, fake scarcity, stock photography, invented reviews, inconsistent typography. Visual restraint: photography, composition, typography and animation carry the design. Every section must belong to the same fashion brand.

## 11. Workflow
1 inspect project & assets → 2 audit skills & stack → 3 design system → 4 theme architecture → 5 home/collections/products/nav/cart → 6 cinematic hero & animation → 7 mobile performance → 8 test interactions → 9 critical design review & refine → 10 deployment instructions. Independent reviews by subagents.

## 12. Testing
Playwright: homepage load, desktop nav, mobile nav, product pages, variant selection, cart ops, collection filtering, video fallback, animation behavior, reduced motion, responsive layouts, keyboard accessibility. **Never report a test as passed unless it actually ran.** Fix issues found.

## Final deliverable
Working Shopify theme code; responsive layouts; functional shopping; cinematic hero; premium animation; product-image integration; theme customization settings; performance optimizations; testing results; clear deployment instructions. If the store isn't connected, build the complete local theme and explain how to connect and publish. **Do not invent product data, videos or unavailable assets. Do not publish or change a live store without approval.** Make sensible decisions without unnecessary questions.
