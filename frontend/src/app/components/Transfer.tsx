import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { ArrowRightLeft, ChevronLeft } from 'lucide-react';
import type { Account } from '@/lib/database';

export const Transfer: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { currency, setCurrentPage } = useApp();
  const [formData, setFormData] = useState({
    fromAccountId: 0,
    toAccountId: 0,
    amount: 0,
    description: '',
    transferType: 'self-transfer' as const,
  });

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const activeAccounts = accounts.filter((account) => account.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fromAccountId || !formData.toAccountId) {
      toast.error('Please select both accounts');
      return;
    }

    if (formData.fromAccountId === formData.toAccountId) {
      toast.error('Cannot transfer to the same account');
      return;
    }

    if (formData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    try {
      // Get account details
      const fromAccount = await db.accounts.get(formData.fromAccountId);
      const toAccount = await db.accounts.get(formData.toAccountId);

      if (!fromAccount || !toAccount) {
        toast.error('Account not found');
        return;
      }

      // Check if from account has sufficient balance
      if (fromAccount.balance < formData.amount) {
        toast.error('Insufficient balance in source account');
        return;
      }

      // Create expense transaction in source account (outflow)
      await db.transactions.add({
        type: 'transfer',
        amount: formData.amount,
        accountId: formData.fromAccountId,
        category: 'Transfer',
        subcategory: 'Transfer Out',
        description: formData.description || `Transfer to ${toAccount.name}`,
        date: new Date(),
        transferToAccountId: formData.toAccountId,
        transferType: formData.transferType,
        updatedAt: new Date(),
      });

      // Create income transaction in destination account (inflow)
      await db.transactions.add({
        type: 'transfer',
        amount: formData.amount,
        accountId: formData.toAccountId,
        category: 'Transfer',
        subcategory: 'Transfer In',
        description: formData.description || `Transfer from ${fromAccount.name}`,
        date: new Date(),
        transferToAccountId: formData.fromAccountId,
        transferType: formData.transferType,
        updatedAt: new Date(),
      });

      // Update account balances
      await db.accounts.update(formData.fromAccountId, {
        balance: fromAccount.balance - formData.amount,
        updatedAt: new Date(),
      });

      await db.accounts.update(formData.toAccountId, {
        balance: toAccount.balance + formData.amount,
        updatedAt: new Date(),
      });

      toast.success(`Transferred ${currency} ${formData.amount.toFixed(2)} successfully`);
      setFormData({
        fromAccountId: 0,
        toAccountId: 0,
        amount: 0,
        description: '',
        transferType: 'self-transfer',
      });
      setCurrentPage('accounts');
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Transfer failed. Please try again.');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentPage('accounts');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-600" size={28} />
            Transfer Money
          </h2>
          <p className="text-gray-500 mt-1">Move money between your own accounts</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">💰 Transfer Between Your Own Accounts</p>
          </div>

          {/* From Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Account
            </label>
            <select
              value={formData.fromAccountId}
              onChange={(e) =>
                setFormData({ ...formData, fromAccountId: parseInt(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select source account</option>
              {activeAccounts.map((account: Account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({currency} {account.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* To Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Account
            </label>
            <select
              value={formData.toAccountId}
              onChange={(e) =>
                setFormData({ ...formData, toAccountId: parseInt(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select destination account</option>
              {activeAccounts
                .filter((acc: Account) => acc.id !== formData.fromAccountId)
                .map((account: Account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({currency} {account.balance.toFixed(2)})
                  </option>
                ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g., Monthly transfer to savings"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Complete Transfer
            </button>
          </div>
        </form>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-2xl">
        <h3 className="font-semibold text-green-900 mb-2">✓ Safe & Secure</h3>
        <p className="text-sm text-green-700">
          Transfers are instantly processed and create audit-trail transactions in both accounts for your records.
        </p>
      </div>
      </div>
    </CenteredLayout>
  );
};
