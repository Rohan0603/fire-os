# FIRE OS Assistant — AI and Proposal Reference

## System shape

```text
Deep Chat UI
 -> consent-scoped client state
 -> optional fresh Nifty fetch
 -> buildContextSummary(state, sendExact=true)
 -> POST { question, contextSummary, messages, sendExact }
 -> Cloudflare Worker (production) OR local Express proxy
 -> shared shape/prompt policy -> OpenRouter Chat Completions
 <- { reply, proposedChanges? }
 -> display reply; validate proposal -> diff -> user confirmation
 -> optional re-authentication -> snapshot -> apply -> local/cloud persistence
 -> local-only audit record and undo snapshot
```

Primary sources are `src/modules/assistant/index.ts`, `src/lib/assistant/`,
`shared/assistant-policy.js`, `shared/assistant-upstream.js`, `worker/src/index.ts`,
and `server/`.

## Consent and user scope

Assistant write permission is stored by `consentScope(uid)` in localStorage;
guests have a separate scope. Reads are enabled by default. Write access is
explicitly toggled in the panel and can be revoked. When the authenticated user
scope changes, pending proposals and attachments are cleared. Chat history is
provided by Deep Chat in the browser and only the most recent 12 alternating
messages are sent. Starter prompts submit through the same request handler.

The UI attempts a fresh Nifty fetch before each question. A successful result is
stored locally without cloud sync; failure is non-fatal and uses the existing
cache. The “send exact” boolean is part of the request. Current UI calls
`buildContextSummary(state, true)`, so exact aggregates are sent for these
requests; default helper behavior is bucketed-only.

## Context construction and privacy

`buildContextSummary` derives valuation from the same `totalNetWorth()` KPI as
the dashboard. It sends:

- constant user label `User`, age band (20s/30s/40s/50s+), and tax slab;
- bucketed FI target, net worth, annual expenses, and each asset category;
- category holding counts;
- Nifty level, 52-week high, calculated drawdown, timestamp, source, status,
  age-in-minutes, and freshness when valid;
- when `sendExact` is true: exact net worth, FI target, annual expenses,
  monthly SIP contribution, and values by holding class.

Bucket boundaries are `<1L` (<₹100,000), `1–5L` (<₹500,000), `5–25L`
(<₹2,500,000), `25L–1Cr` (<₹10,000,000), and `1Cr+`. Monthly SIP is the sum
of `state.sip[*].monthlyAmount`. Holding groups include MF, SIP, FD, EPF, ESOP,
bonds, custom holdings and demat; net-worth breakdown comes from shared KPI
valuation. Nifty data is omitted unless values and timestamp validate; freshness
is ≤1 hour.

The summary does not include UID, email, real name, date of birth, raw NAV map,
full fund maps, transaction IDs, or expense lists. `redactPII()` exists for
email/UID string redaction. Do not confuse client context minimization with
provider privacy guarantees: the allowed context and conversation are sent to
the configured proxy/provider.

## Request API and server policy

Client endpoint is `${VITE_ASSISTANT_API_URL}/api/assistant/query`; without a
base URL it is same-origin. Browser timeout defaults to 30s. JSON body:

```json
{
  "question": "latest user question",
  "contextSummary": {},
  "messages": [{"role":"user","content":"latest user question"}],
  "sendExact": true
}
```

Shared Valibot schemas in `shared/assistant-policy.js` validate request and
proposal-envelope shapes. Message history has 1–12 strict message objects,
strictly alternating user/assistant starting with user; text must be non-empty and ≤6,000 chars. The last message must be the
user question exactly. Question is required and ≤4,000 chars. Body is capped at
100 KB (Worker validates JSON string size and Content-Length). `sendExact` must
be boolean if present. Extra message keys are rejected.

`checkPromptPolicy()` rejects blank/overlong questions (400), destructive
requests such as deleting/wiping/resetting everything (403), and requests for
PII/raw dumps/full portfolio disclosure (403). Each user turn in the submitted
history is checked. This is pattern filtering, not semantic moderation.

Cloudflare Worker route: only `POST /api/assistant/query` and OPTIONS are
handled. It applies a Cloudflare rate limit of 20 requests per minute per
`CF-Connecting-IP` (binding failure => 503), validates the configured upstream
secret, and has a 25s upstream timeout. CORS allows configured `ALLOWED_ORIGIN`
or `*`. OpenRouter request uses `Authorization: Bearer ...`, `HTTP-Referer`,
`X-OpenRouter-Title: FIRE OS`, selected model fallbacks, `max_tokens: 180`,
non-streaming response. Provider failure maps to 502; timeout 504; malformed
input 400/413; bad route 404.

Local Express middleware uses Helmet, CORS, JSON limit 200 KB and
`express-rate-limit` (default 20 requests per 15-minute window, configurable
`ASSISTANT_RATE_LIMIT`). `/health` reports status/time. The local and production
implementations share `shared/assistant-policy.js` and
`shared/assistant-upstream.js`; their prompt construction and rate limits differ.
The local proxy logs metadata and bounded provider error detail, not raw
portfolio context/replies. Treat provider error detail and user questions as
potentially sensitive operational data.

