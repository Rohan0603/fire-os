# FIRE OS — Backend, Persistence, and API Reference

## Deployed components

FIRE OS has no general application API server. Static UI is hosted by Firebase
Hosting, user portfolio storage/auth use Firebase Auth + Cloud Firestore, and
the Assistant runs through a Cloudflare Worker proxy to OpenRouter. Public
market APIs are called from the browser through their clients.

## Identity and storage lifecycle

Firebase initializes from `VITE_FIREBASE_*` in `src/lib/config.ts`. Auth UI
supports email/password and Google popup. Authorized domains are declared in
`firebase.json`. `AuthCoordinator` wraps Firebase's auth-state listener with a
generation token; asynchronous callbacks are ignored if a newer identity
superseded them.

Local persistence scopes are:

| Mode | localStorage key |
| --- | --- |
| Legacy anonymous import | `fireOS_v2` (read/migrate only) |
| Guest | `fireOS_v2:anonymous` |
| Signed in | `fireOS_v2:user:{uid}` |

Only the active identity can persist. `saveData()` serializes validated
persisted fields, excluding `currentUser`, `_lastSavedAt`, `_syncMetadata`; it
keeps stale market cache values available as fallback. Market history is
local-only: on every save the in-memory history cache is schema-validated and
trimmed (1260 Nifty / 2520 NAV points per series, at most 8 series, 256 KB
section budget) before being written as `marketHistory`, and it is dropped
first when a save would exceed the 750 KB local payload ceiling.
`marketHistory` is a non-enumerable field on state, so envelope clones,
undo snapshots, backups and Assistant context JSON never include it; it is
also stripped from the cloud envelope because Firestore rules allowlist the
persisted `data` fields. Because `Object.assign` copies only enumerable
properties, state handoffs use `applyPersistedState()` (startup load and both
auth scope switches) to carry history onto app state — a plain `Object.assign`
would leave the empty default and the next save would erase the persisted
cache; if both in-memory sources are empty, `saveData()` falls back to the
already-persisted section rather than overwriting it with nothing. The module
history cache is global across identity scopes by design: market history is
public market data (index/NAV series), never user data, so saves mirror the
same cache into whichever scope is active. Invalid/corrupt local
data (including a malformed `marketHistory`) is rejected with a warning while
keeping the rest of the portfolio. `persistPortfolioState()` writes locally
first, publishes the save signal (`portfolioSavedStore` in
`src/core/stores.ts`), and only then optionally enqueues Firestore. Sign-out
tears down listeners, attempts a bounded sync flush, clears scope and resets
memory. Guest writes are never sent to cloud. The Nanostores atoms are
ephemeral UI signals only: durable portfolio persistence remains in
`PortfolioRepository`/`storage.ts` (identity-scoped localStorage) and
Firestore — `@nanostores/persistent` is deliberately not used and no portfolio
data is mirrored into the stores.

On sign-in, controller restores the user's local scope, reads remote data, and
merges local+remote envelopes (`src/lib/merge.ts`). Realtime listeners observe
both canonical state and MF holding subcollection. `SyncCoordinator` queues the
latest envelope, debounces writes (1s), retries transient errors up to three
times with exponential delays starting at 500ms, pauses offline, flushes on
reconnect, and publishes status changes to `syncStatusStore`. Section
clocks/entry timestamps
support merge decisions. The state envelope uses schema `fireOS_v4` for writes;
rules accept v2/v3/v4.

## Firestore data contract

Canonical path:

```text
/users/{uid}/portfolio/state
/users/{uid}/portfolio/state/holdings/{holdingId}
```

The canonical envelope contains schemaVersion, lastSavedAt, optional client,
serverMetadata, `data`, sectionUpdatedAt, entryUpdatedAt, migration, format.
`data` holds validated persisted sections (excluding `mf` when split). MF docs
are `{ kind: 'mf', value: SIPFund, updatedAt }`; client reconstructs `data.mf`
and holding timestamps on read. Save writes state document, then reconciles
holding docs (delete removed IDs, set current entries). `deletePortfolio()`
removes child holdings and state. Rules permit only authenticated owner reads,
writes and deletes; state and MF shapes have allowlists, bounded strings/maps,
lists and schema versions. The Firestore source is `firestore.rules`.

