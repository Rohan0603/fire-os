/** Minimal Goal form component for the Goal Wizard. */
import { useState } from 'react';
import { Button, Input, Select } from '../ui';
import type { Goal, GoalKind, GoalRiskBucket } from '../../types/state';
import { appState } from '../../lib/appState';

export function GoalForm({
  initialGoal,
  onSubmit,
}: {
  initialGoal?: Partial<Goal>;
  onSubmit: (goal: Goal) => void;
}) {
  const [id, setId] = useState(initialGoal?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initialGoal?.name ?? '');
  const [kind, setKind] = useState<Goal['kind']>(initialGoal?.kind ?? 'fi');
  const [targetToday, setTargetToday] = useState(
    initialGoal?.targetToday?.toString() ?? '',
  );
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? '');
  const [monthlyContribution, setMonthlyContribution] = useState(
    initialGoal?.monthlyContribution?.toString() ?? '',
  );
  const [priority, setPriority] = useState(initialGoal?.priority?.toString() ?? '1');
  const [riskBucket, setRiskBucket] = useState<Goal['riskBucket']>(initialGoal?.riskBucket ?? 'medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id,
      name,
      kind,
      targetToday: Number(targetToday),
      targetDate,
      inflation: 'cpi',
      linkedAssetIds: [],
      currentAmount: initialGoal?.currentAmount ?? 0,
      priority: Number(priority),
      riskBucket,
      monthlyContribution: monthlyContribution ? Number(monthlyContribution) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium">Goal name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium">Goal type</label>
        <Select
          value={kind}
          onValueChange={(v) => setKind(v as GoalKind)}
          options={[
            { value: 'fi', label: 'Financial Independence' },
            { value: 'home', label: 'Home' },
            { value: 'education', label: 'Education' },
            { value: 'marriage', label: 'Marriage' },
            { value: 'vehicle', label: 'Vehicle' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Target amount (₹)</label>
        <Input
          type="number"
          value={targetToday}
          onChange={(e) => setTargetToday(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Target date (YYYY-MM)</label>
        <Input type="month" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium">Monthly contribution (optional)</label>
        <Input
          type="number"
          value={monthlyContribution}
          onChange={(e) => setMonthlyContribution(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Priority</label>
        <Input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          min="1"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Risk bucket</label>
          <Select
            value={riskBucket}
            onValueChange={(v) => setRiskBucket(v as Goal['riskBucket'])}
            options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>
      <Button type="submit" variant="primary">
        Save goal
      </Button>
    </form>
  );
}