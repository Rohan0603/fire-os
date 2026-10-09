# Main.ts Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract self-contained shell sections from `src/main.ts` (319 lines) into separate, testable modules. Split only when a section changes independently OR would gain a useful test boundary.

**Architecture:** `main.ts` is the app entry point that orchestrates: module registration, tab navigation, error handling, and app initialization. Extract self-contained sections (error handling, tab navigation, theme) into dedicated modules under `src/app/` so each can be imported, unit-tested, and changed independently.

**Tech Stack:** TypeScript, existing Vitest setup, existing `src/app/` module structure.

**Spec:** docs/master.md (Main.ts Extraction), TODO.md line 23-25

## Global Constraints

- Version floor: TypeScript strict mode
- No new dependencies
- CLI interface preserved (same entry point behavior)
- Each extracted module must be independently testable
- Do NOT split just to reduce file length — only when a section has a clear boundary AND gains a testable unit

## Review Focus

- **Split boundary quality:** A split is wrong if the new module imports everything back from main.ts (circular dependency). Each module must be self-contained.
- **Testability:** Every extracted section must have a dedicated unit test that fails without the module.
- **Behavioral parity:** Extraction must not change app behavior — all tests (e2e + existing unit) must still pass.
- **Dependency direction:** Extracted modules must only depend on lower-level libs (`src/lib/`), never on `main.ts`.
- **No feature creep:** Do not restructure unrelated modules (auth, profile, dashboard) — only extract from main.ts.

## File Structure

- Create: `src/app/app-init.ts` (initApp, renderApp, lifecycle functions), `src/app/tab-navigation.ts` (setupTabNavigation), `src/app/error-handling.ts` (setupErrorHandling, handleError), `src/app/theme.ts` (setupTheme)
- Modify: `src/main.ts` (replaces inline functions with imports)
- Create: `src/app/app-init.test.ts`, `src/app/tab-navigation.test.ts`, `src/app/error-handling.test.ts`, `src/app/theme.test.ts`

## Task 1: Extract error-handling module

**Files:**
- Create: `src/app/error-handling.ts`
- Create: `src/app/error-handling.test.ts`
- Modify: `src/main.ts:52-53, 212-238`

**Interfaces:**
- Consumes: `handleError` usage at line 212, 220, 235; `setupErrorHandling` at line 203
- Produces: `export function setupErrorHandling(): void`, `export function handleError(error: unknown, message: string): void`

- [ ] **Step 1: Write failing tests for error handling**

```typescript
// src/app/error-handling.test.ts
import { setupErrorHandling, handleError } from './error-handling';

describe('error-handling', () => {
  it('sets up global error handlers', () => {
    setupErrorHandling();
    // Assert: ErrorEvent / unhandledrejection listeners attached
    expect(globalErrorEventHandler).toBeDefined();
  });

  it('handles unknown errors with a fallback message', () => {
    expect(() => handleError('string error', 'Custom message')).toThrow('Custom message');
  });

  it('logs and forwards Error objects', () => {
    const e = new Error('network down');
    handleError(e, 'App initialization failed - please reload the page');
    expect(mockLog).toHaveBeenCalledWith('App initialization failed - please reload the page', e);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/error-handling.test.ts`
Expected: FAIL — `error-handling` module not yet defined

- [ ] **Step 3: Implement error-handling in `src/app/error-handling.ts`**

```typescript
// Copy the exact error handling logic currently inline at main.ts:203-238.
// Signature: export function setupErrorHandling(): void,
//            export function handleError(error: unknown, message: string): void
// One line approach: wrap existing inline logic, attach window.onerror/window.onunhandledrejection
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/error-handling.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/error-handling.ts src/app/error-handling.test.ts src/main.ts
git commit -m "feat: extract error-handling into self-contained module"
```

---

### Task 2: Extract tab-navigation module

**Files:**
- Create: `src/app/tab-navigation.ts`
- Create: `src/app/tab-navigation.test.ts`
- Modify: `src/main.ts:9, 227`

**Interfaces:**
- Consumes: `FeatureRegistry` type, tab selector `[data-tab]`
- Produces: `export function setupTabNavigation(featureRegistry: FeatureRegistry, sessionController: SessionController): void`

- [ ] **Step 1: Write failing test for tab navigation**

```typescript
// src/app/tab-navigation.test.ts
import { setupTabNavigation } from './tab-navigation';

describe('tab-navigation', () => {
  it('activates the tab matching the URL path', () => {
    const registry = new MockFeatureRegistry();
    setupTabNavigation(registry, {} as SessionController);
    expect(registry.mountedTab).toBe('dashboard');
  });

  it('does not re-mount a tab that is already active', () => {
    const registry = new MockFeatureRegistry();
    setupTabNavigation(registry, {} as SessionController);
    setupTabNavigation(registry, {} as SessionController);
    expect(registry.mountCallCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/tab-navigation.test.ts`
Expected: FAIL — `tab-navigation` module not yet defined

