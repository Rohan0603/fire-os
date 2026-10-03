# Assistant (OpenRouter) Integration

Portfolio assistant backed by OpenRouter through a server-side proxy, with reads enabled by default and a guarded write flow (propose → review → confirm → audit → undo).

## Architecture

```
Browser  →  POST /api/assistant/query  →  Express proxy  →  OpenRouter
{question, contextSummary, sendExact?}    policy + prompt      OPENROUTER_API_KEY (server only)
                                            + rate limit
                 ←  { reply, proposedChanges? }  ←
```

- **Dev:** Vite proxy forwards `/api/assistant` to `http://127.0.0.1:3001`.
- **Prod:** Firebase Hosting serves the frontend; the configured `VITE_ASSISTANT_API_URL` points to the Cloudflare Worker proxy (same response contract).
- The browser never holds `OPENROUTER_API_KEY`; no `VITE_OPENROUTER_*` keys exist.

### Zero-cost production path

Deep Chat is bundled as a vanilla web component. Its handler keeps the existing request contract,
while `VITE_ASSISTANT_API_URL` can point to a Cloudflare Worker such as
`https://fire-os-assistant.<account>.workers.dev`. The Worker handles
`POST /api/assistant/query`, keeps `OPENROUTER_API_KEY` in a Worker Secret, and returns the same
`{ reply, proposedChanges? }` response. Set the Firebase repository variable
`VITE_ASSISTANT_API_URL` before building.

Provision and deploy the Worker:

```sh
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY --config worker/wrangler.toml
npm run deploy:worker
```

Set GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the optional
`.github/workflows/deploy-worker.yml` workflow. Never put the OpenRouter key in `VITE_*` variables.

## Consent model

Stored per scope in `localStorage` under `{scope}:fireOS:assistant:consent`
(scope = `anonymous` or `user:{uid}`):

| Setting | Effect |
|------|--------|
| `allowWrites` | Enables proposal cards (diff + Confirm/Reject); off by default |

Portfolio reads and exact balance context are enabled by default. Existing stored
`suggestChanges` values are migrated to `allowWrites`.

## Sanitization rules (`src/lib/assistant/sanitize.ts`)

- Identity redacted: real name → `User`; no DOB, email, uid, scheme codes, fund names, ISINs, expense rows, NAV cache.
- Balances bucketed: `<1L`, `1–5L`, `5–25L`, `25L–1Cr`, `1Cr+`.
- Valuation reuses `totalNetWorth` (dashboard KPI) so context matches what the user sees.
- `exact` block is included for the assistant's read-only portfolio analysis.
- `exact.holdings.sip` is current SIP portfolio value; `exact.monthlySipContribution` is the monthly SIP amount.

## Guarded write flow (PR2)

A reply may include `proposedChanges`. The client never applies them automatically:

1. **Validate** — `applyAssistantProposal` (`src/lib/assistant/proposal.ts`) rejects runtime
   keys (`currentUser`, `_lastSavedAt`, `_syncMetadata`), underscore-prefixed keys, keys
   outside `PERSISTED_STATE_KEYS`, >25 touched keys, and any candidate that fails
   `isPersistedPortfolioData`.
2. **Review** — the proposal card shows a field-level diff (`path: before → after`).
   Nothing is written until the user clicks **Confirm changes**.
3. **Classify** — `classifyProposal` flags destructive / high-value changes
   (bulk removals from holding sections, numeric deltas ≥ ₹10L) as requiring
   re-authentication:
   - Google users → re-auth popup (`reauthenticateWithPopup`)
   - Password users → password re-entry (`reauthenticateWithCredential`)
   - Guests → typed `CONFIRM` phrase (local-only change anyway)
4. **Snapshot + apply + persist** — pre-change snapshot is recorded, the proposal is
   applied to state, then `persistPortfolioState` writes local (and cloud when the
   user opts into "Save to cloud after confirm" — authenticated only).
5. **Audit** — every decision (confirmed / rejected / validation-failed /
   save-failed / reauth-required) is appended to a 50-entry local ring buffer at
   `{scope}:fireOS:assistant:audit` with the question, diff, and timestamp.
6. **Undo** — "Undo last assistant change" restores the pre-change snapshot via
   `undoLastSavedPortfolioChange` and re-persists.

The server enforces the same key allowlist (`PERSISTED_ALLOWLIST` in
`server/lib/policy.js`, mirroring `PERSISTED_STATE_KEYS`) when extracting
`proposedChanges` from a reply — unknown keys are stripped before the client
ever sees them.

## Server contract

`POST /api/assistant/query`

- Body: `{ question: string, messages: Array<{role: 'user'|'assistant', content: string}>, contextSummary: object|string, sendExact?: boolean }`
- The browser keeps up to 12 conversation messages in memory and sends them on each turn; they are cleared when portfolio scope changes and are not persisted to local storage.
- The server validates message roles, order, size, and that the final user message matches `question`. It adds the trusted system prompt and latest context itself; clients cannot submit system messages.
- Responses: `{ reply, proposedChanges? }` | `{ error }`
- Policy rejects destructive ("delete all", "wipe"…) and PII-disclosure prompts with 403.
- Rate limit: `ASSISTANT_RATE_LIMIT` (default 20) per 15 min.
- Logs: metadata only (latency, model, question length) — never portfolio bodies.

### Environment (server only)

