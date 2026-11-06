/*
 * STEADFAST · sf-product.js (COMMERCE)
 * PDP + quick view: <sf-variant-picker>, <sf-product-form>, <sf-product-gallery>,
 * <sf-zoom-viewer>, <sf-related-products>. Contract: ARCHITECTURE §4.4, §4.7. DESIGN §7.8, §8.3.
 * Variant data comes from the embedded sf-product-json; nothing here reads inventory counts.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules.product) return;
  S.modules.product = true;

  var doc = document;
  function rootOf(el) { return el.closest('[data-sf-product-root]') || doc; }
  function smooth() { return S.motion.reduced ? 'auto' : 'smooth'; }
  function isDesktop() { return window.matchMedia('(min-width: 990px)').matches; }

  /* ── <sf-variant-picker> ─────────────────────────────────── */
  class SfVariantPicker extends HTMLElement {
    connectedCallback() {
      var jsonEl = rootOf(this).querySelector('[data-sf-product-json]');
      if (!jsonEl) return;
      try { this.product = JSON.parse(jsonEl.textContent); } catch (e) { return; }
      this._ac = new AbortController();
      this.addEventListener('change', this._onChange.bind(this), { signal: this._ac.signal });
      this.source = this.closest('[data-sf-quick-view-body]') ? 'quick-view' : 'pdp';
      this._refreshAvailability(this.selected());
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }
    get sectionId() { return this.getAttribute('data-section-id'); }

    /* Values per option index, from checked radios, selects or fixed (hidden) single values. */
    selected() {
      var count = this.product.options.length;
      var values = new Array(count).fill(null);
      this.querySelectorAll('[data-sf-option]').forEach(function (group) {
        var i = Number(group.getAttribute('data-index'));
        var checked = group.querySelector('input[type="radio"]:checked');
        var select = group.querySelector('select');
        values[i] = checked ? checked.value : select ? select.value : null;
      });
      this.querySelectorAll('[data-sf-option-fixed]').forEach(function (input) {
        values[Number(input.getAttribute('data-index'))] = input.value;
      });
      return values;
    }
    findVariant(values) {
      return this.product.variants.find(function (v) {
        return v.options.every(function (o, i) { return values[i] === null || values[i] === o; });
      }) || null;
    }
    _onChange(e) {
      if (!e.target.closest('[data-sf-option]')) return;
      var values = this.selected();
      var exact = values.indexOf(null) === -1 ? this.findVariant(values) : null;
      this._refreshAvailability(values);
      this.querySelectorAll('[data-sf-option]').forEach(function (group) {
        var out = group.querySelector('[data-sf-option-value]');
        if (out) out.textContent = values[Number(group.getAttribute('data-index'))] || '';
      });
      if (exact && this.getAttribute('data-update-url') === 'true' && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', exact.id);
        window.history.replaceState(window.history.state, '', url.toString());
      }
      S.bus.emit('variant:change', { sectionId: this.sectionId, productId: this.product.id, variant: exact, source: this.source });
    }
    /* A value is available if some available variant has it AND matches the other selected values. */
    _refreshAvailability(values) {
      var variants = this.product.variants;
      this.querySelectorAll('[data-sf-option]').forEach(function (group) {
        var idx = Number(group.getAttribute('data-index'));
        var isAvailable = function (val) {
          return variants.some(function (v) {
            if (!v.available || v.options[idx] !== val) return false;
            return v.options.every(function (o, j) { return j === idx || values[j] === null || values[j] === o; });
          });
        };
        group.querySelectorAll('input[type="radio"]').forEach(function (input) {
          var ok = isAvailable(input.value);
          var label = group.querySelector('label[for="' + CSS.escape(input.id) + '"]');
          if (!label) return;
          label.classList.toggle('is-unavailable', !ok);
          var hint = label.querySelector('[data-sf-unavailable-text]');
          if (hint) hint.hidden = ok;
        });
        group.querySelectorAll('option').forEach(function (opt) {
          var ok = isAvailable(opt.value);
          opt.textContent = ok ? opt.getAttribute('data-label') : S.t('products.value_unavailable', { value: opt.getAttribute('data-label') });
        });
      });
    }
  }

  /* ── <sf-product-form> ───────────────────────────────────── */
  class SfProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      this.idInput = this.form.querySelector('[data-sf-variant-id]');
      this.button = this.form.querySelector('[data-sf-add-button]');
      this.label = this.form.querySelector('[data-sf-add-label]');
      this.form.addEventListener('submit', this._onSubmit.bind(this), sig);
      this._off = S.bus.on('variant:change', this._onVariant.bind(this));
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._off) this._off();
    }
    get sectionId() { return this.getAttribute('data-section-id'); }
    _setButton(state) {
      var b = this.button;
      if (!b) return;
      var key = { add: 'products.add_to_cart', sold: 'products.sold_out', none: 'products.unavailable', busy: 'products.adding' }[state];
      this.label.textContent = S.t(key);
      var disabled = state === 'sold' || state === 'none';
      b.disabled = disabled;
      if (disabled) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      if (state === 'busy') { b.setAttribute('aria-busy', 'true'); b.classList.add('is-loading'); }
      else { b.removeAttribute('aria-busy'); b.classList.remove('is-loading'); }
      this._state = state;
    }
    _onVariant(d) {
      if (!d || d.sectionId !== this.sectionId) return;
      var v = d.variant;
      var prev = this._state;
      this._clearError();
      if (!v) {
        this._setButton('none');
      } else {
        this.idInput.value = v.id;
        this._setButton(v.available ? 'add' : 'sold');
        var priceEl = rootOf(this).querySelector('[data-sf-price]');
        if (priceEl && v.price_html) {
          var tmp = doc.createElement('div');
          tmp.innerHTML = v.price_html;
          var src = tmp.querySelector('[data-sf-price]');
          if (src) { priceEl.className = src.className + ' sf-price--pdp'; priceEl.innerHTML = src.innerHTML; }
        }
        var qty = this.querySelector('sf-quantity-input');
        if (qty && typeof qty.setRules === 'function') qty.setRules(v.quantity_rule);
        var minQ = this.form.querySelector('[data-sf-min-qty]');
        if (minQ && v.quantity_rule) minQ.value = v.quantity_rule.min || 1;
      }
      if (prev !== this._state && this._state !== 'add') S.a11y.announce(this.label.textContent);
    }
    _clearError() {
      var box = this.querySelector('[data-sf-form-error]');
      if (box) box.hidden = true;
    }
    _onSubmit(e) {
      if (!S.cart || typeof S.cart.add !== 'function') return; // native POST to /cart/add
      e.preventDefault();
      if (!this.button || this.button.disabled || this._state === 'busy') return;
      var id = Number(this.idInput.value);
      var qInput = this.form.querySelector('[name="quantity"]');
      var qty = Math.max(1, Number(qInput && qInput.value) || 1);
      var self = this;
      var title = this.getAttribute('data-product-title') || '';
      this._clearError();
      this._setButton('busy');
      S.cart.add([{ id: id, quantity: qty }], { source: this.getAttribute('data-source') || 'product-form', trigger: this.button })
        .then(function () {
          self._setButton('add');
          S.a11y.announce(S.t('cart.item_added', { title: title }));
        })
        .catch(function (err) {
          self._setButton('add');
          var box = self.querySelector('[data-sf-form-error]');
          var msg = (err && typeof err.description === 'string' && err.description) || (err && err.message) || S.t('cart.error');
          if (box) {
            box.querySelector('[data-sf-form-error-text]').textContent = msg;
            box.hidden = false;
          }
          S.a11y.announce(msg, 'assertive');
        });
    }
  }

  /* ── <sf-product-gallery> ────────────────────────────────── */
  class SfProductGallery extends HTMLElement {
    connectedCallback() {
      this.list = this.querySelector('[data-sf-gallery-list]');
      if (!this.list) return;
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this.counter = this.querySelector('[data-sf-gallery-counter]');
      this.bar = this.querySelector('[data-sf-gallery-bar]');
      var raf = 0;
      this.list.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; self._sync(); });
      }, { passive: true, signal: this._ac.signal });
      this.addEventListener('click', this._onClick.bind(this), sig);
      this._off = S.bus.on('variant:change', this._onVariant.bind(this));
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._off) this._off();
    }
    get items() { return [].slice.call(this.list.children); }
    _isRail() { return this.list.scrollWidth > this.list.clientWidth + 2; }
    _sync() {
      var items = this.items;
      if (!items.length || !this._isRail()) return;
      var w = this.list.clientWidth || 1;
      var i = Math.min(items.length - 1, Math.max(0, Math.round(this.list.scrollLeft / w)));
      if (this.counter) this.counter.textContent = S.t('products.media_position', { current: i + 1, total: items.length });
      if (this.bar) this.bar.style.setProperty('--_p', ((i + 1) / items.length).toFixed(4));
    }
    _onClick(e) {
      var play = e.target.closest('[data-sf-media-play]');
      if (play) { e.preventDefault(); this._loadDeferred(play.closest('[data-sf-deferred-media]')); return; }
      var zoom = e.target.closest('[data-sf-zoom]');
      if (zoom) {
        var dialog = doc.getElementById(this.getAttribute('data-zoom-id'));
        if (!dialog || typeof dialog.open !== 'function') return;
        e.preventDefault();
        dialog.open(zoom);
        var viewer = dialog.querySelector('sf-zoom-viewer');
        if (viewer) viewer.show(zoom.getAttribute('data-media-id'));
      }
    }
    _loadDeferred(box) {
      if (!box || box.dataset.loaded) return;
      var tpl = box.querySelector('template');
      if (!tpl) return;
      var mount = function () {
        box.dataset.loaded = '1';
        var node = tpl.content.cloneNode(true);
        box.querySelector('[data-sf-media-play]').remove();
        box.appendChild(node);
        var v = box.querySelector('video');
        if (v) v.play().catch(function () {});
        var focusable = box.querySelector('video, iframe, model-viewer');
        if (focusable) focusable.focus({ preventScroll: true });
      };
      if (box.hasAttribute('data-model') && window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
        window.Shopify.loadFeatures([{ name: 'model-viewer-ui', version: '1.0', onLoad: function () {} }, { name: 'shopify-xr', version: '1.0', onLoad: function () {} }], mount);
      } else {
        mount();
      }
    }
    /* The selected variant's media leads the gallery (moved first, 200ms crossfade). */
    _onVariant(d) {
      if (!d || d.sectionId !== this.getAttribute('data-section-id') || !d.variant || !d.variant.featured_media_id) return;
      var id = String(d.variant.featured_media_id);
      var item = this.list.querySelector('[data-media-id="' + id + '"]');
      if (!item) return;
      var first = this.list.firstElementChild;
      this.items.forEach(function (el) { el.classList.toggle('is-active', el === item); });
      var self = this;
      var apply = function () {
        if (item !== first) self.list.insertBefore(item, first);
        self.items.forEach(function (el, i) { el.setAttribute('data-index', i + 1); });
        self.list.classList.remove('is-swapping');
        if (self._isRail()) self.list.scrollTo({ left: 0, behavior: 'auto' });
        else {
          var top = self.list.getBoundingClientRect().top;
          if (top < 0) self.list.scrollIntoView({ block: 'start', behavior: smooth() });
        }
        self._sync();
      };
      if (item === first) { apply(); return; }
      if (S.motion.reduced) { apply(); return; }
      this.list.classList.add('is-swapping');
      setTimeout(apply, 200);
    }
  }

  /* ── <sf-zoom-viewer>: full-screen viewer; native scroll/pinch to pan, drag on desktop ── */
  class SfZoomViewer extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-sf-zoom-track]');
      if (!this.track) return;
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this.counter = this.querySelector('[data-sf-zoom-counter]');
      this.addEventListener('click', function (e) {
        if (e.target.closest('[data-sf-zoom-prev]')) self.go(-1);
        else if (e.target.closest('[data-sf-zoom-next]')) self.go(1);
        else if (e.target.closest('.sf-zoom__img')) self.toggleZoom(e.target.closest('.sf-zoom__slide'), e);
      }, sig);
      this.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); self.go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); self.go(-1); }
      }, sig);
      var raf = 0;
      this.track.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; self._sync(); });
      }, { passive: true, signal: this._ac.signal });
      this._drag(sig);
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }
    get slides() { return [].slice.call(this.track.children); }
    get index() { return Math.round(this.track.scrollLeft / (this.track.clientWidth || 1)); }
    show(mediaId) {
      var slide = this.track.querySelector('[data-media-id="' + mediaId + '"]') || this.slides[0];
      var self = this;
      requestAnimationFrame(function () {
        self.track.scrollTo({ left: slide.offsetLeft, behavior: 'auto' });
        self._sync();
      });
    }
    go(dir) {
      var i = Math.max(0, Math.min(this.slides.length - 1, this.index + dir));
      this.slides.forEach(function (s) { s.classList.remove('is-zoomed'); });
      this.track.scrollTo({ left: this.slides[i].offsetLeft, behavior: smooth() });
    }
    _sync() {
      if (this.counter) this.counter.textContent = S.t('products.media_position', { current: this.index + 1, total: this.slides.length });
    }
    toggleZoom(slide, e) {
      if (!slide || this._dragged) return;
      var pan = slide.querySelector('[data-sf-zoom-pan]');
      var on = !slide.classList.contains('is-zoomed');
      var rect = pan.getBoundingClientRect();
      var fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
      slide.classList.toggle('is-zoomed', on);
      if (on) {
        pan.scrollLeft = fx * (pan.scrollWidth - pan.clientWidth);
        pan.scrollTop = fy * (pan.scrollHeight - pan.clientHeight);
        pan.focus({ preventScroll: true });
      }
    }
    _drag(sig) {
      var self = this, state = null;
      this.track.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') return;
        var slide = e.target.closest('.sf-zoom__slide.is-zoomed');
        if (!slide) return;
        var pan = slide.querySelector('[data-sf-zoom-pan]');
        state = { pan: pan, x: e.clientX, y: e.clientY, l: pan.scrollLeft, t: pan.scrollTop, moved: false };
        self._dragged = false;
      }, sig);
      window.addEventListener('pointermove', function (e) {
        if (!state) return;
        var dx = e.clientX - state.x, dy = e.clientY - state.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
        state.pan.scrollLeft = state.l - dx;
        state.pan.scrollTop = state.t - dy;
      }, sig);
      window.addEventListener('pointerup', function () {
        if (state && state.moved) { self._dragged = true; setTimeout(function () { self._dragged = false; }, 0); }
        state = null;
      }, sig);
    }
  }

  /* ── <sf-related-products>: recommendations via Section Rendering, near the viewport ── */
  class SfRelatedProducts extends HTMLElement {
    connectedCallback() {
      var url = this.getAttribute('data-url');
      if (!url || this.dataset.loaded) return;
      var self = this;
      // Observe the section root: while pending it is a 1px box (this element is display: none).
      var target = this.closest('[data-sf-related-root]') || this;
      this._stop = S.inView(target, function () { self._load(url); }, { rootMargin: '0px 0px 400px 0px' });
    }
    disconnectedCallback() { if (this._stop) this._stop(); }
    _load(url) {
      var self = this;
      var root = this.closest('[data-sf-related-root]');
      fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) {
        self.dataset.loaded = '1';
        S.utils.swapHTML(html, '[data-sf-related-body]', self);
        var hasCards = self.querySelector('[data-sf-related-body] .sf-card, [data-sf-related-body] sf-product-card');
        if (root) {
          if (hasCards) root.removeAttribute('data-state');
          else root.hidden = true;
        }
      }).catch(function () { if (root) root.hidden = true; });
    }
  }

  [['sf-variant-picker', SfVariantPicker], ['sf-product-form', SfProductForm], ['sf-product-gallery', SfProductGallery],
    ['sf-zoom-viewer', SfZoomViewer], ['sf-related-products', SfRelatedProducts]].forEach(function (pair) {
    if (!customElements.get(pair[0])) customElements.define(pair[0], pair[1]);
  });
})();
