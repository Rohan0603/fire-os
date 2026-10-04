# CSV Parsing and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support standards-compliant portfolio CSV export and safe, preview-based portfolio import using one parser/serializer library.

**Architecture:** Use PapaParse to parse and serialize CSV. Keep the existing export schema and formula escaping; normalize parsed rows into an import candidate, validate with the shared persisted-state schema, and persist only after preview and explicit replace/merge confirmation.

**Tech Stack:** TypeScript, PapaParse, Vitest.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially CSV import/export.

## Global Constraints

- Preserve column order, row order, CRLF line endings, quoting, empty-value behavior, and spreadsheet formula protection.
- Add CSV import only through preview and explicit confirmation; do not alter JSON/CAS workflows.
- Add only PapaParse and its type support if the package does not provide compatible types.

## Review Focus

- Embedded commas, quotes, CR/LF, and multiline cells must round-trip as valid CSV; pin in `src/lib/portfolioCsv.test.ts`.
- Strings beginning with whitespace then `=`, `+`, `@`, or `-` must remain escaped; pin in `src/lib/portfolioCsv.test.ts`.
- Negative numeric values must remain numeric rather than formula-prefixed text; pin in `src/lib/portfolioCsv.test.ts`.
- Missing NAV remains an empty value and headers remain exact; pin in `src/lib/portfolioCsv.test.ts`.
- Unicode/Indian names must remain intact; pin in `src/lib/portfolioCsv.test.ts`.
- Duplicate/unknown categories, malformed numbers, and formula-prefixed text must be surfaced or rejected; pin in import parser tests.
- Cancel and invalid preview must not mutate state; pin in import workflow tests.
- Merge and replace must use explicit user choices and handle empty candidate data safely; pin in import workflow tests.

---

### Task 1: PapaParse export migration

**Files:**
- Modify: `package.json`, lockfile
- Modify: `src/lib/portfolioCsv.ts`
- Test: `src/lib/portfolioCsv.test.ts`

**Interfaces:**
- Preserve `buildPortfolioCsv(state: FireOSState): string`.

- [ ] Add test cases for commas, embedded quotes, multiline strings, formula-like text, negative numbers, and exact header/line endings.
- [ ] Run `npm test -- src/lib/portfolioCsv.test.ts`; expected: migration compatibility cases fail where current serializer differs from expected standards.
- [ ] Add PapaParse and replace cell joining with `Papa.unparse`, configuring CRLF and escaping formula-like string cells before serialization.
- [ ] Run `npm test -- src/lib/portfolioCsv.test.ts` and `npm run build`; expected: pass.

**Completion note:** Update `docs/master.md` and `docs/ui.md` to document PapaParse serialization and formula protection.

### Task 2: CSV import preview and apply

**Files:**
- Create: `src/modules/profile/csv-import.ts`
- Modify: `src/modules/profile/index.ts`
- Test: `src/modules/profile/csv-import.test.ts`

**Interfaces:**
- Consumes: Task 1 `buildPortfolioCsv`, shared persisted schema, and active `PortfolioRepository`.
- Produces: `parsePortfolioCsv(text: string): CsvImportPreview`, where `CsvImportPreview` has `candidate: Partial<FireOSState>`, `validRows: number`, and `issues: Array<{ row: number; field: string; message: string }>`.

- [ ] Test recognized categories, duplicate rows, invalid numbers, quoted multiline names, unknown categories, and formula-like text.
- [ ] Run focused import tests; expected: parser/normalization cases fail before implementation.
- [ ] Add import file flow with parsed preview, row-level issues, explicit replace/merge choice, cancel path, and confirmation before repository persistence.
- [ ] Run import/export tests, portfolio repository tests, and `npm run build`; expected: pass.

**Expanded completion note:** Correct the export-only documentation in `docs/ui.md` and `docs/master.md` to describe both CSV directions.
