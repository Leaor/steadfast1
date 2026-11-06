// Desktop navigation (BRIEF §12; ARCHITECTURE §9 row 02, §2.4 sf-header, §4.2 <sf-header>; DESIGN §7.1–§7.2).
import { test, expect, fx, gotoOk, effectiveOpacity, expectDialogOpen, focusIsInside, markIntroSeen } from './helpers/base.mjs';

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'desktop project only'));

const primaryNav = (page) => page.getByRole('navigation', { name: /^primary$/i });
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

test('primary nav items match menus.json main-menu', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const nav = primaryNav(page);
  await expect(nav).toBeVisible();
  const links = fx.menuLinks('main-menu');
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    const kids = link.links || [];
    if (kids.length) {
      const trigger = nav.getByRole('button', { name: new RegExp(`^\\s*${link.title}`, 'i') });
      await expect(trigger, `disclosure button for ${link.title}`).toHaveCount(1);
      await trigger.click();
      const panel = page.locator(`#${await trigger.getAttribute('aria-controls')}`);
      await expect(panel).toBeVisible();
      for (const kid of kids) {
        const a = panel.locator('a', { hasText: new RegExp(`^\\s*${kid.title}\\s*$`, 'i') }).first();
        await expect(a, `child link ${kid.title}`).toHaveCount(1);
        expect(new URL(await a.getAttribute('href'), 'http://x').pathname + (new URL(kid.url, 'http://x').hash || ''))
          .toBe(new URL(kid.url, 'http://x').pathname + (new URL(kid.url, 'http://x').hash || ''));
      }
      await page.keyboard.press('Escape');
    } else {
      const a = nav.getByRole('link', { name: new RegExp(`^\\s*${link.title}\\s*$`, 'i') });
      await expect(a, `top-level link ${link.title}`).toHaveCount(1);
      const want = new URL(link.url, 'http://x');
      const got = new URL(await a.getAttribute('href'), 'http://x');
      expect(got.pathname + got.hash).toBe(want.pathname + want.hash);
    }
  }
});

