/** Goal form for the Goals route. Uses the shared UI kit so the field set,
 *  validation and error surfaces match every other migrated route. */
import { useState } from 'react';
import { Button, FieldLabel, Input, Select } from '../ui';
import type { Goal, GoalKind, GoalRiskBucket } from '../../types/state';

const KIND_OPTIONS = [
  { value: 'fi', label: 'Financial Independence' },
  { value: 'home', label: 'Home' },
  { value: 'education', label: 'Education' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'custom', label: 'Custom' },
];

const RISK_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export interface GoalFormErrors {
  name?: string;
  targetToday?: string;
  targetDate?: string;
  priority?: string;
}

export function GoalForm({
  initialGoal,
  onSubmit,
  onCancel,
}: {
  initialGoal?: Partial<Goal>;
  onSubmit: (goal: Goal) => void;
  onCancel?: () => void;
}) {
  const [id] = useState(initialGoal?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initialGoal?.name ?? '');
  const [kind, setKind] = useState<GoalKind>(initialGoal?.kind ?? 'fi');
  const [targetToday, setTargetToday] = useState(initialGoal?.targetToday?.toString() ?? '');
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? '');
  const [monthlyContribution, setMonthlyContribution] = useState(
    initialGoal?.monthlyContribution?.toString() ?? '',
  );
  const [priority, setPriority] = useState(initialGoal?.priority?.toString() ?? '1');
  const [riskBucket, setRiskBucket] = useState<GoalRiskBucket>(initialGoal?.riskBucket ?? 'medium');
  const [errors, setErrors] = useState<GoalFormErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate here rather than relying on `required`: a native bubble gives no
    // persistent inline message, and these fields are the only place a goal's
    // assumptions are entered.
    const next: GoalFormErrors = {};
    if (!name.trim()) next.name = 'Give the goal a name so you can recognise it later.';
    if (!targetToday || Number(targetToday) <= 0) next.targetToday = 'Enter a target above ₹0.';
    if (!/^\d{4}-\d{2}$/.test(targetDate)) next.targetDate = 'Pick a target month.';
    if (!priority || Number(priority) < 1) next.priority = 'Priority starts at 1.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      id,
      name: name.trim(),
      kind,
      targetToday: Number(targetToday),
      targetDate,
      inflation: 'cpi',
      linkedAssetIds: initialGoal?.linkedAssetIds ?? [],
      currentAmount: initialGoal?.currentAmount ?? 0,
      priority: Number(priority),
      riskBucket,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Goal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Coorg house"
          autoFocus
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="goal-kind">Goal type</FieldLabel>
          <Select
            id="goal-kind"
            value={kind}
            onValueChange={(v) => setKind(v as GoalKind)}
            options={KIND_OPTIONS}
          />
        </div>
        <Input
          label="Target amount (₹)"
          type="number"
          inputMode="numeric"
          min="0"
          step="10000"
          value={targetToday}
          onChange={(e) => setTargetToday(e.target.value)}
          error={errors.targetToday}
          hint="In today's rupees, so inflation does not distort the target."
        />
        <Input
          label="Target date"
          type="month"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          error={errors.targetDate}
        />
        <Input
          label="Monthly contribution (optional)"
          type="number"
          inputMode="numeric"
          min="0"
          step="500"
          value={monthlyContribution}
          onChange={(e) => setMonthlyContribution(e.target.value)}
          hint="What you plan to add each month towards this goal."
        />
        <Input
          label="Priority"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          error={errors.priority}
          hint="1 is the most important goal."
        />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <FieldLabel htmlFor="goal-risk">Risk bucket</FieldLabel>
          <Select
            id="goal-risk"
            value={riskBucket}
            onValueChange={(v) => setRiskBucket(v as GoalRiskBucket)}
            options={RISK_OPTIONS}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit">{initialGoal?.name ? 'Save changes' : 'Create goal'}</Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}