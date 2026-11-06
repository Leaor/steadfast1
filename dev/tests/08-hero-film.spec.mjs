// Hero film + video fallback (BRIEF §3, §12; ARCHITECTURE §9 row 08, §5; FILM-STORYBOARD A2–A8).
import { test, expect, gotoOk, effectiveOpacity, fileOf, events, waitForEvent, markIntroSeen, isMobile } from './helpers/base.mjs';

const hero = (page) => page.locator('sf-hero-film').first();
const intro = (page) => page.locator('sf-hero-film video.sf-hero__intro').first();
const loop = (page) => page.locator('sf-hero-film video.sf-hero__loop').first();
const control = (page) => page.locator('sf-hero-film [data-sf-hero-control]').first();
const state = (page) => hero(page).getAttribute('data-state');
const primaryCta = (page) => page.locator('sf-hero-film .sf-hero__ctas .sf-btn--primary').first();
const files = (testInfo) => (isMobile(testInfo)
  ? { intro: 'sf-film-mobile.mp4', loop: 'sf-film-loop-mobile.mp4', variant: 'mobile' }
  : { intro: 'sf-film-desktop.mp4', loop: 'sf-film-loop-desktop.mp4', variant: 'desktop' });

function trackMp4(page) {
  const list = [];
  page.on('request', (r) => { if (/\.mp4(\?|$)/.test(r.url())) list.push(fileOf(r.url())); });
  return list;
}
async function waitPlaying(page) {
  await expect.poll(() => state(page), { timeout: 10_000, message: 'hero reaches playing' }).toBe('playing');
}
async function contentVisible(page) {
  await expect.poll(() => effectiveOpacity(page.locator('sf-hero-film .sf-hero__ctas').first()), { message: 'CTAs visible' }).toBeGreaterThan(0.99);
  await expect(primaryCta(page)).toBeVisible();
}
/** Records every class/state the hero element takes, so short-lived beats aren't missed. */
async function recordHeroClasses(page) {
  await page.evaluate(() => {
    const el = document.querySelector('sf-hero-film');
    window.__sfHeroSeen = new Set([...el.classList, `state:${el.dataset.state}`]);
    new MutationObserver(() => { el.classList.forEach((c) => window.__sfHeroSeen.add(c)); window.__sfHeroSeen.add(`state:${el.dataset.state}`); })
      .observe(el, { attributes: true, attributeFilter: ['class', 'data-state'] });
  });
}
const seen = (page, token) => page.evaluate((t) => window.__sfHeroSeen?.has(t) || false, token);

