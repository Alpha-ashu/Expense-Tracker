export type GoalCategoryKey =
  | 'travel'
  | 'emergency'
  | 'gadget'
  | 'wedding'
  | 'education'
  | 'investment'
  | 'vehicle'
  | 'business'
  | 'personal'
  | 'custom';

export const GOAL_CATEGORIES: Array<{ key: GoalCategoryKey; label: string; icon: string }> = [
  { key: 'travel', label: 'Travel', icon: '🌴' },
  { key: 'emergency', label: 'Emergency Fund', icon: '🛟' },
  { key: 'gadget', label: 'Gadget', icon: '📱' },
  { key: 'wedding', label: 'Wedding', icon: '💍' },
  { key: 'education', label: 'Education', icon: '🎓' },
  { key: 'investment', label: 'Investment', icon: '📈' },
  { key: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { key: 'business', label: 'Business', icon: '💼' },
  { key: 'personal', label: 'Personal', icon: '⭐' },
  { key: 'custom', label: 'Custom', icon: '🧩' },
];

export const getGoalCategoryMeta = (category?: string) => {
  const found = GOAL_CATEGORIES.find((item) => item.key === category);
  return found || { key: 'custom', label: 'Custom', icon: '🧩' };
};

export const getGoalProgress = (currentAmount: number, targetAmount: number) => {
  if (targetAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (currentAmount / targetAmount) * 100));
};

export const getMonthlySuggestion = (targetAmount: number, currentAmount: number, targetDate: Date) => {
  const remaining = Math.max(0, targetAmount - currentAmount);
  const now = new Date();
  const ms = targetDate.getTime() - now.getTime();
  const months = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30)));
  return {
    months,
    monthlyAmount: remaining / months,
    remaining,
  };
};

export const getMilestoneLabel = (progress: number) => {
  if (progress >= 100) return 'Goal Completed';
  if (progress >= 75) return '75% Milestone Achieved';
  if (progress >= 50) return '50% Milestone Achieved';
  if (progress >= 25) return '25% Milestone Achieved';
  return '';
};