## Model output and proposal extraction

System instruction says use only supplied context for user-specific facts,
distinguish facts/calculations/recommendations, default to 80 words, use INR,
avoid PII/raw data, and only propose minimal top-level JSON when needed. It
clarifies `exact.holdings.sip` means current SIP market value, while
`exact.monthlySipContribution` is the monthly contribution.

Model configuration defaults to `openrouter/free`, then configured free-model
fallbacks, capped at OpenRouter's 3-model limit. Reply extraction reads first
choice content (or compatible `content` field). Proposal extraction parses the
first greedy `{...}` substring as a Valibot-validated object envelope, then
`PERSISTED_ALLOWLIST` projects allowed persisted top-level fields and removes
runtime/underscore keys. Extraction does not establish semantic correctness;
the browser applies the complete persisted-state schema to the merged candidate
before review or acceptance. Firestore rules independently validate cloud writes.

## Proposal validation and user-mediated writes

`applyAssistantProposal()` requires a non-empty plain object of ≤25 keys.
Every key must be a `PERSISTED_STATE_KEYS` member and cannot start with `_` or
be a runtime field. It one-level merges object sections into current state,
strips runtime fields and checks the complete candidate with
`isPersistedPortfolioData()`. On success it returns a field-level diff. Arrays
are shown as section replacements; object section diffs are one level deep.

If write consent is disabled, the proposal is not applied and the UI asks the
user to enable writes. With consent, the user sees before/after fields and
chooses Confirm or Reject. `classifyProposal()` requires reauthentication for
removed holding entries, numeric deltas ≥₹1,000,000, and list reductions of at
least 10. Google users reauthenticate by popup; password users re-enter the
password; guests must type `CONFIRM`. Unsupported provider types have no
successful reauth path.

On confirm the client revalidates against current state, records a pre-change
snapshot, applies the proposal, and persists. Cloud save is a separate checkbox
enabled only for signed-in users. Failed cloud persistence reports that local
change remains and offers undo. The audit stores at most 50 entries per scope,
newest last; it includes timestamp, first 200 chars of triggering question,
diff, decision, cloudSaved and notes. It is local-only and not synced. Undo
restores the previous portfolio snapshot and persists it through the active
portfolio repository.

## Error behavior and operations

Client maps non-2xx responses to `AssistantRequestError(status)`, AbortError to
timeout copy, and other failures to connectivity copy. Proxy errors commonly
indicate missing `OPENROUTER_API_KEY`, provider quota/auth/model issues, policy
rejections, rate limiting, or origin/CSP mismatch. Browser bundle must contain
the intended `VITE_ASSISTANT_API_URL`; the API key must never be a `VITE_*`
variable. Worker secret is set with Wrangler; see `docs/README.md`.

Relevant checks: `npm run test:server`, `npm run test:worker`, unit tests under
`src/lib/assistant/`, and `e2e/assistant.spec.ts`. If changing a request,
proposal or privacy contract, update both proxy boundary tests and the UI flow.

## Full request trace: from chat event to model result

1. `DeepChatElement.connect.handler` receives transcript. UI drops empty turns,
   maps Deep Chat `ai` to API `assistant`, and takes last 12 messages. Only the
   latest user message is `question`.
2. Before creating context, UI calls market-data `fetchNifty()`. Successful
   data overwrites state `niftyData` and `niftyHigh` and persists locally with
   cloud sync disabled. Network failure is ignored so request can use old
   persisted Nifty data.
3. UI calls `buildContextSummary(state, true)`. Helper independently supports
   false (default), but current UI opts into exact aggregates for each request.
   It updates Nifty freshness label and calls browser `queryAssistant()` with
   timeout 30s, JSON content type and no auth header. CORS/proxy endpoint is
   from `VITE_ASSISTANT_API_URL`, or relative same-origin when unset.
4. `validateAssistantRequest()` validates body and message alternation, exact
   last question match, boolean sendExact and serialized size. Every user turn
   is scanned by regex prompt policy. Provider receives context serialized as
   JSON text preceded by system instructions; messages are appended as chat
   transcript.
5. Worker applies IP limiter then calls OpenRouter with configured model list,
   referer/title metadata, `max_tokens:180`, `stream:false`, 25s timeout. Local
   Express uses its own 15-minute IP/window limiter and no explicit fetch
   timeout in `server.js`.
6. Proxy extracts first response choice content, extracts proposal candidate
   separately, and returns `{reply, proposedChanges?}`. Worker response parser
   accepts OpenRouter `choices[0].message.content` or root `content`; Express
   uses optional chaining for same alternatives.
7. UI sends reply to chat. It defers proposal card until Deep Chat's new `ai`
   response callback; `pendingProposal` is single-slot module memory. Request
   failures send Deep Chat error, append an escaped text attachment and toast.
8. Any identity scope change clears pending proposal and assistant attachment
   DOM; prior conversation transcript ownership is Deep Chat component state,
   while only the last 12 turns are sent on each request.

## Prompt differences and model selection

