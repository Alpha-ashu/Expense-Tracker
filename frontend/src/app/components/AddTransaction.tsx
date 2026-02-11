import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getSubcategoriesForCategory } from '@/lib/expenseCategories';
import { BillUpload } from '@/app/components/BillUpload';
import { Card } from '@/app/components/ui/card';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';
import { motion } from 'framer-motion';

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map(cat => cat.name),
  income: Object.values(INCOME_CATEGORIES).map(cat => cat.name),
};

export const AddTransaction: React.FC = () => {
  const { accounts, setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    category: CATEGORIES.expense[0],
    subcategory: '',
    description: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const rawDraft = localStorage.getItem('voiceTransactionDraft');
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        type?: 'expense' | 'income';
        amount?: number;
        category?: string | null;
        description?: string;
        date?: string;
      };

      const nextType = draft.type ?? 'expense';
      const categoryList = CATEGORIES[nextType];
      const nextCategory = draft.category && categoryList.includes(draft.category)
        ? draft.category
        : categoryList[0];

      setFormData((prev) => ({
        ...prev,
        type: nextType,
        amount: draft.amount ?? prev.amount,
        category: nextCategory,
        description: draft.description ?? prev.description,
        date: draft.date ?? prev.date,
      }));
    } catch (error) {
      console.error('Failed to parse voice draft:', error);
    } finally {
      localStorage.removeItem('voiceTransactionDraft');
    }
  }, []);

  const subcategories = useMemo(() => {
    return getSubcategoriesForCategory(formData.category, formData.type);
  }, [formData.category, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const account = accounts.find(a => a.id === formData.accountId);
    if (!account) {
      toast.error('Please select an account');
      return;
    }

    try {
      await db.transactions.add({
        ...formData,
        date: new Date(formData.date),
        tags: [],
      });

      const newBalance = formData.type === 'income'
        ? account.balance + formData.amount
        : account.balance - formData.amount;

      await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: new Date() });

      // Show detailed success message
      const typeLabel = formData.type === 'income' ? 'Income' : 'Expense';
      const icon = formData.type === 'income' ? '📈' : '📉';
      const message = `${icon} ${typeLabel} ${currency} ${formData.amount.toFixed(2)} added to ${formData.category}`;
      toast.success(message);
      setCurrentPage('transactions');
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('❌ Failed to add transaction. Please try again.');
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-32 lg:pb-8">
      <div className="max-w-2xl mx-auto px-4 lg:px-0">
        {/* Header */}
        <div className="pt-6 lg:pt-10">
          <PageHeader
            title="Add Transaction"
            subtitle="Record a new income or expense"
            icon={formData.type === 'income' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            showBack
            backTo="transactions"
          />
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-6"
        >
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense', category: CATEGORIES.expense[0] })}
              className={`relative py-4 rounded-2xl border-2 transition-all font-semibold text-sm sm:text-base ${
                formData.type === 'expense'
                  ? 'bg-red-50 border-red-300 text-red-700 shadow-lg'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-red-200'
              }`}
            >
              <div className="text-2xl mb-1">📉</div>
              Expense
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income', category: CATEGORIES.income[0] })}
              className={`relative py-4 rounded-2xl border-2 transition-all font-semibold text-sm sm:text-base ${
                formData.type === 'income'
                  ? 'bg-green-50 border-green-300 text-green-700 shadow-lg'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-green-200'
              }`}
            >
              <div className="text-2xl mb-1">📈</div>
              Income
            </motion.button>
          </div>

          <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Amount *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{currency}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-lg font-semibold"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Account */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Account *</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  required
                >
                  <option value="">Select an account</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>{account.name} ({currency} {account.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <CategoryDropdown
                  value={formData.category}
                  onChange={(value) => setFormData({ ...formData, category: value, subcategory: '' })}
                  options={CATEGORIES[formData.type]}
                  label="Category"
                  required
                />
              </div>

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Subcategory</label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  >
                    <option value="">Select a subcategory</option>
                    {subcategories.map(subcat => (
                      <option key={subcat} value={subcat}>{subcat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="e.g., Grocery shopping"
                  required
                />
              </div>

              {/* Merchant */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Merchant (Optional)</label>
                <input
                  type="text"
                  value={formData.merchant}
                  onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="e.g., Whole Foods"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setCurrentPage('transactions')}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black hover:bg-gray-900 text-white rounded-xl transition-colors font-semibold shadow-lg"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
