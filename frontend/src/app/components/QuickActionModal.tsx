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
import { motion, AnimatePresence } from 'motion/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

const quickActions = [
  // Row 1
  { id: 'add-expense', label: 'Expense', icon: TrendingDown, color: 'bg-red-600', description: 'Quick expense entry', openForm: 'expense' },
  { id: 'add-income', label: 'Income', icon: TrendingUp, color: 'bg-green-600', description: 'Record income', openForm: 'income' },
  // Row 2
  { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft, color: 'bg-blue-600', description: 'Transfer money', openForm: 'transfer' },
  { id: 'split-bill', label: 'Split Expense', icon: Users, color: 'bg-purple-600', description: 'Group expense', openForm: 'group' },
  // Row 3
  { id: 'add-goal', label: 'New Goal', icon: Target, color: 'bg-indigo-600', description: 'Savings goal', openForm: 'goal' },
  { id: 'pay-emi', label: 'Pay EMI', icon: CreditCard, color: 'bg-orange-600', description: 'EMI payment', openForm: 'transaction' },
  // Row 4
  { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'bg-teal-600', description: 'Transaction calendar', openForm: 'calendar' },
  { id: 'voice-entry', label: 'Voice Input', icon: Mic, color: 'bg-pink-600', description: 'Speak to add', openForm: 'voice' },
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[80vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-500 mt-1">Choose what you want to do</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Actions Grid */}
            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const isSelected = selectedAction === action.id;

                  return (
                    <motion.button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      whileTap={{ scale: 0.95 }}
                      className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all ${
                        isSelected ? 'ring-4 ring-blue-500' : ''
                      }`}
                    >
                      <div className={`absolute inset-0 ${action.color}`} />
                      <div className="relative">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h4 className="font-semibold text-white mb-1">
                          {action.label}
                        </h4>
                        <p className="text-xs text-white/80">
                          {action.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-safe-bottom bg-white" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};