`persistedPortfolioSchema` in `src/types/state.ts` is the Valibot client
boundary; `isPersistedPortfolioData()` delegates to it and normalization still
fills legacy partial payloads from defaults. The strict schema enforces exact
keys and finite numbers, plus limits such as 50 liabilities, 20 ESOP quote
holdings, bounded names/returns and valid market-cache statuses. The optional
`marketHistory` section is a record of strict `HistoricalSeries` objects
(positive finite values, ISO dates, freshness metadata) capped at 8 entries;
normalization drops a malformed section rather than failing the payload, and
`isFireOSState()` treats the key as optional while requiring every other
persisted key. Firestore rules
independently enforce owner and envelope/selected field shape; do not rely on
client validation as authorization.

Write-size measurement is in `src/lib/portfolioMetrics.ts`. Dev logs report
bytes/holding count (not portfolio values); a warning is emitted over 750,000
bytes to leave margin beneath Firestore's 1 MiB document maximum. MF entries
remain separate documents to control state document size.

## External HTTP services

| Feature | Request | Cache/fallback | Source |
| --- | --- | --- | --- |
| Mutual fund NAV | `GET https://api.mfapi.in/mf/{schemeCode}`; parses first `data[]` NAV | 4h; in-flight dedupe, 30s timeout, stale value on failure | `src/modules/api/mfapi.ts` |
| Nifty 50 | Yahoo chart `^NSEI` one-year daily data via `https://corsproxy.io/?key=...&url=...` | 1h; parses `regularMarketPrice` and 52w high (history highs/current fallback); manual entry when unavailable | `src/modules/api/nifty.ts` |
| FX | Yahoo chart `{FROM}{TO}=X` via corsproxy | 24h; stale cached rate fallback; manual rate helper | `src/modules/api/currency.ts` |
| ESOP quote | Yahoo chart `{symbol}` daily via corsproxy | 15m memory + localStorage; in-flight request dedupe | `src/modules/api/esop.ts` |
| Nifty history | Yahoo chart `^NSEI` `interval=1d&range=5y` via corsproxy, 8s timeout | 24h bounded history cache; provider clamp 5y, client-side window cuts | `src/modules/api/nifty.ts` |
| NAV history | MFAPI `GET https://api.mfapi.in/mf/{schemeCode}` full-life series, 30s timeout | 24h bounded history cache | `src/modules/api/mfapi.ts` |
| Assistant | `POST {VITE_ASSISTANT_API_URL}/api/assistant/query` | no response cache | Worker; see [AI](ai.md) |

Nifty/FX/ESOP browser calls require `VITE_CORSPROXY_API_KEY`. These are
client-exposed configuration values, not secrets; do not put provider
credentials in Vite env. Yahoo FX accepts an ISO-code allowlist. Currency
identity returns the original amount; unsupported pairs/data return null.
ESOP valuation = holding quantity × Yahoo quote price × FX-to-INR; it returns
null value unless quote and positive rate are available. Symbols prefixed
`EPA:`, `NSE:`, `BSE:` gain `.PA`, `.NS`, `.BO` suffixes.

Cache TTL constants (`src/lib/config.ts`): NAV four hours, Nifty one hour,
currency 24 hours. Cache status identifies live, cache-fresh, stale or manual
data where implemented. `src/modules/api/index.ts` hydrates these caches from
persisted state at bootstrap. NAV background refresh runs only online and when
the page is visible, one fund at a time with 100ms spacing; it abandons results
when active UID changes.

Market history uses one shared bounded cache in `src/modules/api/index.ts`
(`initializeHistoryCache`, `sanitizeHistoryCache`, `HISTORY_CACHE_TTL` 24h,
at most 8 series, per-series caps of 1260 Nifty and 2520 NAV daily points, and a
256 KB budget). It hydrates from persisted `marketHistory`, serves a series as
`cache-fresh` inside the TTL, returns provider results as `live`, and falls back
to expired cache as `stale` only when the provider fails — provider failures never
erase a valid cache. Both history endpoints require `VITE_CORSPROXY_API_KEY` for
the Nifty series. `marketHistory` is non-enumerable on state, is never written to
the cloud envelope, and is mirrored into identity-scoped localStorage on save.

## Assistant endpoint

