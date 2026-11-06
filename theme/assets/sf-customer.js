/*
 * STEADFAST · sf-customer.js (COMMERCE)
 * <sf-address-form> (country → province sync from Shopify's data-provinces), delete confirm,
 * the #recover toggle on log in, and focus on error summaries / success lines after a post.
 * Contract: ARCHITECTURE §4.7. Every form works without this file.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules.customer) return;
  S.modules.customer = true;

  var doc = document;

  class SfAddressForm extends HTMLElement {
    connectedCallback() {
      this.country = this.querySelector('[data-sf-country]');
      this.province = this.querySelector('[data-sf-province]');
      this.wrap = this.querySelector('[data-sf-province-wrap]');
      if (!this.country || !this.province) return;
      this._ac = new AbortController();
      var def = this.country.getAttribute('data-default');
      if (def) {
        for (var i = 0; i < this.country.options.length; i++) {
          if (this.country.options[i].value === def || this.country.options[i].textContent.trim() === def) { this.country.selectedIndex = i; break; }
        }
      }
      this.country.addEventListener('change', this.sync.bind(this, false), { signal: this._ac.signal });
      this.sync(true);
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }
    sync(initial) {
      var opt = this.country.options[this.country.selectedIndex];
      var provinces = [];
      try { provinces = JSON.parse((opt && opt.getAttribute('data-provinces')) || '[]'); } catch (e) { provinces = []; }
      var keep = initial ? this.province.getAttribute('data-default') : '';
      this.province.innerHTML = '';
      provinces.forEach(function (p) {
        var o = doc.createElement('option');
        o.value = p[0];
        o.textContent = p[1];
        if (keep && (p[0] === keep || p[1] === keep)) o.selected = true;
        this.province.appendChild(o);
      }, this);
      if (this.wrap) this.wrap.hidden = provinces.length === 0;
    }
  }
  if (!customElements.get('sf-address-form')) customElements.define('sf-address-form', SfAddressForm);

  doc.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('form[data-sf-confirm]');
    if (form && !window.confirm(form.getAttribute('data-sf-confirm'))) e.preventDefault();
  });

  /* Log in: #recover shows the recovery form (CSS :target handles no-JS); keep focus sensible. */
  function syncRecover() {
    var recover = doc.getElementById('recover');
    if (!recover) return;
    var show = window.location.hash === '#recover' || !!recover.querySelector('[data-sf-recover-success], [data-sf-recover-error]');
    recover.closest('.sf-login').classList.toggle('is-recovering', show);
  }
  doc.addEventListener('click', function (e) {
    var open = e.target.closest && e.target.closest('[data-sf-recover-open]');
    var cancel = e.target.closest && e.target.closest('[data-sf-recover-cancel]');
    if (!open && !cancel) return;
    e.preventDefault();
    var login = doc.querySelector('.sf-login');
    if (!login) return;
    login.classList.toggle('is-recovering', !!open);
    if (window.history.replaceState) window.history.replaceState(null, '', open ? '#recover' : window.location.pathname);
    var target = open ? doc.getElementById('RecoverEmail') : doc.getElementById('CustomerEmail');
    if (target) target.focus();
  });

  function ready() {
    syncRecover();
    var focusTarget = doc.querySelector('[data-sf-error-summary]') || doc.querySelector('[data-sf-form-status]');
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }
  window.addEventListener('hashchange', syncRecover);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
