// node dev/tests/helpers/summarize.mjs [results.json] → prints per-spec pass/fail/skip counts and failures
// (markdown) from an actual Playwright JSON report. Used to build reports/SUMMARY.md.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(here, '..', 'reports', 'results.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const rows = new Map();
const failures = [];
function walk(suite, file) {
  const f = suite.file || file;
  for (const s of suite.suites || []) walk(s, f);
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const r = t.results?.[t.results.length - 1];
      const status = t.status === 'skipped' || r?.status === 'skipped' ? 'skip' : (t.status === 'expected' ? 'pass' : (t.status === 'flaky' ? 'flaky' : 'fail'));
      const key = path.basename(spec.file || f);
      const row = rows.get(key) || { pass: 0, fail: 0, skip: 0, flaky: 0 };
      row[status]++;
      rows.set(key, row);
      if (status === 'fail') {
        const msg = (r?.error?.message || r?.errors?.[0]?.message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 3).join(' ⏎ ');
        failures.push({ file: key, project: t.projectName, title: spec.title, msg: msg.slice(0, 400) });
      }
    }
  }
}
for (const s of data.suites || []) walk(s, s.file);
const tot = { pass: 0, fail: 0, skip: 0, flaky: 0 };
console.log('| Spec | Pass | Fail | Skip |\n|---|---:|---:|---:|');
for (const [k, v] of [...rows].sort()) { console.log(`| ${k} | ${v.pass} | ${v.fail} | ${v.skip} |`); for (const x in tot) tot[x] += v[x]; }
console.log(`| **Total** | **${tot.pass}** | **${tot.fail}** | **${tot.skip}** |`);
console.log(`\nStarted: ${data.stats?.startTime || '?'} · duration ${Math.round((data.stats?.duration || 0) / 1000)} s\n`);
console.log('## Failures\n');
for (const f of failures) console.log(`- **${f.file}** [${f.project}] ${f.title}\n  - ${f.msg}`);
