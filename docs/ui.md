# FIRE OS — UI, Features, and Calculation Reference

## UI framework and lifecycle

The client is vanilla TypeScript rendered by Vite; there is no component
framework. `src/main.ts` creates the nav and seven tab containers, starts auth,
sets theme/offline listeners and routes paths/hash to a `FeatureRegistry`.
Feature modules receive a shared `FeatureContext` (`state`, portfolio
repository, feature ports). Modules own their DOM and use template strings,
native controls, CSS and explicit event listeners. Dashboard is unmounted when
leaving its tab; profile and most other modules initialize once then render on
activation. CSS tokens/themes are in `src/styles/tokens.css`, layout/global
styles are in `src/styles/`, with feature CSS under each module.

Theme is saved as `fire-os-theme` and follows OS dark preference on first load.
Offline banner tracks browser online/offline events. `portfolioStateSaved`
coalesces dashboard refresh to an animation frame. App root catches module and
fatal initialization errors and renders fallback messages.

## Tabs and behaviors

### Profile — `src/modules/profile/`

Profile is the central entry/edit surface for name, DOB/age, monthly income,
expenses, tax slab and FI target; asset records; liabilities; SIP/MF fund
names/scheme/units/costs; insurance and ESOP state. Changes mutate shared state
and go through repository persistence. Age helper validates exact YYYY-MM-DD
dates and accounts for whether the birthday has passed. Import/export includes
JSON backup and CSV download. `pdf-parser.ts` handles browser PDF/CAS parsing;
profile flows can use fund matching to associate scheme names/codes. CSV
serialization implementation is in `src/lib/portfolioCsv.ts`.

### Dashboard — `src/modules/dashboard/`

The dashboard refreshes NAVs for positive-unit SIP holdings before computing
KPIs. It shows net worth/assets/liabilities; SIP current value/invested/P&L;
FI progress; Nifty drawdown; cashflow summary; market-data freshness, sync mode,
last-save time, profile completeness and liabilities; category composition
canvas; FI target progress; Coorg goal; and, when SWP enabled, SWP, tax,
advisor-review and expense-tracker widgets. A market crash monitor can show a
severity banner. Dashboard refreshes on state save while active and on theme
change.

Net worth rules: MF and SIP = units × matching cached NAV (MF requires explicit
scheme code; SIP may use name matcher); FD, EPF, ESOP and bonds sum `amount`;
demat sums `currentValue`; custom holdings sum `amount`; liabilities are
clamped nonnegative and subtracted. Composition percentages use gross assets
(not net worth). SIP invested value uses explicit positive cost basis when
present, otherwise monthly amount × inclusive elapsed months. SIP XIRR
generates one negative monthly flow from start month plus a positive current
value on now; total XIRR is the simple mean of fund XIRRs. FI target is user
entry; progress is current net worth / target (0 when no target), with years
remaining only when already achieved. Drawdown is max(0, `(high-level)/high`).

### Planning Tools — `src/modules/calculators/`

- **Crash Protocol:** bonds are the initial crash fund; displays 10%, 15%, and
  25% of entered crash-fund value. Nifty refresh stores level/high and displays
  drawdown plus deployment examples based on 10/15/25% of total net worth.
  Nifty can be entered manually. Background alert deployment values use the
  same percentages of bonds.
- **Emergency Runway:** UI currently uses `profile.annualExpenses` as the
  monthly-expense amount; liquid assets are SIP (units × direct scheme-code
  cached NAV) plus only `fd.fd.amount`. It floors to months and labels ≥12
  healthy, ≥6 moderate, otherwise low. This is the implemented UI behavior.
- **SIP Pause:** defaults to current total monthly SIP, six months and 12% annual
  return. UI estimate is missed contributions = monthly × months; lost growth
  approximation = missed × (annual % / 12 / 100) × 12; total is their sum.
- **Tax planner:** `src/modules/calculators/tax/ltcg-planner.ts` approximates
  long-term eligible SIP units as total units × (invested amount attributable
  to months beyond 12 / total invested). Uses cached NAV; positive gains are
  ranked descending. Allowance is max(0, ₹125,000 − lastHarvestedAmount),
  irrespective of the stored `harvestTarget`; recommendations allocate eligible
  gain up to that amount and convert allocated gain fraction to units/value.
