import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { saveGoalWithBackendSync } from '@/lib/auth-sync-integration';
import { GoalMember } from '@/lib/database';
import { GOAL_CATEGORIES, getMonthlySuggestion } from '@/lib/goal-utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Sparkles,
  Target,
  Users,
  TrendingUp,
  Calendar,
  Wallet,
  ChevronLeft,
  Check,
  Trash2,
  UserPlus,
  Mail,
  Phone,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { takeVoiceDraft, VOICE_GOAL_DRAFT_KEY, type VoiceGoalDraft } from '@/lib/voiceDrafts';

const steps = [
  { id: 1, title: 'Goal Details', description: 'Name your goal and set a category' },
  { id: 2, title: 'Target & Timeline', description: 'Set amount, deadline, and monthly plan' },
  { id: 3, title: 'Goal Type', description: 'Individual goal or group savings' },
];

const goalTypeOptions = [
  { value: 'individual', label: 'Individual', description: 'Track this goal on your own', icon: Target, group: 'Goal type' },
  { value: 'group', label: 'Group Goal', description: 'Invite friends to contribute', icon: Users, group: 'Goal type' },
];

const contactTypeOptions = [
  { value: 'email', label: 'Email', icon: Mail, group: 'Contact method' },
  { value: 'phone', label: 'Phone', icon: Phone, group: 'Contact method' },
  { value: 'link', label: 'Invite Link', icon: LinkIcon, group: 'Contact method' },
];

