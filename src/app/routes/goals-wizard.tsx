/** Goals route — create, edit, delete, and reorder planning goals. */
import { useState } from 'react';
import { appState } from '../../lib/appState';
import { formatCurrency } from '../../lib/formatters';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableNumericCell,
  TableRow,
} from '../ui';
import { GoalForm } from './goal-form';
import type { Goal, GoalKind } from '../../types/state';

const KIND_LABELS: Record<GoalKind, string> = {
  fi: 'Financial Independence',
  home: 'Home',
  education: 'Education',
  marriage: 'Marriage',
  vehicle: 'Vehicle',
  custom: 'Custom',
};

/** Clamped so an over-funded or missing-target goal cannot produce a bar that
 *  overflows its track or divides by zero. */
function progressOf(goal: Goal): number {
  if (goal.targetToday <= 0) return 0;
  return Math.max(0, Math.min(100, (goal.currentAmount / goal.targetToday) * 100));
}

/** Whole months from today to the target, so the user sees a horizon rather
 *  than a bare date. Returns null when the goal has no target month yet. */
function monthsRemaining(targetDate: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(targetDate);
  if (!match) return null;
  const now = new Date();
  return (Number(match[1]) - now.getFullYear()) * 12 + (Number(match[2]) - now.getMonth());
}

export function GoalsRoute() {
  const [goals, setGoals] = useState<Goal[]>(() => appState.goals ?? []);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);

  const dialogOpen = creating || editing !== null;

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = (goal: Goal) => {
    const next = editing
      ? goals.map((g) => (g.id === goal.id ? goal : g))
      : [...goals, goal];
    setGoals(next);
    closeDialog();
  };

  const handleDelete = (id: string) => {
    const next = goals.filter((g) => g.id !== id);
    setGoals(next);
    appState.goals = next;
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financial Goals</h1>
          <p className="text-sm text-(--color-muted-foreground)">
            {goals.length === 0
              ? 'Define what you are saving towards and track how far along you are.'
              : `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'} tracked against your corpus.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Add goal</Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No goals yet</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-(--color-muted-foreground)">
              A goal pairs a rupee target with a date, so FIRE OS can tell you whether your
              current savings rate gets you there. Start with Financial Independence if you are
              unsure.
            </p>
          </CardBody>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setCreating(true)}>Add your first goal</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          {/* Table already scrolls horizontally; the min-width stops the name
              column being crushed to two words before the scroll kicks in. */}
          <Table className="min-w-[46rem]">
            <TableCaption>Savings goals, funding progress and time to target</TableCaption>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Goal</TableHeaderCell>
                <TableHeaderCell className="w-56">Progress</TableHeaderCell>
                <TableNumericCell>Target</TableNumericCell>
                <TableNumericCell>Saved</TableNumericCell>
                <TableNumericCell>Shortfall</TableNumericCell>
                <TableNumericCell>Time left</TableNumericCell>
                <TableHeaderCell className="w-24 text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {goals.map((goal) => {
                const progress = progressOf(goal);
                const shortfall = Math.max(0, goal.targetToday - goal.currentAmount);
                const months = monthsRemaining(goal.targetDate);
                const reached = progress >= 100;

                return (
                  <TableRow key={goal.id}>
                    <TableCell scope="row">
                      <span className="font-medium">{goal.name}</span>
                      <span className="block text-xs text-(--color-muted-foreground)">
                        {KIND_LABELS[goal.kind]} · Priority {goal.priority} · {goal.riskBucket} risk
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          role="progressbar"
                          aria-label={`${goal.name} funding progress`}
                          aria-valuenow={Math.round(progress)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2 flex-1 overflow-hidden rounded-full bg-(--color-muted)"
                        >
                          <div
                            className="h-full rounded-full bg-(--color-accent) transition-[width] duration-300 motion-reduce:transition-none"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-(--color-muted-foreground)">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </TableCell>

                    <TableNumericCell>{formatCurrency(goal.targetToday)}</TableNumericCell>
                    <TableNumericCell>{formatCurrency(goal.currentAmount)}</TableNumericCell>
                    <TableNumericCell>
                      {reached ? (
                        <span className="text-(--color-accent)">Reached</span>
                      ) : (
                        formatCurrency(shortfall)
                      )}
                    </TableNumericCell>
                    <TableNumericCell className="whitespace-nowrap">
                      {months === null ? '—' : months <= 0 ? 'Due now' : `${months} mo`}
                    </TableNumericCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(goal)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(goal.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={editing ? `Edit ${editing.name}` : 'New goal'}
        description="A target amount in today's rupees and the month you need it by."
      >
        {dialogOpen ? (
          <GoalForm
            key={editing?.id ?? 'new'}
            initialGoal={editing ?? undefined}
            onSubmit={handleSave}
            onCancel={closeDialog}
          />
        ) : null}
      </Dialog>
    </div>
  );
}