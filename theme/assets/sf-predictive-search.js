/*
 * STEADFAST · sf-predictive-search.js (COMMERCE)
 * <sf-predictive-search> inside #sf-search-overlay: debounced /search/suggest (Section Rendering),
 * combobox + listbox keyboard model (focus stays in the input), result-count announcements.
 * Contract: ARCHITECTURE §4.7. Without JS the overlay form is a plain GET to /search.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules['predictive-search']) return;
  S.modules['predictive-search'] = true;

  var doc = document;

  class SfPredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[name="q"]');
      this.region = this.querySelector('[data-sf-predictive-body]');
      if (!this.input || !this.region || this.getAttribute('data-enabled') === 'false') return;
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this.input.addEventListener('input', S.utils.debounce(function () { self.query(); }, 250), sig);
      this.input.addEventListener('keydown', this._onKey.bind(this), sig);
      this.region.addEventListener('pointermove', function (e) {
        var o = e.target.closest('[role="option"]');
        if (o) self._setActive(o, false);
      }, sig);
      this._off = S.bus.on('search:close', function () { if (self._fetch) self._fetch.abort(); });
      if (this.input.value.trim().length >= 2) this.query();
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._off) this._off();
      if (this._fetch) this._fetch.abort();
    }
    get options() { return [].slice.call(this.region.querySelectorAll('[role="option"]')); }
    clear() {
      this.region.innerHTML = '<div id="sf-predictive-results" role="listbox" hidden></div>';
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
      this._lastQ = '';
    }
    query() {
      var q = this.input.value.trim();
      if (q.length < 2) { this.clear(); return; }
      if (q === this._lastQ) return;
      this._lastQ = q;
      if (this._fetch) this._fetch.abort();
      this._fetch = new AbortController();
      var self = this;
      var url = S.routes.predictive_search + '?q=' + encodeURIComponent(q) +
        '&resources[type]=product,collection,page,article,query&resources[limit]=4' +
        '&resources[options][unavailable_products]=last&section_id=sf-predictive-search';
      this.setAttribute('aria-busy', 'true');
      fetch(url, { credentials: 'same-origin', signal: this._fetch.signal }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) {
        self.removeAttribute('aria-busy');
        if (!S.utils.swapHTML(html, '[data-sf-predictive-body]', self)) return;
        var list = self.region.querySelector('[role="listbox"]');
        var n = list ? Number(list.getAttribute('data-count') || 0) : 0;
        self.input.setAttribute('aria-expanded', list && !list.hidden ? 'true' : 'false');
        self.input.removeAttribute('aria-activedescendant');
        S.a11y.announce(n ? S.t('search.predictive_count', { count: n }) : S.t('search.predictive_none'));
      }).catch(function (err) {
        self.removeAttribute('aria-busy');
        if (err && err.name === 'AbortError') return;
        self._lastQ = '';
      });
    }
    _setActive(option, scroll) {
      this.options.forEach(function (o) {
        var on = o === option;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.classList.toggle('is-active', on);
      });
      if (option) {
        this.input.setAttribute('aria-activedescendant', option.id);
        if (scroll !== false) option.scrollIntoView({ block: 'nearest' });
      } else {
        this.input.removeAttribute('aria-activedescendant');
      }
    }
    _onKey(e) {
      var opts = this.options;
      if (!opts.length) return;
      var current = opts.findIndex(function (o) { return o.getAttribute('aria-selected') === 'true'; });
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._setActive(opts[(current + 1) % opts.length]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._setActive(opts[current <= 0 ? opts.length - 1 : current - 1]);
      } else if (e.key === 'Enter' && current > -1) {
        var link = opts[current].querySelector('a[href]');
        if (link) { e.preventDefault(); window.location.href = link.href; }
      }
    }
  }
  if (!customElements.get('sf-predictive-search')) customElements.define('sf-predictive-search', SfPredictiveSearch);
})();
