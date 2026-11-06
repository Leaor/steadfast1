---
name: steadfast-premium
description: Design preset for the Steadfast website. Use for any design, build, redesign, or review work on Steadfast pages, sections, components, navigation, hero, services or product cards, motion, or 3D. Applies the premium-web-experience standards with Steadfast-specific priorities (confident premium branding, a cinematic but restrained hero, scroll storytelling, selective 3D) while preserving existing Steadfast branding and business information.
---

# Steadfast Premium Preset

Steadfast should feel like it was built by a respected digital studio: **intentional, distinctive, credible, and expensive, never cluttered.** The name says it: steady, dependable, built to last. The design should feel that way too. It should be confident and composed, not flashy.

This preset layers on top of `premium-web-experience`. Load that skill too, and follow its motion, 3D gate, accessibility, and performance rules. Where they conflict, this preset wins for Steadfast.

## 0. Ground rules

- **Preserve the brand and the facts.** Before designing, find and reuse the existing logo, colors, fonts, imagery, copy, services and products, contact details, service areas, hours, testimonials, and legal text. Never invent business facts (prices, certifications, years in business, reviews, phone numbers). If something is missing, use a clearly marked placeholder and list it for the owner.
- If no brand tokens exist yet, propose them (Section 2) and record them in one place (for example `src/styles/tokens.css` or the Tailwind theme) before building pages.
- Get the user's approval before changing the logo, brand colors, or primary messaging.

## 1. Experience priorities (in order)

1. **Clarity and trust.** Visitors know within 5 seconds what Steadfast does, for whom, and how to act.
2. **Hero presentation.** A composed, beautiful first screen. Strong headline, one supporting line, a primary CTA plus a secondary CTA, and a single striking visual (photography, or one tasteful 3D element if it passes the gate).
3. **Scroll storytelling.** The page reads as a narrative: promise → proof → services/products → process → social proof → CTA. Use at most one pinned or scrubbed scroll sequence per page.
4. **Interactive service/product cards.** Subtle lift (translateY −4px plus a shadow refinement), image scale 1.03–1.05 inside an overflow-hidden frame, an arrow nudge on the CTA, and full keyboard parity. The whole card is clickable via one real link (no nested interactive traps).
5. **Elegant menu.** The desktop nav is crisp, with a sticky header that condenses on scroll (height and background, ≤300ms). The mobile menu is a full-height panel with staggered link reveals (≤40ms stagger, ≤450ms total), a focus trap, `Esc` to close, and the body scroll locked without layout shift.
6. **Refined section transitions.** Use background tone shifts, clip-path or mask reveals on imagery, and generous spacing. No section should "pop" in.
7. **Subtle depth and parallax.** Imagery parallax ≤10% offset, layered foreground and background in the hero, soft realistic shadows. Disabled under reduced motion and on low-power devices.
8. **Strong CTAs.** One primary action style used consistently (for example "Get a quote" or "Book a consultation", matching the existing business). Repeat it at the hero, mid-page, and footer. Keep a sticky mobile CTA bar if the business depends on calls or leads.
9. **Mobile excellence.** Design mobile-first. Thumb-reachable CTAs, tap-to-call where relevant, no hover-only information, and fast LCP on 4G.

## 2. Visual direction (defaults if no brand system exists)

- **Mood:** architectural, solid, warm-professional. Think materials, structure, precision.
- **Palette:** a deep, grounded base (ink, charcoal, or deep navy/forest) plus warm off-white surfaces and **one** confident accent used sparingly for CTAs and key highlights. No neon, no purple-blue gradients, no glows.
- **Type:** a distinctive, sturdy display face (a refined grotesk or a strong serif with character) paired with a highly legible text face. Large, tight display headings and calm body copy.
- **Imagery:** real work, people, and places with consistent grading. Use generous crops and let photos breathe edge to edge.
- **Details:** thin hairline dividers, precise alignment, small-caps or tracked eyebrow labels, numbered process steps, restrained iconography (one line-icon set at a consistent stroke).

## 3. Where 3D is allowed (pick at most two)

Use 3D only where it raises perceived quality. Good candidates:
- **Hero signature object:** one slowly responsive, brand-relevant object (for example a structural form, material sample, or abstract mark built from the logo) that reacts subtly to pointer and scroll. Poster image first, lazy-loaded, and paused offscreen.
- **Product or service showcase:** an inspectable model, if Steadfast sells or builds physical things.
- **Process or story section:** a scroll-scrubbed 3D sequence explaining "how we work", only if it's clearer than 2D.

Not allowed: 3D backgrounds behind text sections, particle fields, floating decorative shapes, or 3D on every page. Default to 2D craft. Everything in `premium-web-experience` → "3D gate" applies.

## 4. Motion character

- **Feel:** steady and assured. Decelerating ease-outs (`expo.out`, `power3.out`, or `cubic-bezier(0.22,1,0.36,1)`). No bounce, no elastic, no spin.
- **Hero entrance:** ≤1.2s total. Eyebrow → headline (line mask reveal) → subcopy → CTAs, with an 80–120ms stagger. Content is visible immediately under reduced motion.
- **Reveals:** short distance (16–24px) and an opacity fade, played once and never re-triggered on scroll-up.
- **Numbers and stats:** count-up only on first view and only if the real figures exist.
- Pick **GSAP + ScrollTrigger** for scroll storytelling and pinned sections. Use **Motion** for React component and menu transitions if the stack is React. Don't ship both unless both are needed.

## 5. Definition of done (Steadfast)

- [ ] Brand assets and every business fact were preserved or confirmed, and placeholders are listed for the owner
- [ ] The hero communicates the offer and CTA at 375px without scrolling
- [ ] Every page has one clear primary CTA, repeated at the hero, mid-page, and footer
- [ ] All `premium-web-experience` checklist items pass (reduced motion, keyboard, CLS/LCP/INP budgets, no horizontal scroll)
- [ ] 3D (if any) has a poster fallback, lazy-loads, holds a smooth frame rate on mobile, and is used in ≤2 places
- [ ] Screenshots taken at mobile and desktop widths and reviewed against "intentional, distinctive, credible, expensive, uncluttered"
