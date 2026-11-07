/* STEADFAST · Section C · Signature showcase (HOME). DESIGN §10 (stage, keyframes, rects, zoom maths).
   One pinned, scrubbed GSAP timeline at ≥ 990 px with motion "full"; otherwise the stacked layout with a
   FRONT / BACK toggle. Image-based only: no 3D, no 360°. Rotation stays within ±6°. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['signature-showcase']) return;
  S.modules['signature-showcase'] = true;

  /* Detail centre (fractions of sf-signature-hero) and zoom, keyed by the block's asset_crop (DESIGN §10.2). */
  const CROPS = {
    zip: { cx: 0.5, cy: 0.32, z: 2.2, v: 0.6 },
    'chest-logo': { cx: 0.5, cy: 0.51, z: 1.8, v: 0.6 },
    shoulder: { cx: 0.42, cy: 0.3, z: 2.4, v: 0.6 },
    'cuff-label': { cx: 0.665, cy: 0.83, z: 2.4, v: 0.5 },
    'neck-label': { cx: 0.5, cy: 0.22, z: 2.4, v: 0.6 }
  };
  /* DESIGN §10.2 beat boundaries for the preset's four details; other counts share 0.22–0.74 evenly. */
  const FOUR = [0.22, 0.36, 0.5, 0.63, 0.74];

  const instances = new WeakMap();

  function init(el) {
    if (instances.has(el)) return;
    const ac = new AbortController();
    const signal = ac.signal;
    const state = { ac, mm: null, st: null, staged: false };
    instances.set(el, state);

    const toggle = el.querySelector('[data-sf-ss-toggle]');
    const buttons = [...el.querySelectorAll('[data-sf-ss-face]')];
    const views = [...el.querySelectorAll('[data-sf-ss-view]')];
    if (toggle) toggle.hidden = false;

    const setFace = (face) => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sfSsFace === face)));
      if (state.staged) {
        // At the end of the pin the back is showing; FRONT holds the front over the timeline (CSS).
        if (face === 'front') el.dataset.face = 'front';
        else delete el.dataset.face;
      } else {
        views.forEach((v) => v.classList.toggle('is-active', v.dataset.sfSsView === face));
      }
    };
    buttons.forEach((b) => b.addEventListener('click', () => setFace(b.dataset.sfSsFace), { signal }));
    state.setFace = setFace;

    // The details list (tabindex 0 in the markup, for the no-JS rail) stays a keyboard stop only while it is
    // a horizontal scroller; in the staged layout it has no box and its captions are read in DOM order.
    const list = el.querySelector('.sf-signature-showcase__details');
    const syncRail = () => {
      if (!list) return;
      if (!state.staged && list.scrollWidth > list.clientWidth + 1) list.tabIndex = 0;
      else list.removeAttribute('tabindex');
    };
    state.syncRail = syncRail;
    if (list && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(syncRail);
      ro.observe(list);
      signal.addEventListener('abort', () => ro.disconnect());
    } else syncRail();

    // Keyboard: the buy block is only faded (never visibility: hidden), so its controls stay in the tab
    // order through the pin; focusing one moves the pin to its end, where the block is shown.
    const buy = el.querySelector('[data-sf-ss-buy]');
    if (buy) {
      buy.addEventListener('focusin', () => {
        const st = state.st;
        if (!state.staged || !st || st.progress >= 0.9) return;
        window.scrollTo({ top: Math.round(st.start + (st.end - st.start) * 0.97), behavior: 'auto' });
      }, { signal });
    }

    if (!S.motion || typeof S.motion.gsapMatchMedia !== 'function') {
      el.classList.add('is-static');
      return;
    }

    // GSAP is needed only for the staged desktop layout; mobile, "subtle" and reduced never download it.
    const desk = window.matchMedia('(min-width: 990px)');
    const eligible = () => desk.matches && S.motion.level === 'full' && el.classList.contains('sf-signature-showcase--pin');
    const startGsap = () => {
      if (state.mm || !eligible()) return;
      // If GSAP never arrives, fall back to the stacked layout rather than a dark stage.
      const failsafe = setTimeout(() => { if (!state.ready) el.classList.add('is-static'); }, 8000);
      signal.addEventListener('abort', () => clearTimeout(failsafe));
      state.mm = S.motion.gsapMatchMedia(el, (cond, level, gsap, ScrollTrigger) => {
        state.ready = true;
        el.classList.remove('is-static');
        const staged = Boolean(cond.desktop && !cond.osReduce && level === 'full' && el.classList.contains('sf-signature-showcase--pin'));
        state.staged = staged;
        delete el.dataset.face;
        setFace(staged ? 'back' : 'front');
        syncRail();
        if (!staged) return () => { state.st = null; };
        return build(el, state, gsap, ScrollTrigger);
      });
    };
    desk.addEventListener('change', startGsap, { signal });
    document.addEventListener('motion:change', startGsap, { signal });
    startGsap();
  }

  function build(el, state, gsap, ScrollTrigger) {
    const q = (sel) => el.querySelector(sel);
    const front = q('[data-sf-ss-front]');
    const back = q('[data-sf-ss-back]');
    const layer = q('[data-sf-ss-layer]');
    const vign = q('[data-sf-ss-vignette]');
    const expo = q('[data-sf-ss-exposure]');
    const intro = q('[data-sf-ss-intro]');
    const dawn = q('[data-sf-ss-dawn]');
    const persp = q('.sf-signature-showcase__persp');
    const buy = q('[data-sf-ss-buy]');
    const details = [...el.querySelectorAll('[data-sf-ss-detail]')];
    const stage = q('[data-sf-ss-pin]');
    if (!front || !back || !layer || !stage) return undefined;

    const lengthVh = el.dataset.scrollLength === 'short' ? 2 : 3;
    const W = () => layer.offsetWidth;
    const H = () => layer.offsetHeight;
    // Zoom maths (DESIGN §10.1): the detail centre lands at stage (0.62, 0.50).
    const zoom = (c) => ({
      x: () => 0.62 * stage.clientWidth - layer.offsetLeft - c.cx * W() * c.z,
      y: () => 0.5 * stage.clientHeight - layer.offsetTop - c.cy * H() * c.z,
      scale: c.z
    });

    // Opacity only (not autoAlpha): hidden captions stay in the accessibility tree and the CTA and
    // FRONT / BACK stay focusable (WCAG 2.1.1); pointer events follow .is-buy-live (CSS).
    gsap.set(details, { opacity: 0 });
    gsap.set(buy, { opacity: 0 });
    gsap.set(back, { opacity: 0, rotationY: 6 });

    // Before the pin: the exposure starts lifting as the section arrives (overlay 1 → 0.45, scale 0.86 → 0.88),
    // so the hoodie is dimly present instead of an empty black stage. Separate elements from the pinned
    // timeline (dawn overlay, perspective wrapper), so the two scrubs never write the same property.
    if (dawn && persp) {
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top 85%', end: 'top top', scrub: 0.8, invalidateOnRefresh: true }
      })
        .fromTo(dawn, { opacity: 1 }, { opacity: 0, duration: 1 }, 0)
        .fromTo(persp, { scale: 0.86 / 0.88 }, { scale: 1, duration: 1 }, 0);
    }

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * lengthVh),
        pin: true,
        pinSpacing: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // Leaving the end phase hands the faces back to the timeline.
        onUpdate: (self) => {
          el.classList.toggle('is-buy-live', self.progress >= 0.9);
          if (self.progress < 0.9 && el.dataset.face) {
            delete el.dataset.face;
            state.setFace('back');
          }
        }
      }
    });
    state.st = tl.scrollTrigger;

    // 0.00–0.10 Enter · 0.10–0.22 Perspective
    tl.fromTo(front, { scale: 0.88, yPercent: 4, rotationY: -6, rotationX: 2 }, { scale: 0.94, yPercent: 0, duration: 0.1 }, 0)
      .fromTo(expo, { opacity: 0.45 }, { opacity: 0.15, duration: 0.1 }, 0)
      .fromTo(intro, { autoAlpha: 1 }, { autoAlpha: 1, duration: 0.01 }, 0)
      .to(front, { rotationY: 3, rotationX: 0, scale: 1, duration: 0.12 }, 0.1)
      .to(expo, { opacity: 0, duration: 0.12 }, 0.1);

    // 0.22–0.74 Details, one caption at a time
    const n = details.length;
    const bounds = n === 4 ? FOUR : Array.from({ length: n + 1 }, (_, i) => 0.22 + (0.52 * i) / Math.max(n, 1));
    if (n) tl.to(intro, { autoAlpha: 0, duration: 0.03 }, 0.22);
    details.forEach((li, i) => {
      const c = CROPS[li.dataset.crop] || CROPS.zip;
      const a = bounds[i];
      const b = bounds[i + 1];
      const move = (b - a) * 0.55;
      if (i === 0) tl.to(front, { rotationY: 0, duration: move }, a);
      tl.to(layer, { ...zoom(c), duration: move }, a)
        .to(vign, { opacity: c.v, duration: move }, a)
        .to(li, { opacity: 1, duration: 0.03 }, a + 0.01);
      if (i < n - 1) tl.to(li, { opacity: 0, duration: 0.025 }, b - 0.025);
    });

    // 0.74–0.80 Return
    tl.to(layer, { x: 0, y: 0, scale: 1, duration: 0.06 }, 0.74)
      .to(vign, { opacity: 0, duration: 0.06 }, 0.74)
      .to(front, { rotationY: 0, rotationX: 0, duration: 0.06 }, 0.74);
    if (n) tl.to(details[n - 1], { opacity: 0, duration: 0.03 }, 0.74);
    else tl.to(intro, { autoAlpha: 0, duration: 0.03 }, 0.74);

    // 0.80–0.90 Front → back: a cut in the dark, never a double exposure. The front goes out while the
    // overlay closes (0.80–0.85); the back comes in as it opens (0.85–0.90). Both faces are 0 at 0.85.
    tl.to(front, { rotationY: -6, opacity: 0, duration: 0.05 }, 0.8)
      .to(expo, { opacity: 0.92, duration: 0.05 }, 0.8)
      .to(back, { rotationY: 0, opacity: 1, duration: 0.05 }, 0.85)
      .to(expo, { opacity: 0, duration: 0.05 }, 0.85);

    // 0.90–1.00 CTA
    tl.to(back, { scale: 0.96, duration: 0.1 }, 0.9)
      .fromTo(buy, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.04 }, 0.9);

    // An anchor scroll (e.g. VIEW THE CAMPAIGN → #campaign) may be under way: the new pin spacer moved its
    // target, so refresh now; sf-core re-targets the hash after every refresh (S.anchor).
    if (S.anchor && S.anchor.recent()) requestAnimationFrame(() => ScrollTrigger.refresh());

    // Refresh once the stage stills have decoded (the 2730 px renditions are lazy).
    const imgs = [...el.querySelectorAll('.sf-signature-showcase__stage img')];
    Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
      .then(() => { if (state.st) ScrollTrigger.refresh(); });

    return () => {
      delete el.dataset.face;
      el.classList.remove('is-buy-live');
      state.st = null;
    };
  }

  function destroy(el) {
    const state = instances.get(el);
    if (!state) return;
    state.ac.abort();
    if (state.mm && typeof state.mm.revert === 'function') state.mm.revert();
    instances.delete(el);
  }

  if (S.sections && typeof S.sections.register === 'function') {
    S.sections.register('signature-showcase', { init, destroy, lazy: true, rootMargin: '100% 0px' });
  } else {
    document.querySelectorAll('[data-sf-section="signature-showcase"]').forEach((el) => el.classList.add('is-static'));
  }
})();
