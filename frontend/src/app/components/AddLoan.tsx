import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import { queueTransactionInsertSync } from '@/lib/auth-sync-integration';
import { backendService } from '@/lib/backend-api';
import { CreditCard, UserPlus, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const AddLoan: React.FC = () => {
  const { setCurrentPage, currency, accounts, friends, refreshData } = useApp();
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    lenderName: '',
    principalAmount: 0,
    interestRate: 0,
    tenureMonths: 12,
    startDate: new Date().toISOString().split('T')[0],
    emiAmount: 0,
    description: '',
    accountId: accounts[0]?.id || 0,
    friendId: undefined as number | undefined,
    status: 'active' as 'active' | 'paid-off' | 'defaulted',
  });
  const selectedAccount = accounts.find((account) => account.id === formData.accountId);

  // Calculate EMI when principal, interest rate, or tenure changes
  const calculateEMI = () => {
    const P = formData.principalAmount;
    const r = formData.interestRate / 100 / 12;
    const n = formData.tenureMonths;

    if (P <= 0 || r < 0 || n <= 0) return 0;
    if (r === 0) return P / n;

    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi * 100) / 100;
  };

  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);

    // Auto-calculate EMI if principal, interest rate, or tenure changes
    if (key === 'principalAmount' || key === 'interestRate' || key === 'tenureMonths') {
      updated.emiAmount = calculateEMI();
      setFormData(updated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lenderName.trim()) {
      toast.error('Please enter lender name');
      return;
    }

    if (formData.principalAmount <= 0) {
      toast.error('Principal amount must be greater than 0');
      return;
    }

    if (formData.tenureMonths <= 0) {
      toast.error('Tenure must be greater than 0');
      return;
    }

    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    setIsLoading(true);

    try {
      const now = new Date();
      const lenderName = formData.lenderName.trim();
      const newBalance = selectedAccount.balance + formData.principalAmount;

      const transactionRecord = {
        type: 'income' as const,
        amount: formData.principalAmount,
        accountId: formData.accountId,
        category: 'Loans',
        subcategory: 'Loan Received',
        description: `Borrowed - ${lenderName}`,
        merchant: lenderName,
        date: new Date(formData.startDate),
        tags: ['loan'],
        expenseMode: 'individual' as const,
        createdAt: now,
        updatedAt: now,
      };

      let transactionId = 0;

      await db.transaction('rw', db.transactions, db.loans, db.accounts, async () => {
        transactionId = await db.transactions.add(transactionRecord);

        await db.loans.add({
          type: 'borrowed',
          name: lenderName,
          principalAmount: formData.principalAmount,
          outstandingBalance: formData.principalAmount,
          interestRate: formData.interestRate,
          emiAmount: formData.emiAmount,
          frequency: 'monthly',
          status: formData.status === 'active' ? 'active' : (formData.status === 'paid-off' ? 'completed' : 'overdue'),
          contactPerson: lenderName,
          friendId: formData.friendId,
          accountId: formData.accountId,
          loanDate: new Date(formData.startDate),
          notes: formData.description.trim() || undefined,
          totalPayable: (formData.emiAmount * formData.tenureMonths) || formData.principalAmount,
          createdAt: now,
          updatedAt: now,
        });

        await db.accounts.update(formData.accountId, {
          balance: newBalance,
          updatedAt: now,
        });
      });

      queueTransactionInsertSync(transactionId, transactionRecord);

      try {
        await backendService.createLoan({
          type: 'borrowed',
          name: lenderName,
          principalAmount: formData.principalAmount,
          outstandingBalance: formData.principalAmount,
          interestRate: formData.interestRate,
          emiAmount: formData.emiAmount,
          dueDate: undefined,
          frequency: 'monthly',
          status: formData.status === 'active' ? 'active' : (formData.status === 'paid-off' ? 'completed' : 'overdue'),
          contactPerson: lenderName,
          friendId: formData.friendId ? String(formData.friendId) : undefined,
          createdAt: now,
          updatedAt: now,
          deletedAt: undefined,
        });
      } catch (syncError) {
        console.info('ℹ️ Loan backend sync skipped:', syncError);
      }

      toast.success(`Loan of ${currency} ${formData.principalAmount} created! EMI: ${currency} ${formData.emiAmount.toFixed(2)}`);
      refreshData();
      setCurrentPage('loans');
    } catch (error) {
      console.error('Failed to add loan:', error);
      toast.error('Failed to add loan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendSelect = (friendId: number) => {
    const selectedFriend = friends.find((friend) => friend.id === friendId);
    if (!selectedFriend) return;

    setFormData((prev) => ({
      ...prev,
      friendId,
      lenderName: selectedFriend.name,
    }));
    setShowFriendPicker(false);
  };

  const totalInterest = (formData.emiAmount * formData.tenureMonths) - formData.principalAmount;

  return (
    <CenteredLayout>
      <div className="space-y-6 max-w-[480px] w-full mx-auto pb-8">
        <PageHeader
          title="Add New Loan"
          subtitle="Track your loans and manage EMI payments"
          icon={<CreditCard size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="loans"
        />

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Lender Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Lender Name *</label>
              <input
                type="text"
                value={formData.lenderName}
                onChange={(e) => handleFieldChange('lenderName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="e.g., Bank Name, Lender Name"
                required
              />

              {/* Add Friend Button */}
              {friends && friends.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowFriendPicker(!showFriendPicker)}
                    className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded hover:bg-green-100 transition-colors flex items-center gap-1"
                    title="Select from Friends"
                    aria-label="Select from Friends"
                  >
                    <UserPlus size={14} />
                    Select from Friends
                  </button>

                  {showFriendPicker && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-green-800">Select a friend:</span>
                        <button
                          type="button"
                          onClick={() => setShowFriendPicker(false)}
                          className="text-green-600 hover:text-green-800"
                          title="Close Friend Picker"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-auto">
                        {friends.map((friend) => (
                          <button
                            key={friend.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${
                              formData.friendId === friend.id
                                ? 'bg-green-100 border-green-300 text-green-800'
                                : 'bg-white border-green-200 text-green-700 hover:bg-green-100'
                            }`}
                            onClick={() => friend.id && handleFriendSelect(friend.id)}
                          >
                            <span>{friend.name}</span>
                            {formData.friendId === friend.id && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Principal Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Principal Amount *</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.principalAmount || ''}
                  onChange={(e) => handleFieldChange('principalAmount', parseFloat(e.target.value) || 0)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Interest Rate (Annual %) *</label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.01"
                  value={formData.interestRate || ''}
                  onChange={(e) => handleFieldChange('interestRate', parseFloat(e.target.value) || 0)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
                <span className="text-gray-600 ml-3">%</span>
              </div>
            </div>

            {/* Tenure */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Tenure (Months) *</label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="1"
                  value={formData.tenureMonths || ''}
                  onChange={(e) => handleFieldChange('tenureMonths', parseInt(e.target.value) || 0)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="12"
                  required
                />
                <span className="text-gray-600 ml-3">months</span>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                aria-label="Start Date"
                title="Start Date"
                placeholder="Start Date"
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Link to Account</label>
              <select
                value={formData.accountId}
                onChange={(e) => handleFieldChange('accountId', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                aria-label="Account"
                title="Account"
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                rows={3}
                aria-label="Loan description"
                title="Loan description"
                placeholder="Add any notes about this loan..."
              />
            </div>

            {/* Summary Box */}
            {formData.principalAmount > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Loan Summary</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Principal Amount:</span>
                    <span className="font-medium text-gray-900">{currency} {formData.principalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly EMI:</span>
                    <span className="font-medium text-gray-900">{currency} {formData.emiAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Interest:</span>
                    <span className="font-medium text-gray-900">{currency} {totalInterest.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between">
                    <span>Total Payable:</span>
                    <span className="font-semibold text-gray-900">{currency} {(formData.principalAmount + totalInterest).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Loan...' : 'Create Loan'}
            </button>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
