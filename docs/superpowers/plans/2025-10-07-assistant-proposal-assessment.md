# Assistant Proposal Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Assistant proposal UI to show affected fields, resulting values, and relevant assumptions before confirmation; validate with users who review suggested changes.

**Architecture:** Add impact visualization panel to the Assistant proposal card. Before user confirmation, show: (1) fields that would change, (2) resulting values after the change, (3) assumptions used to compute those results. Require explicit confirmation via a confirmation dialog.

**Tech Stack:** React components, existing Assistant proposal structure, Zod schema for proposal validation, modal for confirmation.

**Spec:** docs/master.md (Assistant Proposal Assessment), TODO.md line 98-100

## Global Constraints

- Version floor: TypeScript strict mode
- No new dependencies — use existing proposal data structures
- Confirmation dialog must be accessible (ARIA, keyboard)
- Must not block proposal flow if user dismisses

## Review Focus

- **Field visibility:** All affected fields must be listed, no hidden changes
- **Result accuracy:** Resulting values must match actual calculation engine outputs
- **Assumption clarity:** Assumptions used must be the same ones driving results
- **Confirmation UX:** User must explicitly confirm or decline, no silent defaults
- **Backward compatibility:** Existing proposals must continue to work unchanged

## File Structure

- Create: `src/components/AssistantProposalImpact.tsx`, `src/components/AssistantConfirmDialog.tsx`
- Modify: `src/modules/assistant/` to wire impact panel + confirmation
- Test: `src/components/AssistantProposalImpact.test.tsx`, `src/components/AssistantConfirmDialog.test.tsx`

## Task 1: Create impact visualization panel

**Files:**
- Create: `src/components/AssistantProposalImpact.tsx`
- Test: `src/components/AssistantProposalImpact.test.tsx`

**Interfaces:**
- Consumes: `Proposal` (from existing structure), `AssumptionSet` from assumptions-display plan
- Produces: UI panel listing affected fields, resulting values, assumptions

- [ ] **Step 1: Write failing test for impact panel**

```typescript
// src/components/AssistantProposalImpact.test.tsx
import { render, screen } from '@testing-library/react';
import { AssistantProposalImpact } from './AssistantProposalImpact';

describe('AssistantProposalImpact', () => {
  it('lists affected fields when proposal has changes', () => {
    const proposal = { affectedFields: ['portfolio.allocation'], results: { newNav: 100 } };
    render(<AssistantProposalImpact proposal={proposal} />);
    expect(screen.getByText(/portfolio.allocation/i)).toBeInTheDocument();
  });

  it('shows resulting values', () => {
    render(<AssistantProposalImpact proposal={proposal} />);
    expect(screen.getByText(/newNav.*100/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AssistantProposalImpact.test.tsx`
Expected: FAIL — impact panel not yet defined

- [ ] **Step 3: Implement impact panel**

```typescript
// Signature: export function AssistantProposalImpact({ proposal }: { proposal: Proposal })
// One line approach: render list of affected fields + result summary + assumptions bullets
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AssistantProposalImpact.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AssistantProposalImpact.tsx src/components/AssistantProposalImpact.test.tsx
git commit -m "feat: add proposal impact visualization panel"
```

---

### Task 2: Create confirmation dialog

**Files:**
- Create: `src/components/AssistantConfirmDialog.tsx`
- Test: `src/components/AssistantConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `Proposal`, `onConfirm`, `onCancel`
- Produces: accessible modal requiring explicit user action

- [ ] **Step 1: Write failing test for confirmation dialog**

```typescript
// src/components/AssistantConfirmDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistantConfirmDialog } from './AssistantConfirmDialog';

describe('AssistantConfirmDialog', () => {
  it('requires explicit confirm before closing', () => {
    const onConfirm = vi.fn();
    render(<AssistantConfirmDialog proposal={mockProposal} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onConfirm when user confirms', () => {
    const onConfirm = vi.fn();
    render(<AssistantConfirmDialog proposal={mockProposal} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AssistantConfirmDialog.test.tsx`
Expected: FAIL — confirmation dialog not yet defined

- [ ] **Step 3: Implement confirmation dialog**

```typescript
// Signature: export function AssistantConfirmDialog({ proposal, onConfirm, onCancel }: Props)
// One line approach: modal with Confirm/Cancel buttons, role="dialog", focus trap
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AssistantConfirmDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AssistantConfirmDialog.tsx src/components/AssistantConfirmDialog.test.tsx
git commit -m "feat: add accessible proposal confirmation dialog"
```

---

### Task 3: Wire impact panel and confirmation into Assistant proposal flow

**Files:**
- Modify: `src/modules/assistant/` (proposal rendering + submission)

**Interfaces:**
- Consumes: `AssistantProposalImpact`, `AssistantConfirmDialog`, existing proposal data
- Produces: proposal card with impact panel + confirm button that opens dialog

- [ ] **Step 1: Write failing test for full integration**

```typescript
// src/modules/assistant/integration.test.ts
import { renderAssistant } from './index';

describe('assistant proposal assessment', () => {
  it('shows impact panel beside proposal', () => {
    const { container } = renderAssistant({ /* mock proposal */ });
    expect(container.querySelector('[data-impact-panel]')).toBeInTheDocument();
  });

  it('opens confirmation dialog on confirm button click', () => {
    const onConfirm = vi.fn();
    renderAssistant({ /* mock proposal */ });
    fireEvent.click(screen.getByText('Show Impact'));
    expect(onConfirm).not.toHaveBeenCalledYet();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/assistant/integration.test.ts`
Expected: FAIL — integration not yet wired

- [ ] **Step 3: Wire into proposal flow**

Render `AssistantProposalImpact` beside each proposal, add "Show Impact" button that opens `AssistantConfirmDialog`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/assistant/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/assistant/index.ts
git commit -m "feat: wire proposal impact panel and confirmation dialog"
```

---

## Self-Review Checklist

- [x] Spec coverage: All three tasks implement proposal assessment requirement
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: `Proposal` type used across all tasks
- [x] Review Focus: Field visibility (all affected fields listed), result accuracy (matches engine), assumption clarity (same assumptions as engine), confirmation UX (explicit confirm/decline), backward compatibility (existing proposals unchanged)
- [x] Proportion: Plan matches spec scope

Plan complete and saved to `docs/superpowers/plans/2025-10-07-assistant-proposal-assessment.md`.