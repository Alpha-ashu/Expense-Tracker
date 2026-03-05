import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';
import { Wallet, Landmark, CreditCard, Banknote, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/app/components/ui/card';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const accountTypes = [
  { id: 'bank', label: 'Bank Account', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', active: 'ring-blue-500' },
  { id: 'card', label: 'Credit Card', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', active: 'ring-purple-500' },
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', active: 'ring-green-500' },
  { id: 'wallet', label: 'Digital Wallet', icon: Smartphone, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', active: 'ring-orange-500' },
];

export const AddAccount: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank' as 'bank' | 'card' | 'cash' | 'wallet',
    balance: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveAccountWithBackendSync({
        name: formData.name.trim(),
        type: formData.type,
        balance: parseFloat(formData.balance) || 0,
        currency,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success('Account created successfully', { icon: '🎉' });
      setCurrentPage('accounts');
    } catch (error) {
      console.error('Failed to add account:', error);
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50/50 pb-32 lg:pb-8 font-sans">
      <div className="max-w-2xl mx-auto px-4 lg:px-0">
        {/* Header */}
        <div className="pt-6 lg:pt-10 mb-8">
          <PageHeader
            title="New Account"
            subtitle="Let's set up a new place to track your money"
            icon={<Wallet size={24} className="text-blue-600" />}
            showBack
            backTo="accounts"
          />
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="bg-white/80 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-6 lg:p-10 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">

              {/* Account Type Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4 tracking-wide uppercase">
                  1. Choose Account Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {accountTypes.map((type) => {
                    const isSelected = formData.type === type.id;
                    const Icon = type.icon;
                    return (
                      <motion.div
                        key={type.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, type: type.id as any })}
                          className={cn(
                            "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left relative overflow-hidden group",
                            isSelected
                              ? `border-transparent ring-2 ${type.active} bg-white shadow-md`
                              : "border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200"
                          )}
                        >
                          {isSelected && (
                            <div className={cn("absolute inset-0 opacity-10", type.bg)} />
                          )}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110",
                            isSelected ? type.bg : "bg-white shadow-sm border border-gray-100"
                          )}>
                            <Icon size={24} className={isSelected ? type.color : "text-gray-400"} />
                          </div>
                          <div>
                            <p className={cn(
                              "font-semibold transition-colors",
                              isSelected ? "text-gray-900" : "text-gray-600"
                            )}>
                              {type.label}
                            </p>
                          </div>
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute top-3 right-3"
                              >
                                <CheckCircle2 className={type.color} size={20} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-gray-50/80 rounded-[1.5rem] p-6 space-y-6 border border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-2 tracking-wide uppercase">
                  2. Account Details
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-4 text-lg border-2 border-transparent bg-white shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-400 font-medium"
                    placeholder="e.g., Main Checking, Chase Sapph..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Current Balance
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-600 group-focus-within:bg-blue-100 group-focus-within:text-blue-700 transition-colors">
                      {currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full pl-20 pr-5 py-4 text-2xl font-bold border-2 border-transparent bg-white shadow-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-300 tracking-tight"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage('accounts')}
                  className="px-8 py-4 rounded-xl font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="w-full relative group overflow-hidden rounded-xl bg-black text-white font-semibold py-4 px-6 flex items-center justify-center gap-2 transition-all hover:bg-gray-900 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 disabled:cursor-not-allowed shadow-[0_8px_20px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.15)]"
                >
                  <span className="relative z-10">{isSubmitting ? 'Creating...' : 'Create Account'}</span>
                  {!isSubmitting && <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
