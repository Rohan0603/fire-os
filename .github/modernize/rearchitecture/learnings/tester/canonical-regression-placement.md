# Canonical Regression Placement

Keep modularization regression assertions inside an existing test file listed by the repository's canonical test script when that script uses explicit paths.

## What Happened
For fire-os task t3, new standalone boundary test files would have passed when invoked directly but would have been omitted by `npm test`, which explicitly lists test paths. The assertions were moved into `src/lib/persistence.test.ts`, preserving canonical coverage without changing project configuration.

## Takeaway
Before adding test files, inspect the canonical command. If it enumerates paths, either extend the command through the owning implementation/configuration task or place focused assertions in an already included suite. Do not silently create a second test path.

## History
- 2026-09-16 (fire-os/t3): initial
- 2026-09-16 (fire-os/t3): kept the `awaitCloud` adapter regression in the canonical persistence suite; 22 tests passed.
