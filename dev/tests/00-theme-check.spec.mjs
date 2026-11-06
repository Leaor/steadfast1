// (gate) Theme validity: `shopify theme check` reports 0 error-severity offenses (ARCHITECTURE §0.12, §9).
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const devDir = path.resolve(here, '..');
const themeDir = path.resolve(here, '..', '..', 'theme');

test('theme check: 0 errors', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'project-independent; runs once');
  test.setTimeout(240_000);
  const run = spawnSync('npx', ['shopify', 'theme', 'check', '--path', themeDir, '--output', 'json'], {
    cwd: devDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1' },
  });
  const out = run.stdout || '';
  const start = out.indexOf('{') >= 0 && (out.indexOf('[') < 0 || out.indexOf('{') < out.indexOf('[')) ? out.indexOf('{') : out.indexOf('[');
  expect(start, `theme check produced JSON (stderr: ${(run.stderr || '').slice(0, 400)})`).toBeGreaterThanOrEqual(0);
  const data = JSON.parse(out.slice(start));
  // CLI 3.x+/5.x: { valid, issues: [{ filePath, check, severity: 'error'|'warning'|'info', message }] }
  // older: [{ path, offenses: [{ check, severity: 0|1|2, message }] }]
  const issues = Array.isArray(data)
    ? data.flatMap((f) => (f.offenses || []).map((o) => ({ filePath: f.path, check: o.check, severity: o.severity === 0 ? 'error' : o.severity === 1 ? 'warning' : 'info', message: o.message, startRow: o.start_row })))
    : (data.issues || []);
  const rel = (p) => path.relative(themeDir, p || '');
  const fmt = (i) => `${rel(i.filePath)}:${(i.startRow ?? 0) + 1} [${i.check}] ${i.message}`;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity !== 'error');
  await testInfo.attach('theme-check-warnings.txt', { body: warnings.map(fmt).join('\n') || '(none)' });
  await testInfo.attach('theme-check-errors.txt', { body: errors.map(fmt).join('\n') || '(none)' });
  expect(errors.map(fmt), 'theme check error-severity offenses').toEqual([]);
});
