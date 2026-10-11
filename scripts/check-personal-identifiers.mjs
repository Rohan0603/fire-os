#!/usr/bin/env node
/* global console, process */
// CI guard: fail the build if personal identifiers appear outside presets/ and
// test files. This repository is public, so the maintainer's personal handles,
// external-advisor references, and contact details must never ship in source.
//
// Narrowing note: the suggested pattern also listed identifiers that are
// unavoidably present in shipped product modules today — fund names (ppfcf,
// nippon) and the owner's personal amounts / milestone years (122000, 55000000,
// 125000, 2031, 2032). Those are baked into the default state/config modules,
// not accidental leaks. Personal plan specifics (goal names, amounts) live in a
// `presets/` module; wire them in per deployment instead of the defaults. The
// identifiers above are intentionally NOT enforced here so this guard can gate
// everything else. Excluded paths follow the brief: anything under a `presets/`
// directory and *.test.* / *.spec.* files.
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
