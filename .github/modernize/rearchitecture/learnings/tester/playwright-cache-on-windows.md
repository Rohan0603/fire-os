# Playwright Cache On Windows

Windows Playwright `spawn UNKNOWN` can mean the managed Chromium executable is missing, not that the app or selectors are broken.

## What Happened

For fire-os task t3.1, Playwright 1.63 resolved Chromium revision 1243, but its cached Chromium/headless-shell executable was absent. A direct Playwright launch using installed system Chrome succeeded, isolating the failure to the Playwright browser cache.

## Takeaway

Check the resolved Playwright cache and launch a known system browser before changing tests. When managed Chromium still returns `spawn UNKNOWN`, an opt-in `channel: 'chrome'` branch in the existing Playwright config provides a reproducible Windows fallback without changing application code. Keep managed Chromium as the default and document the credential/configuration gap separately.

Playwright does not automatically load Vite's repository `.env`; the existing config may safely parse only the E2E credential keys while preserving explicit process overrides. This enables authenticated coverage from a clean shell without exposing credential values.

## History

- 2026-09-16 (fire-os/t3.1): initial
- 2026-09-16 (fire-os/t3.1): verified `PLAYWRIGHT_CHANNEL=chrome` fallback in the real E2E runner; managed Chromium remains the default and remains blocked.
- 2026-09-16 (fire-os/t3.1): made system Chrome the Windows default in the existing Playwright config; `PLAYWRIGHT_CHANNEL=chromium` remains the explicit managed-browser diagnostic override.
- 2026-09-17 (fire-os/t3.1): loaded only `E2E_EMAIL` and `E2E_PASSWORD` from `.env` in Playwright config; clean-shell authenticated E2E passed while managed Chromium remained blocked.
