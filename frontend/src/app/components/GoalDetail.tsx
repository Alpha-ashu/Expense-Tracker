import React, { useEffect, useMemo, useState } from 'react';
import { db, Goal, GoalContribution } from '@/lib/database';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { getGoalCategoryMeta, getGoalProgress, getMilestoneLabel, getMonthlySuggestion } from '@/lib/goal-utils';
import { MessageSquare, Plus, Target } from 'lucide-react';
import { toast } from 'sonner';

const SELECTED_GOAL_ID_KEY = 'selected_goal_id';

type MemberContribution = {
  name: string;
  amount: number;
  status: 'paid' | 'pending';
};

export const GoalDetail: React.FC = () => {
  const { setCurrentPage, currency, accounts } = useApp();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [memberName, setMemberName] = useState<string>('');

  useEffect(() => {
    const selectedId = Number(localStorage.getItem(SELECTED_GOAL_ID_KEY));
    if (!Number.isFinite(selectedId)) {
      setCurrentPage('goals');
      return;
    }

    const load = async () => {
      const foundGoal = await db.goals.get(selectedId);
      if (!foundGoal) {
        setCurrentPage('goals');
        return;
      }

      const rows = await db.goalContributions.where('goalId').equals(selectedId).reverse().sortBy('date');
      setGoal(foundGoal);
      setContributions(rows.reverse());
      setMemberName(foundGoal.members?.[0]?.name || '');
    };

    void load();
  }, [setCurrentPage]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const getWidthClass = (value: number) => {
    const safe = Math.max(0, Math.min(100, value));
    const bucket = Math.round(safe / 10) * 10;

    switch (bucket) {
      case 0: return 'w-0';
      case 10: return 'w-[10%]';
      case 20: return 'w-[20%]';
      case 30: return 'w-[30%]';
      case 40: return 'w-[40%]';
      case 50: return 'w-1/2';
      case 60: return 'w-[60%]';
      case 70: return 'w-[70%]';
      case 80: return 'w-[80%]';
      case 90: return 'w-[90%]';
      default: return 'w-full';
    }
  };

  const progress = goal ? getGoalProgress(goal.currentAmount, goal.targetAmount) : 0;
  const category = getGoalCategoryMeta(goal?.category);
  const milestone = getMilestoneLabel(progress);
  const monthlySuggestion = goal
    ? getMonthlySuggestion(goal.targetAmount, goal.currentAmount, new Date(goal.targetDate))
    : { months: 1, monthlyAmount: 0, remaining: 0 };

  const timeline = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const contribution of contributions) {
      const month = new Date(contribution.date).toLocaleDateString('en-US', { month: 'short' });
      grouped.set(month, (grouped.get(month) || 0) + contribution.amount);
    }
    return [...grouped.entries()].map(([month, total]) => ({ month, total }));
  }, [contributions]);

  const memberRows: MemberContribution[] = useMemo(() => {
    if (!goal?.members || goal.members.length === 0) return [];

    return goal.members.map((member) => {
      const sum = contributions
        .filter((item) => item.memberName === member.name)
        .reduce((acc, item) => acc + item.amount, 0);

      return {
        name: member.name,
        amount: sum,
        status: sum > 0 ? 'paid' : 'pending',
      };
    });
  }, [goal?.members, contributions]);

  const sortedContributions = useMemo(
    () => [...contributions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [contributions],
  );

  const lastContributionDate = sortedContributions.length > 0
    ? new Date(sortedContributions[sortedContributions.length - 1].date)
    : null;

  const completedOnDate = useMemo(() => {
    if (!goal) return null;
    let runningTotal = 0;
    for (const contribution of sortedContributions) {
      runningTotal += contribution.amount;
      if (runningTotal >= goal.targetAmount) {
        return new Date(contribution.date);
      }
    }
    if (goal.currentAmount >= goal.targetAmount && lastContributionDate) {
      return lastContributionDate;
    }
    return null;
  }, [goal, sortedContributions, lastContributionDate]);

  const addContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal?.id) return;
    if (amount <= 0) {
      toast.error('Enter a valid contribution amount');
      return;
    }

    await db.goalContributions.add({
      goalId: goal.id,
      amount,
      accountId,
      date: new Date(),
      memberName: goal.isGroupGoal ? memberName : undefined,
      status: goal.isGroupGoal ? 'paid' : undefined,
    });

    await db.goals.update(goal.id, {
      currentAmount: goal.currentAmount + amount,
      updatedAt: new Date(),
    });

    const account = accounts.find((item) => item.id === accountId);
    if (account) {
      await db.accounts.update(accountId, { balance: account.balance - amount });
    }

    toast.success('Contribution added');
    setAmount(0);

    const updatedGoal = await db.goals.get(goal.id);
    const rows = await db.goalContributions.where('goalId').equals(goal.id).reverse().sortBy('date');
    setGoal(updatedGoal || null);
    setContributions(rows.reverse());
  };

  if (!goal) {
    return null;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto space-y-6 pb-24">
      <PageHeader
        title={`${category.icon} ${goal.name}`}
        subtitle="Goal overview, contributions, and timeline"
        icon={<Target size={20} />}
        showBack
        backTo="goals"
      >
        <Button onClick={() => setCurrentPage('goals')} className="rounded-full">Back to Goals</Button>
      </PageHeader>

      <Card variant="glass" className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Target</p>
            <p className="text-xl font-bold">{formatCurrency(goal.targetAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Saved</p>
            <p className="text-xl font-bold">{formatCurrency(goal.currentAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Remaining</p>
            <p className="text-xl font-bold">{formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Goal Type</p>
            <p className="text-xl font-bold">{goal.isGroupGoal ? 'Group' : 'Individual'}</p>
          </div>
        </div>

        <div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-3 bg-black rounded-full transition-all ${getWidthClass(progress)}`} />
          </div>
          <p className="text-sm mt-2 text-gray-600">{progress.toFixed(0)}% completed</p>
          {milestone && <p className="text-sm font-semibold text-green-700 mt-1">{milestone} 🎉</p>}
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm">
          Suggested Saving: {formatCurrency(monthlySuggestion.monthlyAmount)} / month for {monthlySuggestion.months} month(s)
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Contribution Info</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-700">
            <span>
              Last contribution: {lastContributionDate
                ? lastContributionDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'No contribution yet'}
            </span>
            {completedOnDate && (
              <span className="font-semibold text-green-700">
                Completed on: {completedOnDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </Card>

      {goal.isGroupGoal && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-bold mb-3">Group Contribution System</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Member</th>
                  <th className="py-2">Contribution</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.map((row) => (
                  <tr key={row.name} className="border-b">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{formatCurrency(row.amount)}</td>
                    <td className="py-2">{row.status === 'paid' ? 'Paid' : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-bold mb-3">Goal Timeline</h3>
        <div className="space-y-2">
          {timeline.length === 0 && <p className="text-sm text-gray-500">No contributions yet.</p>}
          {timeline.map((item) => (
            <div key={item.month} className="flex items-center gap-3">
              <span className="w-10 text-xs text-gray-500">{item.month}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-3 bg-blue-500 rounded-full ${getWidthClass((item.total / Math.max(goal.targetAmount, 1)) * 100)}`} />
              </div>
              <span className="text-xs font-semibold">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="glass" className="p-6 space-y-4">
        <h3 className="text-lg font-bold">Add Contribution</h3>
        <form onSubmit={addContribution} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            step="0.01"
            value={amount || ''}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="px-3 py-2 border border-gray-200 rounded-lg"
            placeholder="Amount"
            required
          />
          <select
            value={accountId}
            onChange={(e) => setAccountId(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-gray-200 rounded-lg"
            aria-label="Contribution account"
            title="Contribution account"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          {goal.isGroupGoal && (
            <select
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg"
              aria-label="Group member"
              title="Group member"
            >
              {(goal.members || []).map((member) => (
                <option key={member.name} value={member.name}>{member.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="px-3 py-2 rounded-lg bg-black text-white font-semibold inline-flex items-center justify-center gap-2">
            <Plus size={14} /> Add
          </button>
        </form>
      </Card>

      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-bold mb-3">Group Chat</h3>
        <p className="text-sm text-gray-600 mb-3">Chat support placeholder for group members.</p>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm">
          <MessageSquare size={16} /> Open Chat
        </button>
      </Card>
    </div>
  );
};