```
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions  # optional
OPENROUTER_API_KEY=...        # local: repo-root .env — cloud: Worker Secret (see below)
OPENROUTER_FALLBACK_MODELS=qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free  # optional, comma-separated; at most 2 fallbacks
OPENROUTER_HTTP_REFERER=https://fire-os-dd6d6.web.app  # optional; attribution only
ASSISTANT_RATE_LIMIT=20                      # optional
PORT=3001                                    # optional (local only)
```

`.env` loading: the server reads only the repository-root `.env`, regardless of the
working directory you start it from. Copy `.env.example` to `.env`; never commit `.env`.

### Model choice

- The primary route is OpenRouter's `openrouter/free` Free Models Router. It chooses
  an available free model dynamically; the actual model is returned by OpenRouter.
- If routing fails, the `models` list uses up to two free fallbacks in order. OpenRouter
  allows at most three models total in this list (including `openrouter/free`). Override
  the fallbacks with the comma-separated `OPENROUTER_FALLBACK_MODELS` setting.
- Free model availability and rate limits change. The router may choose a different
  model from one request to the next; see https://openrouter.ai/models?pricing=free.
- The proxy surfaces upstream error details in the chat UI and logs only provider
  metadata (status, model, latency, and a truncated error message), never prompts.

### Assistant instructions and chat state

- Instructions live in `server/prompts/assistant.md`. The server loads this file once
  at startup, then includes it in every OpenRouter request.
- OpenRouter chat completions are stateless. Sending instructions only on the first
  request does not retain them for later messages; each request must include them.
- The UI sends up to 12 recent user/assistant messages for continuity. This history is
  memory-only, resets on reload, consent revocation, or portfolio-scope change, and is
  not written to local storage. Current sanitized context is refreshed and sent each turn.
- OpenRouter's `HTTP-Referer` and `X-OpenRouter-Title` headers are sent for app
  attribution. OpenRouter documents these as attribution headers, not model-access
  requirements; the referer can be overridden with `OPENROUTER_HTTP_REFERER`.

### Common errors

| Status / message | Cause | Fix |
|---|---|---|
| `401` | missing or invalid OpenRouter API key | set `OPENROUTER_API_KEY` in the server environment |
| `402` / `403` | provider access, quota, or account limit | check the OpenRouter key/account and model availability |
| `404` | unavailable/unknown model ID | check current Free Router/fallback model availability |
| `429` | rate limited | retry later or select another available provider/model |
| `500 OpenRouter API key not configured` | `.env` not loaded / key missing | put key in `server/.env` or root `.env` |


## Optional Firebase Functions deployment

- `server/index.js` wraps the Express app as the `assistantProxy` Cloud Function.
- This path requires Firebase Blaze billing; use the Cloudflare Worker path above for zero-cost hosting.
  (2nd gen, `us-central1`, 256MiB, 60s timeout, CORS disabled for same-origin use).
- `firebase.json` rewrites `/api/assistant/**` → `assistantProxy` before the SPA
  catch-all; the function codebase packages `server/` with `.env*` excluded.
- The API key is a defined secret, not an env file:

  ```sh
  firebase functions:secrets:set OPENROUTER_API_KEY   # once, per project
  firebase deploy --only functions:assistantProxy,hosting
  ```

- `.github/workflows/deploy.yml` deploys `hosting,functions,firestore:rules,firestore:indexes`
  on push to `main` after lint/format/tests/e2e/rules checks (server tests included).

## Source layout

| Path | Purpose |
|------|---------|
| `src/lib/assistant/sanitize.ts` | Pure sanitization + range bucketing |
| `src/lib/assistant/contextBuilder.ts` | Context entry point |
| `src/lib/assistant/consent.ts` | Write-access consent read/write/toggle |
| `src/lib/assistant/client.ts` | `queryAssistant()` fetch wrapper (same-origin or Worker URL) |
| `src/modules/assistant/index.ts` | Deep Chat handler plus guarded proposal attachments |
| `src/lib/assistant/proposal.ts` | Validation, diff, classification, apply, `stripRuntime` |
| `src/lib/assistant/audit.ts` | Local audit ring buffer + `hasConfirmedAssistantAction` |
| `src/lib/assistant/reauth.ts` | Google popup / password re-auth helpers |
| `src/modules/assistant/` | Feature module: chat workspace, write-access control, proposal card, audit UI |
| `server/index.js` | Firebase Cloud Function entry (`assistantProxy`) |
| `server/server.js` | Express proxy endpoint (local dev + function runtime) |
| `server/prompts/assistant.md` | Maintainable system instructions loaded by the server |
| `server/lib/policy.js` | Request validation, prompt policy, proposal allowlist |
| `server/lib/prompt.js` | System prompt + message construction |
| `worker/src/index.ts` | Cloudflare Worker equivalent of assistant proxy |
| `e2e/assistant.spec.ts` | Browser tests: consent gating, proposal flows, undo |

## Testing

- `npm test` — unit tests (sanitization, context, consent, client, proposal, audit)
- `npm run test:server` — policy + prompt tests (includes proposal allowlist)
- `npm run test:metadata` — prerendered route metadata (includes `/assistant`)
- `npm run test:e2e` — Playwright (`e2e/assistant.spec.ts` mocks `/api/assistant/query`)
- `npm run test:rules:emulator` — Firestore rules against the emulator (CI runs it)

## Security notes

- Firestore Rules remain authoritative for cloud writes; client validation is supplementary.
- Assistant consent/audit data stays in `localStorage` (never synced) unless a future opt-in lands.
- No API key, no OpenRouter endpoint, and no raw portfolio dump appears in `dist/`.
- Destructive/high-value changes cannot bypass re-auth; rejects and failed attempts are audited.
