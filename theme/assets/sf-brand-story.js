/* STEADFAST · Section F · Brand story (HOME). DESIGN §8.2 device 3, §8.3 F.
   "full": the light sweep (--sweep −30% → 130%) scrubbed from "top 75%" to "center 55%" (ScrollTrigger 1);
   the lead paragraph reveals once with a clip mask when the sweep passes 70% (ScrollTrigger 2).
   "subtle": final state with one opacity reveal. Reduced: wordmark fully visible, static. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['brand-story']) return;
  S.modules['brand-story'] = true;

  const instances = new WeakMap();
  const SWEEP_FROM = -30;
  const SWEEP_TO = 130;
  const REVEAL_AT = (70 - SWEEP_FROM) / (SWEEP_TO - SWEEP_FROM); // progress where the sweep passes 70%

  function fadeOnce(el) {
    if (!('IntersectionObserver' in window)) return () => {};
    el.classList.add('is-fade-armed');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.classList.add('is-revealed');
    }, { rootMargin: '0px 0px -25% 0px' });
    io.observe(el);
    return () => { io.disconnect(); el.classList.remove('is-fade-armed', 'is-revealed'); };
  }

  function init(el) {
    if (instances.has(el) || !S.motion || typeof S.motion.gsapMatchMedia !== 'function') return;
    const lit = el.querySelector('[data-sf-bs-sweep]');
    const mark = el.querySelector('[data-sf-bs-mark]');
    const copy = el.querySelector('[data-sf-bs-copy]');
    const mm = S.motion.gsapMatchMedia(el, (cond, level, gsap, ScrollTrigger) => {
      if (cond.osReduce || level === 'reduced') return undefined;
      if (level !== 'full') return fadeOnce(el);

      let revealed = false;
      const reveal = () => {
        if (revealed || !copy) return;
        revealed = true;
        gsap.fromTo(copy, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out' });
      };
      if (copy) gsap.set(copy, { clipPath: 'inset(0% 0% 100% 0%)' });

      if (lit && mark) {
        el.classList.add('is-sweep-armed');
        gsap.fromTo(lit, { '--sweep': SWEEP_FROM + '%' }, {
          '--sweep': SWEEP_TO + '%',
          ease: 'none',
          scrollTrigger: {
            trigger: mark,
            start: 'top 75%',
            end: 'center 55%',
            scrub: 0.8,
            invalidateOnRefresh: true,
            onUpdate: (self) => { if (self.progress >= REVEAL_AT) reveal(); }
          }
        });
      }
      if (copy) {
        // Second trigger: guarantees the paragraph appears even if the sweep is skipped past (or absent).
        ScrollTrigger.create({ trigger: copy, start: lit ? 'bottom 60%' : 'top 85%', once: true, onEnter: reveal });
      }
      return () => el.classList.remove('is-sweep-armed');
    });
    instances.set(el, mm);
  }

  function destroy(el) {
    const mm = instances.get(el);
    if (mm && typeof mm.revert === 'function') mm.revert();
    instances.delete(el);
  }

  if (S.sections && typeof S.sections.register === 'function') {
    S.sections.register('brand-story', { init, destroy, lazy: true, rootMargin: '100% 0px' });
  }
})();
