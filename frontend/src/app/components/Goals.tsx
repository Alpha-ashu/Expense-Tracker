import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { saveGoalWithBackendSync } from '@/lib/auth-sync-integration';
import { backendService } from '@/lib/backend-api';
import { Plus, Target, Calendar, TrendingUp, Edit2, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const Goals: React.FC = () => {
  const { goals, accounts, currency, setCurrentPage } = useApp();
  const [showContributeModal, setShowContributeModal] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      await backendService.updateGoal(String(editingGoalId), {
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

  const handleDeleteGoal = (goalId: number, goalName: string) => {
    setGoalToDelete({ id: goalId, name: goalName });
    setDeleteModalOpen(true);
  };

  const confirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    setIsDeleting(true);
    try {
      await backendService.deleteGoal(String(goalToDelete.id));
      toast.success('Goal deleted successfully');
      setDeleteModalOpen(false);
      setGoalToDelete(null);
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Failed to delete goal');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalGoalsAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavedAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalGoalsAmount > 0 ? (totalSavedAmount / totalGoalsAmount) * 100 : 0;

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      <PageHeader
        title="Goals & Savings"
        subtitle="Track and achieve your financial goals"
        icon={<Target size={20} className="sm:w-6 sm:h-6 lg:w-6 lg:h-6" />}
      >
        <Button
          onClick={() => setCurrentPage('add-goal')}
          className="rounded-full h-9 sm:h-10 px-3 sm:px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-xs sm:text-sm"
        >
          <Plus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Add Goal
        </Button>
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                <Target className="text-white sm:w-5 sm:h-5" size={18} />
              </div>
              <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Goals</p>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 tracking-tight">
                {goals.length}
              </h3>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                <TrendingUp className="text-white sm:w-5 sm:h-5" size={18} />
              </div>
              <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Saved</p>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 tracking-tight">
                {formatCurrency(totalSavedAmount)}
              </h3>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card variant="mesh-purple" className="p-4 sm:p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 sm:mb-4">
                <Sparkles className="text-white sm:w-5 sm:h-5" size={18} />
              </div>
              <p className="text-white/80 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Overall Progress</p>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                {overallProgress.toFixed(0)}%
              </h3>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl -mr-16 sm:-mr-32 -mt-16 sm:-mt-32 pointer-events-none" />
          </Card>
        </motion.div>
      </div>

      {/* Goals Grid */}
      <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {goals.map((goal, index) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const daysRemaining = getDaysRemaining(goal.targetDate);
            const monthlyRequired = (goal.targetAmount - goal.currentAmount) / Math.max(1, daysRemaining / 30);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="glass" className="p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors flex-shrink-0",
                      progress >= 100 ? "bg-green-500 text-white" :
                      progress >= 50 ? "bg-black text-white" :
                      "bg-orange-500 text-white"
                    )}>
                      <Target size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEditClick(goal)}
                        className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                        title="Edit goal"
                        aria-label={`Edit goal ${goal.name}`}
                      >
                        <Edit2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id!, goal.name)}
                        className="p-1 sm:p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                        title="Delete goal"
                        aria-label={`Delete goal ${goal.name}`}
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <span className={cn(
                        "px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-bold flex-shrink-0",
                        progress >= 100
                          ? 'bg-green-100 text-green-700'
                          : progress >= 50
                          ? 'bg-black/10 text-gray-900'
                          : 'bg-orange-100 text-orange-700'
                      )}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {editingGoalId === goal.id ? (
                    <div className="space-y-2 sm:space-y-3">
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="Goal name"
                        aria-label="Goal name"
                        title="Goal name"
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <input
                        type="number"
                        value={editFormData.targetAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, targetAmount: parseFloat(e.target.value) })}
                        placeholder="Target amount"
                        aria-label="Target amount"
                        title="Target amount"
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <input
                        type="number"
                        value={editFormData.currentAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, currentAmount: parseFloat(e.target.value) })}
                        placeholder="Current amount"
                        aria-label="Current amount"
                        title="Current amount"
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <input
                        type="date"
                        value={editFormData.targetDate ? new Date(editFormData.targetDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => setEditFormData({ ...editFormData, targetDate: e.target.value })}
                        aria-label="Target date"
                        title="Target date"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 px-3 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors shadow-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingGoalId(null)}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-display font-bold text-gray-900 mb-2">{goal.name}</h3>
                      <p className="text-sm text-gray-500 mb-4 capitalize">{goal.category}</p>

                      <div className="space-y-4 mb-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500 font-medium">Progress</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={cn(
                                "h-3 rounded-full transition-all",
                                progress >= 100
                                  ? 'bg-green-500'
                                  : progress >= 50
                                  ? 'bg-black'
                                  : 'bg-orange-500'
                              )}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Calendar size={16} />
                            <span>Target Date</span>
                          </div>
                          <span className="font-bold text-gray-900">
                            {new Date(goal.targetDate).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Days Remaining</span>
                          <span className={`font-bold ${daysRemaining < 30 ? 'text-red-600' : 'text-gray-900'}`}>
                            {daysRemaining > 0 ? daysRemaining : 0} days
                          </span>
                        </div>

                        {progress < 100 && (
                          <div className="bg-black/5 border border-black/10 rounded-xl p-3 backdrop-blur-sm">
                            <p className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Required Monthly</p>
                            <p className="text-lg font-display font-bold text-gray-900">{formatCurrency(monthlyRequired)}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setShowContributeModal(goal.id!)}
                        className="w-full px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-900 transition-all font-medium shadow-sm active:scale-95"
                        aria-label={`Add contribution to ${goal.name}`}
                        title={`Add contribution to ${goal.name}`}
                      >
                        Add Contribution
                      </button>
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {/* Empty State */}
      {goals.length === 0 && (
        <Card variant="glass" className="p-12 text-center border-2 border-dashed border-gray-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Target className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-display font-bold text-gray-900 mb-2">No goals yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">Start planning for your financial future by creating your first savings goal</p>
            <Button
              onClick={() => setCurrentPage('add-goal')}
              className="rounded-full h-11 px-6 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95"
              aria-label="Create your first goal"
              title="Create your first goal"
            >
              <Plus size={18} className="mr-2" />
              Create Your First Goal
            </Button>
          </motion.div>
        </Card>
      )}

      {/* Modals */}
      {showContributeModal && (
        <ContributeModal
          goalId={showContributeModal}
          accounts={accounts}
          onClose={() => setShowContributeModal(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Goal"
        message="This goal will be permanently deleted. All contribution records will be lost."
        itemName={goalToDelete?.name}
        isLoading={isDeleting}
        onConfirm={confirmDeleteGoal}
        onCancel={() => {
          setDeleteModalOpen(false);
          setGoalToDelete(null);
        }}
      />
    </div>
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

    await backendService.updateGoal(String(goalId), {
      currentAmount: goal.currentAmount + amount,
    });
    // TODO: Sync goalContributions to backend if not already implemented

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-2xl font-display font-bold mb-6 text-gray-900">Add Contribution</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 font-medium"
              required
              autoFocus
              aria-label="Contribution amount"
              title="Contribution amount"
              placeholder="Enter contribution amount"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">From Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 font-medium appearance-none bg-white"
              aria-label="Select account"
              title="Select account"
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
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium active:scale-95"
              aria-label="Cancel contribution"
              title="Cancel contribution"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-all font-medium shadow-sm active:scale-95"
              aria-label="Add contribution"
              title="Add contribution"
            >
              Add Contribution
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