test('dropdown: click and Enter open it, aria-expanded toggles, Esc closes and restores focus', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const trigger = primaryNav(page).locator('button[aria-expanded]').first();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const panel = page.locator(`#${await trigger.getAttribute('aria-controls')}`);

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.mouse.move(5, 600); // keep hover intent out of the way
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  // focus can move into the panel
  await page.keyboard.press('Tab');
  expect(await panel.evaluate((p) => p.contains(document.activeElement)), 'Tab moves into the open panel').toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('header is visible and usable during the intro (first visit)', async ({ page }) => {
  await gotoOk(page, '/');
  const hero = page.locator('sf-hero-film');
  await expect.poll(() => hero.getAttribute('data-state'), { timeout: 8000 }).toMatch(/loading|playing/);
  const hdr = page.locator('[data-sf-header]');
  await expect(hdr).toBeVisible();
  expect(await effectiveOpacity(hdr)).toBeGreaterThan(0.99);
  // Actionability (visible, stable, receives events) of the header controls while the intro runs.
  const account = page.locator('[data-sf-header] a[href$="/account"]').first();
  await account.click({ trial: true });
  await primaryNav(page).locator('a, button').first().click({ trial: true });
  await page.locator('[data-sf-header] [data-sf-open="cart"]').first().click({ trial: true });
  await page.locator('[data-sf-header] [data-sf-open="search"]').first().click({ trial: true });
  await account.click();
  await page.waitForURL(/\/account\/login/);
});

test('transparent over the hero (logo at opacity 0), solid past it (logo fades in)', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/');
  const hdr = page.locator('[data-sf-header]');
  const logo = page.locator('[data-sf-header] .sf-header__logo').first();
  await expect(logo).toHaveCount(1);
  // Visual solidity: the most opaque full-width background inside the header (bg alpha × effective opacity).
  const bgAlpha = () => hdr.evaluate((root) => {
    const hw = root.getBoundingClientRect().width;
    const eff = (n) => { let o = 1; for (; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
    const alpha = (n) => { const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
    return Math.max(0, ...[root, ...root.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().width >= hw * 0.9 && getComputedStyle(n).visibility !== 'hidden' && !n.closest('dialog, [id^="sf-mega"], .sf-mega')).map((n) => alpha(n) * eff(n)));
  });
  await expect.poll(bgAlpha).toBe(0);
  await expect.poll(() => effectiveOpacity(logo.locator('.sf-logo, svg').first())).toBeLessThan(0.01);
  expect(await logo.evaluate((el) => el.getBoundingClientRect().width), 'logo box reserved').toBeGreaterThan(40);

  const heroH = await page.locator('[data-sf-section="hero-film"]').evaluate((el) => el.getBoundingClientRect().height);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), heroH + 80);
  await page.mouse.wheel(0, -40); // a small scroll up keeps the on-scroll-up header shown
  await expect.poll(bgAlpha).toBeGreaterThan(0.9);
  await expect.poll(() => effectiveOpacity(logo.locator('.sf-logo, svg').first())).toBeGreaterThan(0.99);
});

test('no element has a computed backdrop-filter', async ({ page }) => {
  await markIntroSeen(page);
  for (const url of ['/', '/collections/all', `/products/${fx.products()[0].handle}`]) {
    await gotoOk(page, url);
    await page.locator('[data-sf-header] [data-sf-open="cart"]').first().click();
    await expectDialogOpen(page, 'sf-cart-drawer');
    const offenders = await page.evaluate(() => [...document.querySelectorAll('*')].flatMap((el) => {
      const out = [];
      for (const pseudo of [null, '::before', '::after', '::backdrop']) {
        const v = getComputedStyle(el, pseudo).backdropFilter;
        if (v && v !== 'none') out.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo || ''}: ${v}`);
      }
      return out;
    }));
    expect(offenders, `backdrop-filter on ${url}`).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('on-scroll-up: hides on scroll down past the hero, shows on scroll up', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/');
  const hdr = page.locator('[data-sf-header]');
  await expect(hdr).toHaveAttribute('data-sticky', 'on-scroll-up');
  // The visible bar is measured through a header control (the cart action), whatever element carries the transform.
  const bottom = () => page.locator('[data-sf-header] [data-sf-open="cart"]').first().evaluate((el) => el.getBoundingClientRect().bottom);
  await page.mouse.move(720, 450);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 250);
  await expect.poll(async () => (await page.evaluate(() => window.scrollY)) > 1500).toBe(true);
  await expect.poll(bottom, { message: 'header hidden while scrolling down' }).toBeLessThanOrEqual(1);
  await page.mouse.wheel(0, -200);
  await expect.poll(bottom, { message: 'header shown on scroll up' }).toBeGreaterThan(20);
});

test('desktop actions: SEARCH opens the overlay with focus in the input, ACCOUNT → login, CART (n) opens the drawer', async ({ page }) => {
  await markIntroSeen(page);
  await gotoOk(page, '/collections/all');
  const search = page.locator('[data-sf-header] [data-sf-open="search"]').first();
  const account = page.locator('[data-sf-header] a[href$="/account"]').first();
  const cart = page.locator('[data-sf-header] [data-sf-open="cart"]').first();
  for (const [loc, re] of [[search, /^search$/], [account, /^account$/], [cart, /^cart\s*\(\s*0\s*\)$/]]) {
    await expect(loc).toBeVisible();
    const text = await loc.evaluate((el) => el.innerText.replace(/\s+/g, ' ').trim());
    expect(text, 'desktop text label (uppercase via CSS)').toMatch(new RegExp(re.source, 'i'));
    expect(text, 'rendered uppercase').toBe(text.toUpperCase());
  }
  await search.click();
  await expectDialogOpen(page, 'sf-search-overlay');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe('q');
  expect(await focusIsInside(page, '#sf-search-overlay')).toBe(true);
  await page.keyboard.press('Escape');
  await expectDialogOpen(page, 'sf-search-overlay', false);
  await expect(search).toBeFocused();

  await cart.click();
  await expectDialogOpen(page, 'sf-cart-drawer');
  await page.keyboard.press('Escape');
  await expectDialogOpen(page, 'sf-cart-drawer', false);

  await account.click();
  await page.waitForURL(/\/account\/login$/);
});