Production Worker is configured in `worker/wrangler.toml`; secret binding is
`OPENROUTER_API_KEY`, rate limiter binding is `ASSISTANT_RATE_LIMITER`. The
endpoint accepts OPTIONS and `POST /api/assistant/query`. Shared Valibot
schemas in `shared/assistant-policy.js` validate request fields, strict message
objects, role alternation, and extracted-proposal envelopes. It limits body to
100KB, requires 1–12 alternating message objects and matching latest question,
blocks destructive/PII prompts, limits to 20 req/min/IP, forwards sanitized
context and messages to OpenRouter, max 180 output tokens and 25s upstream
timeout. CORS `ALLOWED_ORIGIN` is a comma-separated origin allowlist; it must
include every host that serves the UI, or the Assistant fails CORS in production
only. See [AI](ai.md) for exact
validation, response shape, prompt and proposal handling.

There is no local Assistant proxy: the Worker is the only implementation. For
local Worker work run `npx wrangler dev --config worker/wrangler.toml` with
`OPENROUTER_API_KEY` in `.dev.vars`, and point `VITE_ASSISTANT_API_URL` at the
local Wrangler URL (otherwise the browser calls the deployed Worker).

## Configuration and deployment

Root `.env.example` describes browser config. `OPENROUTER_API_KEY` is a server
secret only. Build injects `VITE_*` variables; they are public by design.
Hosting CSP, COOP, X-Frame-Options and related headers are configured in
`firebase.json`; CSP connect-src allows Firebase, Assistant Worker, Yahoo,
corsproxy and MFAPI. Hosting SPA rewrites all paths to `/index.html`, with
pre-rendered route metadata generated by scripts.

Typical commands:

