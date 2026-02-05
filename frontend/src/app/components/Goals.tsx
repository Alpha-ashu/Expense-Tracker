import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { Plus, Target, Calendar, TrendingUp, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Goals: React.FC = () => {
  const { goals, accounts, currency, setCurrentPage } = useApp();
  const [showContributeModal, setShowContributeModal] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getDaysRemaining = (targetDate: Date) => {
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleEditClick = (goal: any) => {
    setEditingGoalId(goal.id);
    setEditFormData({ ...goal });
  };

  const handleSaveEdit = async () => {
    if (!editingGoalId) return;
    try {
      await db.goals.update(editingGoalId, {
        name: editFormData.name,
        targetAmount: editFormData.targetAmount,
        currentAmount: editFormData.currentAmount,
        targetDate: editFormData.targetDate ? new Date(editFormData.targetDate) : undefined,
        category: editFormData.category,
      });
      setEditingGoalId(null);
      toast.success('Goal updated successfully');
    } catch (error) {
      console.error('Failed to update goal:', error);
      toast.error('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      try {
        await db.goals.delete(goalId);
        toast.success('Goal deleted successfully');
      } catch (error) {
        console.error('Failed to delete goal:', error);
        toast.error('Failed to delete goal');
      }
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Goals & Savings</h2>
            <p className="text-gray-500 mt-1">Track your financial goals</p>
          </div>
        <button
          onClick={() => setCurrentPage('add-goal')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          const daysRemaining = getDaysRemaining(goal.targetDate);
          const monthlyRequired = (goal.targetAmount - goal.currentAmount) / Math.max(1, daysRemaining / 30);

          return (
            <div key={goal.id} className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="text-blue-600" size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditClick(goal)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600"
                    title="Edit goal"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal.id!)}
                    className="p-1 hover:bg-red-100 rounded transition-colors text-red-600"
                    title="Delete goal"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    progress >= 100
                      ? 'bg-green-100 text-green-700'
                      : progress >= 50
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {progress.toFixed(0)}%
                  </span>
                </div>
              </div>

              {editingGoalId === goal.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Goal name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={editFormData.targetAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, targetAmount: parseFloat(e.target.value) })}
                    placeholder="Target amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={editFormData.currentAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, currentAmount: parseFloat(e.target.value) })}
                    placeholder="Current amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={editFormData.targetDate ? new Date(editFormData.targetDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditFormData({ ...editFormData, targetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGoalId(null)}
                      className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{goal.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 capitalize">{goal.category}</p>

                  <div className="space-y-4 mb-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            progress >= 100
                              ? 'bg-green-500'
                              : progress >= 50
                              ? 'bg-blue-500'
                              : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar size={16} />
                        <span>Target Date</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {new Date(goal.targetDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Days Remaining</span>
                      <span className={`font-medium ${daysRemaining < 30 ? 'text-red-600' : 'text-gray-900'}`}>
                        {daysRemaining > 0 ? daysRemaining : 0} days
                      </span>
                    </div>

                    {progress < 100 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-600 mb-1">Required Monthly Saving</p>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(monthlyRequired)}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowContributeModal(goal.id!)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Contribution
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="bg-white p-12 rounded-xl border-2 border-dashed border-gray-300 text-center">
          <Target className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No goals yet</h3>
          <p className="text-gray-500 mb-4">Start planning for your financial future</p>
          <button
            onClick={() => setCurrentPage('add-goal')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Goal
          </button>
        </div>
      )}

      {showContributeModal && (
        <ContributeModal
          goalId={showContributeModal}
          accounts={accounts}
          onClose={() => setShowContributeModal(null)}
        />
      )}
      </div>
    </CenteredLayout>
  );
};

const ContributeModal: React.FC<{
  goalId: number;
  accounts: any[];
  onClose: () => void;
}> = ({ goalId, accounts, onClose }) => {
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const goal = await db.goals.get(goalId);
    if (!goal) return;

    await db.goalContributions.add({
      goalId,
      amount,
      accountId,
      date: new Date(),
    });

    await db.goals.update(goalId, {
      currentAmount: goal.currentAmount + amount,
    });

    const account = accounts.find(a => a.id === accountId);
    if (account) {
      await db.accounts.update(accountId, {
        balance: account.balance - amount,
      });
    }

    toast.success('Contribution added successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Add Contribution</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Contribution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
