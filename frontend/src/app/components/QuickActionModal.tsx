import React, { useState } from 'react';
import {
  X,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Users,
  Target,
  Mic,
  Calendar,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

const quickActions = [
  // Row 1
  { id: 'add-expense', label: 'Expense', icon: TrendingDown, gradient: 'from-pink-500 to-rose-500', description: 'Quick expense entry', openForm: 'expense' },
  { id: 'add-income', label: 'Income', icon: TrendingUp, gradient: 'from-emerald-400 to-teal-500', description: 'Record income', openForm: 'income' },
  // Row 2
  { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft, gradient: 'from-blue-500 to-indigo-600', description: 'Transfer money', openForm: 'transfer' },
  { id: 'split-bill', label: 'Split Expense', icon: Users, gradient: 'from-violet-500 to-purple-600', description: 'Group expense', openForm: 'group' },
  // Row 3
  { id: 'add-goal', label: 'New Goal', icon: Target, gradient: 'from-amber-400 to-orange-500', description: 'Savings goal', openForm: 'goal' },
  { id: 'pay-emi', label: 'Pay EMI', icon: CreditCard, gradient: 'from-red-500 to-orange-600', description: 'EMI payment', openForm: 'transaction' },
  // Row 4
  { id: 'calendar', label: 'Calendar', icon: Calendar, gradient: 'from-cyan-400 to-blue-500', description: 'Transaction calendar', openForm: 'calendar' },
  { id: 'voice-entry', label: 'Voice Input', icon: Mic, gradient: 'from-fuchsia-500 to-pink-600', description: 'Speak to add', openForm: 'voice' },
];

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onAction,
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleAction = async (actionId: string) => {
    // Haptic feedback
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        // Haptics not available
      }
    }

    setSelectedAction(actionId);
    setTimeout(() => {
      onAction(actionId);
      onClose();
      setSelectedAction(null);
    }, 150);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-white/90 backdrop-blur-2xl rounded-t-[40px] z-50 max-h-[85vh] overflow-hidden shadow-2xl border-t border-white/50"
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-16 h-1.5 bg-gray-300/50 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6">
              <div>
                <h3 className="text-2xl font-bold font-display text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">What would you like to do?</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Actions Grid */}
            <div className="px-6 pb-12 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const isSelected = selectedAction === action.id;

                  return (
                    <motion.button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      className={cn(
                        "relative overflow-hidden rounded-[24px] p-5 text-left transition-all group h-[120px] flex flex-col justify-between shadow-sm hover:shadow-md border border-gray-100",
                        isSelected ? 'ring-4 ring-black/10' : 'bg-white'
                      )}
                    >
                      <div className={cn(
                        "absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-full blur-2xl -mr-8 -mt-8 transition-opacity group-hover:opacity-20",
                        action.gradient
                      )} />

                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        "bg-gradient-to-br text-white",
                        action.gradient
                      )}>
                        <Icon size={24} />
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-900 text-lg leading-tight">
                          {action.label}
                        </h4>
                        <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
                          {action.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-safe-bottom bg-white/90" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};