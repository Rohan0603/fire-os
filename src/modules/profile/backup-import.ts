
import type { FeatureContext } from '../../core/feature-context';
import { normalizePersistedState, persistedPortfolioSchema, type FireOSState } from '../../types/state';

const runtimeStateKeys = new Set(['currentUser', '_lastSavedAt', '_syncMetadata']);

export function parsePortfolioBackup(text: string): { data: Partial<FireOSState> | null; issues: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { data: null, issues: ['File is not valid JSON.'] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { data: null, issues: ['Backup must contain a JSON object.'] };
  }

  const persisted = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !runtimeStateKeys.has(key)),
  );
  const result = persistedPortfolioSchema.safeParse(persisted);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.map(String).join('.') || 'backup'}: ${issue.message}`,
    );
    return { data: null, issues };
  }
  return { data: result.data as Partial<FireOSState>, issues: [] };
}

export async function restorePortfolioBackup(
  data: Partial<FireOSState>,
  context: FeatureContext,
  confirmed: boolean,
): Promise<void> {
  if (!confirmed) return;
  const normalized = normalizePersistedState(data);
  if (!normalized) return;
  const candidate = {
    ...normalized,
    currentUser: context.state.currentUser,
    _lastSavedAt: context.state._lastSavedAt,
    _syncMetadata: context.state._syncMetadata,
  };
  await context.portfolio.save(candidate);
  Object.assign(context.state, candidate);
}
