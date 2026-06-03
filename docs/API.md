# FIRE OS API Documentation

This document describes all external APIs integrated into FIRE OS, including request/response formats, caching strategies, error handling, and fallback mechanisms.

## Table of Contents

1. [Mutual Fund NAV API](#mutual-fund-nav-api)
2. [Nifty Index API](#nifty-index-api)
3. [EUR/INR Exchange Rate API](#eurinr-exchange-rate-api)
4. [Firebase Realtime Database](#firebase-realtime-database)
5. [Error Handling & Fallbacks](#error-handling--fallbacks)
6. [Caching Strategy](#caching-strategy)
7. [Rate Limits & Quotas](#rate-limits--quotas)
8. [Testing API Calls](#testing-api-calls)

---

## Mutual Fund NAV API

### Service: MutualFunds.com API

**Endpoint:** `https://api.mfapi.in/mf/{schemeCode}`

### Request

```bash
GET /mf/122639
```

**Parameters:**
| Param | Type | Example | Required |
|-------|------|---------|----------|
| schemeCode | string | `122639` | Yes |

### Response

```json
{
  "meta": {
    "fund_house": "Parag Parikh Financial Advisory Services Ltd.",
    "scheme_type": "Open Ended Schemes",
    "scheme_category": "Equity: Flexicap",
    "scheme_code": 122639,
    "scheme_name": "Parag Parikh Flexi Cap Direct Plan"
  },
  "data": [
    {
      "date": "02-Jun-2024",
      "nav": "45.6789"
    },
    {
      "date": "31-May-2024",
      "nav": "45.2134"
    }
    // ... historical data
  ],
  "status": "SUCCESS"
}
```

### Supported Scheme Codes

| Fund | Code | Category | NAV (approx) |
|------|------|----------|---|
| Parag Parikh Flexi Cap Direct | 122639 | Equity: Flexicap | ₹80+ |
| Nippon India Growth Mid Cap Direct | 118668 | Equity: Mid Cap | ₹4700+ |
| Nippon India Small Cap Direct | 118778 | Equity: Small Cap | ₹160+ |
| ICICI Prudential Gold ETF | 113076 | Commodity: Gold | ₹120+ |

### Implementation in FIRE OS

**File:** `src/modules/api/mfapi.ts`

```typescript
export async function fetchNAV(schemeCode: string): Promise<number | null> {
  try {
    // 1. Check cache first
    const cached = getCachedNAV(schemeCode);
    if (cached && !isExpired(cached.timestamp, 4 * 60 * 60 * 1000)) {
      return cached.nav;
    }
    
    // 2. Fetch from API with 5-second timeout
    const response = await fetch(
      `https://api.mfapi.in/mf/${schemeCode}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const nav = parseFloat(data.data[0].nav);
    
    // 3. Validate NAV is reasonable number
    if (isNaN(nav) || nav <= 0) {
      throw new Error('Invalid NAV value');
    }
    
    // 4. Update cache
    setCachedNAV(schemeCode, { nav, timestamp: Date.now() });
    
    return nav;
  } catch (error) {
    logger.error(`NAV fetch failed for ${schemeCode}:`, error);
    
    // 5. Fallback: Return cached NAV (even if expired)
    const cached = getCachedNAV(schemeCode);
    if (cached) {
      return cached.nav;
    }
    
    // 6. No cache: Show manual entry modal
    return null;
  }
}
```

### Exports

```typescript
// src/modules/api/mfapi.ts
export async function fetchNAV(schemeCode: string): Promise<number | null>
export function getCachedNAV(schemeCode: string): CachedNAV | null
export function setCachedNAV(schemeCode: string, data: CachedNAV): void
export function clearNAVCache(): void
export function getNAVCacheMap(): Map<string, CachedNAV>
export function initializeNAVCache(cacheMap: Map<string, CachedNAV>): void
```

### Error Scenarios

| Scenario | Error | Fallback |
|----------|-------|----------|
| Network unavailable | TypeError: fetch failed | Return cached NAV |
| Request timeout | AbortError: timeout | Return cached NAV |
| Invalid scheme code | HTTP 404 | Show manual entry modal |
| API overloaded | HTTP 429 (rate limit) | Return cached NAV |
| Invalid response | JSON parse error | Return cached NAV |
| No cache available | No cached value | Show manual entry modal |

---

## Nifty Index API

### Service: Yahoo Finance via CORS Proxy

**Primary Endpoint:** `https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI`

**CORS Proxy:** `https://api.allorigins.win/raw?url=...`

### Request

```bash
# Direct (won't work from GitHub Pages due to CORS)
GET https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI

# Via CORS proxy (works from GitHub Pages)
GET https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3D%5ENSEI
```

### Response (Yahoo Finance)

```json
{
  "quoteResponse": {
    "result": [
      {
        "symbol": "^NSEI",
        "regularMarketPrice": 25150.5,
        "fiftyTwoWeekHigh": 26500.0,
        "fiftyTwoWeekLow": 22000.0,
        "currency": "INR"
      }
    ]
  }
}
```

### FIRE OS Response Format

```typescript
interface NiftyData {
  level: number;           // Current Nifty index level
  high52w: number;         // 52-week high
  source: 'Yahoo Finance' | 'ETF Approximation' | 'cached' | 'manual';
  timestamp: number;       // Unix timestamp (milliseconds)
}
```

### Fallback Strategy (Priority Order)

```
1. Yahoo Finance CORS proxy
   ↓ (if fails)
2. ETF Approximation (Gold ETF NAV from scheme 135106)
   ↓ (if fails)
3. Cached value (even if expired)
   ↓ (if no cache)
4. Manual entry modal (user enters value)
```

### Implementation in FIRE OS

**File:** `src/modules/api/nifty.ts`

```typescript
export async function fetchNifty(): Promise<NiftyData | null> {
  try {
    // 1. Check cache first
    const cached = getCachedNifty();
    if (cached && !isExpired(cached.timestamp, 1 * 60 * 60 * 1000)) {
      return cached;
    }
    
    // 2. Try Yahoo Finance
    const yahooData = await fetchYahooNifty();
    if (yahooData) {
      return {
        ...yahooData,
        source: 'Yahoo Finance',
        timestamp: Date.now()
      };
    }
    
    // 3. Try ETF approximation
    const etfData = await fetchETFApproximation();
    if (etfData) {
      return {
        ...etfData,
        source: 'ETF Approximation',
        timestamp: Date.now()
      };
    }
    
    // 4. Return cached value (even if expired)
    if (cached) {
      return cached; // Stale but better than nothing
    }
    
    // 5. Return null, UI will show manual entry modal
    return null;
  } catch (error) {
    logger.error('Nifty fetch failed:', error);
    return null;
  }
}

async function fetchYahooNifty(): Promise<Partial<NiftyData> | null> {
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI';
    const corsUrl = encodeURIComponent(url);
    const response = await fetch(
      `https://api.allorigins.win/raw?url=${corsUrl}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    const data = JSON.parse(await response.text());
    const quote = data.quoteResponse.result[0];
    
    return {
      level: quote.regularMarketPrice,
      high52w: quote.fiftyTwoWeekHigh
    };
  } catch (error) {
    logger.warn('Yahoo Finance fetch failed:', error);
    return null;
  }
}

async function fetchETFApproximation(): Promise<Partial<NiftyData> | null> {
  try {
    // Use Gold ETF NAV as rough approximation
    const nav = await fetchNAV('135106'); // Gold ETF
    if (nav) {
      return {
        level: nav * 250, // Rough approximation
        high52w: nav * 260 // Rough approximation
      };
    }
  } catch (error) {
    logger.warn('ETF approximation failed:', error);
  }
  return null;
}
```

### Exports

```typescript
export async function fetchNifty(): Promise<NiftyData | null>
export function getCachedNifty(): NiftyData | null
export function setCachedNifty(data: NiftyData): void
export function clearNiftyCache(): void
export function initializeNiftyCache(data: NiftyData | null): void
export async function showManualNiftyModal(): Promise<NiftyData>
```

### UI Behavior

- **If Yahoo Finance data used:** Show current Nifty level + 52W high
- **If ETF approximation used:** Show disclaimer "Based on ETF NAV (not official NSE data)"
- **If cache used:** Show timestamp "Last updated: 2 hours ago"
- **If manual entry:** Allow user to type Nifty level + 52W high in modal

---

## EUR/INR Exchange Rate API

### Service: Yahoo Finance via CORS Proxy

**Endpoint:** `https://query1.finance.yahoo.com/v7/finance/quote?symbols=EURINR=X`

### Request

```bash
GET https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DEURINR%3DX
```

### Response

```json
{
  "quoteResponse": {
    "result": [
      {
        "symbol": "EURINR=X",
        "regularMarketPrice": 92.5,
        "currency": "INR"
      }
    ]
  }
}
```

### FIRE OS Format

```typescript
interface EURINRData {
  rate: number;        // INR per EUR (e.g., 92.5)
  timestamp: number;   // Unix timestamp
}
```

### Implementation in FIRE OS

**File:** `src/modules/api/eurInr.ts`

```typescript
export async function fetchEURINR(): Promise<number | null> {
  try {
    // 1. Check cache
    const cached = getCachedEURINR();
    if (cached && !isExpired(cached.timestamp, 24 * 60 * 60 * 1000)) {
      return cached.rate;
    }
    
    // 2. Fetch from Yahoo Finance
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=EURINR=X';
    const corsUrl = encodeURIComponent(url);
    const response = await fetch(
      `https://api.allorigins.win/raw?url=${corsUrl}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    const data = JSON.parse(await response.text());
    const rate = data.quoteResponse.result[0].regularMarketPrice;
    
    // 3. Validate rate is reasonable
    if (isNaN(rate) || rate < 80 || rate > 150) {
      throw new Error('Rate out of expected range');
    }
    
    // 4. Update cache
    setCachedEURINR({ rate, timestamp: Date.now() });
    
    return rate;
  } catch (error) {
    logger.error('EUR/INR fetch failed:', error);
    
    // 5. Return cached rate
    const cached = getCachedEURINR();
    if (cached) {
      return cached.rate;
    }
    
    // 6. Show manual entry modal
    return await showManualEURINRModal();
  }
}
```

### Validation

- Rate must be between 80-150 INR/EUR (sanity check)
- Reject if outside this range (data corruption)

### Auto-Fetch Trigger

- Fetched automatically when ESOP Tools tab opens
- Can be manually refreshed via button

### Exports

```typescript
export async function fetchEURINR(): Promise<number | null>
export function getCachedEURINR(): number | null
export function getCachedEURINRData(): EURINRData | null
export function setCachedEURINR(data: EURINRData): void
export function clearEURINRCache(): void
export function initializeEURINRCache(data: EURINRData | null): void
export async function showManualEURINRModal(): Promise<number>
```

---

## Firebase Realtime Database

### Service: Google Firebase

**Project:** `fire-os-dd6d6` (Google Cloud)  
**Region:** `asia-southeast1` (Singapore, serving India)  
**Database URL:** `https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app`

### Authentication

Uses Firebase Authentication (email/password method).

```typescript
// Configure Firebase
const firebaseConfig = {
  apiKey: "...",
  authDomain: "fire-os-dd6d6.firebaseapp.com",
  projectId: "fire-os-dd6d6",
  storageBucket: "fire-os-dd6d6.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
```

### Data Structure

```
fire-os-dd6d6/
└── users/
    └── {uid}/
        └── portfolio/
            ├── profile
            │   ├── name: string
            │   ├── age: number
            │   ├── annualExpenses: number
            │   └── fiTarget: number
            ├── sip
            │   ├── sip1: { units, amount, sipStart, nav1, ... }
            │   ├── sip2: { ... }
            │   └── ...
            ├── fd: { amount }
            ├── epf: { amount }
            ├── esop: { amount, shares, price }
            ├── demat: { ISIN: { name, quantity, currentValue } }
            ├── nav: { schemeCode: { nav, timestamp } }
            ├── niftyData: { level, high52w, source, timestamp }
            ├── eurInr: { rate, timestamp }
            └── _lastSavedAt: "ISO timestamp"
```

### API Methods

#### Read Portfolio

```typescript
export async function loadPortfolioFromFirebase(uid: string): Promise<FireOSState | null> {
  try {
    const ref = ref(database, `users/${uid}/portfolio`);
    const snapshot = await get(ref);
    
    if (!snapshot.exists()) {
      // First login, create empty portfolio
      return createEmptyPortfolio(uid);
    }
    
    return snapshot.val();
  } catch (error) {
    logger.error('Failed to load portfolio from Firebase:', error);
    return null;
  }
}
```

#### Write Portfolio

```typescript
export async function savePortfolioToFirebase(uid: string, portfolio: FireOSState): Promise<void> {
  try {
    const ref = ref(database, `users/${uid}/portfolio`);
    await set(ref, {
      ...portfolio,
      _lastSavedAt: new Date().toISOString()
    });
    
    logger.info('Portfolio saved to Firebase');
  } catch (error) {
    logger.error('Failed to save portfolio to Firebase:', error);
    showErrorToast('Failed to save to cloud');
    throw error;
  }
}
```

#### Real-Time Sync

```typescript
export function onPortfolioChange(uid: string, callback: (portfolio: FireOSState) => void) {
  const ref = ref(database, `users/${uid}/portfolio`);
  
  const unsubscribe = onValue(ref, (snapshot) => {
    if (snapshot.exists()) {
      const portfolio = snapshot.val();
      D = mergeWithLocal(D, portfolio); // Merge with localStorage
      callback(portfolio);
    }
  }, (error) => {
    logger.error('Real-time sync error:', error);
  });
  
  return unsubscribe; // Can call to stop listening
}
```

### Security Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "portfolio": {
          ".validate": "newData.hasChildren(['profile', 'sip', 'fd'])"
        }
      }
    }
  }
}
```

### Offline Behavior

Firebase SDK provides built-in offline persistence:

1. When offline: Changes saved locally to device
2. Queue builds up in memory
3. When online: Queue flushed to server
4. No data loss on network interruption

### Sync Conflict Resolution

When portfolio exists both locally (localStorage) and remotely (Firebase):

```typescript
function mergePortfolios(local: FireOSState, remote: FireOSState): FireOSState {
  // Remote data takes precedence (it's fresher from other devices)
  // But preserve any local edits made while offline
  
  return {
    ...remote,
    // Local changes (made while offline) override remote if more recent
    profile: {
      ...remote.profile,
      ...local.profile // Local edits win
    }
  };
}
```

---

## Error Handling & Fallbacks

### Global Error Handler

```typescript
// Catches all unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Uncaught error:', event.error);
  showErrorToast('An unexpected error occurred');
});

// Catches unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled rejection:', event.reason);
  showErrorToast('An unexpected error occurred');
});
```

### API Error Toast Messages

| Error | Toast Message | Action |
|-------|---------------|--------|
| Network unavailable | "Check your internet connection" | Retry button |
| Timeout (>5s) | "Request timed out. Try again" | Retry button |
| HTTP 429 (rate limit) | "Too many requests. Try again later" | Wait & retry |
| HTTP 404 (not found) | "Data not found" | Show manual entry |
| JSON parse error | "Invalid response from server" | Retry button |
| Firebase write fail | "Failed to save. Retrying..." | Auto-retry |

### Fallback Cascade

```
Fresh API fetch
  ↓ (if fails)
Cached data (even if expired)
  ↓ (if no cache)
Manual entry modal
  ↓ (if user cancels)
Null / Show error
```

### Retry Logic

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T | null> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error(`Failed after ${maxAttempts} attempts:`, lastError);
  return null;
}
```

---

## Caching Strategy

### Cache Storage

All caches stored in `D` object (global state):

```typescript
D.nav = {
  '122639': { nav: 45.67, timestamp: 1717339200000 },
  '118668': { nav: 4776.00, timestamp: 1717339200000 }
};

D.niftyData = {
  level: 25150.5,
  high52w: 26500.0,
  source: 'Yahoo Finance',
  timestamp: 1717339200000
};

D.eurInr = {
  rate: 92.5,
  timestamp: 1717339200000
};
```

### TTL Validation

```typescript
function isExpired(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp > ttlMs;
}

// Usage
const cached = getCachedNAV('122639');
if (cached && !isExpired(cached.timestamp, 4 * 60 * 60 * 1000)) {
  // Cache is fresh, use it
  return cached.nav;
}
```

### Cache Lifecycle

| API | TTL | Refresh Trigger | Invalidate Trigger |
|-----|-----|-----------------|-------------------|
| NAV | 4 hours | Manual ⟳ button | Scheme code changed |
| Nifty | 1 hour | Manual ⚡ button | Market opens (9:15 AM) |
| EUR/INR | 24 hours | ESOP Tools tab open | Currency changed |

### Persistence

Cache persists across app sessions via Firebase + localStorage:

```typescript
// On app startup
function initializeAPICache() {
  const cached = localStorage.getItem('fireOS_nav_cache');
  if (cached) {
    D.nav = JSON.parse(cached);
  }
}

// On app shutdown (periodically)
function persistAPICache() {
  localStorage.setItem('fireOS_nav_cache', JSON.stringify(D.nav));
}
```

---

## Rate Limits & Quotas

### MutualFunds.com API

- **Rate Limit:** Not published, assume ~100 req/min
- **Quota:** No hard limit
- **Mitigation:** Cache for 4 hours

### Yahoo Finance (via CORS Proxy)

- **Rate Limit:** ~2000 requests/hour per IP
- **Quota:** None
- **Mitigation:** Cache for 1-24 hours, use CORS proxy

### Firebase Realtime Database (Free Tier)

- **Concurrent connections:** 100
- **Operations/second:** 100
- **Storage:** 1 GB
- **Bandwidth:** 1 GB/month down, 10 GB/month up
- **Mitigation:** Batch writes, debounce updates

### Firebase Authentication (Free Tier)

- **Auth ops/month:** Unlimited
- **Concurrent users:** No limit
- **Mitigation:** None needed

---

## Testing API Calls

### Manual Testing (Browser)

```javascript
// Open browser console (F12), then:

// Test NAV API
fetch('https://api.mfapi.in/mf/122639')
  .then(r => r.json())
  .then(d => console.log(d.data[0].nav));

// Test Nifty API
const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI';
fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
  .then(r => r.text())
  .then(d => console.log(JSON.parse(d).quoteResponse.result[0]));

// Test EUR/INR API
const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=EURINR=X';
fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
  .then(r => r.text())
  .then(d => console.log(JSON.parse(d).quoteResponse.result[0]));
```

### cURL Testing

```bash
# Test NAV
curl https://api.mfapi.in/mf/122639

# Test Nifty
curl "https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3D%5ENSEI"

# Test EUR/INR
curl "https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DEURINR%3DX"
```

### Automated Tests (Playwright)

```typescript
// tests/api.test.ts
import { test, expect } from '@playwright/test';
import { fetchNAV, fetchNifty, fetchEURINR } from '../src/modules/api';

test('NAV fetch returns valid number', async () => {
  const nav = await fetchNAV('122639');
  expect(nav).toBeTruthy();
  expect(typeof nav).toBe('number');
  expect(nav).toBeGreaterThan(0);
});

test('Nifty fetch returns valid data', async () => {
  const nifty = await fetchNifty();
  expect(nifty).toBeTruthy();
  expect(nifty?.level).toBeGreaterThan(0);
  expect(nifty?.high52w).toBeGreaterThan(nifty?.level);
});

test('EUR/INR fetch returns valid rate', async () => {
  const rate = await fetchEURINR();
  expect(rate).toBeTruthy();
  expect(rate).toBeGreaterThan(80);
  expect(rate).toBeLessThan(150);
});
```

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — Overall system architecture
- [CLAUDE.md](../CLAUDE.md) — Development guide
- [README.md](../README.md) — Feature overview
