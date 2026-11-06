/*
 * STEADFAST · sf-product-card.js (CORE)
 * <sf-product-card>: quick view / quick add / inline size cells / colour swatches.
 * Contract: ARCHITECTURE §4.6 (+ §15 X1). Every action degrades to a link or a form POST.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules['product-card']) return;
  S.modules['product-card'] = true;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, S.motion.reduced ? 0 : ms); }); }

  class SfProductCard extends HTMLElement {
    connectedCallback() {
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      this.addEventListener('click', this._onClick.bind(this), sig);
      this.addEventListener('submit', this._onSubmit.bind(this), sig);
      this.addEventListener('pointerenter', this._warm.bind(this), { once: true, signal: this._ac.signal });
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }

    get title() {
      var t = this.querySelector('.sf-card__link');
      return t ? t.textContent.trim() : '';
    }

    _warm(e) {
      if (e.pointerType !== 'mouse') return;
      var tpl = this.querySelector('template[data-sf-card-secondary]');
      if (tpl) tpl.replaceWith(tpl.content.cloneNode(true));
    }

    _onClick(e) {
      var qv = e.target.closest('[data-sf-quick-view]');
      if (qv && this.contains(qv)) {
        // Fall back to the product page when no quick view shell is on the page.
        if (!document.getElementById('sf-quick-view')) return;
        e.preventDefault();
        S.bus.emit('quickview:open', {
          url: qv.getAttribute('href') || this.dataset.productUrl,
          handle: this.dataset.productHandle,
          intent: qv.getAttribute('data-intent') || 'view',
          trigger: qv
        });
        return;
      }
      var toggle = e.target.closest('[data-sf-sizes-toggle]');
      if (toggle) {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          var first = this.querySelector('[data-sf-sizes] button:not([disabled])');
          if (first && e.detail === 0) first.focus();
        }
        return;
      }
      var swatch = e.target.closest('[data-sf-swatch]');
      if (swatch) {
        e.preventDefault();
        this._swap(swatch);
      }
    }

    _swap(swatch) {
      var img = this.querySelector('.sf-card__img--primary');
      if (!img || swatch.getAttribute('aria-pressed') === 'true') return;
      this.querySelectorAll('[data-sf-swatch]').forEach(function (b) { b.setAttribute('aria-pressed', b === swatch ? 'true' : 'false'); });
      var src = swatch.getAttribute('data-src');
      var srcset = swatch.getAttribute('data-srcset');
      var alt = swatch.getAttribute('data-alt');
      if (!src) return;
      img.classList.add('is-swapping');
      var pre = new Image();
      if (srcset) { pre.sizes = img.sizes || ''; pre.srcset = srcset; }
      pre.src = src;
      var apply = function () {
        if (img.parentElement && img.parentElement.tagName === 'PICTURE') {
          img.parentElement.querySelectorAll('source').forEach(function (s) { s.remove(); });
        }
        if (srcset) img.srcset = srcset; else img.removeAttribute('srcset');
        img.src = src;
        if (alt) img.alt = alt;
        img.classList.remove('is-swapping');
      };
      Promise.all([(pre.decode ? pre.decode() : Promise.resolve()).catch(function () {}), wait(200)]).then(apply);
    }

    _onSubmit(e) {
      var form = e.target.closest('[data-sf-quick-add]');
      if (!form || !S.cart || typeof S.cart.add !== 'function') return; // native POST to /cart/add
      e.preventDefault();
      var btn = e.submitter || form.querySelector('button[type="submit"]');
      if (!btn || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;
      var id = Number(form.querySelector('[name="id"]').value);
      var qty = Number((form.querySelector('[name="quantity"]') || {}).value || 1);
      var error = this.querySelector('[data-sf-card-error]');
      var self = this;
      if (error) { error.hidden = true; error.textContent = ''; }
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      S.cart.add([{ id: id, quantity: qty }], { source: 'quick-add', trigger: btn })
        .then(function () {
          S.a11y.announce(S.t('quick_add.added', { title: self.title }));
          btn.classList.add('is-added');
          return wait(900).then(function () { btn.classList.remove('is-added'); });
        })
        .catch(function (err) {
          if (!error) return;
          error.textContent = (err && ((typeof err.description === 'string' && err.description) || err.message)) || S.t('general.error');
          error.hidden = false;
        })
        .then(function () {
          btn.classList.remove('is-loading');
          btn.removeAttribute('aria-busy');
        });
    }
  }
  if (!customElements.get('sf-product-card')) customElements.define('sf-product-card', SfProductCard);
})();
