import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/app/components/ui/card';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';

export const AddAccount: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank' as 'bank' | 'card' | 'cash' | 'wallet',
    balance: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.accounts.add({
        ...formData,
        currency,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success('Account added successfully');
      setCurrentPage('accounts');
    } catch (error) {
      console.error('Failed to add account:', error);
      toast.error('Failed to add account');
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-32 lg:pb-8">
      <div className="max-w-2xl mx-auto px-4 lg:px-0">
        {/* Header */}
        <div className="pt-6 lg:pt-10">
          <PageHeader
            title="Add New Account"
            subtitle="Create a new account to track your finances"
            icon={<Wallet size={20} />}
          />
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="e.g., Chase Checking"
                  required
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Account Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                >
                  <option value="bank">🏦 Bank Account</option>
                  <option value="card">💳 Credit/Debit Card</option>
                  <option value="cash">💵 Cash</option>
                  <option value="wallet">📱 Digital Wallet</option>
                </select>
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Opening Balance
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{currency}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance || ''}
                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">💡 Tip:</span> You can add multiple accounts and track them separately. All transactions will be organized by account.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setCurrentPage('accounts')}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black hover:bg-gray-900 text-white rounded-xl transition-colors font-semibold shadow-lg"
                >
                  Create Account
                </button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
