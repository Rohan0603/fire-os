# ESOP Tools Core Features

## Goal
Implement the core ESOP Tools module in FIRE OS including Live Valuation, Vesting Schedule, Trigger Monitor, and Tax Calculator.

## Tasks
- [x] Task 1: Update `src/types/state.ts` to include `esopDetails` (vesting schedule array, triggers object like marriage/childbirth) → Verify: Types compile successfully.
- [x] Task 2: Create `src/modules/esop/index.ts` and `styles.css` with the "ESOP Tools" tab skeleton → Verify: ESOP tab exists and renders placeholder text.
- [x] Task 3: Implement Live Valuation UI leveraging existing `eurInr` and a new Yahoo Finance fetch for `GLE.PA` to display total INR value and net worth % → Verify: UI displays live calculated value based on current EUR/INR and stock price.
- [x] Task 4: Build Vesting Schedule UI to display the timeline and next unlock date based on `D.esopDetails.vestingSchedule` → Verify: Table correctly maps pending/vested shares and dates.
- [x] Task 5: Implement Trigger Monitor UI with toggles for user-driven events (Marriage, Child birth, etc.) and auto-calculation for the 5-year holding trigger → Verify: Toggling updates `D.esopDetails.triggers` and triggers visually update.
- [x] Task 6: Build Tax Calculator logic (Perquisite tax at marginal rate + 12.5% LTCG) to display pre-tax vs post-tax realized value → Verify: Changing share price/amount updates the tax breakdown correctly.
- [x] Task 7: Integrate the ESOP module into `src/main.ts` tab navigation and logic → Verify: Clicking "ESOP Tools" in the navigation loads the complete module.

## Done When
- [x] ESOP Tools tab is visible and fully functional
- [x] Vesting schedule displays accurately
- [x] Tax calculations correctly deduct 30% perquisite and 12.5% LTCG taxes
- [x] User triggers can be successfully toggled and saved
