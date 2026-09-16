## architect t1 — 2026-09-16
**Decision**: Add `FeatureContext` and `FeatureRegistry`; preserve `appState` and persistence behind adapters during migration. Replace feature-to-feature imports with core ports, widgets, or typed events.
**Rationale**: Establishes explicit ownership and stable extension seams without forcing a product rewrite.
