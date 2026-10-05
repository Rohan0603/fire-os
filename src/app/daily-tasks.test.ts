import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeState, type FireOSState } from '../types/state';
import { createDailyTaskRunner, type DailyTaskDeps } from './daily-tasks';

const TODAY = new Date('2026-03-10T08:00:00Z');

function createFixture(): FireOSState {
  const state = initializeState();
  state.fd = { 'fd-1': { amount: 2_000_000, currency: 'INR' } };
  return state;
}

function createDeps(): DailyTaskDeps {
  return {
    persist: vi.fn(),
    notify: vi.fn(),
    executeMonthlyWithdrawal: vi.fn(async (state: FireOSState) => {
      state.expenses.push({
        date: TODAY.toISOString().substring(0, 10),
        category: 'SWP',
        amount: 1000,
        linkedToSWP: true,
      });
    }),
    renderDashboardIfVisible: vi.fn(),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDailyTaskRunner', () => {
  it('records one sorted net-worth snapshot per day', async () => {
    const state = createFixture();
    state.netWorthHistory = [{ date: '2026-12-01', value: 5 }];
    const deps = createDeps();
    const run = createDailyTaskRunner(deps);

    run(state);
    run(state);
    await flush();

    expect(state.netWorthHistory).toEqual([
      { date: '2026-03-10', value: 2_000_000 },
      { date: '2026-12-01', value: 5 },
    ]);
    expect(deps.persist).toHaveBeenCalledTimes(1);
  });

  it('skips the snapshot when there is no net worth to record', async () => {
    const state = initializeState();
    const deps = createDeps();
    const run = createDailyTaskRunner(deps);

    run(state);
    await flush();

    expect(state.netWorthHistory).toEqual([]);
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it('adds newly reached milestones once and notifies', async () => {
    const state = createFixture();
    const deps = createDeps();
    const run = createDailyTaskRunner(deps);

    run(state);
    run(state);
    await flush();

    expect(state.achievedMilestones).toEqual(['nw-10l']);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith('🏆 Milestone Reached!', 5000, 'success');
    expect(deps.persist).toHaveBeenCalledTimes(1);
  });

  it('runs the monthly SWP once per month and persists the result', async () => {
    const state = createFixture();
    state.achievedMilestones = ['nw-10l'];
    state.swpSchedule = { enabled: true, startDate: '2026-01', monthlyAmount: 1000, rate: 0.03 };
    const deps = createDeps();
    const run = createDailyTaskRunner(deps);

    run(state);
    await flush();

    expect(deps.executeMonthlyWithdrawal).toHaveBeenCalledTimes(1);
    expect(state.expenses).toHaveLength(1);
    expect(deps.persist).toHaveBeenCalledTimes(2);
    expect(deps.notify).toHaveBeenCalledWith('✓ Automatic monthly SWP executed', 4000, 'success');
    expect(deps.renderDashboardIfVisible).toHaveBeenCalledTimes(1);

    run(state);
    await flush();

    expect(deps.executeMonthlyWithdrawal).toHaveBeenCalledTimes(1);
  });

  it('does not run the SWP before its start month', async () => {
    const state = createFixture();
    state.achievedMilestones = ['nw-10l'];
    state.netWorthHistory = [{ date: '2026-03-10', value: 2_000_000 }];
    state.swpSchedule = { enabled: true, startDate: '2026-04', monthlyAmount: 1000, rate: 0.03 };
    const deps = createDeps();
    const run = createDailyTaskRunner(deps);

    run(state);
    await flush();

    expect(deps.executeMonthlyWithdrawal).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it('keeps running after a withdrawal failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createFixture();
    state.achievedMilestones = ['nw-10l'];
    state.swpSchedule = { enabled: true, startDate: '2026-01', monthlyAmount: 1000, rate: 0.03 };
    const deps = createDeps();
    deps.executeMonthlyWithdrawal = vi.fn(async () => {
      throw new Error('network down');
    });
    const run = createDailyTaskRunner(deps);

    run(state);
    await flush();

    expect(deps.persist).toHaveBeenCalledTimes(1);
    expect(deps.notify).not.toHaveBeenCalledWith('✓ Automatic monthly SWP executed', 4000, 'success');
    expect(consoleError).toHaveBeenCalledWith(
      '[SWP Auto] Failed to execute withdrawal:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
