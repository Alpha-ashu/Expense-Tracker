import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
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

  const [isDesktop, setIsDesktop] = useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return (
    <>
        <div className="flex flex-col min-h-screen bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-100">
            <button type="button" onClick={() => setCurrentPage('goals')}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-white transition-all shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Target size={15} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-900 leading-tight">Create New Goal</h1>
                <p className="text-[11px] text-gray-400">Build a plan that gets you there</p>
              </div>
            </div>
            <button type="button" onClick={() => setCurrentPage('goals')}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-white">
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-4 py-4 flex-1 space-y-5">

              {/* Step progress */}
              <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Step {currentStep} of {steps.length}</p>
                    <p className="text-[11px] text-gray-400">{steps[currentStep - 1].description}</p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    {steps[currentStep - 1].title}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {steps.map((step) => (
                    <div key={step.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${step.id <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>

              {/* Step 1 */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  {/* Goal Name */}
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Goal Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all placeholder:text-gray-300"
                      placeholder="e.g., Trip to Bali"
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
                  </div>

                  {/* Category Grid */}
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Category *</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {GOAL_CATEGORIES.map((category) => (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: category.key })}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            formData.category === category.key
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                          }`}
                        >
                          <div className="text-xl mb-1">{category.icon}</div>
                          <div className="text-xs font-bold">{category.label}</div>
                        </button>
                      ))}
                    </div>
                    {errors.category && <p className="text-xs text-red-500 mt-1.5">{errors.category}</p>}
                  </div>

                  {/* Description */}
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white resize-none transition-all placeholder:text-gray-300"
                      placeholder="Add a short note about this goal"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {currentStep === 2 && (
                <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4 space-y-4">
                  {/* Target Amount */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Target Amount *</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
                      <span className="text-sm font-bold text-gray-400 shrink-0">{currency}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={formData.targetAmount || ''}
                        onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-2xl font-black text-gray-900 outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.targetAmount && <p className="text-xs text-red-500 mt-1.5">{errors.targetAmount}</p>}
                  </div>

                  {/* Initial Contribution */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Initial Contribution</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
                      <span className="text-sm font-bold text-gray-400 shrink-0">{currency}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={formData.currentAmount || ''}
                        onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-lg font-bold text-gray-900 outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.currentAmount && <p className="text-xs text-red-500 mt-1.5">{errors.currentAmount}</p>}
                  </div>

                  {/* Target Date */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Target Date *</label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                    />
                    {errors.deadline && <p className="text-xs text-red-500 mt-1.5">{errors.deadline}</p>}
                  </div>

                  {/* Monthly Saving */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Monthly Saving Plan</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
                      <span className="text-sm font-bold text-gray-400 shrink-0">{currency}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={formData.monthlySavingPlan || ''}
                        onChange={(e) => setFormData({ ...formData, monthlySavingPlan: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-lg font-bold text-gray-900 outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                    {suggestion && (
                      <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                        <Sparkles size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-800 font-medium">
                          Suggested: <span className="font-bold">{formatCurrency(suggestion.monthlyAmount)}</span>/mo for {suggestion.months} months
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Goal Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['individual', 'group'] as const).map((type) => (
                        <button key={type} type="button"
                          onClick={() => setFormData({ ...formData, goalType: type })}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            formData.goalType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                          }`}>
                          <p className="font-bold text-sm capitalize">{type === 'individual' ? 'Individual Goal' : 'Group Goal'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{type === 'individual' ? 'Track on your own' : 'Invite friends to contribute'}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.goalType === 'group' && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={15} /> Add Members</h4>
                        <button type="button" onClick={copyInviteLink}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                          <Copy size={12} /> Copy link
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input type="text" value={memberInput.name}
                          onChange={(e) => setMemberInput({ ...memberInput, name: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                          placeholder="Member name" />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={memberInput.contactType}
                            onChange={(e) => setMemberInput({ ...memberInput, contactType: e.target.value as 'phone' | 'email' | 'link' })}
                            className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                            <option value="phone">Phone</option>
                            <option value="email">Email</option>
                            <option value="link">Invite Link</option>
                          </select>
                          <input type="text" value={memberInput.contactValue}
                            onChange={(e) => setMemberInput({ ...memberInput, contactValue: e.target.value })}
                            className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            placeholder="Phone or email" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={addMember}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm">
                          + Add Member
                        </button>
                        {friends.slice(0, 3).map((friend) => (
                          <button key={friend.id} type="button" onClick={() => addFriendAsMember(friend)}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-white">
                            {friend.name}
                          </button>
                        ))}
                      </div>
                      {errors.members && <p className="text-xs text-red-500">{errors.members}</p>}
                      <div className="space-y-1.5">
                        {members.map((m, i) => (
                          <div key={`${m.name}-${i}`} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-xl px-3 py-2">
                            <span className="font-bold text-gray-900">{m.name}</span>
                            <span className="text-gray-400"></span>
                            <span>{m.contactType}: {m.contactValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom nav bar */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3 pb-safe">
              {currentStep > 1 ? (
                <button type="button" onClick={prevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-white transition-all">
                  <ArrowLeft size={15} /> Back
                </button>
              ) : (
                <button type="button" onClick={() => setCurrentPage('goals')}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-white transition-all">
                  <ArrowLeft size={15} /> Cancel
                </button>
              )}
              {currentStep < steps.length ? (
                <button type="button" onClick={nextStep}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-black shadow-md hover:bg-blue-700 transition-all">
                  Next <ArrowRight size={15} />
                </button>
              ) : (
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all">
                  <Target size={15} /> Create Goal
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        
        <div className="flex min-h-screen flex-col items-start justify-start p-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Target size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Create Goal</h1>
              <p className="text-xs text-gray-500">Smart planning for your financial future.</p>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              
              {/* Primary Horizontal Action Bar */}
              <div className="flex items-center gap-4">
                
                {/* 1. Goal Name */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Goal Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                    placeholder="e.g., Trip to Bali, Emergency Fund..."
                    required
                  />
                </div>

                {/* 2. Target Amount */}
                <div className="w-[200px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Target</label>
                  <div className="flex items-center bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-black rounded-2xl px-4 py-4 transition-all">
                    <span className="text-gray-500 font-bold mr-2">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.targetAmount || ''}
                      onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-xl font-display font-bold text-gray-900 border-none outline-none placeholder:text-gray-300"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* 3. Category Smart Dropdown */}
                <div className="w-[180px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer transition-all"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                  >
                    {GOAL_CATEGORIES.map(cat => (
                       <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Deadline */}
                <div className="w-[160px] shrink-0">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Deadline</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none"
                    required
                  />
                </div>

                {/* Submit Action */}
                <div className="shrink-0 pt-6">
                  <button
                    type="submit"
                    className="h-14 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Target size={18} /> Create
                  </button>
                </div>
              </div>

              {/* Secondary Details Row */}
              <div className="flex gap-4 border-t border-gray-100 pt-6">
                 {/* Type Dropdown */}
                 <div className="w-[200px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Goal Type</label>
                    <select
                      value={formData.goalType}
                      onChange={(e) => setFormData({ ...formData, goalType: e.target.value as any })}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer transition-all"
                      style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                    >
                      <option value="individual">Individual</option>
                      <option value="group">Group Goal</option>
                    </select>
                 </div>
                 
                 {/* Current Amount */}
                 <div className="w-[180px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Initial Deposit</label>
                    <div className="flex items-center bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-black rounded-xl px-3 py-3 transition-all">
                      <span className="text-gray-500 font-bold mr-2 text-sm">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.currentAmount || ''}
                        onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-sm font-bold text-gray-900 border-none outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                 </div>

                 {/* Description */}
                 <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-black focus:border-black rounded-xl py-3 px-3 text-sm font-bold text-gray-900 outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                      placeholder="Add a short note about this goal..."
                    />
                 </div>
              </div>

              
              {formData.goalType === 'group' && (
                <div className="mt-4 p-6 bg-blue-50/50 border border-blue-100 rounded-2xl">
                   <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2"><Users size={16} /> Group Goal Configuration</h3>
                   <div className="text-sm text-gray-600 mb-4">
                     Advanced group member configuration is handled automatically when editing, or use the mobile view.
                   </div>
                   <div className="opacity-70 pointer-events-none grid grid-cols-3 gap-2">
                      <input className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Member name" disabled />
                      <input className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Contact type" disabled />
                      <button className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-semibold" disabled>Add Member</button>
                   </div>
                </div>
              )}

              {/* Smart Suggestion UI */}
              {suggestion && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                     <Sparkles size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-900 font-medium">Smart Insight</p>
                    <p className="text-xs text-emerald-700">
                      Save <span className="font-bold">{formatCurrency(suggestion.monthlyAmount)}</span> per month for {suggestion.months} months to reach your goal.
                    </p>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      </div>
    </>
  );
};
