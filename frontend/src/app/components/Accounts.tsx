import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { Plus, Wallet, CreditCard, Banknote, Smartphone, Edit2, Trash2, Eye, EyeOff, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

export const Accounts: React.FC = () => {
  const { accounts, transactions, currency, setCurrentPage } = useApp();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleDeleteAccount = async (id: number) => {
    if (confirm('Are you sure you want to delete this account?')) {
      await db.accounts.delete(id);
      toast.success('Account deleted successfully');
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    await db.accounts.update(id, { isActive: !isActive });
    toast.success(`Account ${!isActive ? 'activated' : 'deactivated'}`);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Wallet className="text-blue-500" size={24} />;
      case 'card':
        return <CreditCard className="text-purple-500" size={24} />;
      case 'cash':
        return <Banknote className="text-green-500" size={24} />;
      case 'wallet':
        return <Smartphone className="text-orange-500" size={24} />;
      default:
        return <Wallet className="text-gray-500" size={24} />;
    }
  };

  const totalBalance = accounts.filter(a => a.isActive).reduce((sum, a) => sum + a.balance, 0);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(t => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Accounts & Wallets</h2>
            <p className="text-gray-500 mt-1">Manage your payment sources</p>
          </div>
        <button
          onClick={() => setCurrentPage('add-account')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Account
        </button>
      </div>

      <div className="bg-blue-600 p-6 rounded-xl text-white">
        <p className="text-sm opacity-90">Total Balance</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
        <p className="text-sm opacity-90 mt-2">{accounts.filter(a => a.isActive).length} active accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(account => (
          <div
            key={account.id}
            onClick={() => setSelectedAccountId(account.id!)}
            className={`bg-white p-6 rounded-xl border-2 transition-all cursor-pointer ${
              selectedAccountId === account.id
                ? 'border-blue-500 bg-blue-50'
                : account.isActive
                ? 'border-gray-200 hover:border-gray-300'
                : 'border-gray-100 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center">
                {getAccountIcon(account.type)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(account.id!, account.isActive)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={account.isActive ? 'Deactivate' : 'Activate'}
                >
                  {account.isActive ? (
                    <Eye size={16} className="text-gray-600" />
                  ) : (
                    <EyeOff size={16} className="text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => setCurrentPage('edit-account')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 size={16} className="text-gray-600" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(account.id!)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} className="text-red-600" />
                </button>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{account.name}</h3>
            <p className="text-sm text-gray-500 capitalize mb-3">{account.type}</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(account.balance)}</p>
          </div>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="bg-white p-12 rounded-xl border-2 border-dashed border-gray-300 text-center">
          <Wallet className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No accounts yet</h3>
          <p className="text-gray-500 mb-4">Add your first account to start tracking your finances</p>
          <button
            onClick={() => setCurrentPage('add-account')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Account
          </button>
        </div>
      )}

      {/* Selected Account Transactions */}
      {selectedAccount && (
        <div className="bg-white rounded-xl border-2 border-blue-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Transactions - {selectedAccount.name}
            </h3>
            <button
              onClick={() => setSelectedAccountId(null)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Category</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {accountTransactions.length > 0 ? (
                  accountTransactions.map(transaction => (
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{transaction.category}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No transactions for this account
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
    </CenteredLayout>
  );
};