- **SWP scheduler:** stores enabled, start month, monthly amount and rate field
  (rate is not used by execution). Manual simulation and daily auto-run reduce
  units in PPFCF → Nippon Growth → Nippon SmallCap → Gold order. Matching uses
  names/scheme codes; category units aggregate SIP and MF; value determines
  needed units rounded up for the initial redemption plan, then actual units
  are deducted SIP-first and MF-second. Records an SWP expense for today's
  date. This is simulated state mutation, not a broker redemption.

Other exported calculation primitives in `src/lib/calculations.ts`: SIP future
value with monthly rate and zero-rate handling; simple SIP cost basis; XIRR via
Newton–Raphson (100 iterations, 365-day year, null on invalid/signless or
nonconvergent flows); emergency runway (returns 999 for positive assets and no
expenses); crash drawdown and 10/15/25% of 10% portfolio buffer; FI target =
25×annual expenses (4% rule); SIP pause future value. UI may implement local
estimates separately (as SIP pause does), so use the screen-specific logic
above for displayed behavior.

### Insurance — `src/modules/insurance/`

Captures term cover/premium/expiry/provider, health cover/premium/family size/
provider and vehicle covered/premium. No insurance quote API is present. Health
assessment and action-engine thresholds are described under Plan below.

### Plan — `src/modules/plan/`

The health assessment combines four dimensions: FI progress (yellow if target
missing; low progress <10% is yellow), protection (red if no cover data;
otherwise yellow when below target), savings rate (red <15%, yellow <30%,
green otherwise; missing income is red), and portfolio watchdog. Watchdog
critical/high => red, other alert => yellow; overall is worst dimension. Term
cover target is max(10×annual income, ₹1Cr); health cover target is ₹20L for
family of two or less, otherwise ₹50L.

Action engine emits urgent watchdog alerts, urgent Nifty drawdown >10%, missing
insurance data, monthly insurance gaps, allocation drift >5%, tax harvest after
11 months/no initial harvest for age >25, April SIP step-up reminder, Coorg SIP
start within six months, and annual harvest reminder from calendar year 2032.
FD maturity logic is commented out and does not run. Completed action IDs are
persisted; current logic treats records under 30 days old as completed, then
resets them. List sorts incomplete before complete, then urgent/this-month/
upcoming/future.

Net-worth snapshots are appended once per UTC date when net worth >0. Milestones
are ₹10L, ₹25L, ₹50L, ₹1Cr, ₹2Cr, ₹5Cr, ₹10Cr and custom FI target; achieved IDs
persist and toast once. Plan includes cashflow summary, action, history and
health renderers.

### ESOP Tools — `src/modules/esop/`

Stores grant/shares, vesting schedule, triggers and optional holdings by ticker,
quantity and currency. Quotes use Yahoo Finance through corsproxy; FX converts
to INR. Value = quantity × quote × INR rate. Holdings may be manually valued
when external data is unavailable. Stock quote freshness is 15 minutes.

### Assistant — `src/modules/assistant/`

Chat, privacy context, write consent, proposal diffs, reauthentication, audit
and undo are fully specified in [AI reference](ai.md). UI also displays Nifty
timestamp/freshness and three starter questions.

## Shared UI and formatting

`src/modules/ui/Modal.ts` wraps native `<dialog>` behavior for shared callers;
`Toast.ts` exposes transient status notifications. `lib/formatters.ts` provides
Indian currency/number formatting. Dashboard charts use native canvas (no
Chart.js dependency). Accessibility uses native inputs/buttons, labels, dialog
and live regions where implemented. Route pages are pre-rendered/verified by
`scripts/routes.mjs`, `prerender-routes.mjs`, and route smoke scripts.

## Persistence signals and tests

Modules save through `FeatureContext.portfolio`; storage validates data and
keeps guest and UID scopes separate. The UI listens for save/sync/auth events;
offline status is browser connectivity, not proof a queued remote write has
completed. Build/type checks: `npm run build`; format/lint: `npm run format:check`,
`npm run lint`; unit tests: `npm test`; browser workflows: `npm run test:e2e`.

