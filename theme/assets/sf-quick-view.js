/*
 * STEADFAST · sf-quick-view.js (COMMERCE)
 * Steadfast.quickView: opens #sf-quick-view, loads the product through the Section Rendering API
 * (?section_id=sf-quick-view), wires the shared PDP components (sf-product.js) and closes itself
 * when its add succeeds, before the cart drawer opens. Contract: ARCHITECTURE §4.4, §4.7.
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || !S.bus || S.modules['quick-view']) return;
  S.modules['quick-view'] = true;

  var doc = document;
  var controller = null;
  var current = null;

  function shell() { return doc.getElementById('sf-quick-view'); }
  function body() { var d = shell(); return d && d.querySelector('[data-sf-quick-view-body]'); }

  function loadingMarkup() {
    return '<div class="sf-qv sf-qv--loading" aria-busy="true">' +
      '<div class="sf-qv__media"><div class="sf-qv__skeleton sf-qv__skeleton--media"></div></div>' +
      '<div class="sf-qv__info"><p class="sf-visually-hidden" id="sf-quick-view-title" tabindex="-1">' + S.t('quick_view.loading') + '</p>' +
      '<div class="sf-qv__skeleton sf-qv__skeleton--line"></div><div class="sf-qv__skeleton sf-qv__skeleton--short"></div></div></div>';
  }
  function errorMarkup(url) {
    var wrap = doc.createElement('div');
    wrap.className = 'sf-qv sf-qv--error';
    var p = doc.createElement('p');
    p.id = 'sf-quick-view-title';
    p.tabIndex = -1;
    p.className = 'sf-text-xl';
    p.textContent = S.t('quick_view.error');
    var a = doc.createElement('a');
    a.className = 'sf-btn sf-btn--secondary';
    a.href = url;
    a.innerHTML = '<span class="sf-btn__label"></span>';
    a.firstChild.textContent = S.t('quick_view.full_details');
    wrap.appendChild(p);
    wrap.appendChild(a);
    return wrap;
  }

  function focusTarget(intent, root) {
    if (intent === 'add') {
      var group = root.querySelector('[data-sf-option]');
      if (group) {
        var input = group.querySelector('input:checked') || group.querySelector('input, select');
        if (input) return input;
      }
      var btn = root.querySelector('[data-sf-add-button]:not([disabled])');
      if (btn) return btn;
    }
    return root.querySelector('#sf-quick-view-title');
  }

  function open(detail) {
    detail = detail || {};
    var dialog = shell();
    var region = body();
    if (!dialog || !region || !detail.url) { if (detail.url) window.location.href = detail.url; return; }
    if (controller) controller.abort();
    controller = new AbortController();
    var signal = controller.signal;
    current = detail;
    region.innerHTML = loadingMarkup();
    if (!dialog.isOpen) dialog.open(detail.trigger);
    var url = detail.url.split('#')[0];
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    Promise.all([
      fetch(url + sep + 'section_id=sf-quick-view', { credentials: 'same-origin', signal: signal }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }),
      S.modules.product ? Promise.resolve() : S.loadScript(S.assets.product)
    ]).then(function (res) {
      if (signal.aborted) return;
      var parsed = new DOMParser().parseFromString(res[0], 'text/html');
      var qv = parsed.querySelector('.sf-qv');
      if (!qv) throw new Error('empty');
      var links = parsed.querySelectorAll('link[rel="stylesheet"]');
      region.innerHTML = '';
      links.forEach(function (l) { region.appendChild(doc.importNode(l, true)); });
      region.appendChild(doc.importNode(qv, true));
      var target = focusTarget(detail.intent, region);
      if (target) target.focus({ preventScroll: true });
      S.bus.emit('quickview:loaded', { url: detail.url, el: region });
    }).catch(function (err) {
      if (signal.aborted || (err && err.name === 'AbortError')) return;
      region.innerHTML = '';
      region.appendChild(errorMarkup(detail.url));
      var t = region.querySelector('#sf-quick-view-title');
      if (t) t.focus({ preventScroll: true });
    });
  }

  function close() {
    var dialog = shell();
    if (dialog && dialog.isOpen) dialog.close();
  }

  S.quickView = { open: open, close: close };
  S.bus.on('quickview:open', function (d) { open(d); });
  S.bus.on('cart:item-added', function (d) { if (d && d.source === 'quick-view') close(); });
  S.bus.on('drawer:close', function (d) {
    if (!d || d.id !== 'sf-quick-view') return;
    if (controller) controller.abort();
    controller = null;
    current = null;
    var region = body();
    // Pause any media left playing in the closed dialog.
    if (region) region.querySelectorAll('video').forEach(function (v) { v.pause(); });
    S.bus.emit('quickview:close', {});
  });
})();
