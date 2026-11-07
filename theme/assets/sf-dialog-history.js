/*
 * STEADFAST · sf-dialog-history.js (CORE, lazy)
 * Loaded by sf-core.js on the first <sf-dialog> open on a coarse pointer (UX-05). Full-screen menus,
 * drawers and sheets read as pages on phones, so Back closes them: each open pushes a same-URL entry,
 * Back (popstate) closes the topmost dialog, and closing from the UI goes back over its entry.
 * The facets drawer is excluded by sf-core (sf-facets owns its own entries).
 */
(function () {
  'use strict';
  var S = window.Steadfast;
  if (!S || S.dialogHistory) return;
  var h = window.history;
  var stack = [];
  var backPending = null, backDone = null;

  function settleBack() {
    if (!backPending) return;
    var done = backDone;
    backPending = backDone = null;
    done();
  }

  S.dialogHistory = {
    push: function (d) {
      var go = function () {
        if (!d.isOpen || d._historyEntry) return;
        h.pushState({ sfDialog: d.id }, '');
        d._historyEntry = true;
        stack.push(d);
      };
      if (backPending) backPending.then(go); else go();
    },
    // The dialog closed from the UI (button, Esc, backdrop, switch): step back over its entry.
    release: function (d) {
      if (!d._historyEntry) return;
      d._historyEntry = false;
      var i = stack.indexOf(d);
      if (i > -1) stack.splice(i, 1);
      if (!h.state || h.state.sfDialog !== d.id || backPending) return;
      // The traversal can reset focus to <body>: keep it where the dialog returned it (WCAG 2.4.3).
      var keep = document.activeElement;
      backPending = new Promise(function (resolve) { backDone = resolve; });
      var fallback = setTimeout(settleBack, 800);
      backPending.then(function () {
        clearTimeout(fallback);
        if (keep && keep !== document.body && keep.isConnected && document.activeElement !== keep) keep.focus({ preventScroll: true });
      });
      h.back();
    }
  };

  // Called from sf-core's popstate listener, which is registered before any section's (sf-facets).
  S.dialogHistory.onPop = function (e) {
    // Dialog entries share the URL of the entry beneath: keep URL-driven listeners out of it.
    if (backPending) { e.stopImmediatePropagation(); settleBack(); return; }
    var top = stack[stack.length - 1];
    if (!top || (e.state && e.state.sfDialog === top.id)) return;
    e.stopImmediatePropagation();
    stack.pop();
    top._historyEntry = false;
    top.close();
  };

  /* A link followed from inside a dialog replaces the dialog's history entry, so Back from the next page
     returns straight to this page instead of to an invisible dialog state. */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    var dlg = a && a.closest('sf-dialog');
    if (!dlg || !dlg._historyEntry || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    window.location.replace(url.href);
  });

})();
