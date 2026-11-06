/* STEADFAST · Section D · Campaign editorial (HOME). DESIGN §8.2 device 2 (aperture), §8.3 D.
   "full": scrubbed aperture on the frame + inner scale 1.15 → 1 (ScrollTrigger 1) and a one-time clip-mask
   text reveal at "top 40%" (ScrollTrigger 2). "subtle": final state, one opacity reveal. Reduced: static. */
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
      const inset = cond.desktop ? 'inset(14% 22% 14% 22%)' : 'inset(8% 10% 8% 10%)';
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 15%', scrub: 0.8, invalidateOnRefresh: true }
      })
        .fromTo(frame, { clipPath: inset }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1 }, 0)
        .fromTo(media, { scale: 1.15 }, { scale: 1, duration: 1 }, 0);
      if (copy) {
        gsap.fromTo(copy, { clipPath: 'inset(0% 0% 100% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: { trigger: cond.desktop ? el : copy, start: cond.desktop ? 'top 40%' : 'top 85%', once: true }
        });
      }
      return undefined;
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
