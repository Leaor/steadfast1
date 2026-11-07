// temporary scratch script (removed after use)
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2]; const BASE = 'http://127.0.0.1:9331';
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe });
const report = { console: [], pageerrors: [] };
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => { await Promise.all([...document.images].filter((i) => i.getBoundingClientRect().bottom > 0 && i.getBoundingClientRect().top < innerHeight).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))); });
  await page.waitForTimeout(900);
}
async function imgs(page) {
  return page.evaluate(() => [...document.images].map((i) => {
    const r = i.getBoundingClientRect(); const sec = i.closest('[data-sf-section]');
    return { src: (i.currentSrc || i.src).replace(location.origin, ''), section: sec ? sec.dataset.sfSection : (i.closest('header,[id^=sf-mega],.sf-mega') ? 'header' : null), visible: r.width > 0 && r.height > 0 && getComputedStyle(i).visibility !== 'hidden', top: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  }));
}
for (const [label, vp, mobile] of [['d', { width: 1440, height: 900 }, false], ['m', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('sf:intro-seen', '1'); } catch {} });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) report.console.push(`${label} ${page.url()} ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => report.pageerrors.push(`${label} ${page.url()} ${e.message}`));
  // home
  await page.goto(BASE + '/'); await settle(page);
  const html = await page.content(); report[`${label}-home-liquid-error`] = /Liquid error|Liquid syntax error/i.test(html);
  for (const sec of ['featured-collection', 'signature-showcase', 'category-grid']) {
    const loc = page.locator(`[data-sf-section="${sec}"]`).first();
    await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
    if (sec === 'category-grid') { await loc.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400); await page.evaluate(() => scrollBy(0, -60)); }
    await settle(page);
    await page.screenshot({ path: `${OUT}/${label}-home-${sec}.png` });
  }
  report[`${label}-home-imgs`] = await imgs(page);
  // collection pages + PDP
  for (const [name, path] of [['coll-hoodies', '/collections/hoodies'], ['coll-all', '/collections/all'], ['pdp-gothic', '/products/embossed-gothic-hoodie']]) {
    await page.goto(BASE + path); await settle(page);
    report[`${label}-${name}-liquid-error`] = /Liquid error|Liquid syntax error/i.test(await page.content());
    await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
    if (name !== 'pdp-gothic') { await page.evaluate(() => scrollBy(0, innerHeight * 0.8)); await settle(page); await page.screenshot({ path: `${OUT}/${label}-${name}-2.png` }); }
    report[`${label}-${name}-imgs`] = await imgs(page);
  }
  // mega menu (desktop) / menu drawer (mobile)
  await page.goto(BASE + '/collections/all'); await settle(page);
  if (!mobile) {
    const trig = page.locator('header nav button[aria-expanded]').first();
    await trig.click(); await page.waitForTimeout(900); await settle(page);
  } else {
    const btn = page.locator('header button[aria-controls*="menu" i], header [data-sf-menu-open], header button[aria-label*="menu" i]').first();
    await btn.click(); await page.waitForTimeout(900); await settle(page);
  }
  await page.screenshot({ path: `${OUT}/${label}-menu.png` });
  report[`${label}-menu-imgs`] = (await imgs(page)).filter((i) => i.visible && i.section === 'header' || /collection-hoodies|category/.test(i.src));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log('console', report.console.length, 'pageerrors', report.pageerrors.length);