export const AddGoal: React.FC = () => {
  const { setCurrentPage, currency, refreshData, friends } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(() => ({
    name: '',
    category: 'travel',
    targetAmount: 0,
    currentAmount: 0,
    monthlySavingPlan: 0,
    deadline: '',
    description: '',
    goalType: 'individual' as 'individual' | 'group',
  }));
  const [memberInput, setMemberInput] = useState({
    name: '',
    contactType: 'email' as 'phone' | 'email' | 'link',
    contactValue: '',
  });
  const [members, setMembers] = useState<GoalMember[]>([]);

  const goalCategoryOptions = GOAL_CATEGORIES.map((category) => ({
    value: category.key,
    label: category.label,
    icon: <span className="text-base">{category.icon}</span>,
    group: 'Goal categories',
  }));

  const deadlineDate = formData.deadline ? new Date(formData.deadline) : null;
  const suggestion = deadlineDate
    ? getMonthlySuggestion(formData.targetAmount, formData.currentAmount, deadlineDate)
    : null;

  useEffect(() => {
    const draft = takeVoiceDraft<VoiceGoalDraft>(VOICE_GOAL_DRAFT_KEY);
    if (!draft) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      name: draft.description || prev.name,
      targetAmount: draft.amount || prev.targetAmount,
      description: draft.description || prev.description,
    }));
  }, []);

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
      {!isDesktop ? (
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans">
          {/* Immersive Hero Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-4 pt-4 pb-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400" />
            <div className="absolute -top-10 right-2 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />

            <div className="relative">
              {/* Top Bar */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage('goals')}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                    <Target size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">New Goal</span>
                </div>
                <div className="w-11" />
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-2">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                        step.id < currentStep
                          ? 'bg-white text-purple-600'
                          : step.id === currentStep
                            ? 'bg-white text-purple-600 ring-2 ring-white/50'
                            : 'bg-white/20 text-white/70'
                      )}
                    >
                      {step.id < currentStep ? <Check size={14} /> : step.id}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 w-8 rounded-full transition-all',
                          step.id < currentStep ? 'bg-white' : 'bg-white/30'
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Amount Card */}
          <div className="relative -mt-3 mx-4">
            <div className="rounded-[28px] p-5 shadow-xl shadow-purple-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Target Amount</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-400">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.targetAmount || ''}
                      onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-4xl font-black text-gray-900 outline-none placeholder:text-gray-200"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.targetAmount && <p className="mt-1 text-xs text-red-500">{errors.targetAmount}</p>}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                  <TrendingUp size={22} className="text-white" />
                </div>
              </div>

              {/* Quick Stats */}
              {formData.targetAmount > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(formData.targetAmount - formData.currentAmount)}
                    </p>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Progress</p>
                    <p className="text-sm font-bold text-violet-600">
                      {Math.round((formData.currentAmount / formData.targetAmount) * 100)}%
                    </p>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Monthly</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formData.monthlySavingPlan > 0 ? formatCurrency(formData.monthlySavingPlan) : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-1 space-y-4 p-4">
              {/* Step 1: Goal Details */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Goal Name */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Target size={14} />
                      Goal Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                      placeholder="e.g., Dream Vacation to Bali"
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-red-500">{errors.name}</p>}
                  </div>

                  {/* Category Selection */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Wallet size={14} />
                      Category *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {GOAL_CATEGORIES.map((category) => (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: category.key })}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all',
                            formData.category === category.key
                              ? 'border-violet-500 bg-violet-50 text-violet-700'
                              : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                          )}
                        >
                          <span className="text-xl">{category.icon}</span>
                          <span className="text-[11px] font-bold">{category.label}</span>
                        </button>
                      ))}
                    </div>
                    {errors.category && <p className="mt-2 text-xs text-red-500">{errors.category}</p>}
                  </div>

                  {/* Description */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Sparkles size={14} />
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                      placeholder="What motivates you to achieve this goal?"
                      rows={3}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 2: Target & Timeline */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Initial Contribution */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Wallet size={14} />
                      Initial Contribution
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:border-violet-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/20">
                      <span className="text-lg font-bold text-gray-400">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.currentAmount || ''}
                        onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.currentAmount && <p className="mt-1.5 text-xs text-red-500">{errors.currentAmount}</p>}
                  </div>

                  {/* Target Date */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Calendar size={14} />
                      Target Date *
                    </label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                    />
                    {errors.deadline && <p className="mt-1.5 text-xs text-red-500">{errors.deadline}</p>}
                  </div>

                  {/* Monthly Saving Plan */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <TrendingUp size={14} />
                      Monthly Saving Plan
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:border-violet-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/20">
                      <span className="text-lg font-bold text-gray-400">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monthlySavingPlan || ''}
                        onChange={(e) => setFormData({ ...formData, monthlySavingPlan: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
                        placeholder="0.00"
                      />
                    </div>
                    {suggestion && (
                      <div className="mt-3 flex items-start gap-3 rounded-xl bg-violet-50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100">
                          <Sparkles size={14} className="text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-violet-900">Smart Suggestion</p>
                          <p className="text-xs text-violet-700">
                            Save <span className="font-bold">{formatCurrency(suggestion.monthlyAmount)}</span> per month
                            for {suggestion.months} months to reach your goal.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Goal Type */}
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Goal Type Selection */}
                  <div className="rounded-2xl p-4 shadow-sm">
                    <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Users size={14} />
                      Goal Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['individual', 'group'] as const).map((type) => {
                        const Icon = type === 'individual' ? Target : Users;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, goalType: type })}
                            className={cn(
                              'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                              formData.goalType === type
                                ? 'border-violet-500 bg-violet-50 text-violet-700'
                                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                            )}
                          >
                            <Icon size={24} className={formData.goalType === type ? 'text-violet-600' : 'text-gray-400'} />
                            <span className="text-sm font-bold capitalize">{type === 'individual' ? 'Individual' : 'Group'}</span>
                            <span className="text-[10px] text-center text-gray-400">
                              {type === 'individual' ? 'Track on your own' : 'Invite friends'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group Members Section */}
                  <AnimatePresence>
                    {formData.goalType === 'group' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        {/* Invite Link */}
                        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                                <LinkIcon size={18} className="text-violet-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Invite Friends</p>
                                <p className="text-xs text-gray-500">Share link to join this goal</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={copyInviteLink}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm text-violet-600 transition-all hover:shadow-md"
                            >
                              <Copy size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Add Member Form */}
                        <div className="rounded-2xl p-4 shadow-sm">
                          <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                            <UserPlus size={14} />
                            Add Members
                          </label>
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={memberInput.name}
                              onChange={(e) => setMemberInput({ ...memberInput, name: e.target.value })}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                              placeholder="Member name"
                            />
                            <div className="flex gap-2">
                              <select
                                value={memberInput.contactType}
                                onChange={(e) => setMemberInput({ ...memberInput, contactType: e.target.value as 'phone' | 'email' | 'link' })}
                                className="w-1/3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                              >
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="link">Link</option>
                              </select>
                              <input
                                type="text"
                                value={memberInput.contactValue}
                                onChange={(e) => setMemberInput({ ...memberInput, contactValue: e.target.value })}
                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
                                placeholder="Contact value"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={addMember}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
                            >
                              <UserPlus size={16} />
                              Add Member
                            </button>
                          </div>
                          {errors.members && <p className="mt-2 text-xs text-red-500">{errors.members}</p>}
                        </div>

                        {/* Quick Add Friends */}
                        {friends.length > 0 && (
                          <div className="rounded-2xl p-4 shadow-sm">
                            <label className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Quick Add Friends</label>
                            <div className="flex flex-wrap gap-2">
                              {friends.slice(0, 5).map((friend) => (
                                <button
                                  key={friend.id}
                                  type="button"
                                  onClick={() => addFriendAsMember(friend)}
                                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all hover:border-violet-300 hover:bg-violet-50"
                                >
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                                    {friend.name.charAt(0).toUpperCase()}
                                  </div>
                                  {friend.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Members List */}
                        {members.length > 0 && (
                          <div className="rounded-2xl p-4 shadow-sm">
                            <label className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                              Members ({members.length})
                            </label>
                            <div className="space-y-2">
                              {members.map((m, i) => (
                                <div
                                  key={`${m.name}-${i}`}
                                  className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                                      {m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-gray-900">{m.name}</p>
                                      <p className="text-xs text-gray-500">
                                        {m.contactType === 'email' && <Mail size={10} className="mr-1 inline" />}
                                        {m.contactType === 'phone' && <Phone size={10} className="mr-1 inline" />}
                                        {m.contactType === 'link' && <LinkIcon size={10} className="mr-1 inline" />}
                                        {m.contactValue}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="sticky bottom-0 border-t border-gray-100 px-4 py-4">
              <div className="flex gap-3">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-5 py-3.5 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
                  >
                    <ArrowLeft size={18} />
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentPage('goals')}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-5 py-3.5 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
                  >
                    <ArrowLeft size={18} />
                    Cancel
                  </button>
                )}
                {currentStep < steps.length ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:shadow-xl active:scale-[0.98]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:shadow-xl active:scale-[0.98]"
                  >
                    <Target size={18} />
                    Create Goal
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans">
          <div className="w-full max-w-[700px]">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCurrentPage('goals')}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:bg-gray-50"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Create New Goal</h1>
                <p className="text-sm text-gray-500">Plan and track your financial dreams</p>
              </div>
            </div>

            {/* Main Card */}
            <div className="overflow-hidden rounded-[32px] shadow-xl shadow-purple-100/50">
              {/* Hero Gradient Section */}
              <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-8 py-8">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl" />

                <div className="relative">
                  <p className="text-sm font-bold uppercase tracking-widest text-white/70">Target Amount</p>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-white/80">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.targetAmount || ''}
                      onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full max-w-[300px] bg-transparent text-5xl font-black text-white outline-none placeholder:text-white/30"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.targetAmount && <p className="mt-2 text-sm text-white/80">{errors.targetAmount}</p>}
                </div>

                {/* Progress Preview */}
                {formData.targetAmount > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-white/60">Remaining</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {formatCurrency(formData.targetAmount - formData.currentAmount)}
                      </p>
                    </div>
                    <div className="border-l border-white/20 pl-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/60">Progress</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {Math.round((formData.currentAmount / formData.targetAmount) * 100)}%
                      </p>
                    </div>
                    <div className="border-l border-white/20 pl-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/60">Monthly</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {formData.monthlySavingPlan > 0 ? formatCurrency(formData.monthlySavingPlan) : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="space-y-6 p-8">
                {/* Step 1: Goal Details */}
                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Goal Name */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Target size={14} />
                        Goal Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-lg font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                        placeholder="e.g., Dream Vacation to Bali"
                      />
                      {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
                    </div>

                    {/* Category */}
                    <div>
                      <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Wallet size={14} />
                        Category *
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {GOAL_CATEGORIES.map((category) => (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => setFormData({ ...formData, category: category.key })}
                            className={cn(
                              'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all',
                              formData.category === category.key
                                ? 'border-violet-500 bg-violet-50 text-violet-700'
                                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            <span className="text-2xl">{category.icon}</span>
                            <span className="text-sm font-bold">{category.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.category && <p className="mt-2 text-sm text-red-500">{errors.category}</p>}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Sparkles size={14} />
                        Description (Optional)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                        placeholder="What motivates you to achieve this goal?"
                        rows={3}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Target & Timeline */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Initial Contribution */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Wallet size={14} />
                        Initial Contribution
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-all focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                        <span className="text-xl font-bold text-gray-400">{currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.currentAmount || ''}
                          onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
                          placeholder="0.00"
                        />
                      </div>
                      {errors.currentAmount && <p className="mt-2 text-sm text-red-500">{errors.currentAmount}</p>}
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Target Date */}
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <Calendar size={14} />
                          Target Date *
                        </label>
                        <input
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base font-semibold text-gray-900 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                        />
                        {errors.deadline && <p className="mt-2 text-sm text-red-500">{errors.deadline}</p>}
                      </div>

                      {/* Monthly Saving Plan */}
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <TrendingUp size={14} />
                          Monthly Saving Plan
                        </label>
                        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-all focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                          <span className="text-xl font-bold text-gray-400">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.monthlySavingPlan || ''}
                            onChange={(e) => setFormData({ ...formData, monthlySavingPlan: parseFloat(e.target.value) || 0 })}
                            className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Smart Suggestion */}
                    {suggestion && (
                      <div className="flex items-start gap-4 rounded-2xl bg-violet-50 p-5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100">
                          <Sparkles size={20} className="text-violet-600" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-violet-900">Smart Suggestion</p>
                          <p className="text-sm text-violet-700">
                            To reach your goal by the deadline, save{' '}
                            <span className="font-bold">{formatCurrency(suggestion.monthlyAmount)}</span> per month for{' '}
                            {suggestion.months} months.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Goal Type */}
                {currentStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Goal Type Selection */}
                    <div>
                      <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Users size={14} />
                        Goal Type
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {(['individual', 'group'] as const).map((type) => {
                          const Icon = type === 'individual' ? Target : Users;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData({ ...formData, goalType: type })}
                              className={cn(
                                'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all',
                                formData.goalType === type
                                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                              )}
                            >
                              <div className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-2xl',
                                formData.goalType === type ? 'bg-violet-200' : 'bg-gray-100'
                              )}>
                                <Icon size={28} className={formData.goalType === type ? 'text-violet-700' : 'text-gray-400'} />
                              </div>
                              <div className="text-left">
                                <p className="text-lg font-bold capitalize">{type === 'individual' ? 'Individual Goal' : 'Group Goal'}</p>
                                <p className="text-sm text-gray-400">
                                  {type === 'individual' ? 'Track on your own' : 'Invite friends to contribute'}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group Members Section */}
                    <AnimatePresence>
                      {formData.goalType === 'group' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4"
                        >
                          {/* Invite Link */}
                          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                                <LinkIcon size={24} className="text-violet-600" />
                              </div>
                              <div>
                                <p className="text-base font-bold text-gray-900">Invite Friends</p>
                                <p className="text-sm text-gray-500">Share link to join this goal</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={copyInviteLink}
                              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-violet-600 transition-all hover:shadow-md"
                            >
                              <Copy size={20} />
                            </button>
                          </div>

                          {/* Add Member Form */}
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                            <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                              <UserPlus size={14} />
                              Add Members
                            </label>
                            <div className="flex gap-3">
                              <input
                                type="text"
                                value={memberInput.name}
                                onChange={(e) => setMemberInput({ ...memberInput, name: e.target.value })}
                                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                placeholder="Member name"
                              />
                              <select
                                value={memberInput.contactType}
                                onChange={(e) => setMemberInput({ ...memberInput, contactType: e.target.value as 'phone' | 'email' | 'link' })}
                                className="w-32 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                              >
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="link">Link</option>
                              </select>
                              <input
                                type="text"
                                value={memberInput.contactValue}
                                onChange={(e) => setMemberInput({ ...memberInput, contactValue: e.target.value })}
                                className="w-48 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                placeholder="Contact"
                              />
                              <button
                                type="button"
                                onClick={addMember}
                                className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 active:scale-95"
                              >
                                Add
                              </button>
                            </div>
                            {errors.members && <p className="mt-2 text-sm text-red-500">{errors.members}</p>}
                          </div>

                          {/* Quick Add Friends */}
                          {friends.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {friends.slice(0, 8).map((friend) => (
                                <button
                                  key={friend.id}
                                  type="button"
                                  onClick={() => addFriendAsMember(friend)}
                                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-violet-300 hover:bg-violet-50"
                                >
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                                    {friend.name.charAt(0).toUpperCase()}
                                  </div>
                                  {friend.name}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Members List */}
                          {members.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Members ({members.length})
                              </label>
                              <div className="grid gap-2">
                                {members.map((m, i) => (
                                  <div
                                    key={`${m.name}-${i}`}
                                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-700">
                                        {m.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-gray-900">{m.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {m.contactType === 'email' && <Mail size={12} className="mr-1 inline" />}
                                          {m.contactType === 'phone' && <Phone size={12} className="mr-1 inline" />}
                                          {m.contactType === 'link' && <LinkIcon size={12} className="mr-1 inline" />}
                                          {m.contactValue}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Navigation & Submit */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                  <div className="flex gap-2">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className={cn(
                          'h-2 w-2 rounded-full transition-all',
                          step.id <= currentStep ? 'bg-violet-500 w-6' : 'bg-gray-200'
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
                      >
                        <ArrowLeft size={18} />
                        Back
                      </button>
                    )}
                    {currentStep < steps.length ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:shadow-xl active:scale-95"
                      >
                        Continue
                        <ArrowRight size={18} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:shadow-xl active:scale-95"
                      >
                        <Target size={18} />
                        Create Goal
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
