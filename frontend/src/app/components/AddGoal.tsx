import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext'; import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { saveGoalWithBackendSync } from '@/lib/auth-sync-integration';
import { GoalMember } from '@/lib/database';
import { GOAL_CATEGORIES, getMonthlySuggestion } from '@/lib/goal-utils';
import { Copy, Target, Users } from 'lucide-react';
import { toast } from 'sonner';

export const AddGoal: React.FC = () => {
  const { setCurrentPage, currency, refreshData, friends } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    category: 'travel',
    targetAmount: 0,
    currentAmount: 0,
    monthlySavingPlan: 0,
    deadline: '',
    description: '',
    goalType: 'individual' as 'individual' | 'group',
  });
  const [memberInput, setMemberInput] = useState({ name: '', contactType: 'email' as 'phone' | 'email' | 'link', contactValue: '' });
  const [members, setMembers] = useState<GoalMember[]>([]);

  const deadlineDate = formData.deadline ? new Date(formData.deadline) : new Date();
  const suggestion = getMonthlySuggestion(formData.targetAmount, formData.currentAmount, deadlineDate);

  useEffect(() => {
    if (formData.monthlySavingPlan <= 0 && suggestion.monthlyAmount > 0) {
      setFormData((prev) => ({ ...prev, monthlySavingPlan: Number(suggestion.monthlyAmount.toFixed(2)) }));
    }
  }, [suggestion.monthlyAmount, formData.monthlySavingPlan]);

  const addMember = () => {
    if (!memberInput.name || !memberInput.contactValue) {
      toast.error('Member name and contact are required');
      return;
    }

    setMembers((prev) => ([
      ...prev,
      {
        name: memberInput.name,
        contactType: memberInput.contactType,
        contactValue: memberInput.contactValue,
        contribution: 0,
        status: 'pending',
      },
    ]));
    setMemberInput({ name: '', contactType: 'email', contactValue: '' });
  };

  const addFriendAsMember = (friend: any) => {
    setMembers((prev) => ([
      ...prev,
      {
        name: friend.name,
        contactType: friend.contactEmail ? 'email' : 'phone',
        contactValue: friend.contactEmail || friend.contactPhone || '',
        contribution: 0,
        status: 'pending',
      },
    ]));
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/invite/goal?name=${encodeURIComponent(formData.name || 'group-goal')}`;
    await navigator.clipboard.writeText(link);
    toast.success('Invite link copied');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.targetAmount <= 0) {
      toast.error('Target amount must be greater than 0');
      return;
    }

    if (formData.currentAmount > formData.targetAmount) {
      toast.error('Current amount cannot exceed target amount');
      return;
    }

    if (formData.goalType === 'group' && members.length === 0) {
      toast.error('Add at least one member for a group goal');
      return;
    }

    try {
      await saveGoalWithBackendSync({
        name: formData.name,
        category: formData.category,
        description: formData.description,
        targetAmount: formData.targetAmount,
        currentAmount: formData.currentAmount,
        monthlySavingPlan: formData.monthlySavingPlan,
        targetDate: new Date(formData.deadline),
        isGroupGoal: formData.goalType === 'group',
        members: formData.goalType === 'group' ? members : [],
      });
      toast.success('Goal created successfully');
      refreshData();
      setCurrentPage('goals');
    } catch (error) {
      console.error('Failed to add goal:', error);
      toast.error('Failed to add goal');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6 max-w-[480px] w-full mx-auto pb-8">
        <PageHeader
          title="Create New Goal"
          subtitle="Set a financial goal and track your progress"
          icon={<Target size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="goals"
        />

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Goal Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="e.g., Save for vacation"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                aria-label="Goal Category"
                title="Goal Category"
              >
                {GOAL_CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>{category.icon} {category.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Goal Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, goalType: 'individual' })}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${formData.goalType === 'individual' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  Individual Goal
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, goalType: 'group' })}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${formData.goalType === 'group' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  Group Goal
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Target Amount *</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetAmount || ''}
                  onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Initial Contribution</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentAmount || ''}
                  onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Target Deadline *</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                aria-label="Goal Deadline"
                title="Goal Deadline"
                placeholder="Goal Deadline"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Monthly Saving Plan</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthlySavingPlan || ''}
                  onChange={(e) => setFormData({ ...formData, monthlySavingPlan: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Suggested Saving: {currency} {suggestion.monthlyAmount.toFixed(2)} per month for {suggestion.months} month(s)
              </p>
            </div>

            {formData.goalType === 'group' && (
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={16} /> Add Members</h4>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                  >
                    <Copy size={14} /> Share invite link
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={memberInput.name}
                    onChange={(e) => setMemberInput({ ...memberInput, name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    placeholder="Name"
                  />
                  <select
                    value={memberInput.contactType}
                    onChange={(e) => setMemberInput({ ...memberInput, contactType: e.target.value as 'phone' | 'email' | 'link' })}
                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    aria-label="Member contact type"
                    title="Member contact type"
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="link">Invite Link</option>
                  </select>
                  <input
                    type="text"
                    value={memberInput.contactValue}
                    onChange={(e) => setMemberInput({ ...memberInput, contactValue: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    placeholder="Phone or email"
                  />
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={addMember} className="px-3 py-2 rounded-lg bg-black text-white text-sm">+ Add Friend</button>
                  {friends.slice(0, 3).map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => addFriendAsMember(friend)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-xs"
                    >
                      {friend.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  {members.map((member, index) => (
                    <div key={`${member.name}-${index}`} className="text-sm text-gray-700">
                      • {member.name} ({member.contactType}: {member.contactValue})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                placeholder="Add any notes about this goal"
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => setCurrentPage('goals')}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700 bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-semibold shadow-lg"
              >
                Create Goal
              </button>
            </div>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
