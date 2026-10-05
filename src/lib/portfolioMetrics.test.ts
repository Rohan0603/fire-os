import { describe, expect, it } from 'vitest';
import { measurePortfolioWrite } from './portfolioMetrics';
import { buildEnvelopeFromState } from './merge';
import { initializeState, type FireOSState } from '../types/state';
import { isPortfolioEnvelope } from '../types/firebase';
import { PERSISTED_PAYLOAD_CEILING } from './storage';
import type { HistoricalSeries } from '../types/api';

describe('portfolio write metrics', () => {
  it('reports UTF-8 document sizes and holding count without including portfolio values', () => {
    const metrics = measurePortfolioWrite(
      { schemaVersion: 'fireOS_v4', data: { profile: { name: 'A' } } },
      {
        fund: { name: 'Fund', units: 2, startDate: '2024-01', monthlyAmount: 1000 },
      },
      '2026-01-01T00:00:00.000Z',
    );

    expect(metrics.stateDocumentBytes).toBeGreaterThan(0);
    expect(metrics.holdingsDocumentBytes).toBeGreaterThan(0);
    expect(metrics.largestHoldingDocumentBytes).toBe(metrics.holdingsDocumentBytes);
    expect(metrics.holdingCount).toBe(1);
    expect(metrics.totalBytes).toBe(metrics.stateDocumentBytes + metrics.holdingsDocumentBytes);
    expect(JSON.stringify(metrics)).not.toContain('Fund');
  });

  it('measures an empty holdings set without reporting a largest entry', () => {
    const metrics = measurePortfolioWrite({ data: {} }, {}, '2026-01-01T00:00:00.000Z');

    expect(metrics.holdingCount).toBe(0);
    expect(metrics.holdingsDocumentBytes).toBe(0);
    expect(metrics.largestHoldingDocumentBytes).toBe(0);
  });
});

const SAVED_AT = '2026-10-01T00:00:00.000Z';

function makeSeries(count: number): HistoricalSeries {
  const startMs = Date.parse('2015-01-01');
  return {
    points: Array.from({ length: count }, (_, index) => ({
      date: new Date(startMs + index * 86_400_000).toISOString().slice(0, 10),
      value: 100 + index * 0.5,
    })),
    source: 'test-provider',
    fetchedAt: SAVED_AT,
    status: 'cache-fresh',
  };
}

