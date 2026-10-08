# FIRE OS Documentation

Entry point for operating and changing FIRE OS. Keep durable technical and
product guidance here. Put release notes in [CHANGELOG.md](CHANGELOG.md).

## Backlog

- [TODO and brainstorm](../TODO.md)

## Technical references

- [Master architecture and system map](master.md)
- [AI and Assistant flow](ai.md)
- [Backend, storage, and API contracts](backend.md)
- [UI, feature behavior, and calculations](ui.md)

## Product

FIRE OS is a vanilla TypeScript/Vite dashboard for Indian FIRE planning. It
tracks portfolios, SIPs, fixed deposits, EPF, ESOPs, insurance, liabilities,
goals, market signals, and planning calculations. Guest mode is local-only;
authenticated users can sync an owner-scoped portfolio through Firebase.

Live app: <https://fire-os-dd6d6.web.app>

## Setup

Prerequisites: Node.js, npm, and Firebase CLI access for deployment.

```bash
npm ci
npm run dev
```

The development script starts the Vite UI and local Assistant proxy. The UI
usually runs at `http://localhost:5173`.

For Firebase features, create a root `.env` with the public web configuration:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_ASSISTANT_API_URL=https://fire-os-assistant.fire-os.workers.dev
```

Never put service-account credentials or OpenRouter secrets in `VITE_*`
variables. `.env` is local and must not be committed.

## Runtime architecture

`src/main.ts` bootstraps Firebase, authentication, persistence, the feature
registry, and navigation. Feature modules own their DOM and receive shared
state through `FeatureContext`.

```text
src/main.ts
  -> FeatureRegistry -> feature modules
  -> AuthCoordinator -> Firebase Auth
  -> storage + SyncCoordinator -> localStorage / Firestore
  -> Assistant client -> Cloudflare Worker -> OpenRouter
```

Important boundaries:

- `src/types/state.ts` defines persisted portfolio data.
- `src/lib/storage.ts` selects anonymous or UID-scoped local storage.
- `src/lib/syncCoordinator.ts` queues authenticated Firestore writes.
- `src/lib/authCoordinator.ts` rejects stale auth-session callbacks.
- `src/modules/api/firestore.ts` owns the portfolio document contract.
- `src/modules/assistant/` owns chat UI and guarded write proposals.
- `shared/assistant-policy.js` is the request validation and proposal-filtering
  contract used by the Assistant Worker.

Firestore stores the canonical portfolio at:

```text
/users/{uid}/portfolio/state
```

Sign-out tears down listeners, flushes pending writes within a bounded timeout,
clears the active scope, and resets in-memory state. Guest data remains under a
separate anonymous scope and never syncs to Firestore.

## Authentication

Email/password and Google popup authentication are enabled in Firebase Auth.
Production authorized domains must include `fire-os-dd6d6.web.app` and
`fire-os-dd6d6.firebaseapp.com`.

Firebase Hosting supplies the security headers in `firebase.json`. Google auth
requires `frame-src` entries for Firebase/Google, Google connection origins,
and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. The Assistant
Worker origin must remain in `connect-src`.

After changing Hosting headers, redeploy Hosting and use a hard refresh when
testing because document responses may be cached for up to one hour.

## Assistant

The Assistant sends sanitized portfolio context to a server-side proxy. The
browser never receives `OPENROUTER_API_KEY`.

```text
Browser -> POST /api/assistant/query -> Cloudflare Worker -> OpenRouter
```

The production frontend uses `VITE_ASSISTANT_API_URL`. The Worker is configured
by `worker/wrangler.toml` and requires the `OPENROUTER_API_KEY` secret:

```bash
npx wrangler secret put OPENROUTER_API_KEY --config worker/wrangler.toml
npm run deploy:worker
npm run build
npx firebase-tools deploy --only hosting
```

The production Worker validates message shape, rejects destructive and
PII-disclosure requests, strips unapproved proposal keys, and applies a
Cloudflare rate limit of 20 requests per minute per client IP. Writes follow
propose -> review -> confirm -> audit -> undo. OpenRouter failures commonly
appear as `401` (key), `402/403` (quota/provider), `404` (model), or `429`
(rate limit).

## External APIs

| Area | Service | Notes |
| --- | --- | --- |
| Mutual fund NAV | `api.mfapi.in` | Cached for four hours; scheme codes live in `src/lib/config.ts`. |
| Nifty and FX | Yahoo Finance via `corsproxy.io` | Cached; failures retain last known values where possible. |
| Portfolio sync | Firebase Auth + Firestore | Owner-scoped rules and offline browser cache. |
| Assistant | Cloudflare Worker + OpenRouter | Secret stays server-side. |

API clients and fallback behavior live under `src/modules/api/` and
`src/lib/assistant/`.

## Portfolio storage sizing

The portfolio envelope remains one Firestore state document; mutual-fund
entries are written as individual `holdings` documents. Development builds log
payload byte counts and holding counts without logging portfolio contents. A
state document above 750 KB raises a warning, leaving headroom below Firestore's
1 MiB document limit. Local saves use the same 750 KB ceiling and drop the
expendable `marketHistory` cache first to stay under it. Further section
splitting should be considered only when
observed document size or write contention justifies its added merge and
migration complexity.

## Validation (quick reference)

| Goal | Command |
|------|---------|
| Fast local gate (no emulator/browser) | `npm run check` |
| Lint + format + build + unit tests | `npm run lint && npm run format:check && npm run build && npm test` |
| Run Playwright e2e | `npm run test:e2e` |
| Run worker unit tests | `npm run test:worker` |
| TypeScript check only | `npm run build` (tsc --noEmit) |
| Verify route metadata | `npm run test:metadata` |

`npm run check` runs the fast local gate in CI order: `build`, `lint`, `format:check`,
unit tests, Worker tests, then route metadata. It omits the checks that need a
server, emulator, or browser — run those separately.

The Playwright suite is the component-test harness for the React layer; there is
no jsdom or Testing Library. It covers route resolution and the
`#<id>.active` selector contract (`routing.spec.ts`), the sidebar, theme and
focus behaviour (`shell.spec.ts`), per-route metadata and guest-mode boot at a
deep URL (`meta-and-guards.spec.ts`), and the OKLCH tokens resolving in both
colour schemes (`theme.spec.ts`), alongside the original `portfolio.spec.ts` and
`assistant.spec.ts`.

