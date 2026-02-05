import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Edit } from 'lucide-react';
import { toast } from 'sonner';

export const EditAccount: React.FC<{ accountId?: number }> = ({ accountId }) => {
  const { setCurrentPage, currency } = useApp();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    db.accounts.get(accountId).then((acc) => {
      setAccount(acc);
      setLoading(false);
    });
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    
    try {
      await db.accounts.update(account.id, {
        name: account.name,
        type: account.type,
        balance: account.balance,
        updatedAt: new Date(),
      });
      toast.success('Account updated successfully');
      setCurrentPage('accounts');
    } catch (error) {
      console.error('Failed to update account:', error);
      toast.error('Failed to update account');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Account not found</p>
      </div>
    );
  }

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
            <Edit className="text-blue-600" size={28} />
            Edit Account
          </h2>
          <p className="text-gray-500 mt-1">Update your account details</p>
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
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Type *
            </label>
            <select
              value={account.type}
              onChange={(e) => setAccount({ ...account, type: e.target.value })}
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
              Current Balance
            </label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={account.balance || ''}
                onChange={(e) => setAccount({ ...account, balance: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
