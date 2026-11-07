// Shared test base: per-test preview reset, console/page-error guard, contract event capture, and
// small page utilities that read only contract hooks (ARCHITECTURE §4–§9).
import { test as base, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchPage } from './console.mjs';
import * as fx from './fixtures.mjs';

export { expect, fx };
const here = path.dirname(fileURLToPath(import.meta.url));
export const SCREENSHOT_DIR = path.resolve(here, '..', 'screenshots');

export const CONTRACT_EVENTS = [
  'cart:updated', 'cart:item-added', 'cart:error', 'cart:open', 'cart:close', 'variant:change',
  'quickview:open', 'quickview:loaded', 'quickview:close', 'drawer:open', 'drawer:close',
  'search:open', 'search:close', 'menu:open', 'menu:close', 'facets:updated', 'motion:change',
  'hero:intro-start', 'hero:intro-end', 'section:load', 'section:unload',
];

function captureEventsScript(names) {
  window.__sfEvents = [];
  window.__sfLongTasks = [];
  window.__sfLayoutShifts = [];
  for (const n of names) {
    document.addEventListener(n, (e) => {
      let detail = {};
      try { detail = JSON.parse(JSON.stringify(e.detail ?? {}, (k, v) => (typeof Node !== 'undefined' && v instanceof Node ? undefined : v))); } catch { /* ignore */ }
      window.__sfEvents.push({ name: n, detail, t: performance.now() });
    }, true);
  }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__sfLongTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__sfLayoutShifts.push({ t: e.startTime, value: e.value }); }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }
}

export const test = base.extend({
  guard: [async ({ page }, use, testInfo) => {
    const g = watchPage(page);
    // Chromium reports this (not theme JS) when a cross-document view transition (CSS @view-transition)
    // targets a page that hasn't opted in, e.g. the harness's static /checkout notice.
    g.allow(/^pageerror: Transition was aborted because of invalid state\. ViewTransition opt-in disabled/);
    await page.addInitScript(captureEventsScript, CONTRACT_EVENTS);
    // ARCHITECTURE §9: every test resets the preview state first.
    const r = await page.request.post('/__preview/reset');
    expect(r.ok(), 'POST /__preview/reset').toBeTruthy();
    await use(g);
    const errs = g.unexpectedErrors();
    if (errs.length) await testInfo.attach('console-errors.txt', { body: errs.join('\n') });
    expect(errs, 'console errors / page errors').toEqual([]);
  }, { auto: true }],
});

export const isMobile = (testInfo) => testInfo.project.name === 'mobile';

// ---------- navigation / content ----------
export async function gotoOk(page, url, { status = 200, waitUntil = 'load' } = {}) {
  const res = await page.goto(url, { waitUntil });
  expect(res, `navigation to ${url}`).not.toBeNull();
  expect(res.status(), `status of ${url}`).toBe(status);
  return res;
}
export async function assertNoTemplateErrors(page) {
  const html = await page.content();
  const liquid = html.match(/Liquid (syntax )?error[^<]{0,160}/gi) || [];
  const missing = html.match(/translation missing[^<"]{0,80}/gi) || [];
  expect(liquid, 'Liquid errors in HTML').toEqual([]);
  expect(missing, 'missing translations in HTML').toEqual([]);
}
/** Visible text without the preview ribbon. */
export async function visibleText(page) {
  return page.evaluate(() => {
    const rib = document.getElementById('sf-preview-ribbon');
    const prev = rib?.style.display;
    if (rib) rib.style.display = 'none';
    const t = document.body.innerText;
    if (rib) rib.style.display = prev;
    return t;
  });
}
export async function ariaLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll('[aria-label]')]
    .filter((el) => !el.closest('#sf-preview-ribbon'))
    .map((el) => el.getAttribute('aria-label')));
}

/** Pretend the intro was already seen this session, so the hero starts `static` (ARCH §4.3 step 3). */
export async function markIntroSeen(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('sf:intro-seen', '1'); } catch { /* */ } });
}

export async function events(page, name) {
  return page.evaluate((n) => (window.__sfEvents || []).filter((e) => !n || e.name === n), name);
}
export async function waitForEvent(page, name, { timeout = 7000, predicate } = {}) {
  await expect.poll(async () => {
    const list = await events(page, name);
    return list.filter((e) => !predicate || predicate(e.detail)).length;
  }, { timeout, message: `waiting for ${name}` }).toBeGreaterThan(0);
  const list = await events(page, name);
  return list.filter((e) => !predicate || predicate(e.detail)).pop();
}