Note: hosting is still Firebase Hosting. The planned move to Cloudflare Workers
has not happened yet; do not assume a Workers deploy path exists.

For local Firebase rules, start the emulator before running:

```bash
npm run test:rules:emulator
```

For deployed HTTP checks, start a preview server and run the project's HTTP
verification script, or set `BASE_URL` to the deployed site as documented in
the script. A local Vite preview does not apply Firebase Hosting headers.

## Agent-contributing guide

### Starting work

1. Check existing AO sessions: `ao session ls --project fire-os`.
2. If no suitable active worker exists, spawn one:
   `ao spawn --project fire-os --name "<label>" --prompt "<clear task description>"`
   — add `--agent <name>` or `--model <id>` as needed.
3. Never claim a PR into the orchestrator session. If a PR needs continuation, assign or spawn a worker.

### Common checks before committing

- `npm run lint && npm run format:check && npm run build` — syntax, style, compile
- `npm test` — unit tests (vitest), excluding firestore.rules
- `npm run test:e2e` — Playwright browser specs; any selector change must preserve the `id` and `data-testid` attributes listed in `docs/master.md` §8

### Publishing scope

- Freeform work: publish only when the user requests it or explicitly configured project rules authorize it.
- Review-only: authorizes submitting the explicitly requested provider review, but forbids code changes, other PR/MR mutations, and AO ownership changes (claiming/attaching the PR/MR).
- Local-only / do-not-publish: complete the permitted local work and report the result without publishing.
- These restrictions take precedence over workflow defaults, including issue-task prompts and CI/review follow-up instructions.

### PR / MR workflow

1. Make small, focused commits with Conventional Commit messages (`feat:`, `fix:`, `refactor:`).
2. Before opening a PR: ensure lint + format + build pass and unit tests pass.
3. For e2e/Playwright changes: run `npm run test:e2e` on the branch first; selector contracts (`id`, `data-testid`) must not change.
4. Push to a topic branch. The orchestrator will open the PR, or use the GitHub CLI if available.
5. If a PR has no owning AO session, run `ao review trigger <session-id>` to start the native reviewer, then `ao review ls <session-id>` to inspect verdicts.

## Deployment

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Firebase Functions are not used. The Spark plan does not include Functions,
and the production Assistant runs on the Cloudflare Worker.

## Troubleshooting

- **Google auth blocked:** hard refresh, confirm Hosting CSP and COOP headers,
  then check Firebase authorized domains.
- **Assistant cannot connect:** inspect the browser CSP, confirm the live
  bundle contains `VITE_ASSISTANT_API_URL`, and probe the Worker endpoint.
- **Assistant returns provider errors:** verify the Worker secret and current
  OpenRouter free-model availability.
- **Data appears missing:** verify the signed-in UID and active local-storage
  scope before changing Firestore data.
- **Market data fails:** retain cached values or enter a manual value; public
  providers can rate-limit requests.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrap and session lifecycle |
| `src/lib/` | State, persistence, auth, calculations, Assistant primitives |
| `src/core/` | Feature context/ports, reactive status stores, repository seam |
| `src/modules/` | UI and domain features |
| `src/types/` | Shared TypeScript contracts |
| `worker/` | Production Cloudflare Assistant Worker |
| `shared/` | Assistant request and policy contract shared across runtimes |
| `scripts/`, `.github/workflows/` | Build/prerender, route checks, local dev, CI/deploy |
| `e2e/` | Playwright browser workflows |
| `firestore.rules`, `firestore.indexes.json` | Cloud data boundary |
| `firebase.json` | Hosting, rewrites, and security headers |
| `docs/` | These references plus `docs/superpowers/` design plans and specs |

For release history, see [CHANGELOG.md](CHANGELOG.md).
