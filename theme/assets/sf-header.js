/*
 * STEADFAST · sf-header.js (CORE)
 * <sf-header> (transparent → solid via the hero sentinel, condensed, hide on scroll down, mega menu
 * disclosure), <sf-menu-drawer> (nested slide-over levels, switching to search / cart),
 * <sf-cart-count>, <sf-localization>, the announcement rotator and the footer accordions.
 * Spec: ARCHITECTURE §4.2, DESIGN §7.1–§7.3, §7.11, §8.3. No GSAP.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules.header) return;
  S.modules.header = true;

  var doc = document;
  var html = doc.documentElement;
  var LG = '(min-width: 990px)';
  var FINE = '(hover: hover) and (pointer: fine)';
  function mq(q) { return window.matchMedia(q).matches; }
  function ms(token) { return S.motion.reduced ? 0 : token; }

  /* ── <sf-header> ─────────────────────────────────────────── */
  class SfHeader extends HTMLElement {
    connectedCallback() {
      this.root = this.closest('[data-sf-header]') || this;
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this.sticky = this.root.getAttribute('data-sticky') || 'on-scroll-up';
      this.lastY = window.scrollY;
      this.pastHero = false;
      this.openItem = null;

      // Runtime height token.
      if ('ResizeObserver' in window) {
        var raf = 0;
        this._ro = new ResizeObserver(function () {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(function () {
            html.style.setProperty('--sf-header-h', Math.round(self.getBoundingClientRect().height) + 'px');
          });
        });
        this._ro.observe(this);
      }

      // Transparent → solid, driven by the hero's sentinel (no GSAP, no scroll maths).
      var sentinel = doc.querySelector('[data-sf-header-sentinel]');
      if (this.root.getAttribute('data-transparent') === 'true') {
        if (!sentinel || !('IntersectionObserver' in window)) {
          this.setState('solid');
        } else {
          this._observeSentinel(sentinel);
        }
      }

      // One rAF-throttled, passive scroll listener (ARCHITECTURE §6.2).
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { ticking = false; self._onScroll(); });
      }, { passive: true, signal: this._ac.signal });
      this._onScroll();

      // Reappear on focus inside, or while any dialog is open.
      this.root.addEventListener('focusin', function () { self.setHidden(false); }, sig);
      this._offs = [
        S.bus.on('drawer:open', function () { self.setHidden(false); self.closeMega(true); }),
        S.bus.on('motion:change', function () { self._onScroll(); })
      ];

      this._initMega(sig);
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      (this._offs || []).forEach(function (off) { off(); });
    }
    _observeSentinel(sentinel) {
      var self = this;
      var build = function () {
        if (self._io) self._io.disconnect();
        var reserve = mq(LG) ? 72 : 56;
        // A huge bottom margin counts "below the viewport" as still under the hero.
        self._io = new IntersectionObserver(function (entries) {
          var e = entries[entries.length - 1];
          self.pastHero = !e.isIntersecting;
          self.setState(e.isIntersecting ? 'transparent' : 'solid');
        }, { rootMargin: '-' + reserve + 'px 0px 100000px 0px', threshold: 0 });
        self._io.observe(sentinel);
      };
      build();
      window.matchMedia(LG).addEventListener('change', build, { signal: this._ac.signal });
    }
    setState(state) {
      if (this.root.getAttribute('data-state') !== state) this.root.setAttribute('data-state', state);
    }
    setHidden(hidden) {
      var v = hidden ? 'true' : 'false';
      if (this.root.getAttribute('data-hidden') !== v) this.root.setAttribute('data-hidden', v);
    }
    _onScroll() {
      var y = Math.max(0, window.scrollY);
      if (this.openItem && Math.abs(y - this.megaY) > 48) this.closeMega();
      var condensed = y > 8 ? 'true' : 'false';
      if (this.root.getAttribute('data-condensed') !== condensed) this.root.setAttribute('data-condensed', condensed);
      if (this.sticky === 'on-scroll-up') {
        var transparentHeader = this.root.getAttribute('data-transparent') === 'true' && doc.querySelector('[data-sf-header-sentinel]');
        var threshold = transparentHeader ? null : this.offsetHeight * 2;
        var beyond = threshold === null ? this.pastHero : y > threshold;
        var delta = y - this.lastY;
        var busy = this.openItem || S.scrollLock.locked || this.root.contains(doc.activeElement);
        if (!beyond || busy) this.setHidden(false);
        else if (delta > 4) this.setHidden(true);
        else if (delta < -4) this.setHidden(false);
      }
      this.lastY = y;
    }

    /* Mega menu: disclosure buttons (not ARIA menus), click / Enter / Space, hover intent on fine pointers. */
    _initMega(sig) {
      var self = this;
      var items = [].slice.call(this.querySelectorAll('[data-sf-nav-item]'));
      items.forEach(function (item) {
        var btn = item.querySelector('[data-sf-mega-trigger]');
        if (!btn) return;
        btn.addEventListener('click', function () {
          clearTimeout(self._enterT);
          if (self.openItem === item) self.closeMega();
          else self.openMega(item);
        }, sig);
        item.addEventListener('pointerenter', function (e) {
          if (e.pointerType !== 'mouse' || !mq(FINE)) return;
          clearTimeout(self._leaveT);
          clearTimeout(self._enterT);
          self._enterT = setTimeout(function () { self.openMega(item); }, 120);
        }, sig);
        item.addEventListener('pointerleave', function (e) {
          if (e.pointerType !== 'mouse') return;
          clearTimeout(self._enterT);
          self._leaveT = setTimeout(function () { if (self.openItem === item) self.closeMega(); }, 200);
        }, sig);
        item.addEventListener('focusout', function (e) {
          if (self.openItem === item && !item.contains(e.relatedTarget)) self.closeMega();
        }, sig);
      });
      // Stage: the hovered / focused category's frame crossfades in (Section E device, DESIGN §8.3 E).
      this.querySelectorAll('[data-sf-mega-panel]').forEach(function (panel) {
        var show = function (e) {
          var a = e.target.closest && e.target.closest('.sf-mega__link');
          if (!a || !panel.contains(a)) return;
          panel.querySelectorAll('.sf-mega__link.is-active').forEach(function (el) { if (el !== a) el.classList.remove('is-active'); });
          a.classList.add('is-active');
          var idx = a.getAttribute('data-sf-mega-show');
          if (idx === null) return;
          panel.querySelectorAll('[data-sf-mega-frame]').forEach(function (f) {
            f.classList.toggle('is-active', f.getAttribute('data-sf-mega-frame') === idx);
          });
        };
        panel.addEventListener('pointerover', show, sig);
        panel.addEventListener('focusin', show, sig);
      });
      doc.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !self.openItem) return;
        var btn = self.openItem.querySelector('[data-sf-mega-trigger]');
        self.closeMega();
        if (btn) btn.focus();
      }, sig);
      doc.addEventListener('click', function (e) {
        if (self.openItem && !self.openItem.contains(e.target)) self.closeMega();
      }, sig);
    }
    openMega(item) {
      if (this.openItem === item) return;
      if (this.openItem) this.closeMega(true);
      clearTimeout(this._closeT);
      clearTimeout(this._leaveT); // a pending hover-out must not close a menu opened since (click / Enter)
      item.classList.remove('is-closing');
      item.classList.add('is-open');
      var btn = item.querySelector('[data-sf-mega-trigger]');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      this.openItem = item;
      this.megaY = window.scrollY;
      this.root.setAttribute('data-mega-open', 'true');
      this.setHidden(false);
    }
    closeMega(instant) {
      clearTimeout(this._enterT);
      var item = this.openItem;
      if (!item) return;
      this.openItem = null;
      var btn = item.querySelector('[data-sf-mega-trigger]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      item.classList.remove('is-open');
      this.root.removeAttribute('data-mega-open');
      if (instant) return;
      item.classList.add('is-closing');
      this._closeT = setTimeout(function () { item.classList.remove('is-closing'); }, ms(240) + 20);
    }
  }
  if (!customElements.get('sf-header')) customElements.define('sf-header', SfHeader);

  /* ── <sf-menu-drawer> ────────────────────────────────────── */
  class SfMenuDrawer extends HTMLElement {
    connectedCallback() {
      this._ac = new AbortController();
      var sig = { signal: this._ac.signal };
      var self = this;
      this.dialogEl = this.closest('sf-dialog');

      this.querySelectorAll('[data-sf-menu-sub]').forEach(function (details) {
        details.addEventListener('toggle', function () {
          if (!details.open) return;
          var back = details.querySelector('[data-sf-menu-back]');
          if (back) back.focus({ preventScroll: true });
        }, sig);
      });
      this.addEventListener('click', function (e) {
        var back = e.target.closest('[data-sf-menu-back]');
        if (back) {
          e.preventDefault();
          self.closeSub(back.closest('[data-sf-menu-sub]'), true);
          return;
        }
        var sw = e.target.closest('[data-sf-menu-switch]');
        if (sw) {
          var target = S.dialogs.get(sw.getAttribute('data-sf-menu-switch'));
          if (!target || typeof target.open !== 'function' || !self.dialogEl) return;
          e.preventDefault();
          var opener = doc.querySelector('[data-sf-header] [data-sf-open="' + sw.getAttribute('data-sf-menu-switch') + '"]');
          var off = S.bus.on('drawer:close', function (d) {
            if (d.id !== self.dialogEl.id) return;
            off();
            target.open(opener || undefined);
          });
          self.dialogEl.close();
        }
      }, sig);
      this.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var open = self.querySelector('[data-sf-menu-sub][open]');
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          self.closeSub(open, true);
        }
      }, { capture: true, signal: this._ac.signal });
      this._offs = [
        S.bus.on('drawer:close', function (d) {
          if (!self.dialogEl || d.id !== self.dialogEl.id) return;
          self.querySelectorAll('[data-sf-menu-sub][open]').forEach(function (el) { el.open = false; });
        }),
        S.bus.on('drawer:open', function (d) {
          if (!self.dialogEl || d.id !== self.dialogEl.id) return;
          var btn = doc.querySelector('[data-sf-header] [data-sf-open="menu"]');
          if (btn) btn.setAttribute('aria-label', S.t('header.menu_close'));
        })
      ];
      this._offs.push(S.bus.on('drawer:close', function (d) {
        if (!self.dialogEl || d.id !== self.dialogEl.id) return;
        var btn = doc.querySelector('[data-sf-header] [data-sf-open="menu"]');
        if (btn) btn.setAttribute('aria-label', S.t('header.menu_open'));
      }));
      // Leaving the mobile layout with the menu open closes it.
      window.matchMedia(LG).addEventListener('change', function (e) {
        if (e.matches && self.dialogEl && self.dialogEl.isOpen) self.dialogEl.close();
      }, sig);
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      (this._offs || []).forEach(function (off) { off(); });
    }
    closeSub(details, refocus) {
      if (!details || !details.open) return;
      var summary = details.querySelector('summary');
      details.classList.add('is-leaving');
      setTimeout(function () {
        details.classList.remove('is-leaving');
        details.open = false;
        if (refocus && summary) summary.focus({ preventScroll: true });
      }, ms(240));
    }
  }
  if (!customElements.get('sf-menu-drawer')) customElements.define('sf-menu-drawer', SfMenuDrawer);

  /* ── <sf-cart-count> ─────────────────────────────────────── */
  class SfCartCount extends HTMLElement {
    connectedCallback() {
      var self = this;
      this._off = S.bus.on('cart:updated', function (d) {
        if (!d || !d.cart || typeof d.cart.item_count !== 'number') return;
        self.update(d.cart.item_count);
      });
    }
    disconnectedCallback() { if (this._off) this._off(); }
    update(count) {
      var next = String(count);
      if (this.getAttribute('data-count') === next) return;
      var self = this;
      this.classList.add('is-updating');
      setTimeout(function () {
        self.textContent = next;
        self.setAttribute('data-count', next);
        self.classList.remove('is-updating');
      }, ms(240));
    }
  }
  if (!customElements.get('sf-cart-count')) customElements.define('sf-cart-count', SfCartCount);

  /* ── <sf-localization>: submit on change ─────────────────── */
  class SfLocalization extends HTMLElement {
    connectedCallback() {
      this._ac = new AbortController();
      this.addEventListener('change', function (e) {
        var select = e.target.closest('[data-sf-localization-select]');
        if (!select || !select.form) return;
        var value = select.parentNode.querySelector('[data-sf-localization-value]');
        var opt = select.options[select.selectedIndex];
        if (value && opt) value.textContent = opt.textContent.trim();
        if (select.form.requestSubmit) select.form.requestSubmit();
        else select.form.submit();
      }, { signal: this._ac.signal });
    }
    disconnectedCallback() { if (this._ac) this._ac.abort(); }
  }
  if (!customElements.get('sf-localization')) customElements.define('sf-localization', SfLocalization);

  /* ── announcement: height token + optional rotation (pausable, WCAG 2.2.2) ── */
  function initAnnouncement(root) {
    if (!root || root.dataset.sfReady) return;
    root.dataset.sfReady = '1';
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        html.style.setProperty('--sf-announcement-h', root.offsetHeight + 'px');
      }).observe(root);
    }
    var seconds = parseFloat(root.getAttribute('data-rotate'));
    var items = root.querySelectorAll('[data-sf-announcement-item]');
    if (!seconds || items.length < 2) return;
    var index = 0, timer = null, userPaused = false, hover = false;
    var toggle = root.querySelector('[data-sf-announcement-toggle]');
    function show(i) {
      items[index].classList.remove('is-active');
      index = (i + items.length) % items.length;
      items[index].classList.add('is-active');
    }
    function run() {
      clearInterval(timer);
      timer = null;
      if (userPaused || hover || S.motion.reduced) return;
      timer = setInterval(function () { show(index + 1); }, seconds * 1000);
    }
    if (toggle) {
      if (S.motion.reduced) { userPaused = true; toggle.setAttribute('aria-pressed', 'true'); }
      toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
        run();
      });
    }
    root.addEventListener('pointerenter', function () { hover = true; run(); });
    root.addEventListener('pointerleave', function () { hover = false; run(); });
    root.addEventListener('focusin', function () { hover = true; run(); });
    root.addEventListener('focusout', function () { hover = false; run(); });
    S.bus.on('motion:change', run);
    run();
  }

  /* ── footer link groups: <details> accordions below 990 px, open columns above ── */
  function syncFooter() {
    var desktop = mq(LG);
    doc.querySelectorAll('[data-sf-footer-group]').forEach(function (d) {
      var summary = d.querySelector('summary');
      d.setAttribute('data-sf-synced', '');
      if (desktop) {
        d.open = true;
        if (summary) { summary.setAttribute('tabindex', '-1'); summary.setAttribute('aria-disabled', 'true'); }
      } else {
        if (!d.dataset.sfTouched) d.open = false;
        if (summary) { summary.removeAttribute('tabindex'); summary.removeAttribute('aria-disabled'); }
      }
    });
  }
  doc.addEventListener('click', function (e) {
    var summary = e.target.closest && e.target.closest('[data-sf-footer-group] > summary');
    if (!summary) return;
    if (mq(LG)) { e.preventDefault(); return; }
    summary.parentElement.dataset.sfTouched = '1';
  });

  function ready() {
    initAnnouncement(doc.querySelector('[data-sf-announcement]'));
    syncFooter();
  }
  window.matchMedia(LG).addEventListener('change', syncFooter);
  S.bus.on('section:load', function (d) {
    if (!d || !d.el) return;
    initAnnouncement(d.el.querySelector('[data-sf-announcement]'));
    syncFooter();
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
