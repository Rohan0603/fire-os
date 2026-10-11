import type { FireOSState } from '../types/state';
import type { ToastType } from '../modules/ui/Toast';
import { totalNetWorth } from '../modules/dashboard/kpis';
import { checkNewMilestones } from '../modules/plan/milestones';

/** Side effects the daily runner needs from the app shell. */
export interface DailyTaskDeps {
  persist(state: FireOSState): void;
  notify(message: string, duration: number, type: ToastType): void;
   executeMonthlyWithdrawal(state: FireOSState): Promise<{ actualAmount: number }>;
}

/**
 * Daily background tasks (snapshots, milestones, monthly SWP). Returns the
 * runner wired to the app's side effects so the state logic stays testable.
 */
export function createDailyTaskRunner(deps: DailyTaskDeps): (state: FireOSState) => void {
  return function checkDailyTasks(state: FireOSState): void {
    try {
      const nw = totalNetWorth(state);
      const today = new Date().toISOString().substring(0, 10);
      let stateChanged = false;

      // Net worth history snapshot (only if we actually have data to record)
      if (nw.netWorth > 0) {
        const hasToday = state.netWorthHistory.some((s) => s.date === today);
        if (!hasToday) {
          state.netWorthHistory.push({ date: today, value: nw.netWorth });
          state.netWorthHistory.sort((a, b) => a.date.localeCompare(b.date));
          stateChanged = true;
        }
      }

      // Milestones check
      const newMilestones = checkNewMilestones(state);
      const newIds = Object.keys(newMilestones);
      if (newIds.length > 0) {
        newIds.forEach((id) => {
          if (!state.achievedMilestones.includes(id)) {
            state.achievedMilestones.push(id);
            stateChanged = true;
          }
        });
        deps.notify('🏆 Milestone Reached!', 5000, 'success');
      }

       // SWP monthly execution check
       if (state.swpSchedule && state.swpSchedule.enabled && state.swpSchedule.autoExecute === true) {
        const currentYearMonth = today.substring(0, 7);
        const startYearMonth = state.swpSchedule.startDate
          ? state.swpSchedule.startDate.substring(0, 7)
          : '';

        if (startYearMonth && currentYearMonth >= startYearMonth) {
          const hasSwpThisMonth = state.expenses?.some(
            (e) => e.category === 'SWP' && e.date.substring(0, 7) === currentYearMonth,
          );
          if (!hasSwpThisMonth) {
            const target = state.swpSchedule.monthlyAmount;
            deps
              .executeMonthlyWithdrawal(state)
              .then((result) => {
                deps.persist(state);
                const actual = result.actualAmount;
                if (actual > 0) {
                  if (actual < target) {
                    const shortfall = target - actual;
                    deps.notify(
                      `✓ SWP executed for ₹${Math.round(actual).toLocaleString('en-IN')} (shortfall of ₹${Math.round(shortfall).toLocaleString('en-IN')})`,
                      5000,
                      'warning',
                    );
                  } else {
                    deps.notify('✓ Automatic monthly SWP executed', 4000, 'success');
                  }
                }
              })
              .catch((e) => {
                console.error('[SWP Auto] Failed to execute withdrawal:', e);
              });
          }
        }
      }

      if (stateChanged) {
        deps.persist(state);
      }
    } catch (e) {
      console.warn('[main] Failed to run daily tasks:', e);
    }
  };
}