- [ ] **Step 3: Implement tab-navigation in `src/app/tab-navigation.ts`**

```typescript
// Copy the tab-activation logic from main.ts:227.
// Signature: export function setupTabNavigation(featureRegistry: FeatureRegistry, sessionController: SessionController): void
// One line approach: parse current route into tab id, call registry.mount(tab) with guard for initialized tabs
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/tab-navigation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tab-navigation.ts src/app/tab-navigation.test.ts src/main.ts
git commit -m "feat: extract tab-navigation into self-contained module"
```

---

### Task 3: Extract theme module

**Files:**
- Create: `src/app/theme.ts`
- Create: `src/app/theme.test.ts`
- Modify: `src/main.ts:11, 230`

**Interfaces:**
- Consumes: `theme-toggle` DOM element, CSS class `dark`
- Produces: `export function setupTheme(): void`

- [ ] **Step 1: Write failing test for theme**

```typescript
// src/app/theme.test.ts
import { setupTheme } from './theme';

describe('theme', () => {
  it('toggles the dark class on the document root', () => {
    document.body.innerHTML = '<input type="checkbox" id="theme-toggle">';
    setupTheme();
    document.getElementById('theme-toggle')!.click();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/theme.test.ts`
Expected: FAIL — `theme` module not yet defined

- [ ] **Step 3: Implement theme in `src/app/theme.ts`**

```typescript
// Copy the theme toggle logic from main.ts:230.
// Signature: export function setupTheme(): void
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/theme.ts src/app/theme.test.ts src/main.ts
git commit -m "feat: extract theme management into self-contained module"
```

---

### Task 4: Extract core app-init module

**Files:**
- Create: `src/app/app-init.ts`
- Create: `src/app/app-init.test.ts`
- Modify: `src/main.ts:194-304`

**Interfaces:**
- Consumes: `appState`, `FeatureRegistry`, `SessionController`, `FeatureContext`
- Produces: `export function initApp(): void`

- [ ] **Step 1: Write failing test for app init**

```typescript
// src/app/app-init.test.ts
import { initApp } from './app-init';

describe('app-init', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><nav><div id="hamburger-btn"></div><div class="nav-tabs"></div></div>';
  });

  it('renders the app shell on DOMContentLoaded', () => {
    initApp();
    expect(document.getElementById('app')).toBeInTheDocument();
  });

  it('renders error message if initialization fails', () => {
    // mock failure path
    initApp();
    expect(document.querySelector('#app > div[style*="color: #d32f2f"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app-init.test.ts`
Expected: FAIL — `app-init` module not yet defined

- [ ] **Step 3: Implement app-init in `src/app/app-init.ts`**

```typescript
// Extract resetLiveAppState, initApp, renderApp from main.ts:194-240.
// Signature: export function resetLiveAppState(): void,
//            export function initApp(): void,
//            export function renderApp(): void
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app-init.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/app-init.ts src/app/app-init.test.ts src/main.ts
git commit -m "feat: extract app-init (initApp, renderApp) into self-contained module"
```

---

### Task 5: Update main.ts and verify behavioral parity

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: all extracted modules above
- Produces: minimal main.ts (~40 lines) that imports and orchestrates

- [ ] **Step 1: Refactor main.ts imports and call sites**

Replace inline function definitions with imports:
```typescript
import { setupErrorHandling, handleError } from './app/error-handling';
import { setupTabNavigation } from './app/tab-navigation';
import { setupTheme } from './app/theme';
import { initApp } from './app/app-init';
```

- [ ] **Step 2: Run all existing tests to verify parity**

Run: `npx vitest run`
Expected: PASS (no regressions in existing tests)

- [ ] **Step 3: Run e2e test suite to verify app behavior unchanged**

Run: `npx playwright test` (or project e2e command from package.json)
Expected: PASS

- [ ] **Step 4: Commit final refactor**

```bash
git add src/main.ts
git commit -m "refactor(main): consolidate to minimal orchestration layer"
```

---

## Self-Review Checklist

- [x] Spec coverage: All extraction targets (error-handling, tab-navigation, theme, app-init) identified from main.ts
- [x] Step scan: Each step has one action with checkable result
- [x] Type consistency: Function names match between main.ts and extracted modules
- [x] Review Focus: Circular dependency (checked via no-import-backward), testability (dedicated tests), behavioral parity (existing + e2e), dependency direction (lib < app), no feature creep (only main.ts touched)
- [x] Proportion: Plan length is reasonable for a refactor; no bodies written beyond signatures

Plan complete and saved to `docs/superpowers/plans/2025-10-07-main-ts-extraction.md`. Which execution approach would you prefer?

- **Subagent-driven** — Fresh subagent per task, fresh reviewer between tasks, whole-branch review at end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task in this session, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until end.

**For this plan I recommend subagent-driven**, because the task explicitly warns "do not split just to reduce file length" — a reviewer gate per extracted module catches circular dependencies and unnecessary splits early, and behavioral parity must be verified before the next module moves. Does the plan capture what you want, and which approach should we use?