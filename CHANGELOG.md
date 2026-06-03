# Changelog

All notable changes to FIRE OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-06-03

### Added
- **Scenario Modeler**: CAGR/SIP/salary sliders → real-time FI age calculation
  - Input: Current corpus, monthly SIP, target, expected CAGR (13-17%), current age
  - Output: Age at FI, months to FI, final corpus
  - Supports annual SIP step-up (configurable, default 10%)
  - Scenarios: 17% CAGR → FI at 43-44 years, 14% → FI at 47-48 years, 13% → FI at 49-50 years

- **Crash Alerts**: Real-time Nifty monitoring with automated crash deployment guidance
  - Monitors every 5 minutes via Yahoo Finance API
  - 10% crash → ₹20K Wint deployment suggested (medium severity)
  - 15% crash → ₹35K deployment (high severity)
  - 25% crash → ₹60K deployment (critical severity)
  - Integrates with dashboard banner alerts

- **Coorg Goal Tracker**: Separate ₹2Cr target tracking for Kerala home project (2036)
  - Status: Planning (until Jan 2031) → In Progress → Target Reached
  - Monthly SIP: ₹10K starting Jan 2031
  - Current corpus tracking with % progress display

- **Portfolio Rebalancing Tool**: Allocation drift detection vs 40/30/20/10 target
  - Current allocation: PPFCF 40%, Nippon Growth 30%, Nippon SmallCap 20%, Gold 10%
  - Triggers recommendations when drift > 5%
  - Displays: Current vs target allocation %, amount to rebalance, recommended trades

- **Fund Manager Alert Integration**: Automated watchdog rules for fund health
  - PPFCF AUM breach: Alert when > ₹1.75L Cr, Plan B = Mirae Asset Flexi Cap
  - Nippon Growth block: Alert when > 14 days blocked, Plan B = Motilal Oswal Midcap
  - Nippon SmallCap block: Alert when > 60 days blocked, Switch = SBI/Bandhan SmallCap
  - Manager exits (Rajeev Thakkar/Samir Rachh): Pause lump-sums, continue SIP
  - Daily automated checks with email/dashboard alerts

### Technical
- New calculator modules: `scenario-modeler.ts`, `portfolio-rebalancing.ts`
- New API module: `nifty-monitor.ts` (real-time Nifty monitoring)
- New watchdog module: `fund-manager-alerts.ts` (fund health automation)
- New dashboard widget: `coorg-tracker.ts` (Coorg goal progress)
- Extended D state object with: coorgCorpus, coorgTarget, watchdogRules
- Firebase persistence: All new features auto-sync across devices
- E2E test suite: 35 tests covering all v2.3 features
- Test results: All 100+ tests passing, zero regressions

### Performance
- Nifty monitoring: 5-minute polling (efficient, not real-time)
- Watchdog checks: Daily (24-hour interval)
- Dashboard calculations: Client-side only (no server load)
- Bundle size impact: +~20KB gzipped (scenario modeler, calculations)

### Breaking Changes
None. v2.3 is fully backward compatible with v2.2.1 data.

### Bug Fixes
None in v2.3 (inherited from v2.2.1 fixes).

---

## [2.2.1] - 2026-06-03

### Fixed
- **NAV Fetch Bug**: Fixed SIP P&L showing ₹0 current value
  - Issue: NAV fetches filtered on `monthlyAmount > 0`, skipping SIPs with no monthly contributions but existing holdings
  - Solution: Changed filter to `units > 0` to fetch NAV for all SIPs with holdings
  
- **NAV Fetch Timing**: Optimized NAV fetch triggers
  - Moved from dashboard tab click only to: Firebase portfolio load (on login) + Profile save + Dashboard tab open (fallback)
  
- **Canvas Crash**: Fixed pie chart crashing when canvas too small
  - Added radius validation before drawing (prevents negative radius crashes)
  
- **Log Cleanup**: Removed verbose `logger.log()` debug statements
  - Kept `logger.warn()` and `logger.error()` for troubleshooting

---

## [2.2.0] - Earlier Release

Earlier versions and changes prior to v2.2.1 can be found in git history.
