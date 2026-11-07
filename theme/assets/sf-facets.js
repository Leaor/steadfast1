/*
 * STEADFAST · sf-facets.js (COMMERCE)
 * <sf-facets>: live filtering / sorting through the Section Rendering API (desktop applies on
 * change, mobile on "Show n results"), history support, removable chips, load more.
 * <sf-grid-density>: 2/4 (desktop) and 1/2 (mobile) grid toggle, persisted per visitor.
 * Contract: ARCHITECTURE §4.7. The markup is a native GET form; this file only enhances it.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules.facets) return;
  S.modules.facets = true;

  var doc = document;
  var DESKTOP = '(min-width: 990px)';
  function isDesktop() { return window.matchMedia(DESKTOP).matches; }
  function cleanParams(params) {
    var out = new URLSearchParams();
    params.forEach(function (v, k) { if (v !== '' && k !== 'page' && k !== 'section_id') out.append(k, v); });
    return out;
  }
  function swapAll(parsed, root, selector) {
    var from = parsed.querySelectorAll(selector);
    var to = root.querySelectorAll(selector);
    to.forEach(function (el, i) { if (from[i]) el.innerHTML = from[i].innerHTML; });
  }

  class SfFacets extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.getAttribute('data-section-id');
      this.form = this.querySelector('[data-sf-facets-form]');
      // Groups beyond the first two render open so they work without JS; collapse them here.
      this.querySelectorAll('[data-sf-facet-collapse]').forEach(function (d) { d.open = false; d.removeAttribute('data-sf-facet-collapse'); });
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this._debounced = S.utils.debounce(function (apply) { self.render(self.formURL(), { apply: apply, push: apply }); }, 300);
      this.addEventListener('change', this._onChange.bind(this), sig);
      this.addEventListener('input', function (e) {
        if (e.target.matches('[data-sf-price-input]')) self._debounced(isDesktop());
      }, sig);
      this.addEventListener('click', this._onClick.bind(this), sig);
      this._syncSort(); // a restored (back/forward) select value
      if (this.form) {
        this.form.addEventListener('submit', function (e) {
          e.preventDefault();
          self.render(self.formURL(), { apply: true, push: true }).then(function () { self.closeDrawer(); });
        }, sig);
      }
      window.addEventListener('popstate', function () {
        self.render(window.location.href, { apply: true, push: false });
      }, sig);
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._fetch) this._fetch.abort();
    }
    closeDrawer() {
      var d = this.querySelector('sf-dialog[data-sf-dialog-type="drawer-left"]');
      if (d && d.isOpen) d.close();
    }
    formURL() {
      var base = this.form ? this.form.getAttribute('action') : window.location.pathname;
      var params = cleanParams(new URLSearchParams(this.form ? new FormData(this.form) : ''));
      var qs = params.toString();
      return base + (qs ? '?' + qs : '');
    }
    /* The visible sort value is a span under the transparent native select (sf-sort). */
    _syncSort() {
      this.querySelectorAll('[data-sf-sort]').forEach(function (sel) {
        var out = sel.parentNode.querySelector('[data-sf-sort-value]');
        var opt = sel.options[sel.selectedIndex];
        if (out && opt) out.textContent = opt.textContent;
      });
    }
    _onChange(e) {
      var t = e.target;
      if (t.matches('[data-sf-sort]')) { this._syncSort(); this.render(this.formURL(), { apply: true, push: true }); return; }
      if (t.matches('[data-sf-price-input]')) return; // handled by 'input'
      if (t.closest('[data-sf-facets-form]')) this._debounced(isDesktop());
    }
    _onClick(e) {
      var link = e.target.closest('[data-sf-facet-link]');
      if (link && this.contains(link)) {
        e.preventDefault();
        this.render(link.getAttribute('href'), { apply: true, push: true });
        return;
      }
      var more = e.target.closest('[data-sf-load-more]');
      if (more && this.contains(more)) {
        e.preventDefault();
        this._loadMore(more);
      }
    }
    _fetchSection(url) {
      if (this._fetch) this._fetch.abort();
      this._fetch = new AbortController();
      var u = new URL(url, window.location.origin);
      u.searchParams.set('section_id', this.sectionId);
      return fetch(u.pathname + u.search, { credentials: 'same-origin', signal: this._fetch.signal }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
    }
    render(url, opts) {
      opts = opts || {};
      var self = this;
      var results = this.querySelector('[data-sf-facets-results]');
      if (opts.apply && results) results.classList.add('is-loading');
      return this._fetchSection(url).then(function (parsed) {
        // Filter groups: keep open/closed state and focus.
        var openState = {};
        self.querySelectorAll('[data-sf-facet]').forEach(function (d) { openState[d.getAttribute('data-sf-facet')] = d.open; });
        var active = doc.activeElement;
        var activeId = active && self.contains(active) ? active.id : null;
        swapAll(parsed, self, '[data-sf-facets-groups]');
        self.querySelectorAll('[data-sf-facet]').forEach(function (d) {
          var k = d.getAttribute('data-sf-facet');
          if (k in openState) d.open = openState[k];
          else if (d.hasAttribute('data-sf-facet-collapse')) d.open = false;
          d.removeAttribute('data-sf-facet-collapse');
        });
        swapAll(parsed, self, '[data-sf-facets-submit-label]');
        swapAll(parsed, self, '.sf-active-facets--drawer');
        if (opts.apply) {
          swapAll(parsed, self, '[data-sf-facets-results]');
          swapAll(parsed, self, '.sf-facets__active-row');
          swapAll(parsed, self, '[data-sf-facets-count]');
          // Counts outside <sf-facets> (the search header) must follow the filters too.
          swapAll(parsed, self.closest('.shopify-section') || doc, '[data-sf-facets-count-header]');
          swapAll(parsed, self, '[data-sf-facets-filter-label]');
          var sortSrc = parsed.querySelector('[data-sf-sort]');
          var sortDst = self.querySelector('[data-sf-sort]');
          if (sortSrc && sortDst && doc.activeElement !== sortDst) sortDst.value = sortSrc.value;
          self._syncSort();
          if (results) results.classList.remove('is-loading');
          if (opts.push && window.history.pushState) {
            var clean = new URL(url, window.location.origin);
            clean.searchParams.delete('section_id');
            window.history.pushState({ sfFacets: true }, '', clean.pathname + clean.search);
          }
          var count = self.querySelector('[data-sf-facets-count]');
          if (count) S.a11y.announce(count.textContent.trim());
          S.bus.emit('facets:updated', { url: url, sectionId: self.sectionId });
        }
        if (activeId) {
          var again = doc.getElementById(activeId);
          if (again && again !== doc.activeElement) again.focus({ preventScroll: true });
        }
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (results) results.classList.remove('is-loading');
        if (opts.apply) window.location.href = url; // fall back to a full navigation
      });
    }
    _loadMore(btn) {
      var self = this;
      var url = btn.getAttribute('href');
      var wrap = btn.closest('[data-sf-load-more-wrap]');
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-loading');
      S.a11y.announce(S.t('collections.loading_more'));
      this._fetchSection(url).then(function (parsed) {
        var grid = self.querySelector('[data-sf-product-grid]');
        var incoming = parsed.querySelector('[data-sf-product-grid]');
        var firstNew = null;
        if (grid && incoming) {
          [].slice.call(incoming.children).forEach(function (li, i) {
            var node = doc.importNode(li, true);
            if (i === 0) firstNew = node;
            grid.appendChild(node);
          });
        }
        var nextWrap = parsed.querySelector('[data-sf-load-more-wrap]');
        if (wrap) {
          if (nextWrap) wrap.innerHTML = nextWrap.innerHTML; else wrap.remove();
        }
        var link = firstNew && firstNew.querySelector('.sf-card__link, a');
        if (link) link.focus({ preventScroll: true });
        S.bus.emit('facets:updated', { url: url, sectionId: self.sectionId });
      }).catch(function () { window.location.href = url; });
    }
  }

  /* ── <sf-grid-density> ───────────────────────────────────── */
  var KEY = 'sf:grid-density';
  function readPref() {
    try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writePref(p) {
    try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ }
  }
  var SIZES = {
    d: { large: '48vw', small: '24vw' },
    m: { large: '100vw', small: '50vw' }
  };

  class SfGridDensity extends HTMLElement {
    connectedCallback() {
      this.host = this.closest('sf-facets') || doc;
      this._ac = new AbortController();
      var self = this;
      var defD = Number(this.host.getAttribute && this.host.getAttribute('data-default-desktop')) === 2 ? 'large' : 'small';
      var defM = Number(this.host.getAttribute && this.host.getAttribute('data-default-mobile')) === 1 ? 'large' : 'small';
      var pref = readPref();
      this.state = { d: pref.d || defD, m: pref.m || defM };
      this.mq = window.matchMedia(DESKTOP);
      this.addEventListener('click', function (e) {
        var b = e.target.closest('[data-density]');
        if (!b) return;
        self.state[self.mq.matches ? 'd' : 'm'] = b.getAttribute('data-density');
        writePref(self.state);
        self.apply();
      }, { signal: this._ac.signal });
      this.mq.addEventListener('change', function () { self.apply(); }, { signal: this._ac.signal });
      this._off = S.bus.on('facets:updated', function () { self.apply(); });
      this.apply();
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._off) this._off();
    }
    apply() {
      var bp = this.mq.matches ? 'd' : 'm';
      var current = this.state[bp];
      var grid = this.host.querySelector('[data-sf-product-grid]');
      if (grid) {
        grid.setAttribute('data-density', current);
        grid.setAttribute('data-density-d', this.state.d);
        grid.setAttribute('data-density-m', this.state.m);
        var sizes = '(min-width: 990px) ' + SIZES.d[this.state.d] + ', (min-width: 750px) 48vw, ' + SIZES.m[this.state.m];
        grid.querySelectorAll('.sf-card__img').forEach(function (img) {
          if (img.getAttribute('sizes') !== sizes) img.setAttribute('sizes', sizes);
          var pic = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
          if (pic) pic.querySelectorAll('source').forEach(function (s) { s.setAttribute('sizes', sizes); });
        });
      }
      this.querySelectorAll('[data-density]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-density') === current ? 'true' : 'false');
      });
    }
  }

  if (!customElements.get('sf-facets')) customElements.define('sf-facets', SfFacets);
  if (!customElements.get('sf-grid-density')) customElements.define('sf-grid-density', SfGridDensity);
})();
