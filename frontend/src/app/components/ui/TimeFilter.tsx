import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TimeFilterPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface TimeFilterProps {
  value: TimeFilterPeriod;
  onChange: (period: TimeFilterPeriod) => void;
  className?: string;
}

const filterOptions: { id: TimeFilterPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export const TimeFilter: React.FC<TimeFilterProps> = ({ value, onChange, className }) => {
  return (
    <div className={cn('flex items-center gap-2 p-1 bg-gray-100 rounded-xl', className)}>
      {filterOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'relative px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
            value === option.id
              ? 'text-white'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {value === option.id && (
            <motion.div
              layoutId="timeFilterPill"
              className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg shadow-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

// Helper function to filter transactions by time period
export const filterByTimePeriod = <T extends { date: Date | string }>(
  items: T[],
  period: TimeFilterPeriod,
  referenceDate: Date = new Date()
): T[] => {
  const now = referenceDate;
  
  return items.filter((item) => {
    const itemDate = new Date(item.date);
    
    switch (period) {
      case 'daily':
        return (
          itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      case 'weekly': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return itemDate >= startOfWeek && itemDate < endOfWeek;
      }
      case 'monthly':
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      case 'yearly':
        return itemDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });
};

// Helper to get period label for display
export const getPeriodLabel = (period: TimeFilterPeriod): string => {
  const now = new Date();
  switch (period) {
    case 'daily':
      return now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    case 'weekly':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'yearly':
      return now.getFullYear().toString();
    default:
      return '';
  }
};
