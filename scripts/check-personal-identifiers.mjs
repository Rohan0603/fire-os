#!/usr/bin/env node
/* global console, process */
// CI guard: fail the build if personal identifiers appear outside presets/ and
// test files. This repository is public, so the maintainer's personal handles,
// external-advisor references, contact details, and fund-specific tokens must
// never ship in source.
//
// NOTE: `ppfcf`, `nippon`, `2031`, `2032`, and `125000` are now enforced by this
// guard after the fund-layer generalization (buckets + harvestTarget). They
// must not appear in any `src/` source file outside `presets/` or test files.
// Removing them from source is a prerequisite for the guard to pass; see the
// brief for the full generalization scope.
//
// Excluded paths follow the brief: anything under a `presets/` directory and
// *.test.* / *.spec.* files.
//
// HARD RULE for `presets/`: it may contain ONLY generic, non-identifying
// sample data (fictional names, round illustrative amounts, placeholder
// dates). This repository is public, and the skip exists so deployment forks
// can locally template their own presets — never to hide real data. Real user
// plans belong in the user's own account data, never in source control. If you
// need a personal preset, keep it local/untracked or template it from generic
// examples; do not commit it under presets/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src', 'worker', 'shared', 'firestore.rules', 'firebase.json'];

// Identifiers that must never (re)appear in shipped source/config.
const DENY = [
  'wint', // former Wint Wealth advisor integration (removed)
  'societe', // former Société Générale integration (removed)
  'socgen',
  'ponnanna06032001', // maintainer's personal contact email
  'user@example', // placeholder that must never ship as a real value
  '122000', // owner's former FI/SWP monthly withdrawal amount (removed)
  '55000000', // owner's former ₹5.5Cr FI target (removed)
  'ppfcf', // Parag Parikh Flexi Cap Fund (owner-specific; generalized to fundBuckets)
  'nippon', // Nippon India fund family (owner-specific; generalized to fundBuckets)
  '2031', // ESOP 5-year holding milestone year (generalized to holdingPeriodYears)
  '2032', // Annual harvest fiscal year (generalized to fiscal-year-end reminder)
  '125000', // Statutory LTCG exemption limit (generalized to taxCalendar.harvestTarget)
  '125_000', // Same with underscore literal
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'presets']);
const isTestFile = (name) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(name);

function* walk(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (SKIP_DIRS.has(entry)) continue;
      yield* walk(join(path, entry));
    }
  } else if (stat.isFile() && !isTestFile(path)) {
    yield path;
  }
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const token of DENY) {
        if (line.toLowerCase().includes(token)) {
          hits.push(`${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}  [${token}]`);
        }
      }
    });
  }
}

if (hits.length > 0) {
  console.error('Personal identifiers found in source (must be removed or moved to presets/):\n');
  for (const hit of hits) console.error(`  ${hit}`);
  console.error(`\n${hits.length} hit(s).`);
  process.exit(1);
}

console.log('No personal identifiers found outside presets/ and test files.');
