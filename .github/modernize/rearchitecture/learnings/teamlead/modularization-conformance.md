# Modularization Conformance

A compatibility-first registry can pass behavior tests while existing features still violate the intended dependency direction.

## What Happened

In fire-os task t4, `FeatureRegistry`, `FeatureContext`, and `PortfolioRepository` passed focused tests and the production build. A source scan still found direct `appState`, `persistPortfolioState`, and sibling feature imports in most legacy modules. System Chrome passed authenticated E2E after `.env` was loaded into the process; managed Chromium remained blocked by Windows `spawn UNKNOWN`.

## Takeaway

Score registry adoption and full feature-boundary migration separately. Keep deferred singleton/sibling edges visible as a failed completeness gate until each is migrated behind a core port, pure calculation, widget contract, or typed event.

## History

- 2026-09-16 (fire-os/t4): initial
- 2026-09-16 (fire-os/t4): after t4.1, source-boundary conformance passed; default managed Chromium remained an independent HIGH environment blocker, so the final gate stayed FAIL.
- 2026-09-16 (fire-os/t4): canonical Windows E2E passed through configured system Chrome; managed Chromium is an explicit diagnostic override, so the conformance gate can PASS while retaining the diagnostic note.
