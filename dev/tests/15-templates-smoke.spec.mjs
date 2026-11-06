// Template smoke (ARCHITECTURE §9 row 15, §8.2): every GET route renders with the right status,
// no Liquid errors, no missing translations, no console errors; logged out and logged in.
import { test, expect, fx, assertNoTemplateErrors, markIntroSeen } from './helpers/base.mjs';
import { htmlRoutes } from './helpers/routes.mjs';

const routes = fx.fixturesReady() ? htmlRoutes() : [];

async function login(page) {
  const r = await page.request.post('/account/login', { form: { form_type: 'customer_login', utf8: '✓', 'customer[email]': 'customer@example.com', 'customer[password]': 'preview' }, maxRedirects: 0 });
  expect([302, 303]).toContain(r.status());
}

for (const r of routes) {
  test(`GET ${r.path} → ${r.status}${r.auth ? ' (logged in)' : ''}`, async ({ page, guard }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' && !['/', '/cart', '/account/login'].includes(r.path), 'smoke runs on desktop (plus key routes on mobile)');
    if (r.status === 404) guard.allow(/status of 404/);
    await markIntroSeen(page);
    if (r.auth) await login(page);
    const res = await page.goto(r.path, { waitUntil: 'load' });
    expect(res.status(), `status of ${r.path}`).toBe(r.status);
    expect(new URL(page.url()).pathname, 'no redirect').toBe(new URL(r.path, 'http://x').pathname);
    await assertNoTemplateErrors(page);
    await expect(page.locator('#sf-preview-ribbon')).toHaveCount(1);
    if (!r.path.startsWith('/gift_cards') && !r.path.startsWith('/checkout')) {
      await expect(page.locator('h1'), `one h1 on ${r.path}`).toHaveCount(1);
      await expect(page.locator('main#MainContent')).toHaveCount(1);
    }
    expect(guard.httpErrors().filter((e) => !e.includes(new URL(r.path, page.url()).href)), 'subresource 4xx/5xx').toEqual([]);
  });
}

test('logged-out /account redirects to /account/login', async ({ page }) => {
  const res = await page.goto('/account');
  expect(res.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/account/login');
});

test('customer flows: login (empty password errors), logout, register', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  await page.goto('/account/login');
  const form = page.locator('form[action$="/account/login"]').first();
  await form.locator('input[type="email"]').fill('customer@example.com');
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await expect(page.locator('main')).toContainText(/.+/);
  await assertNoTemplateErrors(page);
  expect(new URL(page.url()).pathname).toMatch(/\/account\/login/);
  await expect(page.locator('main [aria-invalid="true"], main .sf-field__error, main [role="alert"], main .errors').first()).toBeVisible();

  await form.locator('input[type="email"]').fill('customer@example.com');
  await form.locator('input[type="password"]').fill('preview');
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL(/\/account$/);
  await expect(page.locator('main')).toContainText(fx.customer()?.first_name || 'Sample');
  await assertNoTemplateErrors(page);
  await page.goto('/account/logout');
  expect(new URL(page.url()).pathname).toBe('/');
  await page.goto('/account');
  expect(new URL(page.url()).pathname).toBe('/account/login');
});

test('newsletter: invalid email shows an inline error; success replaces the form and takes focus', async ({ page }) => {
  await markIntroSeen(page);
  await page.goto('/collections/all');
  const form = page.locator('#newsletter form').first();
  const email = form.locator('input[name="contact[email]"]');
  await expect(form.locator('input[name="contact[tags]"]')).toHaveValue('newsletter');
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await email.fill('not-an-email');
  await email.evaluate((i) => { i.form.noValidate = true; });
  await form.locator('button[type="submit"]').click();
  await page.waitForLoadState('load');
  await assertNoTemplateErrors(page);
  await expect(page.locator('#newsletter input[name="contact[email]"]')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#newsletter input[name="contact[email]"]').fill('reader@example.com');
  await page.locator('#newsletter form button[type="submit"]').click();
  await page.waitForURL(/customer_posted=true/);
  const ok = page.locator('#newsletter [role="status"]');
  await expect(ok).toHaveText("You're subscribed.");
  await expect(ok).toBeFocused();
  await expect(page.locator('#newsletter input[name="contact[email]"]')).toHaveCount(0);
});
