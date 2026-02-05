import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

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
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentPage('accounts')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Plus className="text-blue-600" size={28} />
            Add New Account
          </h2>
          <p className="text-gray-500 mt-1">Create a new account to track your finances</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Chase Checking"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bank">Bank Account</option>
              <option value="card">Credit/Debit Card</option>
              <option value="cash">Cash</option>
              <option value="wallet">Digital Wallet</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opening Balance
            </label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.balance || ''}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage('accounts')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
