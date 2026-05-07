---
name: nav-fetch-validator
description: Validate NAV API endpoints and provide fallback suggestions when external APIs are unreachable
disable-model-invocation: true
---

# NAV Fetch Validator

Validates that critical NAV and market data APIs are accessible, logs failures, and suggests manual fallback data entry when APIs are down.

## What This Does

- **API Health Checks**: Tests connectivity to `api.mfapi.in`, `api.allorigins.win`, and Yahoo Finance proxy
- **Graceful Degradation**: Alerts you when APIs fail, with retry guidance
- **Fallback Data**: Provides step-by-step instructions for manual data entry when APIs are unavailable
- **Uptime Tracking**: Logs API failures to help identify patterns

## Invocation

```bash
/nav-fetch-validator
```

**User-only** — triggered manually before starting the app or when you notice fetch failures.

## Usage

### Check API Status

Run this when you first open FIRE OS:

```bash
/nav-fetch-validator check
```

**Output:**
```
✓ api.mfapi.in responding (200 OK)
✗ api.allorigins.win timeout (30s)
✓ Yahoo Finance (via proxy) responding
⚠ Recommend: Use manual NAV entry for Nifty fetch
```

### Manual Fallback (When APIs Are Down)

When the validator detects failures, it guides you through manual entry:

1. **Get Nifty Level**: Open your brokerage app → view Nifty 50 → enter in Crash Protocol modal
2. **Get Fund NAVs**: Visit each fund's official website:
   - Parag Parikh Flexi Cap: parag.com/nav
   - Nippon India Growth: nippon.in/nav
   - Enter each NAV manually in the fund card
3. **Verify Data Persists**: Refresh the page → values stay in localStorage

### Logging API Failures

The skill logs all failures to help identify when APIs go down:

```bash
~/.claude/projects/fire-os/api-failures.log
```

Each entry includes:
- Timestamp
- API endpoint
- Error type (timeout, 404, CORS, etc.)
- Suggested action

## Integration with FIRE OS

The skill works alongside your e2e tests:

- **Before Tests**: Run `/nav-fetch-validator check` to verify test environment APIs
- **After Deployment**: Run check to confirm GitHub Pages can reach external APIs
- **On Fetch Failures**: Manual fallback prevents blocking on transient API issues

## Troubleshooting

### "api.mfapi.in: connection refused"
- **Cause**: Server down or rate-limited
- **Action**: Wait 5–10 minutes, then retry. Use manual NAV entry in the meantime.

### "api.allorigins.win: timeout"
- **Cause**: CORS proxy overloaded
- **Action**: Use direct Yahoo Finance URL (may fail on GitHub Pages due to CORS). Manual entry is more reliable.

### "localhost failing but deployed site works"
- **Cause**: Local dev server not running
- **Action**: Start server with `npm start` and retest

## Related Resources

- [Mutual Funds API](https://api.mfapi.in) — NAV data source
- [AllOrigins CORS Proxy](https://allorigins.win) — Nifty fetch proxy
- FIRE OS README: API troubleshooting section
