# Aggregate Validation Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run check` that runs the fast gate in CI order (no emulator, browser, or server required).

**Architecture:** Create a new script `scripts/check.mjs` that sequentially runs existing validation commands: `npm run lint`, `npm run test`, `npm run build`, `npm run format:check`. Each step must pass before the next runs.

**Tech Stack:** Node.js scripts, existing package.json scripts, vitest, eslint, prettier, vite.

**Spec:** docs/master.md (Aggregate Validation Command), TODO.md line 26-31

## Global Constraints

- Version floor: Node 18+
- No new dependencies
- Must run in CI without emulator, browser, or server
- Exit code must be non-zero on any failure
- Order: lint → test → build → format:check (fastest first)

## Review Focus

- **Order matters:** lint must run first (fastest, catches syntax errors early)
- **Fail fast:** stop on first failure, don't run remaining steps
- **CI parity:** must produce identical results locally and in CI
- **No false positives:** format:check must not modify files
- **Clear output:** each step's name and result visible in console

## File Structure

- Create: `scripts/check.mjs`
- Modify: `package.json` (add `check` script)

## Task 1: Write check script

**Files:**
- Create: `scripts/check.mjs`
- Test: `scripts/check.test.mjs` (or inline test)

**Interfaces:**
- Consumes: existing package.json scripts (`lint`, `test`, `build`, `format:check`)
- Produces: exit code 0 if all pass, non-zero on first failure

- [ ] **Step 1: Write failing test for check script**

```javascript
// scripts/check.test.mjs
import { runCheck } from './check.mjs';

describe('check script', () => {
  it('runs lint, test, build, format:check in order and exits 0 on success', async () => {
    const result = await runCheck(['echo lint', 'echo test', 'echo build', 'echo format']);
    expect(result.exitCode).toBe(0);
  });

  it('stops on first failure and returns non-zero exit code', async () => {
    const result = await runCheck(['echo lint', 'exit 1', 'echo build']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stepsRun).toEqual(['lint']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check.test.mjs`
Expected: FAIL — script not yet defined

- [ ] **Step 3: Implement check script in `scripts/check.mjs`**

```javascript
// Approach: use child_process.execSync to run each npm script in sequence,
// capture output, stop on first non-zero exit code.
// Signature: export async function runCheck(steps = ['lint', 'test', 'build', 'format:check'])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/check.mjs scripts/check.test.mjs
git commit -m "feat: add check script for aggregate validation"
```

---

### Task 2: Add npm script and verify

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/check.mjs`
- Produces: `npm run check` command

- [ ] **Step 1: Add check script to package.json**

```json
"scripts": {
  "check": "node scripts/check.mjs"
}
```

- [ ] **Step 2: Run check locally to verify**

Run: `npm run check`
Expected: PASS (all 4 steps succeed)

- [ ] **Step 3: Verify CI runs it correctly**

Check `.github/workflows/*.yml` for existing CI commands — add `npm run check` if not present, or note it's already covered.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add npm run check script for CI gate"
```

---

## Self-Review Checklist

- [x] Spec coverage: Both tasks map to the single requirement
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: N/A (JS script)
- [x] Review Focus: Order (lint first), fail fast, CI parity, no file modification, clear output
- [x] Proportion: Plan is concise for a simple script

Plan complete and saved to `docs/superpowers/plans/2025-10-07-aggregate-validation.md`.