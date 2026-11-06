// STEADFAST preview test suite (ARCHITECTURE §9). Dev-only, never shipped.
// Run: npm --prefix dev test   (or: cd dev && npx playwright test --config tests/playwright.config.mjs)
import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SF_PREVIEW_PORT || 9292);
const baseURL = `http://127.0.0.1:${PORT}`;

// ARCHITECTURE §15: use the preinstalled Chromium, never `playwright install`.
// Playwright resolves it through PLAYWRIGHT_BROWSERS_PATH; fall back to the symlink if not.
const launchOptions = {};
if (process.env.SF_CHROMIUM) launchOptions.executablePath = process.env.SF_CHROMIUM;
else if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('/opt/pw-browsers/chromium')) {
  launchOptions.executablePath = '/opt/pw-browsers/chromium';
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export default defineConfig({
  testDir: '.',
  testMatch: /\d\d-.*\.spec\.mjs$/,
  outputDir: path.join(here, 'reports', 'artifacts'),
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: Number(process.env.SF_WORKERS || 2),
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(here, 'reports', 'results.json') }],
    ['html', { outputFolder: path.join(here, 'reports', 'html'), open: 'never' }],
  ],
  webServer: {
    command: `node ../preview/server.mjs --port ${PORT}`,
    cwd: here,
    url: `${baseURL}/__preview/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        launchOptions,
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: IPHONE_UA,
        launchOptions,
      },
    },
  ],
});
