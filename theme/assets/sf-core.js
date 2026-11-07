/*
 * STEADFAST · sf-core.js (CORE)
 * window.Steadfast behaviour: event bus, motion switch, lazy GSAP loader, section registry,
 * fetch/swap helpers, a11y helpers, scroll lock, <sf-dialog>, the [data-sf-reveal] observer,
 * the visitor motion toggle and newsletter success focus. Contract: ARCHITECTURE §4.2–§4.5.
 * Classic defer script, no modules, no dependencies.
 */
(function () {
  'use strict';

  var S = (window.Steadfast = window.Steadfast || {});
  if (S.modules && S.modules.core) return;
  S.modules = S.modules || {};
  S.modules.core = true;
  S.routes = S.routes || {};
  S.settings = S.settings || {};
  S.strings = S.strings || {};
  S.assets = S.assets || {};
  S.breakpoints = S.breakpoints || { md: 750, lg: 990, xl: 1200 };

  var doc = document;
  var html = doc.documentElement;

  /* ── debug ─────────────────────────────────────────────── */
  S.debug = function () {
    try {
      if (window.localStorage.getItem('sf:debug') === '1') {
        window.console.debug.apply(window.console, ['[steadfast]'].concat([].slice.call(arguments)));
      }
    } catch (e) { /* storage blocked */ }
  };

  /* ── strings: Steadfast.t('cart.item_added', { title: 'Hoodie' }) ── */
  S.t = function (key, vars) {
    var value = S.strings[key];
    if (value && typeof value === 'object') {
      var count = vars && vars.count;
      value = count === 1 ? value.one : value.other;
    }
    if (typeof value !== 'string') return key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        value = value.split('[' + name + ']').join(String(vars[name]));
      });
    }
    return value;
  };

  /* ── event bus (all events on document) ───────────────── */
  var handlerMap = new Map();
  S.bus = {
    on: function (name, handler) {
      var wrapped = function (e) { handler(e.detail, e); };
      if (!handlerMap.has(handler)) handlerMap.set(handler, []);
      handlerMap.get(handler).push({ name: name, wrapped: wrapped });
      doc.addEventListener(name, wrapped);
      return function () { S.bus.off(name, handler); };
    },
    off: function (name, handler) {
      var list = handlerMap.get(handler);
      if (!list) return;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].name === name) {
          doc.removeEventListener(name, list[i].wrapped);
          list.splice(i, 1);
        }
      }
      if (!list.length) handlerMap.delete(handler);
    },
    emit: function (name, detail) {
      doc.dispatchEvent(new CustomEvent(name, { detail: detail || {}, bubbles: false }));
    }
  };

  /* ── utils ─────────────────────────────────────────────── */
  S.utils = {
    debounce: function (fn, ms) {
      var t;
      return function () {
        var ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, ms);
      };
    },
    throttle: function (fn, ms) {
      var last = 0, t;
      return function () {
        var ctx = this, args = arguments, now = Date.now(), wait = ms - (now - last);
        clearTimeout(t);
        if (wait <= 0) {
          last = now;
          fn.apply(ctx, args);
        } else {
          t = setTimeout(function () { last = Date.now(); fn.apply(ctx, args); }, wait);
        }
      };
    },
    fetchJSON: function (url, opts) {
      opts = opts || {};
      var headers = { Accept: 'application/json' };
      var body = opts.body;
      if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
        body = JSON.stringify(body);
      }
      if (body !== undefined && body !== null && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
      return fetch(url, {
        method: opts.method || (body ? 'POST' : 'GET'),
        headers: headers,
        body: body,
        signal: opts.signal,
        credentials: 'same-origin'
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            var err = {
              status: res.status,
              message: (data && data.message) || res.statusText || S.t('general.error'),
              description: (data && (data.description || data.errors)) || ''
            };
            throw err;
          }
          return data;
        });
      });
    },
    fetchSections: function (ids, url) {
      url = url || window.location.pathname + window.location.search;
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      return fetch(url + sep + 'sections=' + encodeURIComponent(ids.join(',')), {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin'
      }).then(function (res) {
        if (!res.ok) throw { status: res.status, message: res.statusText };
        return res.json();
      });
    },
    fetchSection: function (id, url) {
      url = url || window.location.pathname + window.location.search;
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      return fetch(url + sep + 'section_id=' + encodeURIComponent(id), { credentials: 'same-origin' }).then(function (res) {
        if (!res.ok) throw { status: res.status, message: res.statusText };
        return res.text();
      });
    },
    swapHTML: function (htmlString, selector, root) {
      root = root || doc;
      if (typeof htmlString !== 'string') return false;
      var parsed = new DOMParser().parseFromString(htmlString, 'text/html');
      var source = parsed.querySelector(selector);
      var target = root.querySelector(selector);
      if (!source || !target) return false;
      target.innerHTML = source.innerHTML;
      S.reveal.scan(target);
      return true;
    }
  };

  S.onIdle = function (cb, timeout) {
    timeout = timeout || 2000;
    if ('requestIdleCallback' in window) return window.requestIdleCallback(cb, { timeout: timeout });
    return setTimeout(cb, Math.min(timeout, 200));
  };

  S.inView = function (el, cb, opts) {
    opts = opts || {};
    var once = opts.once !== false;
    if (!('IntersectionObserver' in window)) {
      cb({ isIntersecting: true, target: el });
      return function () {};
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (once && !entry.isIntersecting) return;
        cb(entry);
        if (once) io.disconnect();
      });
    }, { rootMargin: opts.rootMargin || '0px', threshold: opts.threshold || 0 });
    io.observe(el);
    return function () { io.disconnect(); };
  };

  /* ── scripts and GSAP ──────────────────────────────────── */
  var scriptPromises = {};
  var dclFired = doc.readyState === 'complete';
  if (!dclFired) doc.addEventListener('DOMContentLoaded', function () { dclFired = true; }, { once: true });
  /* opts.ordered: inserted with async = false, so several scripts download in parallel but execute in
     insertion order (GSAP then ScrollTrigger, PERF-05). */
  S.loadScript = function (url, opts) {
    if (!url) return Promise.reject(new Error('No script URL'));
    if (scriptPromises[url]) return scriptPromises[url];
    scriptPromises[url] = new Promise(function (resolve, reject) {
      var existing = doc.querySelector('script[src="' + url + '"]');
      if (existing && existing.dataset.sfLoaded === '1') return resolve();
      var s = existing || doc.createElement('script');
      s.addEventListener('load', function () { s.dataset.sfLoaded = '1'; resolve(); }, { once: true });
      // A parser-inserted script already in the markup may have run before this call: its load event
      // will not fire again. Deferred/sync scripts have run by DOMContentLoaded, async ones by window load.
      if (existing) {
        var done = function () { existing.dataset.sfLoaded = '1'; resolve(); };
        if (doc.readyState === 'complete') done();
        else if (!existing.async && dclFired) done();
        else {
          if (!existing.async) doc.addEventListener('DOMContentLoaded', done, { once: true });
          window.addEventListener('load', done, { once: true });
        }
      }
      s.addEventListener('error', function () { delete scriptPromises[url]; reject(new Error('Failed to load ' + url)); }, { once: true });
      if (!existing) {
        s.src = url;
        s.async = !(opts && opts.ordered);
        doc.head.appendChild(s);
      }
    });
    return scriptPromises[url];
  };

  /* In-page anchors: GSAP arrives lazily and ScrollTrigger.refresh() (and pin spacers) cancel a smooth anchor
     scroll in progress. After a refresh, re-target a hash navigated to in the last 4 s unless the visitor
     has scrolled by hand since. */
  var hashNavAt = location.hash ? 0 : -1e9;
  var markHash = function () { hashNavAt = performance.now(); };
  window.addEventListener('hashchange', markHash);
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) markHash();
  }, true);
  ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, function () { hashNavAt = -1e9; }, { passive: true }); });
  S.anchor = {
    recent: function () { return performance.now() - hashNavAt < 4000 && location.hash.length > 1; },
    retarget: function () {
      if (!S.anchor.recent()) return;
      var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView({ block: 'start' });
    }
  };

  var gsapPromise = null;
  S.loadGsap = function () {
    if (gsapPromise) return gsapPromise;
    gsapPromise = Promise.all([
      S.loadScript(S.assets.gsap, { ordered: true }),
      S.loadScript(S.assets.scrollTrigger, { ordered: true })
    ])
      .then(function () {
        var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);
        gsap.config({ nullTargetWarn: false });
        ScrollTrigger.config({ ignoreMobileResize: true });
        ScrollTrigger.addEventListener('refresh', function () { requestAnimationFrame(S.anchor.retarget); });
        var fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
        var loaded = doc.readyState === 'complete' ? Promise.resolve() : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });
        Promise.all([fontsReady, loaded]).then(function () { ScrollTrigger.refresh(); });
        return { gsap: gsap, ScrollTrigger: ScrollTrigger };
      });
    gsapPromise.catch(function () { gsapPromise = null; });
    return gsapPromise;
  };

  /* ── motion ─────────────────────────────────────────────── */
  var osReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function storedMotion() {
    try { return window.localStorage.getItem('sf:motion'); } catch (e) { return null; }
  }
  function computeLevel() {
    if (osReduce.matches) return 'reduced';
    if (storedMotion() === 'reduced') return 'reduced';
    var lvl = S.settings.motionLevel;
    return lvl === 'subtle' || lvl === 'reduced' ? lvl : 'full';
  }
  function applyLevel() {
    var prev = html.getAttribute('data-sf-motion');
    var next = computeLevel();
    html.setAttribute('data-sf-motion', next);
    syncMotionToggles();
    if (prev !== next) S.bus.emit('motion:change', { level: next });
    return next;
  }
  S.motion = {
    get level() { return html.getAttribute('data-sf-motion') || computeLevel(); },
    get reduced() { return this.level === 'reduced'; },
    get osReduced() { return !!osReduce.matches; },
    set: function (level) {
      try {
        if (level === 'reduced') window.localStorage.setItem('sf:motion', 'reduced');
        else window.localStorage.removeItem('sf:motion');
      } catch (e) { /* storage blocked: the attribute still changes for this page */ }
      if (level === 'reduced') {
        var prev = html.getAttribute('data-sf-motion');
        html.setAttribute('data-sf-motion', 'reduced');
        syncMotionToggles();
        if (prev !== 'reduced') S.bus.emit('motion:change', { level: 'reduced' });
        return;
      }
      applyLevel();
    },
    gsapMatchMedia: function (scopeEl, setup) {
      var mm = null, dead = false, offChange = null;
      function build(api) {
        if (dead) return;
        if (mm) mm.revert();
        mm = api.gsap.matchMedia(scopeEl);
        mm.add({ desktop: '(min-width: 990px)', mobile: '(max-width: 989px)', osReduce: '(prefers-reduced-motion: reduce)' }, function (context) {
          return setup(context.conditions, S.motion.level, api.gsap, api.ScrollTrigger, context);
        });
      }
      S.loadGsap().then(function (api) {
        if (dead) return;
        build(api);
        offChange = S.bus.on('motion:change', function () { build(api); });
      }).catch(function (err) { S.debug('GSAP failed to load', err); });
      return {
        revert: function () {
          dead = true;
          if (offChange) offChange();
          if (mm) mm.revert();
          mm = null;
        }
      };
    }
  };
  if (osReduce.addEventListener) osReduce.addEventListener('change', applyLevel);

  /* ── a11y ───────────────────────────────────────────────── */
  var FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  function visibleFocusables(container) {
    return [].slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (el) {
      return el.offsetWidth || el.offsetHeight || el.getClientRects().length;
    });
  }
  S.a11y = {
    announce: function (msg, politeness) {
      var region = doc.getElementById(politeness === 'assertive' ? 'sf-live-assertive' : 'sf-live-polite');
      if (!region) return;
      region.textContent = '';
      setTimeout(function () { region.textContent = msg; }, 50);
    },
    trapFocus: function (container, opts) {
      opts = opts || {};
      function onKey(e) {
        if (e.key !== 'Tab') return;
        var items = visibleFocusables(container);
        if (!items.length) { e.preventDefault(); return; }
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (doc.activeElement === first || !container.contains(doc.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && doc.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
      container.addEventListener('keydown', onKey);
      var initial = opts.initialFocus || visibleFocusables(container)[0];
      if (initial && initial.focus) initial.focus({ preventScroll: true });
      return function release() { container.removeEventListener('keydown', onKey); };
    },
    focusables: visibleFocusables
  };

  /* ── scroll lock (reference counted, no layout shift) ───── */
  var lockCount = 0;
  var supportsGutter = window.CSS && CSS.supports && CSS.supports('scrollbar-gutter', 'stable');
  S.scrollLock = {
    lock: function () {
      lockCount += 1;
      if (lockCount > 1) return;
      if (!supportsGutter) {
        var sbw = window.innerWidth - html.clientWidth;
        if (sbw > 0) html.style.paddingInlineEnd = sbw + 'px';
      }
      html.classList.add('sf-scroll-locked');
    },
    unlock: function () {
      if (lockCount === 0) return;
      lockCount -= 1;
      if (lockCount > 0) return;
      html.classList.remove('sf-scroll-locked');
      html.style.paddingInlineEnd = '';
    },
    get locked() { return lockCount > 0; }
  };

  /* ── reveal observer ([data-sf-reveal]: fade | exposure | mask) ── */
  var revealIO = null;
  function revealAll(root) {
    (root || doc).querySelectorAll('[data-sf-reveal]:not(.is-revealed)').forEach(function (el) { el.classList.add('is-revealed'); });
  }
  S.reveal = {
    scan: function (root) {
      root = root || doc;
      if (S.motion.reduced || !('IntersectionObserver' in window)) { revealAll(root); return; }
      if (!revealIO) {
        revealIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            revealIO.unobserve(entry.target);
          });
        }, { threshold: 0.15 });
      }
      var list = root.querySelectorAll ? root.querySelectorAll('[data-sf-reveal]:not(.is-revealed)') : [];
      list.forEach(function (el) { revealIO.observe(el); });
      if (root.matches && root.matches('[data-sf-reveal]:not(.is-revealed)')) revealIO.observe(root);
    }
  };
  S.bus.on('motion:change', function (d) { if (d.level === 'reduced') revealAll(doc); });
  ['section:load', 'quickview:loaded', 'facets:updated'].forEach(function (name) {
    S.bus.on(name, function (d) { S.reveal.scan((d && d.el) || doc); });
  });

  /* ── section registry ───────────────────────────────────── */
  var registry = {};
  var instances = new WeakMap();
  function initEl(type, el, force) {
    var def = registry[type];
    if (!def || instances.has(el)) return;
    var state = { done: false, stop: null };
    instances.set(el, state);
    function run() {
      if (state.done) return;
      state.done = true;
      if (state.stop) state.stop();
      try { def.init(el); } catch (err) { S.debug('init failed', type, err); }
    }
    if (def.lazy && !force) {
      state.stop = S.inView(el, run, { rootMargin: def.rootMargin || '50% 0px' });
    } else {
      run();
    }
  }
  function destroyEl(type, el) {
    var def = registry[type];
    var state = instances.get(el);
    if (!def || !state) return;
    if (state.stop) state.stop();
    if (state.done && def.destroy) {
      try { def.destroy(el); } catch (err) { S.debug('destroy failed', type, err); }
    }
    instances.delete(el);
  }
  function eachSection(root, cb) {
    var nodes = [];
    if (root.matches && root.matches('[data-sf-section]')) nodes.push(root);
    if (root.querySelectorAll) nodes = nodes.concat([].slice.call(root.querySelectorAll('[data-sf-section]')));
    nodes.forEach(function (el) { cb(el.getAttribute('data-sf-section'), el); });
  }
  /* Lazy section modules (PERF-06): a section root may carry data-sf-module="{{ 'sf-x.js' | asset_url }}"
     instead of a <script defer>. The script is fetched when the section nears the viewport (100%
     rootMargin), or at once in the theme editor / on force; its S.sections.register() call then inits. */
  var moduleSeen = new WeakSet();
  function loadModule(el, now) {
    var url = el.getAttribute('data-sf-module');
    if (!url || moduleSeen.has(el)) return;
    moduleSeen.add(el);
    var load = function () { S.loadScript(url).catch(function (err) { moduleSeen.delete(el); S.debug('module failed', url, err); }); };
    if (now || (window.Shopify && window.Shopify.designMode)) load();
    else S.inView(el, load, { rootMargin: '100% 0px' });
  }
  S.sections = {
    register: function (type, def) {
      registry[type] = def;
      doc.querySelectorAll('[data-sf-section="' + type + '"]').forEach(function (el) { initEl(type, el, false); });
    },
    init: function (root, force) {
      eachSection(root || doc, function (type, el) {
        if (registry[type]) initEl(type, el, force);
        else loadModule(el, force);
      });
    },
    destroy: function (root) { eachSection(root || doc, function (type, el) { destroyEl(type, el); }); }
  };
  doc.addEventListener('shopify:section:load', function (e) {
    eachSection(e.target, function (type, el) { if (!registry[type]) loadModule(el, true); });
    S.sections.init(e.target, false);
    var first = e.target.querySelector && e.target.querySelector('[data-sf-section]');
    S.bus.emit('section:load', { sectionId: e.detail && e.detail.sectionId, type: first ? first.getAttribute('data-sf-section') : null, el: e.target });
  });
  doc.addEventListener('shopify:section:unload', function (e) {
    S.sections.destroy(e.target);
    var first = e.target.querySelector && e.target.querySelector('[data-sf-section]');
    S.bus.emit('section:unload', { sectionId: e.detail && e.detail.sectionId, type: first ? first.getAttribute('data-sf-section') : null, el: e.target });
  });
  doc.addEventListener('shopify:section:select', function (e) {
    S.sections.init(e.target, true);
    if (e.target.scrollIntoView) e.target.scrollIntoView({ block: 'start', behavior: S.motion.reduced ? 'auto' : 'smooth' });
  });
  doc.addEventListener('shopify:block:select', function (e) {
    var sectionEl = doc.getElementById('shopify-section-' + (e.detail && e.detail.sectionId));
    if (sectionEl) S.sections.init(sectionEl, true);
  });

  /* ── <sf-dialog> ────────────────────────────────────────── */
  var EVENT_ALIASES = { 'sf-search-overlay': 'search', 'sf-menu-drawer': 'menu' };
  /* data-sf-open keys whose dialog id is not simply 'sf-' + key (ARCHITECTURE §4.2 mapping). */
  var OPEN_ALIASES = { menu: 'sf-menu-drawer', search: 'sf-search-overlay', cart: 'sf-cart-drawer' };
  function dialogFor(key) {
    return doc.getElementById(OPEN_ALIASES[key] || 'sf-' + key) || doc.getElementById('sf-' + key);
  }
  function keysFor(id) {
    var keys = [id.replace(/^sf-/, '')];
    Object.keys(OPEN_ALIASES).forEach(function (k) { if (OPEN_ALIASES[k] === id) keys.push(k); });
    return keys;
  }
  S.dialogs = { get: dialogFor };

  /* Stylesheets of closed dialogs load on intent (hover/focus/touch of an opener) or on open, never at page
     load: the cart drawer, search overlay and quick view declare theirs in data-sf-css. */
  var stylePromises = {};
  S.loadStyle = function (url) {
    if (stylePromises[url]) return stylePromises[url];
    stylePromises[url] = new Promise(function (resolve) {
      var link = doc.querySelector('link[rel="stylesheet"][href="' + url + '"]');
      if (link && link.sheet) return resolve();
      if (!link) {
        link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        doc.head.appendChild(link);
      }
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
    return stylePromises[url];
  };
  function prepareDialog(d) { return d && typeof d.prepare === 'function' ? d.prepare() : null; }
  function onIntent(e) {
    var t = e.target.closest && e.target.closest('[data-sf-open], [data-sf-quick-view], [data-sf-quick-add], [data-sf-add-button]');
    if (!t) return;
    var key = t.getAttribute('data-sf-open');
    if (key) prepareDialog(dialogFor(key));
    else if (t.hasAttribute('data-sf-add-button')) prepareDialog(doc.getElementById('sf-cart-drawer'));
    else { prepareDialog(doc.getElementById('sf-quick-view')); prepareDialog(doc.getElementById('sf-cart-drawer')); }
  }
  ['pointerover', 'focusin', 'touchstart'].forEach(function (type) { doc.addEventListener(type, onIntent, { passive: true }); });

  function durationOf(el) {
    var cs = window.getComputedStyle(el);
    var max = 0;
    cs.transitionDuration.split(',').forEach(function (d, i) {
      var delay = (cs.transitionDelay.split(',')[i] || '0s').trim();
      var total = parseFloat(d) * (d.indexOf('ms') > -1 ? 1 : 1000) + parseFloat(delay) * (delay.indexOf('ms') > -1 ? 1 : 1000);
      if (total > max) max = total;
    });
    return max;
  }

  /* Back closes the topmost dialog on touch devices (UX-05). The history logic is a lazy module
     (sf-dialog-history.js), fetched on the first dialog open on a coarse pointer. */
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  function historyPush(d) {
    if (!coarse.matches || !d.id || d.closest('sf-facets') || !window.history.pushState) return;
    if (S.dialogHistory) { S.dialogHistory.push(d); return; }
    if (!S.assets.dialogHistory) return;
    S.loadScript(S.assets.dialogHistory).then(function () {
      if (S.dialogHistory && d.isOpen) S.dialogHistory.push(d);
    }).catch(function (err) { S.debug('dialog history failed', err); });
  }
  function historyRelease(d) { if (d._historyEntry && S.dialogHistory) S.dialogHistory.release(d); }
  // Registered here, before any section script, so a dialog's popstate can stop URL-driven listeners.
  window.addEventListener('popstate', function (e) { if (S.dialogHistory) S.dialogHistory.onPop(e); });
  // A fresh load onto a stale dialog entry (no bfcache): neutralise it.
  try {
    if (window.history.state && window.history.state.sfDialog) window.history.replaceState(null, '');
  } catch (e) { /* history unavailable */ }

  class SfDialog extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector(':scope > dialog');
      if (!this.dialog) return;
      this._ac = new AbortController();
      var signal = this._ac.signal;
      var self = this;
      var downOnBackdrop = false;
      this.dialog.addEventListener('cancel', function (e) {
        e.preventDefault();
        self.close();
      }, { signal: signal });
      this.dialog.addEventListener('pointerdown', function (e) {
        downOnBackdrop = e.target === self.dialog && self._outside(e);
      }, { signal: signal });
      this.dialog.addEventListener('click', function (e) {
        if (e.target === self.dialog && downOnBackdrop && self._outside(e)) self.close();
        downOnBackdrop = false;
      }, { signal: signal });
      this.dialog.addEventListener('close', function () {
        if (self._closing) return;
        self._finishClose();
      }, { signal: signal });
    }
    disconnectedCallback() {
      if (this._ac) this._ac.abort();
      if (this.isOpen) {
        S.scrollLock.unlock();
      }
    }
    get isOpen() { return !!(this.dialog && this.dialog.open); }
    get key() { return (this.id || '').replace(/^sf-/, ''); }
    _outside(e) {
      var r = this.dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }
    _setExpanded(value) {
      if (!this.id) return;
      keysFor(this.id).forEach(function (key) {
        doc.querySelectorAll('[data-sf-open="' + key + '"][aria-expanded]').forEach(function (t) {
          t.setAttribute('aria-expanded', value ? 'true' : 'false');
        });
      });
    }
    prepare() {
      var urls = (this.getAttribute('data-sf-css') || '').split(/\s+/).filter(Boolean);
      if (!urls.length) return null;
      var self = this;
      if (!this._css) this._css = Promise.all(urls.map(S.loadStyle)).then(function () { self._cssReady = true; });
      return this._cssReady ? null : this._css;
    }
    open(trigger) {
      if (!this.dialog || this.isOpen || this._pending) return;
      var css = this.prepare();
      if (css) {
        var self = this;
        this._pending = trigger || doc.activeElement || true;
        css.then(function () {
          var t = self._pending;
          self._pending = null;
          if (t) self.open(t === true ? undefined : t);
        });
        return;
      }
      clearTimeout(this._closeTimer);
      this._closing = false;
      this.classList.remove('is-closing');
      this._trigger = trigger || doc.activeElement;
      this.dialog.showModal();
      S.scrollLock.lock();
      this.classList.add('is-opening');
      var self = this;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          self.classList.add('is-open');
          var dur = durationOf(self.dialog);
          clearTimeout(self._openTimer);
          self._openTimer = setTimeout(function () { self.classList.remove('is-opening'); }, dur + 20);
        });
      });
      var initial = this.dialog.querySelector('[data-sf-initial-focus]') || this.dialog.querySelector('[autofocus]');
      if (initial) initial.focus({ preventScroll: true });
      this._setExpanded(true);
      historyPush(this);
      S.bus.emit('drawer:open', { id: this.id });
      if (EVENT_ALIASES[this.id]) S.bus.emit(EVENT_ALIASES[this.id] + ':open', {});
    }
    close() {
      this._pending = null;
      if (!this.dialog || !this.isOpen || this._closing) return;
      this._closing = true;
      clearTimeout(this._openTimer);
      this.classList.remove('is-opening');
      this.classList.remove('is-open');
      this.classList.add('is-closing');
      var self = this;
      var dur = durationOf(this.dialog);
      this._closeTimer = setTimeout(function () {
        self.dialog.close();
        self._finishClose();
      }, dur + 10);
    }
    _finishClose() {
      this._closing = false;
      this.classList.remove('is-closing', 'is-open', 'is-opening');
      S.scrollLock.unlock();
      this._setExpanded(false);
      var trigger = this._trigger;
      this._trigger = null;
      if (trigger && trigger.isConnected && typeof trigger.focus === 'function') {
        trigger.focus({ preventScroll: true });
      }
      historyRelease(this);
      S.bus.emit('drawer:close', { id: this.id });
      if (EVENT_ALIASES[this.id]) S.bus.emit(EVENT_ALIASES[this.id] + ':close', {});
    }
  }
  if (!customElements.get('sf-dialog')) customElements.define('sf-dialog', SfDialog);

  /* Global openers and closers */
  doc.addEventListener('click', function (e) {
    var opener = e.target.closest && e.target.closest('[data-sf-open]');
    if (opener) {
      var key = opener.getAttribute('data-sf-open');
      if (key === 'cart' && S.settings.cartType === 'page') return;
      var target = dialogFor(key);
      if (target && typeof target.open === 'function') {
        e.preventDefault();
        if (target.isOpen) target.close();
        else target.open(opener);
      }
      return;
    }
    var closer = e.target.closest && e.target.closest('[data-sf-close]');
    if (closer) {
      var dlg = closer.closest('sf-dialog');
      if (dlg && typeof dlg.close === 'function') {
        e.preventDefault();
        dlg.close();
      }
    }
  });

  /* ── visitor motion toggle ([data-sf-motion-toggle]) ───── */
  function syncMotionToggles() {
    var reduced = html.getAttribute('data-sf-motion') === 'reduced';
    doc.querySelectorAll('[data-sf-motion-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', reduced ? 'true' : 'false');
      if (osReduce.matches) btn.setAttribute('data-os-reduced', '');
      else btn.removeAttribute('data-os-reduced');
    });
  }
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-sf-motion-toggle]');
    if (!btn) return;
    e.preventDefault();
    if (osReduce.matches) {
      S.a11y.announce(S.t('motion.reduced_on'));
      return;
    }
    var nowReduced = S.motion.level !== 'reduced';
    S.motion.set(nowReduced ? 'reduced' : null);
    if (nowReduced) S.a11y.announce(S.t('motion.reduced_on'));
  });

  /* ── svh fallback ──────────────────────────────────────── */
  if (!(window.CSS && CSS.supports && CSS.supports('height', '1svh'))) {
    var setVh = function () { html.style.setProperty('--sf-vh', window.innerHeight * 0.01 + 'px'); };
    setVh();
    window.addEventListener('resize', S.utils.debounce(setVh, 150), { passive: true });
  }

  /* ── ready ─────────────────────────────────────────────── */
  function ready() {
    syncMotionToggles();
    S.reveal.scan(doc);
    S.sections.init(doc, false);
    // Newsletter: after a post Shopify reloads the page at #form-id. Focus the success message, or on a
    // failed submit the invalid field (its aria-describedby reads the error; ARCHITECTURE §7.8).
    var target = doc.querySelector('.sf-newsletter-form__success[tabindex="-1"]') ||
      doc.querySelector('.sf-newsletter-form [aria-invalid="true"]');
    if (target) {
      var focusTarget = function () {
        if (doc.activeElement === target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
      };
      focusTarget();
      // The redirect's #form fragment is applied after load and moves focus to the document; re-apply.
      var refocus = function () { requestAnimationFrame(function () { setTimeout(focusTarget, 0); }); };
      if (doc.readyState === 'complete') refocus();
      else window.addEventListener('load', refocus, { once: true });
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
