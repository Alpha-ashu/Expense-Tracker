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
  { id: 'add-expense',  label: 'Expense',       icon: TrendingDown,    gradient: 'from-pink-500 to-rose-500',       description: 'Quick expense entry',      openForm: 'expense'     },
  { id: 'add-income',   label: 'Income',         icon: TrendingUp,      gradient: 'from-emerald-400 to-teal-500',    description: 'Record income',            openForm: 'income'      },
  { id: 'transfer',     label: 'Transfer',       icon: ArrowRightLeft,  gradient: 'from-blue-500 to-indigo-600',     description: 'Transfer money',           openForm: 'transfer'    },
  { id: 'split-bill',   label: 'Split',          icon: Users,           gradient: 'from-violet-500 to-purple-600',   description: 'Group expense',            openForm: 'group'       },
  { id: 'add-goal',     label: 'New Goal',       icon: Target,          gradient: 'from-amber-400 to-orange-500',    description: 'Savings goal',             openForm: 'goal'        },
  { id: 'pay-emi',      label: 'Pay EMI',        icon: CreditCard,      gradient: 'from-red-500 to-orange-600',      description: 'EMI payment',              openForm: 'transaction' },
  { id: 'calendar',     label: 'Calendar',       icon: Calendar,        gradient: 'from-cyan-400 to-blue-500',       description: 'Transaction calendar',     openForm: 'calendar'    },
  { id: 'voice-entry',  label: 'Voice',          icon: Mic,             gradient: 'from-fuchsia-500 to-pink-600',    description: 'Speak to add',             openForm: 'voice'       },
];

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onAction,
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleAction = async (actionId: string) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
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

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-2xl rounded-t-[32px] shadow-2xl border-t border-white/50 overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300/60 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">Quick Actions</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">What would you like to do?</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 w-9 h-9"
                aria-label="Close quick actions"
                title="Close quick actions"
              >
                <X size={18} />
              </Button>
            </div>

            {/* 4-col × 2-row grid — NO scroll, all 8 fit */}
            <div className="px-4 pb-8">
              <div className="grid grid-cols-4 gap-3">
                {quickActions.map((action, i) => {
                  const Icon = action.icon;
                  const isSelected = selectedAction === action.id;

                  return (
                    <motion.button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 22 }}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.04 }}
                      className={cn(
                        "flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl border transition-all",
                        isSelected
                          ? "bg-gray-50 border-gray-200 ring-2 ring-black/10"
                          : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow-md"
                      )}
                    >
                      {/* Icon bubble */}
                      <div className={cn(
                        "w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm",
                        "bg-gradient-to-br text-white",
                        action.gradient
                      )}>
                        <Icon size={22} strokeWidth={2.2} />
                      </div>

                      {/* Label */}
                      <span className="text-[11.5px] font-semibold text-gray-800 text-center leading-tight w-full truncate px-1">
                        {action.label}
                      </span>

                      {/* Subtle description — only shown on slightly larger screens */}
                      <span className="hidden sm:block text-[10px] text-gray-400 text-center leading-tight truncate w-full px-1">
                        {action.description}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* iOS safe-area spacer */}
            <div className="h-safe-bottom bg-white/95" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};