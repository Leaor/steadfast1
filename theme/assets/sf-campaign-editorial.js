/* STEADFAST · Section D · Campaign editorial (HOME). DESIGN §8.2 device 2 (aperture), §8.3 D.
   "full": a scrubbed vertical shaft on the frame (--_ap 30 % of the width → 0, in whole px, so no horizontal edge ever crosses the haze;
   feathered side edges fade out at the end) + inner scale 1.15 → 1 (ScrollTrigger 1), and a one-time
   clip-mask text reveal at "top 40%" (ScrollTrigger 2). If GSAP arrives after the section has already
   crossed the scrub start (anchor jump, fast fling, slow network), the final state is kept: nothing that is
   already on screen shrinks or hides. "subtle": final state, one opacity reveal. Reduced: static. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['campaign-editorial']) return;
  S.modules['campaign-editorial'] = true;

  const instances = new WeakMap();

  function fadeOnce(el) {
    const copy = el.querySelector('[data-sf-ce-copy]');
    if (!copy || !('IntersectionObserver' in window)) return () => {};
    el.classList.add('is-fade-armed');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.classList.add('is-revealed');
    }, { rootMargin: '0px 0px -25% 0px' });
    io.observe(copy);
    return () => { io.disconnect(); el.classList.remove('is-fade-armed', 'is-revealed'); };
  }

  function init(el) {
    if (instances.has(el) || !S.motion || typeof S.motion.gsapMatchMedia !== 'function') return;
    const frame = el.querySelector('[data-sf-ce-frame]');
    const media = el.querySelector('[data-sf-ce-media]');
    const copy = el.querySelector('[data-sf-ce-copy]');
    const mm = S.motion.gsapMatchMedia(el, (cond, level, gsap) => {
      if (cond.osReduce || level === 'reduced') return undefined;
      if (level !== 'full') return fadeOnce(el);
      // Already past the aperture's start line: show the frame as it is, no late snap.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return undefined;
      const ap = cond.desktop ? 30 : 14;
      el.classList.add('is-aperture');
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 15%', scrub: 0.8, invalidateOnRefresh: true }
      })
        // --_ap in whole px (snap): a fractional clip edge leaks a 1 px hairline of image past the feather.
        .fromTo(frame, { '--_ap': () => Math.round(frame.offsetWidth * ap / 100), '--_feather': 1 }, { '--_ap': 0, duration: 1, snap: { '--_ap': 1 } }, 0)
        .to(frame, { '--_feather': 0, duration: 0.3 }, 0.7)
        .fromTo(media, { scale: 1.15 }, { scale: 1, duration: 1 }, 0);
      if (copy) {
        gsap.fromTo(copy, { clipPath: 'inset(0% 0% 100% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: { trigger: cond.desktop ? el : copy, start: cond.desktop ? 'top 40%' : 'top 85%', once: true }
        });
      }
      return () => el.classList.remove('is-aperture');
    });
    instances.set(el, mm);
  }

  function destroy(el) {
    const mm = instances.get(el);
    if (mm && typeof mm.revert === 'function') mm.revert();
    instances.delete(el);
  }

  if (S.sections && typeof S.sections.register === 'function') {
    S.sections.register('campaign-editorial', { init, destroy, lazy: true, rootMargin: '100% 0px' });
  }
})();
