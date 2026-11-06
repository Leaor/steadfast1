/* STEADFAST · Section E · <sf-category-index> (HOME). DESIGN §8.3 E.
   Hover or focus on a category name makes its image the active stage image. The first category is active
   in the markup, so the stage is right without JS. CSS does the crossfade; no GSAP. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['category-grid']) return;
  S.modules['category-grid'] = true;

  class SfCategoryIndex extends HTMLElement {
    connectedCallback() {
      if (this._ac || this.dataset.layout !== 'index') return;
      this._ac = new AbortController();
      const signal = this._ac.signal;
      this.items = [...this.querySelectorAll('[data-sf-cat-item]')];
      this.slides = [...this.querySelectorAll('[data-sf-cat-slide]')];
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
      this.items.forEach((item) => {
        const i = item.dataset.sfCatItem;
        item.addEventListener('pointerenter', () => { if (fine.matches) this.activate(i); }, { signal });
        item.addEventListener('focusin', () => this.activate(i), { signal });
      });
    }

    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      this._ac = null;
    }

    activate(i) {
      if (this.current === i) return;
      this.current = i;
      this.items.forEach((el) => el.classList.toggle('is-active', el.dataset.sfCatItem === i));
      this.slides.forEach((el) => el.classList.toggle('is-active', el.dataset.sfCatSlide === i));
    }
  }

  if (!customElements.get('sf-category-index')) customElements.define('sf-category-index', SfCategoryIndex);
})();
