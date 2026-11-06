/* STEADFAST · Section B · <sf-product-rail> (HOME). DESIGN §8.3 B, §9 B; ARCHITECTURE §4.8.
   CSS + IntersectionObserver, no GSAP. Native scroll-snap; prev/next scroll one card; 1 px progress line;
   a one-time exposure lift on the cards visible when the section arrives. Never auto-advances. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['featured-collection']) return;
  S.modules['featured-collection'] = true;

  const html = document.documentElement;
  const level = () => (S.motion && S.motion.level) || html.dataset.sfMotion || 'full';

  class SfProductRail extends HTMLElement {
    connectedCallback() {
      if (this._ac) return;
      this._ac = new AbortController();
      const signal = this._ac.signal;
      this.track = this.querySelector('[data-sf-rail-track]');
      this.prev = this.querySelector('[data-sf-rail-prev]');
      this.next = this.querySelector('[data-sf-rail-next]');
      this.bar = this.querySelector('[data-sf-rail-progress]');
      if (!this.track) return;

      if (this.dataset.layout === 'rail') {
        const buttons = this.querySelector('[data-sf-rail-buttons]');
        if (buttons) buttons.hidden = false;
        this.prev && this.prev.addEventListener('click', () => this.step(-1), { signal });
        this.next && this.next.addEventListener('click', () => this.step(1), { signal });
        this.track.addEventListener('scroll', () => this.queue(), { passive: true, signal });
        if ('ResizeObserver' in window) {
          this._ro = new ResizeObserver(() => this.queue());
          this._ro.observe(this.track);
        }
        this.update();
      }
      this.armLift();
    }

    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      this._ac = null;
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      if (this._raf) cancelAnimationFrame(this._raf);
      clearTimeout(this._cleanup);
    }

    queue() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this.update(); });
    }

    update() {
      const t = this.track;
      const max = t.scrollWidth - t.clientWidth;
      const x = Math.abs(t.scrollLeft);
      if (this.prev) this.prev.disabled = x <= 1;
      if (this.next) this.next.disabled = x >= max - 1;
      if (this.bar) {
        const p = t.scrollWidth > 0 ? Math.min(1, (x + t.clientWidth) / t.scrollWidth) : 1;
        this.bar.style.setProperty('--_progress', p.toFixed(4));
      }
    }

    step(dir) {
      const item = this.track.querySelector('[data-sf-rail-item]');
      if (!item) return;
      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      const behavior = level() === 'reduced' ? 'auto' : 'smooth';
      this.track.scrollBy({ left: dir * (item.getBoundingClientRect().width + gap), behavior });
    }

    /* Exposure lift (DESIGN §8.2 device 1): only the cards visible when the section arrives
       (≤ 5 desktop, ≤ 2 below 990 px), once. Content stays visible without JS or under reduced motion. */
    armLift() {
      if (level() === 'reduced' || !('IntersectionObserver' in window)) return;
      const rect = this.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.8) return; // already on screen: nothing to reveal
      const max = window.matchMedia('(min-width: 990px)').matches ? 5 : 2;
      const vw = window.innerWidth;
      const items = [...this.track.querySelectorAll('[data-sf-rail-item]')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.left < vw && r.right > 0; })
        .slice(0, max);
      if (!items.length) return;
      items.forEach((el, i) => { el.setAttribute('data-sf-lift', ''); el.style.setProperty('--_i', i); });
      this._io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this._io.disconnect();
        this.track.classList.add('is-lit');
        // Hand the cards back to their own styles once the lift has finished.
        this._cleanup = setTimeout(() => {
          items.forEach((el) => { el.removeAttribute('data-sf-lift'); el.style.removeProperty('--_i'); });
          this.track.classList.remove('is-lit');
        }, 2400);
      }, { rootMargin: '0px 0px -20% 0px' });
      this._io.observe(this);
    }
  }

  if (!customElements.get('sf-product-rail')) customElements.define('sf-product-rail', SfProductRail);
})();
