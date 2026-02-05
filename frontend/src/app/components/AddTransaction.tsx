import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getSubcategoriesForCategory } from '@/lib/expenseCategories';
import { BillUpload } from '@/app/components/BillUpload';

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

      toast.success('Transaction added successfully');
      setCurrentPage('transactions');
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('Failed to add transaction');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentPage('transactions')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Plus className="text-blue-600" size={28} />
            Add Transaction
          </h2>
          <p className="text-gray-500 mt-1">Record a new income or expense</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Transaction Type *</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense', category: CATEGORIES.expense[0] })}
                className={`flex-1 py-3 rounded-lg border-2 transition-colors font-medium ${
                  formData.type === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 text-gray-600 hover:border-red-300'
                }`}
              >
                💸 Expense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income', category: CATEGORIES.income[0] })}
                className={`flex-1 py-3 rounded-lg border-2 transition-colors font-medium ${
                  formData.type === 'income'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-600 hover:border-green-300'
                }`}
              >
                💰 Income
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account *</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {CATEGORIES[formData.type].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          {subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
              <select
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Grocery shopping at Whole Foods"
              required
            />
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Merchant (Optional)</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Whole Foods, Amazon, etc."
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage('transactions')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Transaction
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
