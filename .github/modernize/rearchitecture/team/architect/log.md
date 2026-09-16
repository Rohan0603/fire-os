## [t1] Mapped feature ownership and extension seams
- Codebase/domain discoveries: `main.ts` is both composition root and business-job coordinator; seven feature entry points import the singleton state; dashboard/profile/plan/ESOP contain the highest-value sibling dependencies.
- Wrong assumptions and corrections: feature folders are already present, but folder boundaries alone do not isolate features because imports cross dashboard, plan, calculators, API, integrations, and trackers.
- Debugging dead-ends and what actually worked: broad PowerShell import enumeration timed out; focused workspace searches produced sufficient path:line evidence.
- Techniques/patterns worth reusing: preserve current `appState` and `persistPortfolioState` behind injected context/repository adapters before physical file moves; use insurance as the first isolated feature pilot.
- Learnings consumed: [(none)]