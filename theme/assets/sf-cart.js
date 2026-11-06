/*
 * STEADFAST · sf-cart.js (COMMERCE)
 * Steadfast.cart (Ajax Cart API + Section Rendering, serial queue), <sf-quantity-input>,
 * <sf-cart-drawer> and <sf-main-cart>. Contract: ARCHITECTURE §4.4, §4.7. Loaded on every page.
 * Without JS every control is a real form: /cart/add, /cart (updates[], checkout), /cart/change.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || (S.modules && S.modules.cart)) return;
  S.modules.cart = true;

  var doc = document;
  var routes = S.routes || {};

  /* COMMERCE strings that sf-config-script does not carry (rendered by sf-search-overlay). */
  function mergeStrings() {
    var el = doc.getElementById('sf-commerce-strings');
    if (!el || el.dataset.merged) return;
    try {
      var extra = JSON.parse(el.textContent);
      Object.keys(extra).forEach(function (k) { if (!(k in S.strings)) S.strings[k] = extra[k]; });
      el.dataset.merged = '1';
    } catch (e) { S.debug('commerce strings', e); }
  }
  mergeStrings();
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mergeStrings, { once: true });

  /* Lazy bootstraps: quick view and predictive search load their modules on first use. */
  S.bus.on('quickview:open', function (d) {
    if (S.quickView) return;
    S.loadScript(S.assets.quickView).then(function () {
      if (S.quickView) S.quickView.open(d);
    }).catch(function () { if (d && d.url) window.location.href = d.url; });
  });
  function loadPredictive() {
    if (S.modules['predictive-search'] || !S.settings.predictiveSearch) return;
    S.loadScript(S.assets.predictiveSearch).catch(function () {});
  }
  S.bus.on('search:open', loadPredictive);
  doc.addEventListener('pointerover', function warm(e) {
    if (e.target.closest && e.target.closest('[data-sf-open="search"]')) { doc.removeEventListener('pointerover', warm); loadPredictive(); }
  });
  var queue = Promise.resolve();
  var lastCart = null;

  function enqueue(task) {
    var run = queue.then(task, task);
    queue = run.catch(function () {});
    return run;
  }
  function isDrawerMode() { return S.settings.cartType !== 'page'; }
  function drawerEl() { return doc.getElementById('sf-cart-drawer'); }
  function mainCartEl() { return doc.querySelector('[data-sf-main-cart]'); }
  function errText(err) {
    if (!err) return S.t('cart.error');
    if (typeof err.description === 'string' && err.description) return err.description;
    if (typeof err.message === 'string' && err.message && err.message !== 'Cart Error') return err.message;
    return S.t('cart.error');
  }
  function findItem(cart, key) {
    if (!cart || !cart.items) return null;
    for (var i = 0; i < cart.items.length; i++) if (cart.items[i].key === key || String(cart.items[i].id) === String(key)) return cart.items[i];
    return null;
  }

  function lineTitle(key) {
    if (!key) return '';
    var line = doc.querySelector('.sf-cart-line[data-key="' + CSS.escape(key) + '"]');
    return line ? line.getAttribute('data-title') : '';
  }

  /* Remember which control had focus inside a region, so a re-render can put it back. */
  function focusToken(region) {
    var a = doc.activeElement;
    if (!a || !region || !region.contains(a)) return null;
    var line = a.closest('[data-key]');
    var hook = ['data-sf-cart-remove', 'data-sf-qty-minus', 'data-sf-qty-plus', 'data-sf-cart-note'].filter(function (h) { return a.hasAttribute(h); })[0];
    if (!hook && a.matches('input[name="updates[]"]')) hook = 'data-sf-qty-field';
    return { key: line ? line.getAttribute('data-key') : null, hook: hook, region: region };
  }
  function restoreFocus(token) {
    if (!token) return;
    var region = token.region;
    var el = null;
    if (token.key && token.hook) {
      var line = region.querySelector('[data-key="' + CSS.escape(token.key) + '"]');
      if (line) el = token.hook === 'data-sf-qty-field' ? line.querySelector('input[name="updates[]"]') : line.querySelector('[' + token.hook + ']');
    } else if (token.hook) {
      el = region.querySelector('[' + token.hook + ']');
    }
    if (!el) el = region.querySelector('[data-sf-cart-title]') || region.querySelector('[data-sf-cart-focus-fallback]');
    if (el) el.focus({ preventScroll: true });
  }

  function applySections(sections) {
    if (!sections) return;
    Object.keys(sections).forEach(function (id) {
      var html = sections[id];
      if (!html) return;
      if (id === 'sf-cart-drawer') {
        var d = drawerEl();
        var region = d && d.querySelector('[data-sf-cart-drawer-body]');
        var token = focusToken(region);
        if (S.utils.swapHTML(html, '[data-sf-cart-drawer-body]', d || doc)) restoreFocus(token);
      } else {
        var main = mainCartEl();
        if (main && main.getAttribute('data-section-id') === id) {
          var body = main.querySelector('[data-sf-main-cart-body]');
          var tok = focusToken(body);
          if (S.utils.swapHTML(html, '[data-sf-main-cart-body]', main)) restoreFocus(tok);
        }
      }
    });
  }

  function sectionIds() {
    var ids = [];
    if (isDrawerMode() && drawerEl()) ids.push('sf-cart-drawer');
    var main = mainCartEl();
    if (main && main.getAttribute('data-section-id')) ids.push(main.getAttribute('data-section-id'));
    return ids;
  }

  function setBusy(on) {
    doc.querySelectorAll('[data-sf-cart-drawer-body], [data-sf-main-cart-body]').forEach(function (el) {
      el.classList.toggle('is-loading', on);
      if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
    });
  }

  function post(route, body) {
    var ids = sectionIds();
    if (ids.length) { body.sections = ids; body.sections_url = window.location.pathname; }
    return S.utils.fetchJSON(route + '.js', { method: 'POST', body: body });
  }

  var cart = {
    get: function () {
      return S.utils.fetchJSON(routes.cart + '.js').then(function (c) { lastCart = c; return c; });
    },
    sectionIds: sectionIds,
    add: function (items, opts) {
      opts = opts || {};
      var source = opts.source || 'external';
      var open = opts.open !== false;
      var d = drawerEl();
      if (open && d && typeof d.prepare === 'function') d.prepare();
      return enqueue(function () {
        return post(routes.cart_add, { items: items }).then(function (res) {
          applySections(res && res.sections);
          return cart.get().then(function (c) {
            var added = (res && res.items) || (res ? [res] : []);
            S.bus.emit('cart:item-added', { items: added, cart: c, source: source });
            S.bus.emit('cart:updated', { cart: c, source: source });
            if (!isDrawerMode()) {
              window.location.href = routes.cart;
            } else if (open) {
              openAfterHost(opts.trigger);
            }
            return c;
          });
        }).catch(function (err) {
          err = err || {};
          S.bus.emit('cart:error', { status: err.status, message: err.message, description: err.description, source: source });
          throw err;
        });
      });
    },
    change: function (params, opts) {
      opts = opts || {};
      params = params || {};
      var source = opts.source || 'external';
      var body = { quantity: params.quantity };
      if (params.line) body.line = params.line; else body.id = params.key;
      var before = findItem(lastCart, params.key);
      var title = before ? before.product_title : lineTitle(params.key);
      setBusy(true);
      return enqueue(function () {
        return post(routes.cart_change, body).then(function (c) {
          applySections(c && c.sections);
          if (c) delete c.sections;
          lastCart = c;
          if (title) {
            if (params.quantity === 0) S.a11y.announce(S.t('cart.item_removed', { title: title }));
            else S.a11y.announce(S.t('cart.item_updated', { title: title, quantity: params.quantity }));
          }
          S.bus.emit('cart:updated', { cart: c, source: source });
          return c;
        }).catch(function (err) {
          err = err || {};
          // The server may have capped the line: re-render so the UI shows the real quantity.
          return cart.refresh({ silent: true }).then(function () {
            S.bus.emit('cart:error', { status: err.status, message: err.message, description: err.description, source: source, key: params.key });
            S.a11y.announce(errText(err), 'assertive');
            throw err;
          });
        }).then(function (c) { setBusy(false); return c; }, function (e) { setBusy(false); throw e; });
      });
    },
    update: function (updates, opts) {
      opts = opts || {};
      var body = { updates: updates || {} };
      if (typeof opts.note === 'string') body.note = opts.note;
      if (opts.attributes) body.attributes = opts.attributes;
      return enqueue(function () {
        return post(routes.cart_update, body).then(function (c) {
          if (!opts.skipRender) applySections(c && c.sections);
          if (c) delete c.sections;
          lastCart = c;
          S.bus.emit('cart:updated', { cart: c, source: opts.source || 'external' });
          return c;
        });
      });
    },
    clear: function () {
      return enqueue(function () {
        return post(routes.cart_clear, {}).then(function (c) {
          applySections(c && c.sections);
          if (c) delete c.sections;
          lastCart = c;
          S.bus.emit('cart:updated', { cart: c, source: 'external' });
          return c;
        });
      });
    },
    refresh: function (opts) {
      opts = opts || {};
      var ids = sectionIds();
      var p = ids.length ? S.utils.fetchSections(ids, window.location.pathname).then(applySections) : Promise.resolve();
      return p.then(function () { return cart.get(); }).then(function (c) {
        if (!opts.silent) S.bus.emit('cart:updated', { cart: c, source: 'external' });
        return c;
      });
    },
    open: function (trigger) {
      if (!isDrawerMode() || !drawerEl()) { window.location.href = routes.cart; return; }
      var d = drawerEl();
      if (d && typeof d.open === 'function' && !d.isOpen) d.open(trigger);
    },
    close: function () {
      var d = drawerEl();
      if (d && typeof d.close === 'function') d.close();
    }
  };
  S.cart = cart;

  /* Open the drawer; if the add came from inside another dialog (quick view), wait until that one has closed. */
  function openAfterHost(trigger) {
    var host = trigger && trigger.closest ? trigger.closest('sf-dialog') : null;
    if (host && host.id !== 'sf-cart-drawer' && host.isOpen) {
      var hostTrigger = host._trigger;
      var off = S.bus.on('drawer:close', function (d) {
        if (d.id !== host.id) return;
        off();
        S.bus.emit('cart:open', { trigger: hostTrigger && hostTrigger.isConnected ? hostTrigger : null });
      });
      return;
    }
    S.bus.emit('cart:open', { trigger: trigger });
  }

  S.bus.on('cart:open', function (d) { cart.open(d && d.trigger); });
  S.bus.on('cart:close', function () { cart.close(); });

  window.addEventListener('pageshow', function (e) { if (e.persisted) cart.refresh(); });
  var hiddenAt = 0;
  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= 30000) { hiddenAt = 0; cart.refresh(); }
  });

  /* ── <sf-quantity-input>: − | value | + (DESIGN §6.4). Emits a native bubbling 'change'. ── */
  class SfQuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      if (!this.input) return;
      this._ac = new AbortController();
      var self = this;
      this.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-sf-qty-minus], [data-sf-qty-plus]');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        self.step(btn.hasAttribute('data-sf-qty-plus') ? 1 : -1);
      }, { signal: this._ac.signal });
      this.input.addEventListener('input', function () { self.sync(); }, { signal: this._ac.signal });
      this.sync();
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }
    get rules() {
      var i = this.input;
      return {
        min: Number(i.min || 0),
        max: i.max ? Number(i.max) : Infinity,
        step: Number(i.step || 1) || 1
      };
    }
    step(dir) {
      var r = this.rules;
      var v = Number(this.input.value || 0);
      var next = dir > 0 ? v + r.step : v - r.step;
      if (this.hasAttribute('data-allow-zero') && dir < 0 && next < r.min) next = 0;
      else next = Math.max(r.min, next);
      next = Math.min(r.max, next);
      if (next === v) return;
      this.input.value = next;
      this.sync();
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setRules(rule) {
      if (!rule) return;
      this.input.min = rule.min || 1;
      this.input.step = rule.increment || 1;
      if (rule.max) this.input.max = rule.max; else this.input.removeAttribute('max');
      if (Number(this.input.value) < Number(this.input.min)) this.input.value = this.input.min;
      this.sync();
    }
    sync() {
      var r = this.rules;
      var v = Number(this.input.value || 0);
      var minus = this.querySelector('[data-sf-qty-minus]');
      var plus = this.querySelector('[data-sf-qty-plus]');
      var floor = this.hasAttribute('data-allow-zero') ? 0 : r.min;
      if (minus) minus.disabled = v <= floor;
      if (plus) plus.disabled = v >= r.max;
    }
  }
  if (!customElements.get('sf-quantity-input')) customElements.define('sf-quantity-input', SfQuantityInput);

  /* ── Shared behaviour for the drawer and the cart page ── */
  class SfCartRegion extends HTMLElement {
    connectedCallback() {
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this._qtyTimers = {};
      this.classList.add('is-enhanced');
      this.addEventListener('change', function (e) { self._onChange(e); }, sig);
      this.addEventListener('click', function (e) { self._onClick(e); }, sig);
      this.addEventListener('input', S.utils.debounce(function (e) {
        if (e.target.matches('[data-sf-cart-note]')) cart.update({}, { note: e.target.value, skipRender: true, source: self.source });
      }, 500), sig);
      this._offError = S.bus.on('cart:error', function (d) { if (d.key) self._lineError(d.key, errText(d)); });
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._offError) this._offError();
    }
    get source() { return 'drawer'; }
    _onChange(e) {
      var input = e.target;
      if (!input.matches('input[name="updates[]"]')) return;
      var key = input.getAttribute('data-key');
      var self = this;
      clearTimeout(this._qtyTimers[key]);
      this._qtyTimers[key] = setTimeout(function () {
        var q = Math.max(0, parseInt(input.value, 10) || 0);
        if (q === 0) self._removeLine(key);
        else cart.change({ key: key, quantity: q }, { source: self.source }).catch(function () {});
      }, 350);
    }
    _onClick(e) {
      var rm = e.target.closest('[data-sf-cart-remove]');
      if (rm && this.contains(rm)) {
        e.preventDefault();
        this._removeLine(rm.getAttribute('data-key'));
      }
    }
    _removeLine(key) {
      var line = this.querySelector('.sf-cart-line[data-key="' + CSS.escape(key) + '"]');
      var run = function () { return cart.change({ key: key, quantity: 0 }, { source: this.source }).catch(function () { if (line) line.classList.remove('is-removing'); }); }.bind(this);
      if (line && !S.motion.reduced) {
        line.classList.add('is-removing');
        setTimeout(run, 240);
      } else {
        run();
      }
    }
    _lineError(key, msg) {
      var line = this.querySelector('.sf-cart-line[data-key="' + CSS.escape(key) + '"]');
      var box = line && line.querySelector('[data-sf-line-error]');
      if (!box) return;
      box.querySelector('[data-sf-line-error-text]').textContent = msg;
      box.hidden = false;
    }
  }

  class SfCartDrawer extends SfCartRegion {
    get source() { return 'drawer'; }
  }
  class SfMainCart extends SfCartRegion {
    get source() { return 'cart-page'; }
    connectedCallback() {
      super.connectedCallback();
      var self = this;
      // With JS the quantities update live; the manual "Update cart" button is not needed.
      this.addEventListener('submit', function (e) {
        if (e.submitter && e.submitter.name === 'checkout') return;
        if (e.submitter && e.submitter.hasAttribute('data-sf-cart-remove')) { e.preventDefault(); return; }
      }, { signal: this._ac.signal });
      if (this.hasAttribute('data-recommendations') && S.assets.product) S.loadScript(S.assets.product).catch(function () {});
      self.dataset.ready = 'true';
    }
  }
  if (!customElements.get('sf-cart-drawer')) customElements.define('sf-cart-drawer', SfCartDrawer);
  if (!customElements.get('sf-main-cart')) customElements.define('sf-main-cart', SfMainCart);

  /* Prime lastCart lazily so removal announcements can name the product. */
  /* Only where a line can be removed (drawer opened, or the cart page), so other pages make no extra request. */
  function prime() { if (!lastCart) cart.get().catch(function () {}); }
  S.bus.on('drawer:open', function (d) { if (d && /cart-drawer$/.test(d.id || '')) prime(); });
  if (doc.querySelector('sf-main-cart')) S.onIdle(prime, 3000);
})();