test.describe('hero film', () => {
  test('(a)(d)(l) first visit: intro plays, beats 8–9, loop, PAUSE, seen flag, one file each', async ({ page }, testInfo) => {
    const f = files(testInfo);
    const mp4 = trackMp4(page);
    await gotoOk(page, '/');
    await waitPlaying(page);
    expect(fileOf(await intro(page).evaluate((v) => v.currentSrc))).toBe(f.intro);
    const start = await waitForEvent(page, 'hero:intro-start');
    expect(start.detail.variant).toBe(f.variant);
    expect(start.detail.source).toBe('bundled');
    await expect(page.locator('html')).toHaveAttribute('data-sf-intro', 'play');

    const endImg = page.locator('sf-hero-film .sf-hero__end img');
    await expect(endImg).toHaveAttribute('fetchpriority', 'high');
    await expect(endImg).toHaveAttribute('loading', 'eager');
    expect(await effectiveOpacity(endImg), 'end still always painted').toBeGreaterThan(0.99);
    const lcp = await page.evaluate(() => new Promise((resolve) => {
      new PerformanceObserver((l) => { const e = l.getEntries().pop(); resolve(e ? { url: e.url, tag: e.element?.tagName, inEnd: !!e.element?.closest?.('.sf-hero__end') } : null); })
        .observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(null), 3000);
    }));
    expect(lcp, 'LCP entry').not.toBeNull();
    expect(lcp.inEnd || /sf-film-end-/.test(lcp.url || ''), `LCP is the hero end still (${JSON.stringify(lcp)})`).toBe(true);
    await expect(page.locator('[data-sf-header]')).toBeVisible();

    await recordHeroClasses(page);
    await intro(page).evaluate((v) => { v.currentTime = Math.max(0, v.duration - 1); });
    await expect.poll(() => seen(page, 'is-beat-8'), { timeout: 5000, message: '.is-beat-8' }).toBe(true);
    await expect(hero(page)).toHaveClass(/is-beat-9/, { timeout: 5000 });
    await expect.poll(() => state(page)).toBe('ended');
    const end = await waitForEvent(page, 'hero:intro-end');
    expect(end.detail.reason).toBe('ended');
    await expect.poll(() => loop(page).evaluate((v) => v.currentSrc).then(fileOf), { timeout: 5000 }).toBe(f.loop);
    await expect.poll(() => loop(page).evaluate((v) => !v.paused)).toBe(true);
    await contentVisible(page);
    await expect(control(page)).toHaveText(/pause/i);
    await expect(control(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => sessionStorage.getItem('sf:intro-seen'))).toBe('1');
    const distinct = [...new Set(mp4)];
    expect(distinct.filter((x) => /sf-film-(desktop|mobile)\.mp4/.test(x)), 'one intro file').toEqual([f.intro]);
    expect(distinct.filter((x) => /sf-film-loop-/.test(x)), 'one loop file').toEqual([f.loop]);
  });

  test('(d) a 1024×1366 portrait viewport gets the mobile files (MOBILE_MQ)', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'desktop project variant');
    await page.setViewportSize({ width: 1024, height: 1366 });
    await gotoOk(page, '/');
    await waitPlaying(page);
    expect(fileOf(await intro(page).evaluate((v) => v.currentSrc))).toBe('sf-film-mobile.mp4');
    await control(page).click();
    await expect.poll(() => loop(page).evaluate((v) => v.currentSrc).then(fileOf), { timeout: 5000 }).toBe('sf-film-loop-mobile.mp4');
  });

  test('(b)(c) SKIP INTRO at ~1 s → final state ≤ 500 ms, focus on the primary CTA; reload → static, no intro request', async ({ page }, testInfo) => {
    const f = files(testInfo);
    const mp4 = trackMp4(page);
    await gotoOk(page, '/');
    await waitPlaying(page);
    await expect.poll(() => intro(page).evaluate((v) => v.currentTime), { timeout: 5000 }).toBeGreaterThan(0.9);
    await expect(control(page)).toHaveText(/skip intro/i);
    await expect.poll(() => effectiveOpacity(control(page))).toBeGreaterThan(0.99);
    await control(page).focus();
    const elapsed = await page.evaluate(async () => {
      const el = document.querySelector('sf-hero-film');
      const btn = el.querySelector('[data-sf-hero-control]');
      const content = el.querySelector('.sf-hero__ctas');
      const op = (n) => { let o = 1; for (; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
      const t0 = performance.now();
      btn.click();
      while (performance.now() - t0 < 2000) {
        if (el.classList.contains('is-beat-9') && op(content) > 0.99) return performance.now() - t0;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return Infinity;
    });
    expect(elapsed, 'final state within 500 ms').toBeLessThanOrEqual(500);
    await expect(primaryCta(page)).toBeFocused();
    expect((await waitForEvent(page, 'hero:intro-end')).detail.reason).toBe('skipped');
    expect(await page.evaluate(() => sessionStorage.getItem('sf:intro-seen'))).toBe('1');
    await expect(control(page)).toHaveText(/pause/i);
    expect([...new Set(mp4)].filter((x) => /sf-film-(desktop|mobile)\.mp4/.test(x))).toEqual([f.intro]);

    // (c) reload in the same session: loop only, UI at rest from first paint.
    mp4.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-sf-intro', 'skip');
    expect(await effectiveOpacity(page.locator('sf-hero-film .sf-hero__content').first()), 'content visible at first paint').toBeGreaterThan(0.99);
    await page.waitForLoadState('load');
    await expect.poll(() => state(page)).toBe('static');
    await expect.poll(() => mp4.includes(f.loop), { timeout: 8000, message: 'loop requested' }).toBe(true);
    expect(mp4.filter((x) => x === f.intro), 'no intro request on reload').toEqual([]);
    expect((await waitForEvent(page, 'hero:intro-end')).detail.reason).toBe('seen');
    await contentVisible(page);
  });

  test('(e1) intro request aborted → intro ends (error) within 5 s and the loop plays', async ({ page, guard }, testInfo) => {
    const f = files(testInfo);
    guard.allow(/Failed to load resource|ERR_FAILED|net::/);
    await page.route(new RegExp(f.intro.replace('.', '\\.')), (r) => r.abort());
    await gotoOk(page, '/');
    const end = await waitForEvent(page, 'hero:intro-end', { timeout: 6000 });
    expect(end.detail.reason).toBe('error');
    await expect.poll(() => loop(page).evaluate((v) => v.currentSrc).then(fileOf), { timeout: 5000 }).toBe(f.loop);
    await expect.poll(() => loop(page).evaluate((v) => !v.paused && v.currentTime > 0), { timeout: 5000 }).toBe(true);
    await contentVisible(page);
  });

  test('(e2) every film request aborted → fallback with end still and CTAs', async ({ page, guard }) => {
    guard.allow(/Failed to load resource|ERR_FAILED|net::/);
    await page.route(/sf-film-[^/]*\.mp4/, (r) => r.abort());
    await gotoOk(page, '/');
    await expect.poll(() => state(page), { timeout: 12_000 }).toBe('fallback');
    await expect(page.locator('sf-hero-film .sf-hero__end img')).toBeVisible();
    await contentVisible(page);
  });

  test('(f) play() rejecting → fallback, UI visible', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function play() { return Promise.reject(new DOMException('Autoplay blocked (test)', 'NotAllowedError')); };
    });
    await gotoOk(page, '/');
    await expect.poll(() => state(page), { timeout: 12_000 }).toBe('fallback');
    await contentVisible(page);
  });

  test('(g) Save-Data → static, zero mp4 requests', async ({ page }) => {
    await page.addInitScript(() => {
      const conn = { saveData: true, effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => conn });
    });
    const mp4 = trackMp4(page);
    await gotoOk(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-sf-save-data', /.*/);
    await expect.poll(() => state(page)).toBe('static');
    expect((await waitForEvent(page, 'hero:intro-end')).detail.reason).toBe('save-data');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    expect(mp4, 'no mp4 requests').toEqual([]);
    await expect(control(page)).toBeHidden();
    await contentVisible(page);
  });

  test('(h) Tab during the intro moves focus into the header and ends the intro', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'keyboard Tab flow is a desktop case');
    await gotoOk(page, '/');
    await waitPlaying(page);
    let inHeader = false;
    for (let i = 0; i < 5 && !inHeader; i++) {
      await page.keyboard.press('Tab');
      inHeader = await page.evaluate(() => !!document.activeElement?.closest('[data-sf-header]'));
    }
    expect(inHeader, 'focus reached the header').toBe(true);
    const end = await waitForEvent(page, 'hero:intro-end');
    expect(['key', 'focus']).toContain(end.detail.reason);
    await expect.poll(() => state(page)).not.toBe('playing');
  });

  test('(i) scrolling during the intro ends it; the loop pauses off-screen', async ({ page }) => {
    await gotoOk(page, '/');
    await waitPlaying(page);
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 400);
    const end = await waitForEvent(page, 'hero:intro-end');
    expect(end.detail.reason).toBe('scrolled');
    await expect.poll(() => loop(page).evaluate((v) => !!v.currentSrc), { timeout: 6000 }).toBe(true);
    const vh = page.viewportSize().height;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), vh * 3);
    await expect.poll(() => loop(page).evaluate((v) => v.paused), { timeout: 5000, message: 'loop paused off-screen' }).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => loop(page).evaluate((v) => !v.paused), { timeout: 5000, message: 'loop resumes on return' }).toBe(true);
  });

  test('(j) PAUSE flips aria-pressed and pauses the loop', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    await expect.poll(() => loop(page).evaluate((v) => !v.paused && v.currentTime > 0), { timeout: 8000 }).toBe(true);
    await expect(control(page)).toHaveText(/pause/i);
    await expect(control(page)).toHaveAttribute('aria-pressed', 'false');
    await control(page).click();
    await expect(control(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(control(page)).toHaveText(/play/i);
    await expect.poll(() => loop(page).evaluate((v) => v.paused)).toBe(true);
    await expect.poll(() => state(page)).toBe('paused');
    await control(page).click();
    await expect(control(page)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => loop(page).evaluate((v) => !v.paused)).toBe(true);
  });

  test('(k) VIEW THE CAMPAIGN → #campaign by default', async ({ page }) => {
    await markIntroSeen(page);
    await gotoOk(page, '/');
    const sec = page.locator('sf-hero-film [data-sf-hero-secondary]').first();
    await expect(sec).toHaveAttribute('data-action', 'link');
    await sec.click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#campaign');
    await expect(page.locator('#campaign')).toBeInViewport();
  });

  test('(k) with cta_secondary_action=replay it restarts the intro from 0', async ({ page }) => {
    const ps = encodeURIComponent(JSON.stringify({ hero: { cta_secondary_action: 'replay' } }));
    await gotoOk(page, `/?preview_sections=${ps}`);
    await waitPlaying(page);
    await control(page).click();
    await expect.poll(() => state(page)).toBe('ended');
    const sec = page.locator('sf-hero-film [data-sf-hero-secondary]').first();
    await expect(sec).toHaveAttribute('data-action', 'replay');
    await sec.click();
    await expect.poll(async () => (await events(page, 'hero:intro-start')).length, {
      timeout: 6000,
      message: `replay emits a second hero:intro-start (events: ${JSON.stringify(await page.evaluate(() => window.__sfEvents.filter((e) => e.name.startsWith('hero:')).map((e) => `${e.name} ${JSON.stringify(e.detail)}`)))})`,
    }).toBe(2);
    await waitPlaying(page);
    expect(await intro(page).evaluate((v) => v.currentTime)).toBeLessThan(3);
  });
});