## Profile: field lifecycle and data-management workflows

`src/modules/profile/index.ts` is the primary portfolio editor. `renderProfile()`
first calls `ensureCoreHoldingRows()`, then renders personal fields, demat
read-only cards, SIP rows, ESOP ticker rows, editable custom holdings and
liabilities, and data actions. Forms do not use a general form framework;
listeners are attached after template render. Most field edits save on blur
after a 500ms debounce, and are saved only if the DOM differs from `appState`.

### Personal assumptions

Inputs are name, DOB, monthly expenses, FI target, monthly income and tax slab.
Although the state field is called `profile.annualExpenses`, the Profile and
Insurance screens label/use the value as **monthly expenses**. The Plan's cash
flow and plain-English summary multiply it by 12; the emergency runway screen
uses it directly as monthly expenses. Keep this mismatch explicit when reading
or changing calculations. DOB uses native `type=date`; a date helper computes
age in UTC and rejects impossible/future dates or age >150. Name is optional,
but if present must be at least two characters. Positive-number helper is used
for expenses, FI target and income; empty fields do not reset existing numeric
values in `saveProfile()` (except DOB, which is reset to empty). Tax slab range
is 0–100 inclusive.

### SIP row edit/save

Rows use `sip1..sip10`; an empty initial form shows a temporary `sip1` row.
Name, scheme code, units, monthly amount, `YYYY-MM` start date and optional
cost-basis are read at save. A fund name blur can fill a missing code through
`getFundSchemeCode()` (three exact canonical fund mappings with case-insensitive
substring matching). If either name or code exists, name is required; a supplied
code must pass the shared scheme-code validator; units, monthly contribution
and cost basis cannot be negative; start date is validated if present. A
positive cost basis is stored; zero/blank removes override. An entirely blank
name+code row deletes that SIP entry. On successful save, NAV refresh is started
for all positive-unit SIPs, sequentially with 100ms spacing. Add SIP chooses
first free slot through 50, even though rendered save loop only reads slots
1–10; this is current source behavior and should be noted before expanding row
limits.

### Custom assets, liabilities, ESOP quote rows

Custom holdings are indexed `otherHolding1..50` by add button, while save scans
1..54. Each row has name, INR amount and annual return 0–100%. Empty rows are
deleted. Rows default read-only; Modify re-renders into edit mode and ✓ runs
whole-form validation/save. Three legacy core holding slots bridge FD/EPF/Bonds:
`otherHolding51` maps to `state.fd.fd`, 52 to `state.epf.epf`, and 53 to
`state.bonds.bonds`; existing non-zero legacy balances seed custom rows when
absent, and saving the row writes both representations. `otherHolding54` is
deleted on render. This is compatibility wiring, not duplicate categories in
net-worth totals: KPI math sums core holding maps and custom map separately, so
avoid populating both representations with the same amount unless intended.

Liabilities are indexed `liability1..50`, default to name+zero when added,
editable via a Modify/Save toggle, and deleted immediately. Save requires a
non-empty name for positive/nonzero value; blank name plus zero removes row;
amount must be finite and >=0; max 50 is enforced by form and state validator.
Liabilities are INR-only and subtracted from assets in net-worth KPI.

ESOP holding rows capture name, hidden symbol and currency, and editable quantity.
Rows are blank/default INR on add; save derives symbol from name if hidden symbol
empty, uppercases symbol/currency, rejects negative quantity and requires name
for non-zero quantity, removes empty zero rows, and sets `esopDetails.shares`
to sum of quantities. Profile refresh requests quote and FX values concurrently
via the market port; successful valuations sum into legacy `state.esop.esop`
INR amount. This refresh is separate from detailed grant/vesting fields in
`esopDetails`.

### CAS PDF import (exact flow)

1. Hidden file input accepts `.pdf`; `parseCASPDF()` uses FileReader to load an
   ArrayBuffer and loads local `/pdfjs/pdf.min.js` + worker assets on demand.
