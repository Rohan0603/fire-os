# Feature Context Ports

Use a default context adapter around the existing singleton while migrating feature modules incrementally.

## What Happened

For fire-os/t2, `FeatureContext` carries live state plus `PortfolioRepository`; its default factory references the existing `appState`, avoiding duplicate state. The repository wraps current storage functions instead of moving persistence during the first extraction. Insurance now accepts the context while keeping legacy entry points.

## Takeaway

Introduce ports before physical moves. Migrate one self-contained feature, preserve public exports, and prove build/test compatibility before moving the next feature.

## History

- 2026-09-16 (fire-os/t2): initial