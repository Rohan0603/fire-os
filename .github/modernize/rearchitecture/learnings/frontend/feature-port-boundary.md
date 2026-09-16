# Feature Port Boundary

Feature modules consume shared calculations, UI, widgets, and market data through `FeatureContext.ports`.

## What Happened

For fire-os/t4.1, remaining feature entry points were migrated from direct singleton, persistence, and sibling implementation imports. `src/core/feature-ports.ts` centralizes compatibility adapters while preserving existing public module exports and behavior. The context also exposes a small typed event bus for future refresh/change notifications.

## Takeaway

Keep legacy implementation paths behind one core adapter during incremental migration. Feature modules should receive context, use `context.portfolio.save(...)`, and call typed ports instead of importing sibling modules. Preserve optional context parameters on public entry points until all composition callers are migrated.

## History

- 2026-09-16 (fire-os/t4.1): initial
