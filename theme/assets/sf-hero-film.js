/* STEADFAST · Section A · <sf-hero-film> (HOME). ARCHITECTURE §5; DESIGN §8.3 A.
   Video + CSS + Web Animations API, no GSAP. Header, scroll, keys and focus work from t = 0;
   any of them ends the intro at once. */
(() => {
  const S = (window.Steadfast = window.Steadfast || {});
  S.modules = S.modules || {};
  if (S.modules['hero-film']) return;
  S.modules['hero-film'] = true;

  const html = document.documentElement;
  const SEEN = 'sf:intro-seen';
  const CAP = 14; // FILM B7 hard cap
  const WATCH = 4000;
  const debug = (...a) => { if (typeof S.debug === 'function') S.debug('[hero]', ...a); };
  const emit = (name, detail) => {
    if (S.bus && S.bus.emit) S.bus.emit(name, detail);
    else document.dispatchEvent(new CustomEvent(name, { detail }));
  };
  const design = () => Boolean((window.Shopify && window.Shopify.designMode) || (S.settings && S.settings.designMode));
  const play = (v, onErr) => { const p = v.play(); if (p && p.catch) p.catch(onErr || (() => {})); };
  const focus = (el) => { if (!el) return; try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } };

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
      this.mq = window.matchMedia(this.dataset.mqMobile || '(max-width: 749px)');
      this.timers = new Set();
      this.mode = 'idle'; // idle | intro | done
      this.visible = true;
      this.baseState = 'static';
      for (const v of [this.$intro, this.$loop]) {
        if (v) { v.muted = true; v.defaultMuted = true; v.playsInline = true; } // iOS needs the properties
      }
      this.bind(this._ac.signal);
      this.start();
    }

    disconnectedCallback() {
      if (!this._ac) return;
      this._ac.abort();
      this._ac = null;
      this.disarm();
      this.clear();
      cancelAnimationFrame(this._raf);
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

    setState(s) { this.dataset.state = s; html.dataset.sfHero = s; debug(s); }

    variant() { return this.mq.matches ? 'mobile' : 'desktop'; }

    pick(kind, variant = this.variant()) { return this.dataset[kind + (variant === 'mobile' ? 'Mobile' : 'Desktop')] || ''; }

    seen() {
      if (design()) return false;
      if ('sfIntroSeen' in html.dataset) return true;
      try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; }
    }

    markSeen() {
      if (design()) return;
      try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* blocked */ }
    }

    setControl(mode) {
      const c = this.$ctl;
      if (!c) return;
      if (!mode || this.dataset.showSkip === 'false') { c.hidden = true; return; }
      c.hidden = false;
      c.dataset.mode = mode;
      if (this.$label) this.$label.textContent = this.dataset['label' + mode[0].toUpperCase() + mode.slice(1)] || '';
      if (mode === 'skip') c.removeAttribute('aria-pressed');
      else c.setAttribute('aria-pressed', String(mode === 'play'));
    }

    /* Eligibility (ARCHITECTURE §5.3): first match wins. */
    start() {
      const d = html.dataset;
      if (d.sfMotion === 'reduced') return this.toStatic('reduced', false, 'play');
      if ('sfSaveData' in d) return this.toStatic('save-data', false, false);
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

    /* ---------- intro: beats 1–7 in the file, 8–9 in the DOM ---------- */
    playIntro(src) {
      this.mode = 'intro';
      this.beat8 = false;
      this.ending = false;
      this.introVariant = this.variant();
      this.classList.remove('is-beat-8', 'is-beat-9', 'is-cut', 'is-instant');
      html.dataset.sfIntro = 'play';
      this.setState('loading');
      this.setControl('skip');
      this.arm();
      this.load(src);
      this.later(() => { if (this.mode === 'intro' && this.dataset.state !== 'playing') this.cut('error'); }, WATCH);
    }

    load(src) {
      const v = this.$intro;
      const token = (this._token = (this._token || 0) + 1);
      v.preload = 'auto';
      if (v.getAttribute('src') !== src) v.src = src;
      try { v.currentTime = 0; } catch (e) { /* not seekable yet */ }
      // AbortError = our own src swap. Anything else (autoplay policy, Low Power Mode) ends the intro.
      play(v, (err) => {
        if (token === this._token && this.mode === 'intro' && !(err && err.name === 'AbortError')) this.cut('error');
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
      // Source check: orientation or width changed since the src was chosen.
      const now = this.variant();
      if (this.mode !== 'intro' || now === this.introVariant) return;
      const other = this.pick('intro', now);
      if (other) { this.introVariant = now; this.load(other); }
    }

    onStall() {
      if (this.mode !== 'intro' || this.dataset.state !== 'playing') return;
      clearTimeout(this._stall);
      this._stall = this.later(() => { if (this.mode === 'intro' && this.$intro.readyState < 3) this.cut('error'); }, WATCH);
    }

    duration() {
      const d = this.$intro.duration;
      return Number.isFinite(d) && d > 0 ? Math.min(d, CAP) : CAP;
    }

    /* Beat detection on rAF reading currentTime (frame-accurate enough for a 1.2 s reveal). */
    watch() {
      cancelAnimationFrame(this._raf);
      const v = this.$intro;
      const tick = () => {
        if (this.mode !== 'intro') return;
        const t = v.currentTime;
        if (!this.beat8 && t >= this.duration() - 0.4) this.onBeat8();
        if (t >= CAP || v.ended) return this.onEnd();
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    onBeat8() {
      this.beat8 = true;
      this.prepareLoop(); // ready for beat 9
      if (this.dataset.logoReveal === 'false' || !this.$mark) return;
      this.classList.add('is-beat-8');
      const m = this.$mark;
      if (!(window.CSS && CSS.registerProperty && m.animate)) return; // opacity + scale only
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
      this.later(() => this.finish('ended'), 600); // beat 9 at D + 0.6 s
    }

    /* Beat 9 (natural end) or an early end (cut: jump to the end of beat 9 in --sf-dur-base). */
    finish(reason, cut) {
      if (this.mode !== 'intro') return;
      this.mode = 'done';
      this.baseState = 'ended';
      this.disarm();
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
      // Free the decoder once the intro has faded out (no new request).
      this.later(() => {
        if (this.mode === 'intro') return;
        this.$intro.pause();
        this.$intro.removeAttribute('src');
        this.$intro.load();
      }, cut ? 600 : 1600);
      emit('hero:intro-end', { reason });
      if (reason === 'skipped') focus(this.$primary);
    }

    cut(reason) { this.finish(reason, true); }

    arm() {
      this.disarm();
      const ac = (this._early = new AbortController());
      const o = { signal: ac.signal, passive: true };
      const scrolled = () => this.cut('scrolled');
      ['wheel', 'touchmove', 'scroll'].forEach((t) => window.addEventListener(t, scrolled, o));
      window.addEventListener('keydown', (e) => {
        // Enter/Space on SKIP INTRO arrives as its click (which moves focus to the primary CTA).
        if (e.target === this.$ctl && (e.key === 'Enter' || e.key === ' ')) return;
        this.cut('key');
      }, o);
      if (this.$content) this.$content.addEventListener('focusin', () => this.cut('focus'), o);
    }

    disarm() { if (this._early) this._early.abort(); this._early = null; }

    /* ---------- loop ---------- */
    prepareLoop() {
      const src = this.pick('loop');
      const l = this.$loop;
      if (!src || !l || 'sfSaveData' in html.dataset) return;
      if (l.getAttribute('src') !== src) { l.preload = 'auto'; l.src = src; }
    }

    startLoop() {
      if (!this.$loop || 'sfSaveData' in html.dataset || !this.pick('loop')) return; // end still only
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
      debug('loop failed');
      this.loopWanted = false;
      l.pause();
      l.removeAttribute('src');
      l.load(); // cancels the download
      this.classList.remove('is-loop-on');
      this.setControl(false);
      this.setState('fallback');
    }

    onControl() {
      if (this.mode === 'intro') return this.cut('skipped');
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
      if (!src) return; // stays a plain link
      e.preventDefault();
      this.clear();
      if (this._sweep) this._sweep.cancel();
      this.userPaused = false;
      this.loopWanted = false;
      this.pauseLoop();
      this.classList.remove('is-loop-on');
      this.playIntro(src);
      focus(this.$ctl); // keep focus on something visible
    }

    bind(signal) {
      const o = { signal };
      const v = this.$intro;
      const l = this.$loop;
      if (v) {
        v.addEventListener('playing', () => this.onPlaying(), o);
        v.addEventListener('loadedmetadata', () => this.onMeta(), o);
        v.addEventListener('ended', () => this.onEnd(), o);
        v.addEventListener('error', () => { if (this.mode === 'intro' && v.getAttribute('src')) this.cut('error'); }, o);
        v.addEventListener('waiting', () => this.onStall(), o);
        v.addEventListener('stalled', () => this.onStall(), o);
      }
      if (l) {
        l.addEventListener('playing', () => { clearTimeout(this._lw); this.classList.add('is-loop-on'); }, o);
        l.addEventListener('error', () => { if (l.getAttribute('src')) this.loopFail(); }, o);
      }
      if (this.$ctl) this.$ctl.addEventListener('click', () => this.onControl(), o);
      if (this.$secondary && this.$secondary.dataset.action === 'replay') {
        this.$secondary.addEventListener('click', (e) => this.replay(e), o);
      }

      // Leaving during the intro ends it; the loop pauses below 25 % visibility.
      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((entries) => {
          const en = entries[entries.length - 1];
          this.visible = en.isIntersecting && en.intersectionRatio >= 0.25;
          if (this.visible) return this.playLoop();
          if (this.mode === 'intro') this.cut('scrolled');
          this.pauseLoop();
        }, { threshold: [0, 0.25] });
        this._io.observe(this);
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.mode === 'intro') v.pause();
          return this.pauseLoop();
        }
        if (this.mode === 'intro') { play(v, () => this.cut('error')); this.watch(); }
        this.playLoop();
      }, o);

      const film = 'sf-campaign-film-' + (this.dataset.sectionId || '');
      const isFilm = (e) => { const id = (e.detail && e.detail.id) || ''; return id === film || 'sf-' + id === film; };
      document.addEventListener('drawer:open', (e) => {
        if (this.mode === 'intro') this.cut('drawer');
        this.drawer = true;
        this.pauseLoop();
        if (isFilm(e)) this.film(true);
      }, o);
      document.addEventListener('drawer:close', (e) => {
        if (isFilm(e)) this.film(false);
        this.drawer = false;
        this.playLoop();
      }, o);

      // Visitor switched to reduced motion: stop, never start anything new.
      document.addEventListener('motion:change', (e) => {
        if (((e.detail && e.detail.level) || html.dataset.sfMotion) !== 'reduced') return;
        this.userPaused = true;
        if (this.mode === 'intro') this.cut('paused');
        this.pauseLoop();
        if (this.$ctl && !this.$ctl.hidden) this.setControl('play');
      }, o);
    }

    /* Campaign film (merchant upload only): src set lazily by MOBILE_MQ, native controls. */
    film(open) {
      const f = document.querySelector('#sf-campaign-film-' + CSS.escape(this.dataset.sectionId || '') + ' [data-sf-campaign-film]');
      if (!f) return;
      if (!open) return f.pause();
      const d = f.dataset;
      const src = (this.mq.matches ? d.srcMobile : d.srcDesktop) || d.srcDesktop || d.srcMobile;
      if (!src) return;
      if (f.getAttribute('src') !== src) f.src = src;
      play(f);
    }
  }

  if (!customElements.get('sf-hero-film')) customElements.define('sf-hero-film', SfHeroFilm);
})();