2. PDF.js extracts each non-empty text item with page/x/y coordinates. Parser
   groups text into rows within 2 y-units; page 1 is searched for uppercase
   investor name, PAN, email, mobile and as-on date.
3. Pages 2+ locate headings containing `folio no` (SOA) or `client id` (demat),
   infer numeric columns from the `Invested` header x-coordinate (fallback 250),
   and parse rows until `Total`. Scheme names may be buffered from prior text
   rows. Values are x-ordered as invested, units, NAV, market value, gain/loss;
   date and percent strings are parsed separately. Parenthesized amounts become
   negative. Empty 0-unit/0-market-value rows are discarded; duplicates keyed
   by identifier+scheme name keep the last row.
4. UI previews investor name/PAN, SOA fund units/invested/current values, and
   demat holdings marked not imported because the summary lacks ISIN. This is a
   confirmation preview, not a write.
5. Confirm clears all existing SIP and demat records, then imports SOA rows as
   `sipN` with parsed fund name, units, NAV date month (or current month),
   monthlyAmount 0 and optional invested value as costBasis. Demat rows with
   positive units become entries keyed from identifier (or normalized name),
   `isin: ''`, parsed name/quantity/currentValue. It closes and re-renders; toast
   says click Save to sync to cloud. Cancel discards pending parsed result.

### Backups and undo

- **JSON Download Backup:** removes runtime auth/sync fields, serializes the
  remaining state as pretty JSON, downloads `fire-os-backup-YYYY-MM-DD.json`,
  and stores local `fire-os:last-exported-at` for the reminder. No corresponding
  Profile import button is rendered in this implementation; do not claim JSON
  restore is available from this screen.
- **CSV Export:** `buildPortfolioCsv()` emits CRLF CSV with Category, Name,
  Units, Monthly contribution, Cost basis, Value, Currency columns. It exports
  MF/SIP market value from cached NAV, holding maps, custom assets, demat and
  liabilities. String cells are quoted, embedded quotes doubled, and strings
  beginning with spreadsheet formula characters `= + @ -` receive a leading
  apostrophe. A missing NAV yields blank value.
- **Undo Last Change:** snapshots are in sessionStorage, scoped per active
  portfolio key, validated and capped at 10; identical consecutive snapshots
  are skipped. Undo requires at least two snapshots, restores the prior one,
  preserves current auth/sync runtime fields and then saves. This is session
  history, not durable cloud version history.
- **Delete Cloud Data:** requires signed-in UID and browser confirmation. Deletes
  holdings child documents and state document; local copy is explicitly kept.
- **Save to Firestore:** signed-in only; first validates/saves current form,
  then awaits cloud persistence, displays success/failure status. Routine saves
  can sync in background; this button is an explicit awaited save.

## Dashboard and market alert calculation details

Dashboard net-worth KPI uses a distinct valuation per state collection:
`mf` requires `schemeCode` and uses `units×nav`; `sip` uses explicit code or
name matcher; FD/EPF/ESOP/Bonds sum each holding amount; demat sums currentValue;
other holdings sum amount, except legacy keys `otherHolding51..53` are filtered
from that custom sum. Liability sum clamps each amount at zero. Gross assets are
used as composition denominator; net worth is assets-liabilities. ESOP
concentration is `state.esop` amount / assets. Other-holding weighted annual
return is Σ(amount×return)/Σamount after filtering legacy slots.

SIP status defaults invested value to zero unless costBasis positive; otherwise
it computes inclusive months between start month and now, with minimum one, and
multiplies monthlyAmount. Current value is units×NAV. XIRR approximation emits
one negative equal monthly flow from first-of-start-month for every elapsed
month plus current value on current date; returns are averaged per fund without
weighting. Invalid start date, nonpositive contribution or nonpositive value
returns null XIRR. The shared XIRR function requires positive and negative flows,
uses Newton–Raphson starting at 10%, up to 100 iterations, clips rate below
-0.999999, rejects rates >1e6 and requires convergence delta <1e-8.

