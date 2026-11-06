#!/usr/bin/env node
// Merges the owner locale fragments in dev/locales/*.json into theme/locales/en.default.json
// (ARCHITECTURE §1.4). Keys are written in sorted order with 2-space JSON.
// Exits 1 if a namespace appears in two fragments, a fragment uses a namespace it does not own,
// a value matches /\bbag\b/i (vocabulary rule §0.5), or a fragment is not valid JSON.
// A missing fragment is reported as a warning (owners build in parallel), not an error.
//
// Usage: node tools/locales/merge-locales.mjs [--check]
//   --check  validate and compare with the existing output without writing it.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fragmentsDir = join(root, 'dev', 'locales');
const outFile = join(root, 'theme', 'locales', 'en.default.json');
const checkOnly = process.argv.includes('--check');

const OWNERS = {
  core: ['general', 'accessibility', 'header', 'menu', 'footer', 'newsletter', 'localization', 'price', 'product_card', 'quick_add', 'motion', 'social'],
  home: ['home'],
  commerce: ['products', 'collections', 'facets', 'search', 'cart', 'quick_view', 'customer', 'contact', 'blogs', 'pages', 'templates', 'password', 'gift_card'],
};
const BANNED = /\bbag\b/i;

const errors = [];
const warnings = [];
const merged = {};
const seenBy = {};

function walk(value, path, visit) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, visit);
  } else {
    visit(path, value);
  }
}

function sortDeep(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortDeep(value[k])]));
  }
  return value;
}

for (const [owner, namespaces] of Object.entries(OWNERS)) {
  const file = join(fragmentsDir, `${owner}.json`);
  if (!existsSync(file)) {
    warnings.push(`dev/locales/${owner}.json not found (skipped)`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    errors.push(`dev/locales/${owner}.json is not valid JSON: ${err.message}`);
    continue;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`dev/locales/${owner}.json must contain a JSON object`);
    continue;
  }
  for (const [ns, value] of Object.entries(data)) {
    if (!namespaces.includes(ns)) {
      const realOwner = Object.keys(OWNERS).find((o) => OWNERS[o].includes(ns));
      errors.push(`${owner}.json uses namespace "${ns}"${realOwner ? ` owned by ${realOwner}` : ' which no owner has'}`);
      continue;
    }
    if (seenBy[ns]) {
      errors.push(`namespace "${ns}" appears in ${seenBy[ns]}.json and ${owner}.json`);
      continue;
    }
    seenBy[ns] = owner;
    walk(value, ns, (path, leaf) => {
      if (typeof leaf !== 'string') {
        errors.push(`${owner}.json ${path}: values must be strings (got ${Array.isArray(leaf) ? 'array' : typeof leaf})`);
      } else if (BANNED.test(leaf)) {
        errors.push(`${owner}.json ${path}: "${leaf}" uses the word "bag" (vocabulary rule: use "cart")`);
      }
    });
    merged[ns] = value;
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const output = JSON.stringify(sortDeep(merged), null, 2) + '\n';
if (checkOnly) {
  const current = existsSync(outFile) ? await readFile(outFile, 'utf8') : '';
  if (current !== output) {
    console.error('error: theme/locales/en.default.json is out of date; run node tools/locales/merge-locales.mjs');
    process.exit(1);
  }
  console.log('locales up to date');
} else {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, output);
  let count = 0;
  walk(merged, '', () => count++);
  console.log(`wrote theme/locales/en.default.json (${Object.keys(merged).length} namespaces, ${count} keys)`);
}