```sh
npm ci
npm run dev
npm run build
npm run deploy:worker
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Backend verification includes `npm run test:worker`, `npm run test:rules`,
`npm run test:rules:emulator`, plus HTTP/route checks.
The Firestore emulator is configured on port 8082.

## Detailed auth and portfolio startup sequence

### Service initialization

`getFirebaseServices()` requires `apiKey`, `authDomain`, `projectId`, `appId`;
it reuses the initialized Firebase app, tries Firestore persistent local cache,
and falls back to `getFirestore()` if initialization throws. Authentication
module uses email/password create/sign-in, Google popup, and password reset.
Client validation checks email syntax, six-character password minimum and
password confirmation. Firebase error codes map to generic messages. Reset
returns success for `auth/user-not-found` to avoid exposing account existence.

### Session transition: guest

1. Firebase auth listener emits `{generation,user:null}`.
2. Controller tears down prior portfolio resources and validates callback is
   current. If no explicit sign-in prompt is pending, `startGuestSession()`
   resets prior session, activates anonymous local-storage scope and loads it.
3. `currentUser=null`; guest UI is shown, cloud save disabled, nav logout label
   becomes “Sign in”. Guest persistence writes only the anonymous key.
4. Choosing sign in tears down guest state, keeps its localStorage data intact,
   shows auth screen and waits for Firebase callback.

### Session transition: authenticated

1. Callback tears down old session; `AuthCoordinator.isCurrent()` compares both
   generation and UID.
2. Select UID storage scope and restore local cache, assign Firebase user to
   runtime state, initialize Firestore.
3. If local state has selected user/holding/history data, build local envelope;
   fetch remote envelope by UID; merge both if present, otherwise use whichever
   exists or an envelope from defaults.
4. Apply envelope to singleton state, set active envelope, persist merged state
   locally without enqueueing a redundant cloud save, hide auth screen.
5. Create `SyncCoordinator` with Firestore `savePortfolio`; `onStatusChange`
   writes `syncStatusStore` (no DOM event). Subscribe separately to state and MF
   holdings snapshots. Each snapshot reconstructs combined data, merges with
   current local envelope and applies state only if auth generation remains
   active; then persists locally and dispatches `profileUpdated`.
6. Start SIP NAV refresh, re-render active profile, call daily tasks, and start
   Nifty monitor. Monitor callback checks auth generation; deployment amount is
   overwritten based on bonds and alert severity.

### Teardown and race protection

`PortfolioSession.teardown()` unsubscribes state+holdings snapshots first,
pauses coordinator, calls flush with 5,000ms timeout, warns if flush fails,
disposes coordinator/listeners (disposal resets `syncStatusStore` to `idle`),
cancels Nifty monitor, clears envelope and
sync config, disables active storage scope and resets singleton state. It also
publishes the cleared scope through `activeScopeStore` and finishes with
`resetScopeStatuses()`, which clears `syncStatusStore`, `marketRefreshStatusStore`
and `activeScopeStore` together.
Observers registered through the session's unsubscribe slot are removed before
the flush, so status writes from the old identity cannot reach them. Auth
generation is incremented on sign-out and callback validity checked after
async Firestore operations. NAV background loop separately captures UID and
stops applying results after identity changes.

## Envelope reconciliation algorithm

`buildEnvelopeFromState()` strips runtime fields, snapshots state data and emits
section clocks for `profile`, `holdings`, `planning`, `insurance`, `esop`, and
`cache`. It compares each section's fields to prior envelope JSON: changed
section gets current `now`; unchanged keeps previous clock or receives `now`.
The builder returns schema `fireOS_v3`; `savePortfolio()` writes v4. Metadata
includes client id/version/platform and backup format marker.

`mergeEnvelopes(local, remote)` starts from cloned remote data, then chooses a
whole section by sectionUpdatedAt timestamp. Newer clock wins. Missing clocks
produce `missing-timestamp` conflict and choose remote if remote timestamp
exists, otherwise local. Equal clocks produce `equal-timestamp`, with
deterministic comparison of clientId then lastWriteId. Result `dirtySections`
is the list of conflict sections. Section clock result is the later of both.
Then `sip` map entries are reconciled individually using `entryUpdatedAt.holdings`
timestamps, newer remote entry wins, and entries present only remotely are
preserved. Removed-key tombstones are not represented in this algorithm; absent
entry timestamp handling therefore cannot model deletion against a stale copy
as robustly as an explicit tombstone protocol.

`mergeState()` is a separate shallow in-memory merger retained for state-shaped
updates. It merges holdings/maps by key, deeply merges watchdog/insurance/ESOP
nested sections, replaces expenses, merges history by date, unions achieved
milestones and completed-action records. `applyEnvelopeToState()` assigns
envelope data to live state; normalization/validation occurs at load boundaries.

## Write queue semantics and edge behavior

`SyncCoordinator.markDirty()` stores only newest pending envelope, marks
pending/offline, and resets debounce timer. `flush()` returns immediately
offline; if a write is active it returns that promise. Otherwise it removes the
pending envelope, sets syncing, invokes provided save callback. Failure restores
that envelope as pending, marks error and rethrows. Retry loop retries selected
Firestore transient codes/network/timeouts with 500ms×2^attempt delays and at
most three retries beyond initial attempt. Online event flushes pending work;
offline event marks offline. Pause invalidates scheduled timer through
generation; resume flushes if online. Teardown `dispose()` drops pending envelope
after flush attempt and removes browser listeners.

`persistPortfolioState()` invokes local save synchronously first. `sync:false`
or missing auth UID ends there. Otherwise `queuePortfolioSave()` verifies the
active scope UID and coordinator exist, builds envelope with active prior
metadata, updates active envelope, marks dirty and explicitly flushes. The
repository's regular save does not await cloud; `{awaitCloud:true}` exposes
failure to caller. This is important: “local save succeeded” does not mean cloud
write succeeded.

## Firestore save/read details and rules boundary

On save, code removes dynamic `entryUpdatedAt` from state document envelope,
removes `data.mf`, writes schemaVersion `fireOS_v4` and remaining data in one
batch. Metrics measure state doc plus MF entries, but the warning fires on
`stateDocumentBytes` alone above 750KB. It then
fetches existing MF documents, deletes IDs missing from current map, sets each
current document `{kind:'mf', value, updatedAt:lastSavedAt}`, and commits the
holdings batch when non-empty. State and child writes are separate commits, so
they are not one atomic transaction together. On load, state doc envelope is
validated and MF entries fetched/validated; if inline `mf` already exists it is
left unchanged, otherwise child entries are attached. Realtime subscription
maintains local state and holdings snapshots independently, emits combined data
when state envelope is available.

Rules require authenticated `request.auth.uid == path uid`; state envelope keys
are limited to schemaVersion, lastSavedAt, client, serverMetadata, data,
sectionUpdatedAt, entryUpdatedAt, migration, format. Supported schema strings
are fireOS_v2/v3/v4. Owner may delete canonical doc and child holdings. Rules
validate top-level envelope and selected nested structures, bounds and
allowlisted keys independently of Assistant Valibot validation. Client
`isPersistedPortfolioData()` does stricter nested
validation for locally loaded/updated data. Keep both rule emulator tests and
client validator tests when changing schema.

## External service contracts and refresh triggers

### MFAPI

`fetchNAV(code)` checks fresh memory cache (`age < 4h`), deduplicates by code,
GETs `/mf/{code}`, requires HTTP success and nonempty `data` array, parses first
entry NAV as float and caches timestamp/source/status. Request timeout is 30s.
Any exception, HTTP error, empty data or invalid NAV returns cached NAV even if
stale, otherwise null. `setCachedNAV()` marks manual. `getNAVCacheMap()` derives
fresh/stale status except manual. Startup cache hydration copies persisted map.

### Nifty

`fetchNifty()` uses cache when under one hour. Otherwise it requires the
configured corsproxy key and requests Yahoo chart `^NSEI`, `interval=1d`,
`range=1y`, timeout 8s. Current value from `meta.regularMarketPrice`; high from
`meta.fiftyTwoWeekHigh`, or max numeric historical highs, or current price as
last fallback. It timestamps `live`, stores cache and returns. Fetch failure
returns null, not stale cache. Manual modal validates positive current/high and
current ≤ high; setter writes in-memory manual cache. Separate persisted data is
copied into cache during bootstrap.

### Currency and stock quotes

Currency cache keys are normalized concatenated pairs (e.g. `EURINR`). A pair
request uses Yahoo symbol `EURINR=X`, chart range 1 day. Only supported ISO
codes, finite positive rate and numeric provider quote are accepted. Convert
returns same amount for identical codes, fresh cached rate if available, else
network or null. `fetchCurrencyRate()` falls back to cached rate including stale
after failed refresh. Manual rate modal accepts positive value and caches it; no screen currently calls
it. `state.currencyRates` is read and merge-reconciled but has no writer — rates
are memory-cache only. Legacy `eurInrData` is hydrated as `EURINR` at bootstrap if
no generic map exists.

Stock symbols are normalized uppercase; prefix `EPA:`, `NSE:`, `BSE:` maps to
`.PA`, `.NS`, `.BO`. Quotes use Yahoo daily chart `regularMarketPrice` and
currency, timeout 10s, with memory + localStorage cache for 15m and in-flight
dedupe. There is no stale quote fallback. ESOP valuations run quote and currency
fetch in parallel for every holding and calculate quantity×price×rate.

### Other outbound calls

Advisor review API call and its user gesture are detailed in [UI](ui.md). PDF.js
is served from local `public/pdfjs/` assets, not a CDN. Assistant requests are
covered by [AI](ai.md).

## Browser environment, security headers, and deployment pipeline

`firebase.json` Hosting serves `dist`, disables trailing slash, rewrites all
paths to index, ignores docs/source metadata. Headers set CSP with local scripts
plus Google auth scripts, inline script/style allowances, allowed Firebase,
Yahoo, corsproxy, MFAPI and Worker `connect-src`; PDF worker may run from self or
blob. COOP is `same-origin-allow-popups`, X-Frame-Options DENY,
frame-ancestors none, nosniff, strict-origin referrer and no camera/microphone/
geolocation. Google popup behavior depends on the COOP setting.

Quality workflow on PR and main runs Node 22 / Java 21, npm ci, build, lint,
Prettier check, unit tests, Worker tests, Firestore emulator tests and Chromium
Playwright tests. Deployment workflow on main/manual installs root dependencies,
Worker tests, builds with env, verifies route metadata, lint, format, unit/Worker/
rules tests; deploys Firebase Hosting/rules/indexes, checks Cloudflare tokens,
deploys Worker, then smoke-tests production routes. Details and scripts are in
`.github/workflows/{quality,deploy}.yml` and `scripts/`.

`npm run dev` (same as `npm run dev:ui`) starts the Vite dev server. Route
definitions in `scripts/routes.mjs` feed prerender and route verification. The
production Hosting CSP must allow the configured Worker origin; changing Worker
URL requires updating build variable and connect-src.