The 5-minute Nifty monitor fetches `fetchNifty()` immediately and then on a
recursive timer. Crash percent is rounded to an integer in
`detectCrashAlert()`: <10 low/no alert; 10–14 medium with fixed suggested
₹20,000; 15–24 high with ₹35,000; ≥25 critical with ₹60,000. The monitor only
calls back when alert severity changes or an existing alert clears. Auth session
controller replaces suggested fixed amount with actual deployment = current
bonds ×10/15/25% for medium/high/critical. Source comments and UI labels may
refer to other constants; this control flow is authoritative.

## Planning Tools: additional formulas and state effects

### Allocation drift

Targets from config: PPFCF 40%, NipponGrowth 30%, NipponSmallCap 20%, Gold 10%;
drift trigger is strictly greater than 5 percentage points. Current percentages
and drift round to one decimal. Recommendation rupees = abs(rounded drift)/100 ×
totalValue; display converts to lakh and rounds one decimal. Zero total value
returns targets, zero current/drift and no actions. Action-engine denominator
includes recognized funds plus custom holding value; passed target buckets only
contain recognized categories. Dashboard advisor request instead passes net
worth as denominator, so calculations can differ from Plan action suggestions.

### Scenario modeler

`calculateFIAge()` validates corpus/SIP nonnegative, goal >0, CAGR/current age
nonnegative. Monthly return = `(1+CAGR)^(1/12)-1`; every iteration grows current
corpus then adds current SIP; after each 12th contribution monthly SIP steps up
by default 10%. It stops when goal reached or at 1,000 months (~83 years), then
returns age to one decimal, month count, rounded final corpus and a rounded
percent label. If unreachable, it still returns capped-horizon values; no
separate failure status. The Plan tab uses fixed 17% CAGR, profile FI target or
₹55,000,000 fallback, profile age or 25 fallback, and total SIP monthlyAmount.
Coast FIRE helper is exported through ports but not displayed in current Plan
render; required corpus is target/(1+return)^years available; if already above
threshold coasting begins now; otherwise logs solve years from target/current
and returns null if no positive return or beyond retirement age.

### Tax planner and tax calendar

LTCG approximation includes only `state.sip`. Months held are inclusive from
start month to now; long-term months are `max(0, elapsed-12)`. Invested amount
uses positive costBasis else monthlyAmount×months; average monthly investment
divides by max(1,elapsed), and estimated long-term invested is average × long-term
months. Eligible units are total units × long-termInvested/fundInvested, clamped
to [0,total units]. Current NAV uses scheme code/name matcher. Gains are
`max(0,longTermValue-longTermInvested)`. Remaining cap = max(0,125000 − recorded
lastHarvestedAmount); stored `harvestTarget` is not used for this calculation.
Funds sort by gains descending. Per fund allocated gain is min(gain, remaining),
units are longTermUnits×allocatedGain/gain, sale amount units×NAV. “Tax saved” UI
is recommended gain ×12.5%. Record increments lastHarvestedAmount by planned
gain and stores today's local calendar date; reset zeros both date and amount.

Section 80C screen reads `localStorage.epf_annual_contribution`, otherwise
estimates EPF as monthlyIncome×50%×12%×12; adds term-life annual premium; fixed
cap is ₹150,000. Input updates only localStorage and its UI calculations, not
portfolio state. Tax calendar is static reminders for March 31, April 1,
April 15 and July 31. It is a planner UI, not tax filing or a verified tax
eligibility service.

### SWP automatic execution

`checkDailyTasks()` runs after authenticated portfolio load. It creates at most
one UTC-date net-worth snapshot if net worth >0; records newly achieved
milestones; and for enabled SWP where current YYYY-MM ≥ configured start month,
checks whether an SWP-category expense already exists for that month. If not,
it calls `executeMonthlyWithdrawal()` asynchronously, persists after success,
toasts, and refreshes active dashboard. This is per app load/session check, not
a guaranteed background scheduler. SWP order planning rounds required partial
units with `ceil(remaining/NAV)` but execution deducts actual units from SIP
entries then MF entries and does not write an external order or cap expense to
available holdings. It appends configured full amount even if holdings did not
cover the withdrawal. A manual simulator awaits cloud persistence.