/** Representative portfolio state; `scale` inflates every variable-length section. */
function sizedPortfolio(scale: number): FireOSState {
  const state = initializeState();
  const size = (base: number) => Math.round(base * scale);
  const pad = (index: number) => String(index).padStart(3, '0');

  state.profile = {
    name: 'Representative Investor',
    dateOfBirth: '1988-04-12',
    age: 38,
    annualExpenses: 1_200_000,
    fiTarget: 60_000_000,
    monthlyIncome: 450_000,
    taxSlabRate: 30,
  };
  state.niftyHigh = 26_300.45;
  state.niftyData = {
    level: 26_120.3,
    high52w: 26_300.45,
    timestamp: SAVED_AT,
    source: 'corsproxy.io',
    status: 'cache-fresh',
  };
  state.swpSchedule = { enabled: true, startDate: '2026-04-01', monthlyAmount: 122_000, rate: 0.03 };
  state.taxCalendar = { lastLTCGHarvestDate: '2026-03-31', lastHarvestedAmount: 180_000, harvestTarget: 125_000 };
  state.insurance = {
    termLife: { currentCover: 10_000_000, annualPremium: 24_000, expiryDate: '2040-01-01', provider: 'HDFC Life' },
    health: { currentCover: 1_000_000, annualPremium: 18_000, familySize: 4, provider: 'Star Health' },
    vehicle: { covered: true, annualPremium: 9_000 },
  };

  for (let i = 0; i < size(30); i += 1) {
    const code = String(120_000 + i);
    state.mf[`mf-${pad(i)}`] = {
      name: `Flexi Cap Fund Growth Option Series ${i}`,
      schemeCode: code,
      units: 1_234.5678 + i,
      startDate: `20${16 + (i % 9)}-0${1 + (i % 9)}`,
      monthlyAmount: 5_000 + i * 500,
      costBasis: 100_000 + i * 10_000,
    };
    state.nav[code] = {
      schemeCode: code,
      nav: 45.6789 + i / 100,
      timestamp: '2026-10-01T05:30:00.000Z',
      ttl: 14_400_000,
      source: 'api.mfapi.in',
      status: 'cache-fresh',
    };
    state.alphaTrackerData[`alpha-${pad(i)}`] = {
      fund: `Fund ${i}`,
      benchmark: 'NIFTY 50 TRI',
      year: 2025,
      return: 12.34 + i / 10,
      benchmarkReturn: 10.11,
    };
  }
  for (let i = 0; i < size(15); i += 1) {
    state.sip[`sip-${pad(i)}`] = {
      name: `Midcap Fund Direct Growth ${i}`,
      schemeCode: String(130_000 + i),
      units: 500.25 + i,
      startDate: `20${20 + (i % 5)}-0${1 + (i % 9)}`,
      monthlyAmount: 10_000 + i * 1_000,
      costBasis: 250_000 + i * 5_000,
    };
  }
  const holdingSections = ['fd', 'epf', 'esop', 'bonds'] as const;
  for (const section of holdingSections) {
    const holdings = state[section];
    for (let i = 0; i < size(8); i += 1) {
      holdings[`${section}-${pad(i)}`] = { amount: 250_000 + i * 10_000, currency: 'INR' };
    }
  }
  for (let i = 0; i < size(10); i += 1) {
    state.otherHoldings[`other-${pad(i)}`] = { name: `Gold sovereign bond tranche ${i}`, amount: 150_000 + i * 5_000, annualReturn: 7.2 };
  }
  for (let i = 0; i < Math.min(size(15), 50); i += 1) {
    state.liabilities[`loan-${pad(i)}`] = { name: `Home loan account ${i}`, amount: 1_500_000 + i * 25_000 };
  }
  for (let i = 0; i < size(12); i += 1) {
    state.demat[`INE002A0101${i % 10}`] = {
      isin: `INE002A0101${i % 10}`,
      quantity: 100 + i,
      currentValue: 50_000 + i * 1_000,
      name: `Listed equity holding ${i}`,
    };
  }
  for (let i = 0; i < size(6); i += 1) {
    state.currencyRates[`usdinr-${i}`] = {
      rate: 83.4 + i / 100,
      timestamp: SAVED_AT,
      sourceCurrency: 'USD',
      targetCurrency: 'INR',
      source: 'corsproxy.io',
      status: 'cache-fresh',
    };
  }
  for (let i = 0; i < size(120); i += 1) {
    state.netWorthHistory.push({
      date: new Date(Date.UTC(2016, i, 1)).toISOString().slice(0, 10),
      value: 1_000_000 + i * 50_000,
    });
    state.expenses.push({
      date: new Date(Date.UTC(2024, i % 12, 1 + (i % 27))).toISOString().slice(0, 10),
      category: i % 3 === 0 ? 'lifestyle' : 'household',
      amount: 12_000 + (i % 7) * 1_000,
      linkedToSWP: i % 4 === 0,
    });
  }
  for (let i = 0; i < size(40); i += 1) {
    state.completedActions[`action-${pad(i)}`] = { completedAt: SAVED_AT };
  }
  for (let i = 0; i < size(18); i += 1) {
    state.achievedMilestones.push(`Milestone ${i}: corpus checkpoint reached`);
  }
  state.esopDetails = {
    shares: 1_200,
    holdings: Array.from({ length: Math.min(size(8), 20) }, (_, i) => ({
      name: `Employer grant tranche ${i}`,
      symbol: `NSE:EMP${i}`,
      quantity: 150 + i,
      currency: 'INR',
    })),
    grantPrice: 420.5,
    liquidationShares: 300,
    vestingFmv: 610.25,
    currentPrice: 742.1,
    slabRate: 30,
    vestingSchedule: Array.from({ length: size(24) }, (_, i) => ({
      date: `202${6 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
      shares: 100,
    })),
    triggers: { marriage: false, childBirth: false, jobChange: false, coorgConstruction: false },
  };
  state.coorgCorpus = 2_400_000;
  return state;
}

function measureLikeProduction(state: FireOSState) {
  const envelope = buildEnvelopeFromState(state, { clientId: 'size-probe', lastWriteId: 'w-1' }, SAVED_AT);
  const { data, entryUpdatedAt: _entryUpdatedAt, ...envelopeWithoutDynamicMetadata } = envelope;
  const { mf, ...stateData } = data;
  void _entryUpdatedAt;
  // Mirrors savePortfolio()'s state document construction in modules/api/firestore.ts.
  const stateDocument = { ...envelopeWithoutDynamicMetadata, schemaVersion: 'fireOS_v4', data: stateData };
  const metrics = measurePortfolioWrite(stateDocument, mf ?? {}, SAVED_AT);
  const { currentUser: _user, _syncMetadata: _meta, _lastSavedAt: _saved, ...persisted } = state;
  void _user;
  void _meta;
  void _saved;
  const localBaseBytes = new TextEncoder().encode(JSON.stringify(persisted)).byteLength;
  const history = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [`series-${index}`, makeSeries(1_000)]),
  );
  const historyBytes = new TextEncoder().encode(JSON.stringify(history)).byteLength;
  return { metrics, stateDocument, localBaseBytes, historyBytes };
}

describe('representative portfolio write size', () => {
  it('measures a realistic portfolio far below every documented ceiling', () => {
    const { metrics, stateDocument, localBaseBytes, historyBytes } = measureLikeProduction(sizedPortfolio(1));

    console.info('[portfolio-size] realistic', {
      ...metrics,
      localBaseBytes,
      localWithHistoryBytes: localBaseBytes + historyBytes,
      stateDocHeadroomFactor: Math.round((750_000 / metrics.stateDocumentBytes) * 10) / 10,
    });

    expect(isPortfolioEnvelope(stateDocument)).toBe(true);
    expect(metrics.stateDocumentBytes).toBeLessThan(750_000);
    expect(metrics.largestHoldingDocumentBytes).toBeLessThan(900_000);
    expect(localBaseBytes + historyBytes).toBeLessThan(PERSISTED_PAYLOAD_CEILING);
  });

  it('keeps a four-times-larger portfolio under the same ceilings', () => {
    const { metrics, stateDocument, localBaseBytes, historyBytes } = measureLikeProduction(sizedPortfolio(4));

    console.info('[portfolio-size] 4x', {
      ...metrics,
      localBaseBytes,
      localWithHistoryBytes: localBaseBytes + historyBytes,
      stateDocHeadroomFactor: Math.round((750_000 / metrics.stateDocumentBytes) * 10) / 10,
    });

    expect(isPortfolioEnvelope(stateDocument)).toBe(true);
    expect(metrics.stateDocumentBytes).toBeLessThan(750_000);
    expect(localBaseBytes + historyBytes).toBeLessThan(PERSISTED_PAYLOAD_CEILING);
  });
});
