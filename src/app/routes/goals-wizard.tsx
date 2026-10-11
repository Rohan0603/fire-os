/** Goals Wizard route — create, edit, delete, and reorder planning goals. */
import { useState } from 'react';
import { appState } from '../../lib/appState';
import { Card, CardTitle, Button } from '../ui';
import { GoalForm } from './goal-form';
import type { Goal } from '../../types/state';

export function GoalsRoute() {
  // Read goals from the mutable global state (FireOSState.goals)
  const [goals, setGoals] = useState<Goal[]>(() => appState.goals ?? []);
  const [editing, setEditing] = useState<Goal | null>(null);

  const handleSave = (goal: Goal) => {
    const next = editing
      ? goals.map((g) => (g.id === goal.id ? goal : g))
      : [...goals, goal];
    setGoals(next);
    // Mutate appState.goals in place
    appState.goals = next;
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const next = goals.filter((g) => g.id !== id);
    setGoals(next);
    appState.goals = next;
  };

  const handleEdit = (goal: Goal) => setEditing(goal);
  const handleCancel = () => setEditing(null);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Financial Goals</h1>
        <Button
          onClick={() =>
            handleEdit({
              id: 'new',
              name: '',
              kind: 'fi',
              targetToday: 0,
              targetDate: '',
              inflation: 'cpi',
              linkedAssetIds: [],
              currentAmount: 0,
              priority: 1,
              riskBucket: 'medium',
            } as Goal)
          }
        >
          Add goal
        </Button>
      </div>

      {editing ? (
        <Card className="max-w-md">
          <CardTitle>{editing.name ? 'Editing' : 'New'} goal</CardTitle>
          <GoalForm initialGoal={editing} onSubmit={handleSave} />
          <Button variant="ghost" onClick={handleCancel} className="mt-2">
            Cancel
          </Button>
        </Card>
      ) : goals.length === 0 ? (
        <Card>
          <CardTitle>No goals yet</CardTitle>
          <p className="text-sm text-(--color-muted-foreground)">
            Add your first financial goal to track progress.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle>Your Goals</CardTitle>
          <ul className="space-y-3">
            {goals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {goal.name} ({goal.kind})
                  </span>
                  <div className="flex items-center gap-4 text-sm text-(--color-muted-foreground)">
                    <span>Target: ₹{goal.targetToday.toLocaleString()}</span>
                    <span>Due: {goal.targetDate}</span>
                    <span>Progress: ₹{goal.currentAmount.toLocaleString()}</span>
                    {goal.monthlyContribution && (
                      <span>SIP: ₹{goal.monthlyContribution.toLocaleString()}</span>
                    )}
                    <span>Priority: {goal.priority}</span>
                    <span>Risk: {goal.riskBucket}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(goal)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(goal.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}