## Exact Plan and auxiliary widget behavior

- **Cashflow:** if monthly income is absent, prompt to configure it. Annual income
  is monthly income×12; annual expenses is `profile.annualExpenses×12`; surplus
  is difference; savings rate is surplus/income×100. Label says post-tax estimate
  but no tax deduction is calculated.
- **Health:** missing FI target is yellow; a configured target with corpus zero
  remains default green in this implementation. Protection is red when both
  term and health covers are zero; otherwise yellow for gaps. Savings missing
  income is red. Overall uses worst color. Watchdog specifics are below.
- **Action rules:** watch funds via stored user-maintained inputs; high alerts
  produce actions. Drawdown >10 creates month-keyed action. Insurance missing
  if both covers zero; if some cover exists, gaps use max(10×annual income,1Cr)
  and health ₹20L for family ≤2, else ₹50L. Allocation collects recognized
  SIP+MF current value and custom assets in denominator but custom amounts do
  not map to a target bucket. Harvest reminder uses elapsed days /30 >11; no
  record + profile age>25 adds initial reminder. April action encourages ≥10%
  SIP raise. Coorg action is when date is 0–6 months away. Calendar ≥2032 adds
  annual harvest action. FD-maturity rule is commented out.
- **Completed actions:** records ISO completedAt by action ID; computed as
  completed when less than 30 days old (including future timestamps); IDs often
  encode month/year to recur. Checkbox updates `completedActions` then rerenders
  Plan; persistence follows surrounding save/event pathways, not an explicit
  repository save in this handler.
- **Milestones:** fixed net worth thresholds plus custom FI target unless
  duplicate. History shows at most six latest stored snapshots. Trend is last
  minus first shown value; bar height relative to maximum displayed; dates and
  values are presentation-only.
- **Coorg:** default target ₹2Cr, SIP start 2031-01, monthly amount ₹10k. Progress
  is current corpus/target (not capped in data; UI bar caps at 100). Remaining
  target can be negative. Status is target reached, in progress if current date
  ≥ SIP start month, otherwise planning. It does not project SIP future value.
- **Watchdog:** PPFCF AUM > configured limit => high; Nippon Growth blocked >14
  days => medium; Small Cap blocked >60 => high; either manager exit => critical.
  It returns text guidance only; it does not alter investments or fetch manager
  status/AUM itself.
- **Expense tracker:** adds/display persisted expenses from dashboard modal.
  Metric named monthlyAverage is rounded totalAmount / expense-record count, not
  grouped by month/date; `_startDate` is unused. Target ₹122,000; within ±10%
  inclusive? Source uses strict `abs(variance)<10`, where variance is rounded
  whole percent. Widget is only displayed when SWP is enabled.
- **Advisor review:** dashboard builds corpus and allocation, posts email +
  portfolio summary + timestamp to `https://api.fire-os.app/advisor/review`,
  opens returned advisor URL. Dashboard uses account email or placeholder
  `user@example.com`; this sends PII and financial summary externally after an
  explicit button click. UI calls it only when SWP is enabled (widget itself is
  conditional). This route is separate from Assistant and Firebase.

## Auth UI and formatting details

Auth forms use email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, password minimum six
characters, and matching signup confirmation. Password reset validates email;
Firebase user-not-found is deliberately returned as success-neutral behavior.
Firebase provider error codes are mapped to user-facing generic messages.
Successful auth relies on the global auth-state listener to activate session;
form code does not navigate directly. Guest sessions are started by
`AuthSessionController` when no signed-in user and no sign-in prompt.

`formatCurrency()` uses crore suffix at absolute ₹10,000,000+, otherwise Indian
comma grouping; non-finite becomes ₹0. `formatNumber()` uses Indian grouping;
`formatPercentage()` expects fractional input and multiplies by 100. Date and
time helpers return empty string for invalid input. Modal helper uses native
`<dialog>.showModal()`, text content for title/button labels and caller-supplied
HTML for modal body; backdrop click and close button close it. Toast uses
role=status/aria-live polite, message textContent, four types and duration-based
dismissal.
