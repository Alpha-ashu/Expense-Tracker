import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { saveGoalWithBackendSync } from '@/lib/auth-sync-integration';
import { GoalMember } from '@/lib/database';
import { GOAL_CATEGORIES, getMonthlySuggestion } from '@/lib/goal-utils';
import { ArrowLeft, ArrowRight, Copy, Sparkles, Target, Users } from 'lucide-react';
import { toast } from 'sonner';

const steps = [
  { id: 1, title: 'Basic Info', description: 'Name, category, description' },
  { id: 2, title: 'Financial Details', description: 'Target, contributions, timeline' },
  { id: 3, title: 'Goal Type', description: 'Individual or group' },
];

export const AddGoal: React.FC = () => {
  const { setCurrentPage, currency, refreshData, friends } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
  const [memberInput, setMemberInput] = useState({
    name: '',
    contactType: 'email' as 'phone' | 'email' | 'link',
    contactValue: '',
  });
  const [members, setMembers] = useState<GoalMember[]>([]);

  const deadlineDate = formData.deadline ? new Date(formData.deadline) : null;
  const suggestion = deadlineDate
    ? getMonthlySuggestion(formData.targetAmount, formData.currentAmount, deadlineDate)
    : null;

  useEffect(() => {
    if (formData.monthlySavingPlan <= 0 && suggestion?.monthlyAmount) {
      setFormData((prev) => ({
        ...prev,
        monthlySavingPlan: Number(suggestion.monthlyAmount.toFixed(2)),
      }));
    }
  }, [suggestion?.monthlyAmount, formData.monthlySavingPlan]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

  const validateStep = (step: number) => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) nextErrors.name = 'Goal name is required';
      if (!formData.category) nextErrors.category = 'Category is required';
    }

    if (step === 2) {
      if (formData.targetAmount <= 0) nextErrors.targetAmount = 'Target amount must be greater than 0';
      if (formData.currentAmount < 0) nextErrors.currentAmount = 'Initial contribution cannot be negative';
      if (formData.currentAmount > formData.targetAmount) nextErrors.currentAmount = 'Initial contribution cannot exceed target';
      if (!formData.deadline) nextErrors.deadline = 'Target date is required';
    }

    if (step === 3) {
      if (formData.goalType === 'group' && members.length === 0) {
        nextErrors.members = 'Add at least one member for a group goal';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

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

    if (!validateStep(3)) return;

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
      <div className="space-y-6 max-w-[760px] w-full mx-auto pb-8">
        <PageHeader
          title="Create New Goal"
          subtitle="Build a plan that gets you there"
          icon={<Target size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="goals"
        />

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Step {currentStep} of {steps.length}</p>
                <p className="text-xs text-gray-500">{steps[currentStep - 1].description}</p>
              </div>
              <div className="text-xs text-gray-500">{steps[currentStep - 1].title}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`h-2 rounded-full transition-colors ${step.id <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="add-goal-name" className="block text-sm font-semibold text-gray-900 mb-2">Goal Name *</label>
                  <input
                    id="add-goal-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="e.g., Trip to Bali"
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-2">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Category *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GOAL_CATEGORIES.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: category.key })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formData.category === category.key
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="text-lg">{category.icon}</div>
                        <div className="text-xs font-semibold mt-1">{category.label}</div>
                      </button>
                    ))}
                  </div>
                  {errors.category && <p className="text-xs text-red-600 mt-2">{errors.category}</p>}
                </div>

                <div>
                  <label htmlFor="add-goal-description" className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                  <textarea
                    id="add-goal-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                    placeholder="Add a short note about this goal"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="add-goal-target-amount" className="block text-sm font-semibold text-gray-900 mb-2">Target Amount *</label>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-lg">{currency}</span>
                    <input
                      id="add-goal-target-amount"
                      type="number"
                      step="0.01"
                      value={formData.targetAmount || ''}
                      onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.targetAmount && <p className="text-xs text-red-600 mt-2">{errors.targetAmount}</p>}
                </div>

                <div>
                  <label htmlFor="add-goal-initial-contribution" className="block text-sm font-semibold text-gray-900 mb-2">Initial Contribution</label>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-lg">{currency}</span>
                    <input
                      id="add-goal-initial-contribution"
                      type="number"
                      step="0.01"
                      value={formData.currentAmount || ''}
                      onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.currentAmount && <p className="text-xs text-red-600 mt-2">{errors.currentAmount}</p>}
                </div>

                <div>
                  <label htmlFor="add-goal-target-date" className="block text-sm font-semibold text-gray-900 mb-2">Target Date *</label>
                  <input
                    id="add-goal-target-date"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    aria-label="Goal target date"
                    title="Goal target date"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                  {errors.deadline && <p className="text-xs text-red-600 mt-2">{errors.deadline}</p>}
                </div>

                <div>
                  <label htmlFor="add-goal-monthly-saving" className="block text-sm font-semibold text-gray-900 mb-2">Monthly Saving Plan</label>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-lg">{currency}</span>
                    <input
                      id="add-goal-monthly-saving"
                      type="number"
                      step="0.01"
                      value={formData.monthlySavingPlan || ''}
                      onChange={(e) => setFormData({ ...formData, monthlySavingPlan: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="0.00"
                    />
                  </div>
                  {suggestion && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                      <Sparkles size={16} className="mt-0.5" />
                      <div>
                        Suggested saving: <span className="font-semibold">{formatCurrency(suggestion.monthlyAmount)}</span> per month for {suggestion.months} months.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Goal Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, goalType: 'individual' })}
                      className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                        formData.goalType === 'individual'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <p className="font-semibold">Individual Goal</p>
                      <p className="text-xs text-gray-500 mt-1">Track progress on your own.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, goalType: 'group' })}
                      className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                        formData.goalType === 'group'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <p className="font-semibold">Group Goal</p>
                      <p className="text-xs text-gray-500 mt-1">Invite friends to contribute.</p>
                    </button>
                  </div>
                </div>

                {formData.goalType === 'group' && (
                  <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={16} /> Add Members</h4>
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                        aria-label="Copy invite link"
                        title="Copy invite link"
                      >
                        <Copy size={14} /> Copy invite link
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        id="add-goal-member-name"
                        type="text"
                        value={memberInput.name}
                        onChange={(e) => setMemberInput({ ...memberInput, name: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                        placeholder="Name"
                        aria-label="Member name"
                        title="Member name"
                      />
                      <select
                        id="add-goal-member-contact-type"
                        value={memberInput.contactType}
                        onChange={(e) => setMemberInput({ ...memberInput, contactType: e.target.value as 'phone' | 'email' | 'link' })}
                        aria-label="Member contact type"
                        title="Member contact type"
                        className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="phone">Phone</option>
                        <option value="email">Email</option>
                        <option value="link">Invite Link</option>
                      </select>
                      <input
                        id="add-goal-member-contact-value"
                        type="text"
                        value={memberInput.contactValue}
                        onChange={(e) => setMemberInput({ ...memberInput, contactValue: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg bg-white"
                        placeholder="Phone or email"
                        aria-label="Member contact value"
                        title="Member contact value"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={addMember} className="px-3 py-2 rounded-lg bg-black text-white text-sm" aria-label="Add member" title="Add member">+ Add Member</button>
                      {friends.slice(0, 4).map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => addFriendAsMember(friend)}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-xs"
                          aria-label={`Add ${friend.name} as member`}
                          title={`Add ${friend.name} as member`}
                        >
                          {friend.name}
                        </button>
                      ))}
                    </div>

                    {errors.members && <p className="text-xs text-red-600">{errors.members}</p>}

                    <div className="space-y-1">
                      {members.map((member, index) => (
                        <div key={`${member.name}-${index}`} className="text-sm text-gray-700">
                          • {member.name} ({member.contactType}: {member.contactValue})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-6">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              {currentStep < steps.length && (
                <button
                  type="button"
                  onClick={nextStep}
                  className="ml-auto inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              )}
              {currentStep === steps.length && (
                <button
                  type="submit"
                  className="ml-auto inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-semibold shadow-sm"
                >
                  Create Goal
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
