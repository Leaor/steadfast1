/* STEADFAST · Section A · <sf-hero-film> (HOME). ARCHITECTURE §5, DESIGN §8.3 A.
   Video + CSS + WAAPI, no GSAP. Scroll, keys, focus end the intro. Control label = action, no aria-pressed. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['hero-film']) return;
  S.modules['hero-film'] = true;
  const html = document.documentElement;
  const SEEN = 'sf:intro-seen';
  const CAP = 14;
  const WATCH = 4000;
  const emit = (name, detail) => {
    if (S.bus && S.bus.emit) S.bus.emit(name, detail);
    else document.dispatchEvent(new CustomEvent(name, { detail }));
  };
  const design = () => Boolean((window.Shopify || {}).designMode || (S.settings || {}).designMode);
  const play = (v, onErr) => { const p = v.play(); if (p && p.catch) p.catch(onErr || (() => {})); };
  const focus = (el) => el && el.focus({ preventScroll: true });
  const noData = () => 'sfSaveData' in html.dataset;
  class SfHeroFilm extends HTMLElement {
    connectedCallback() {
      if (this._ac) return;
      this._ac = new AbortController();
      const $ = (s) => this.querySelector(s);
      this.$intro = $('.sf-hero__intro');
      this.$loop = $('.sf-hero__loop');
      this.$ctl = $('[data-sf-hero-control]');
      this.$label = $('[data-sf-hero-label]');
      this.$content = $('.sf-hero__content');
      this.$mark = $('[data-sf-hero-mark]');
      this.$primary = $('[data-sf-hero-primary]');
      this.$secondary = $('[data-sf-hero-secondary]');
      this.mq = matchMedia(this.dataset.mqMobile || '(max-width: 749px)');
      this.timers = new Set();
      this.mode = 'idle';
      this.visible = true;
      this.baseState = 'static';
      for (const v of [this.$intro, this.$loop]) if (v) { v.muted = true; v.defaultMuted = true; v.playsInline = true; }
      this.bind(this._ac.signal);
      this.start();
    }
    disconnectedCallback() {
      if (!this._ac) return;
      this._ac.abort();
      this._ac = null;
      this.disarm();
      this.clear();
      this._w = (this._w || 0) + 1;
      if (this._io) this._io.disconnect();
      if (this._sweep) this._sweep.cancel();
      for (const v of [this.$intro, this.$loop]) if (v) v.pause();
      this.mode = 'idle';
    }
    later(fn, ms) {
      const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
      this.timers.add(id);
      return id;
    }
    clear() { this.timers.forEach(clearTimeout); this.timers.clear(); }
    setState(s) { this.dataset.state = s; html.dataset.sfHero = s; }
    variant() { return this.mq.matches ? 'mobile' : 'desktop'; }
    pick(kind, variant = this.variant()) { return this.dataset[kind + (variant === 'mobile' ? 'Mobile' : 'Desktop')] || ''; }
    seen() {
      if (design()) return false;
      if ('sfIntroSeen' in html.dataset) return true;
      try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; }
    }
    markSeen() { if (!design()) try { sessionStorage.setItem(SEEN, '1'); } catch (e) {} }
    setControl(mode) {
      const c = this.$ctl;
      if (!c) return;
      // show_skip hides SKIP only; PAUSE stays (2.2.2)
      if (!mode || (mode === 'skip' && this.dataset.showSkip === 'false')) { c.hidden = true; return; }
      c.hidden = false;
      c.dataset.mode = mode;
      if (this.$label) this.$label.textContent = this.dataset['label' + mode[0].toUpperCase() + mode.slice(1)] || '';
    }
    start() {
      const d = html.dataset;
      if (d.sfMotion === 'reduced') return this.toStatic('reduced', false, 'play');
      if (noData()) return this.toStatic('save-data', false, false);
      if (this.dataset.introEnabled === 'false') return this.toStatic('disabled');
      if (this.dataset.frequency !== 'every_visit' && this.seen()) return this.toStatic('seen');
      const src = this.pick('intro');
      if (!src) return this.toStatic('no-film');
      this.playIntro(src);
    }
    toStatic(reason, loop = true, control = 'pause') {
      this.mode = 'done';
      this.baseState = 'static';
      this.classList.add('is-instant', 'is-beat-9');
      this.classList.remove('is-beat-8');
      html.dataset.sfIntro = 'skip';
      this.setState('static');
      this.setControl(control);
      requestAnimationFrame(() => requestAnimationFrame(() => this.classList.remove('is-instant')));
      if (loop) this.startLoop();
      emit('hero:intro-end', { reason });
    }
    playIntro(src) {
      this.mode = 'intro';
      this.beat8 = this.ending = false;
      this.introVariant = this.variant();
      this.classList.remove('is-beat-8', 'is-beat-9', 'is-cut', 'is-instant', 'is-ui');
      html.dataset.sfIntro = 'play';
      this.setState('loading');
      this.setControl('skip');
      this.arm();
      this.load(src);
      this.later(() => { if (this.inIntro && this.dataset.state !== 'playing') this.cut('error'); }, WATCH);
    }
    load(src) {
      const v = this.$intro;
      const token = (this._token = (this._token || 0) + 1);
      v.preload = 'auto';
      if (v.getAttribute('src') !== src) v.src = src;
      try { v.currentTime = 0; } catch (e) {}
      play(v, (err) => {
        if (token === this._token && this.inIntro && !(err && err.name === 'AbortError')) this.cut('error');
      });
    }
    onPlaying() {
      if (this.mode !== 'intro') return;
      clearTimeout(this._stall);
      if (this.dataset.state !== 'loading') return;
      this.setState('playing');
      emit('hero:intro-start', { source: this.dataset.source || 'bundled', variant: this.introVariant });
      this.watch();
    }
    onMeta() {
      const now = this.variant();
      if (this.mode !== 'intro' || now === this.introVariant) return;
      const other = this.pick('intro', now);
      if (other) { this.introVariant = now; this.load(other); }
    }
    onStall() {
      if (this.mode !== 'intro' || this.dataset.state !== 'playing') return;
      clearTimeout(this._stall);
      this._stall = this.later(() => { if (this.inIntro && this.$intro.readyState < 3) this.cut('error'); }, WATCH);
    }
    duration() {
      const d = this.$intro.duration;
      return Number.isFinite(d) && d > 0 ? Math.min(d, CAP) : CAP;
    }
    watch() {
      const v = this.$intro;
      const w = (this._w = (this._w || 0) + 1);
      const next = v.requestVideoFrameCallback ? (f) => v.requestVideoFrameCallback(f) : (f) => requestAnimationFrame(f);
      const tick = () => {
        if (w !== this._w || this.mode !== 'intro') return;
        const t = v.currentTime;
        if (t >= 2.2) this.classList.add('is-ui'); // CTAs from the first cut
        if (!this.beat8 && t >= this.duration() - 0.4) this.onBeat8();
        if (t >= CAP || v.ended) return this.onEnd();
        if (!v.paused) next(tick);
      };
      next(tick);
    }
    onBeat8() {
      this.beat8 = true;
      this.prepareLoop();
      if (this.dataset.logoReveal === 'false' || !this.$mark) return;
      this.classList.add('is-beat-8');
      const m = this.$mark;
      if (!(window.CSS && CSS.registerProperty && m.animate)) return;
      try {
        m.classList.add('is-sweeping');
        this._sweep = m.animate([{ '--sweep': '-30%' }, { '--sweep': '130%' }], {
          duration: 1200, easing: 'cubic-bezier(0.445, 0.05, 0.55, 0.95)'
        });
        this._sweep.onfinish = this._sweep.oncancel = () => { m.classList.remove('is-sweeping'); this._sweep = null; };
      } catch (e) { m.classList.remove('is-sweeping'); }
    }
    onEnd() {
      if (this.mode !== 'intro' || this.ending) return;
      this.ending = true;
      if (!this.beat8) this.onBeat8();
      if (this.$intro.currentTime >= CAP) this.$intro.pause();
      this.later(() => this.finish('ended'), 600);
    }
    finish(reason, cut) {
      if (this.mode !== 'intro') return;
      this.mode = 'done';
      this.baseState = 'ended';
      this.disarm();
      this._w++;
      if (cut) {
        this.clear();
        if (this._sweep) this._sweep.cancel();
        this.classList.add('is-cut');
        this.$intro.pause();
      }
      this.classList.add('is-beat-9');
      this.setState('ended');
      this.setControl(this.userPaused ? 'play' : 'pause');
      this.markSeen();
      this.startLoop();
      this.later(() => {
        if (this.inIntro) return;
        this.$intro.pause();
        this.$intro.removeAttribute('src');
        this.$intro.load();
      }, cut ? 600 : 1600);
      emit('hero:intro-end', { reason });
      if (reason === 'skipped') focus(this.$primary);
    }
    get inIntro() { return this.mode === 'intro'; }
    cut(reason) { this.finish(reason, true); }
    arm() {
      this.disarm();
      const o = { signal: (this._early = new AbortController()).signal, passive: true };
      const scrolled = (e) => { if (e.type !== 'scroll' || performance.now() > (this._quiet | 0)) this.cut('scrolled'); };
      ['wheel', 'touchmove', 'scroll'].forEach((t) => addEventListener(t, scrolled, o));
      addEventListener('keydown', (e) => {
        if (e.target === this.$ctl && (e.key === 'Enter' || e.key === ' ')) return;
        this.cut('key');
      }, o);
      if (this.$content) this.$content.addEventListener('focusin', () => this.cut('focus'), o);
    }
    disarm() { if (this._early) this._early.abort(); this._early = null; }
    prepareLoop() {
      const src = this.pick('loop');
      const l = this.$loop;
      if (!src || !l || noData()) return;
      if (l.getAttribute('src') !== src) { l.preload = 'auto'; l.src = src; }
    }
    startLoop() {
      if (!this.$loop || noData() || !this.pick('loop')) return;
      this.loopWanted = true;
      this.prepareLoop();
      this.playLoop();
    }
    playLoop() {
      const l = this.$loop;
      if (!this.loopWanted || this.userPaused || !this.visible || document.hidden || this.drawer) return;
      clearTimeout(this._lw);
      this._lw = this.later(() => {
        if (this.loopWanted && !this.classList.contains('is-loop-on') && !l.paused && l.readyState < 3) this.loopFail();
      }, WATCH * 2);
      play(l, (err) => { if (err && err.name === 'NotAllowedError') this.loopFail(); });
    }
    pauseLoop() { if (this.$loop && !this.$loop.paused) this.$loop.pause(); }
    loopFail() {
      const l = this.$loop;
      this.loopWanted = false;
      l.pause();
      l.removeAttribute('src');
      l.load();
      this.classList.remove('is-loop-on');
      this.setControl(false);
      this.setState('fallback');
    }
    onControl() {
      if (this.inIntro) return this.cut('skipped');
      if (this.$ctl.dataset.mode === 'play') {
        this.userPaused = false;
        this.setControl('pause');
        this.setState(this.baseState);
        if (this.loopWanted) this.playLoop(); else this.startLoop();
      } else {
        this.userPaused = true;
        this.pauseLoop();
        this.setControl('play');
        this.setState('paused');
      }
    }
    replay(e) {
      const src = this.pick('intro');
      if (!src) return;
      e.preventDefault();
      this.clear();
      if (this._sweep) this._sweep.cancel();
      this.userPaused = this.loopWanted = false;
      this.pauseLoop();
      this.classList.remove('is-loop-on');
      this._quiet = performance.now() + 1500;
      if (scrollY > 0) scrollTo({ top: 0, behavior: 'instant' });
      this.playIntro(src);
      focus(this.$ctl);
    }
    bind(signal) {
      const o = { signal };
      const v = this.$intro;
      const l = this.$loop;
      const on = (el, t, fn) => el && el.addEventListener(t, fn, o);
      on(v, 'playing', () => this.onPlaying());
      on(v, 'loadedmetadata', () => this.onMeta());
      on(v, 'ended', () => this.onEnd());
      on(v, 'error', () => { if (this.inIntro && v.getAttribute('src')) this.cut('error'); });
      on(v, 'waiting', () => this.onStall());
      on(v, 'stalled', () => this.onStall());
      on(l, 'playing', () => { clearTimeout(this._lw); this.classList.add('is-loop-on'); });
      on(l, 'error', () => { if (l.getAttribute('src')) this.loopFail(); });
      on(this.$ctl, 'click', () => this.onControl());
      if (this.$secondary && this.$secondary.dataset.action === 'replay') on(this.$secondary, 'click', (e) => this.replay(e));
      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((entries) => {
          const en = entries[entries.length - 1];
          this.visible = en.isIntersecting && en.intersectionRatio >= 0.25;
          if (this.visible) return this.playLoop();
          if (this.inIntro && performance.now() > (this._quiet | 0)) this.cut('scrolled');
          this.pauseLoop();
        }, { threshold: [0, 0.25] });
        this._io.observe(this);
      }
      on(document, 'visibilitychange', () => {
        if (document.hidden) {
          if (this.inIntro) v.pause();
          return this.pauseLoop();
        }
        if (this.inIntro) { play(v, () => this.cut('error')); this.watch(); }
        this.playLoop();
      });
      const isFilm = (e) => { const id = (e.detail && e.detail.id) || ''; return id === film(this) || 'sf-' + id === film(this); };
      on(document, 'drawer:open', (e) => {
        if (this.inIntro) this.cut('drawer');
        this.drawer = true;
        this.pauseLoop();
        if (isFilm(e)) this.film(true);
      });
      on(document, 'drawer:close', (e) => {
        if (isFilm(e)) this.film(false);
        this.drawer = false;
        this.playLoop();
      });
      on(document, 'motion:change', (e) => {
        if (((e.detail && e.detail.level) || html.dataset.sfMotion) !== 'reduced') return;
        this.userPaused = true;
        if (this.inIntro) this.cut('paused');
        this.pauseLoop();
        if (this.$ctl && !this.$ctl.hidden) this.setControl('play');
      });
    }
    film(open) {
      const f = document.querySelector('#' + CSS.escape(film(this)) + ' [data-sf-campaign-film]');
      if (!f) return;
      if (!open) return f.pause();
      const d = f.dataset;
      const src = (this.mq.matches ? d.srcMobile : d.srcDesktop) || d.srcDesktop || d.srcMobile;
      if (!src) return;
      if (f.getAttribute('src') !== src) f.src = src;
      play(f);
    }
  }
  const film = (el) => 'sf-campaign-film-' + (el.dataset.sectionId || '');
  if (!customElements.get('sf-hero-film')) customElements.define('sf-hero-film', SfHeroFilm);
})();
