# Feature Context and Registry

Use an injected feature context and registry to isolate new features while preserving the existing singleton state and persistence contracts during migration.

## What Happened

For fire-os task t1, source inspection found feature-oriented folders but shared singleton access in seven feature entry points and several sibling feature imports. The design chose `FeatureModule` + `FeatureContext` + `FeatureRegistry` as the first boundary, with compatibility adapters over `appState` and `persistPortfolioState`.

## Takeaway

Extract composition and dependency direction before moving files: the shell owns registration/lifecycle, features own their containers, core owns pure calculations/events/ports, and infrastructure owns Firebase/storage/market-data implementations. Keep the existing state object as the adapter source until tests prove each feature no longer needs it.

## History

- 2026-09-16 (fire-os/t1): initial