// ---------- computed style helpers ----------
export async function effectiveOpacity(locator) {
  return locator.evaluate((el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1');
    return o;
  });
}
export const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
export const fileOf = (u) => pathOf(u).split('/').pop();

// ---------- dialogs (<sf-dialog id> wrapping a native <dialog>) ----------
export const dialog = (page, id) => page.locator(`[id="${id}"] dialog`).first();
export async function expectDialogOpen(page, id, open = true) {
  await expect.poll(() => page.locator(`[id="${id}"] dialog`).first().evaluate((d) => d.open).catch(() => false),
    { message: `#${id} dialog open=${open}` }).toBe(open);
}
export async function focusIsInside(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return !!(root && a && root.contains(a));
  }, selector);
}
export async function activeElementInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    return a ? { tag: a.tagName.toLowerCase(), id: a.id, cls: a.className?.toString?.() || '', text: (a.textContent || '').trim().slice(0, 60), href: a.getAttribute('href'), name: a.getAttribute('name') } : null;
  });
}
/** Waits until every animation (CSS transitions/animations, WAAPI) under the selector has finished. */
export async function settleAnimations(page, selector) {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const anims = root.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
  }, selector);
}

// ---------- header ----------
export const header = (page) => page.locator('[data-sf-header]').first();
export async function openCartFromHeader(page) {
  const trigger = page.locator('[data-sf-header] [data-sf-open="cart"]').first();
  await trigger.click();
  await expectDialogOpen(page, 'sf-cart-drawer');
  return trigger;
}

// ---------- cart (preview Ajax API) ----------
export async function cartJSON(page) {
  const r = await page.request.get('/cart.js');
  expect(r.ok()).toBeTruthy();
  return r.json();
}
export async function apiAdd(page, id, quantity = 1) {
  const r = await page.request.post('/cart/add.js', { data: { items: [{ id, quantity }] } });
  return r;
}

// ---------- variant picker ----------
/** The <fieldset> for an option inside a scope (PDP main / quick view). */
export function optionFieldset(scope, optionName) {
  return scope.locator('sf-variant-picker fieldset').filter({ has: scope.page().locator('legend', { hasText: new RegExp(optionName, 'i') }) }).first();
}
/** Selects an option value via its native control (radio label click, or <select>). */
export async function chooseOption(scope, optionName, value) {
  const page = scope.page();
  const fs = optionFieldset(scope, optionName);
  if (await fs.count()) {
    const radio = fs.locator(`input[type="radio"][value="${value.replace(/"/g, '\\"')}"]`).first();
    const id = await radio.getAttribute('id');
    const label = id ? fs.locator(`label[for="${id}"]`) : radio.locator('xpath=ancestor::label[1]');
    if (await label.count()) await label.first().click();
    else await radio.check({ force: true });
    return radio;
  }
  // dropdown mode: <label for> + <select>
  const select = scope.locator('sf-variant-picker select').filter({ has: page.locator('option', { hasText: value }) }).first();
  await select.selectOption({ label: value }).catch(() => select.selectOption(value));
  return select;
}

/**
 * Size is never pre-selected on the PDP / quick view (sf-variant-picker): with no ?variant= and more than
 * one size, the submit shows "Select a size" (data-state="select") until the shopper picks one. This picks
 * the size of `variant` (default: the first available variant) when, and only when, that state is shown.
 */
export async function chooseSizeIfRequired(scope, product, variant) {
  const btn = scope.locator('sf-product-form button[type="submit"]').first();
  if ((await btn.getAttribute('data-state')) !== 'select') return false;
  const p = product;
  const v = variant || fx.firstAvailable(p);
  const si = (p.options || []).findIndex((o) => fx.optName(o).toLowerCase() === 'size');
  if (si < 0) return false;
  await chooseOption(scope, 'size', fx.variantOptions(v)[si]);
  await expect(btn).not.toHaveAttribute('data-state', 'select');
  return true;
}

export function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
export function screenshotPath(testInfo, name) {
  const dir = path.join(SCREENSHOT_DIR, testInfo.project.name);
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `${slug(name)}.png`);
}

/** Context options of the current project (for extra contexts, e.g. javaScriptEnabled:false). */
export function projectContext(testInfo, baseURL, extra = {}) {
  const u = testInfo.project.use || {};
  const pick = {};
  for (const k of ['viewport', 'isMobile', 'hasTouch', 'deviceScaleFactor', 'userAgent']) if (u[k] !== undefined) pick[k] = u[k];
  return { ...pick, baseURL, ...extra };
}