Both prompts tell model not to invent user facts, keep responses concise,
explain plain language, use INR, not reveal/request PII, propose only minimal
top-level JSON, and leave all mutations for explicit client approval. Production
Worker prompt is inline in `worker/src/index.ts` and defaults to <=80 words.
Local prompt is `server/prompts/assistant.md`, loaded at module startup; it also
contains role/tone requirements, exactly 1–3 numbered actions for “what next”,
freshness guidance, changing Indian tax/regulatory uncertainty, and distinction
between missing context and absent user data. Thus local and production prompt
behavior is not byte-identical; modify/test both when policy intent changes.

Shared upstream config defaults to `openrouter/free`, `qwen/qwen3.8-27b:free`,
and `google/gemma-4-31b-it:free`. `OPENROUTER_FALLBACK_MODELS` comma-separated
replaces defaults; whitespace/empty entries removed, deduplicated with default
model first, and list capped at three. Upstream error parser extracts common
JSON `error`, nested message, or top-level message fields; Worker bounds detail
to 200 characters in HTTP response, local logs structured event and returns
bounded error.

## Consent/storage implications

`canReadPortfolio()` always returns true; reads do not require separate consent
toggle. Only write permission is opt-in (`allowWrites:false` default). Consent
key is `${scope}:fireOS:assistant:consent`, with scope `anonymous` or
`user:{uid}`. Existing `suggestChanges` legacy true value is accepted as write
consent. Data context is generated from appState and sent to configured backend
when a question is asked, independent of write toggle. `sendExact` controls
range vs exact aggregates within summary builder; current Chat handler passes
true unconditionally, so today's UI currently always sends exact summary
figures. This differs from route metadata wording that describes range-only; see
`scripts/routes.mjs` if adjusting UI behavior.

Assistant audit key is `${activePortfolioStorageKey}:fireOS:assistant:audit`;
for anonymous scope it is isolated from signed-in UID. Audit record first 200
characters of question plus before/after proposal values. The audit is local,
bounded to 50 entries and can include financial detail in diffs. It is not
uploaded through portfolio sync. Portfolio undo snapshots use sessionStorage
and are independent of the assistant audit.

## Proposal review subtleties

Server proposal extraction uses greedy regex from first `{` through last `}` in
reply; malformed/mixed JSON text yields no proposal. Server allowlist prevents
unknown top-level output; nested payloads remain the browser's responsibility.
Client constructs candidate from current state and one-level merges each plain
object section; complete persisted-state validator then validates recursive
known shapes. Extra unknown nested keys fail exact shape checks.

Client `classifyProposal()` treats top-level object updates in holdings key set
as a full key set when detecting removals; because the actual candidate merge
preserves existing keys for one-level object proposals, an omission in proposal
is not a deletion in applied candidate. Proposals replacing arrays can trigger
reauth if at least ten entries disappear. High-value threshold applies numeric
properties inside object values, not arbitrary numeric arrays. Validation is
rerun immediately before confirm to catch state changes since preview.

Snapshot flow: commit records current state before apply, applies values in
place, then `persistPortfolioState()`. Local save happens before awaited cloud
sync. If cloud fails after local write, implementation retains state locally,
records `save-failed`, and offers Undo. Undo uses previous validated snapshot,
then repository save; cloud failure leaves local undo in place. The message
“Undo last assistant change” can target most recent portfolio snapshot, while
the snapshot stack can include other saves as well; it is not exclusively
assistant-scoped.

## Failure matrix

| Stage | Observable outcome | State effect |
| --- | --- | --- |
| Nifty refresh before question | ignored error; continue | prior cache remains |
| Browser request abort after configured timeout | “Request timed out” | no mutation |
| Proxy validation / policy error | API error text and toast | no mutation |
| Rate limiter unavailable/limit exceeded | 503/429 response | no mutation |
| OpenRouter non-2xx | 502 with bounded provider detail | no mutation |
| Worker upstream timeout | 504 | no mutation |
| No proposal extraction | reply only | no write workflow |
| Invalid proposal | validation error/audit row | no mutation |
| No write consent | review notice | proposal not applied |
| Reject | rejection audit | no mutation |
| Reauth cancel/fail | reauth-required audit | no mutation |
| Valid confirmation, local save succeeds | confirmation/audit/toast | state and localStorage updated |
| Cloud sync fails | save-failed, Undo prompt | current state remains locally changed |

## Test map and maintenance points

- Sanitization/bucketing: `src/lib/assistant/sanitize.test.ts`.
- Consent scope/default/migration: `consent.test.ts`.
- Proposal validation/diff/classification: `proposal.test.ts`.
- Local action audit: `audit.test.ts`.
- Browser client/request errors: `client.test.ts`.
- Express request/prompt/upstream behavior: `server/test/` and
  `npm run test:server`.
- Worker routing, limits and upstream behavior: `worker/test/` and
  `npm run test:worker`.
- User flow: `e2e/assistant.spec.ts`.

For a state schema change, update the TypeScript allowlist/validator, shared
JavaScript proposal allowlist, `firestore.rules` as needed, and proposal tests.
For endpoint/message changes, keep local and Worker contracts aligned even
though prompts and limiter infrastructure intentionally differ.
