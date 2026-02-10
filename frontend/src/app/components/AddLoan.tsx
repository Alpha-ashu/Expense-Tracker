import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const AddLoan: React.FC = () => {
  const { setCurrentPage, currency, accounts } = useApp();
  const [formData, setFormData] = useState({
    lenderName: '',
    loanType: 'personal' as 'personal' | 'home' | 'auto' | 'education' | 'business',
    principalAmount: 0,
    interestRate: 0,
    tenureMonths: 12,
    startDate: new Date().toISOString().split('T')[0],
    emiAmount: 0,
    description: '',
    accountId: accounts[0]?.id || 0,
    status: 'active' as 'active' | 'paid-off' | 'defaulted',
  });

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

    try {
      await db.loans.add({
        type: 'borrowed',
        name: formData.lenderName,
        principalAmount: formData.principalAmount,
        outstandingBalance: formData.principalAmount,
        interestRate: formData.interestRate,
        emiAmount: formData.emiAmount,
        dueDate: undefined,
        frequency: 'monthly',
        status: formData.status === 'active' ? 'active' : (formData.status === 'paid-off' ? 'completed' : 'overdue'),
        contactPerson: undefined,
        friendId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined
      });

      toast.success(`Loan of ${currency} ${formData.principalAmount} created! EMI: ${currency} ${formData.emiAmount.toFixed(2)}`);
      setCurrentPage('loans');
    } catch (error) {
      console.error('Failed to add loan:', error);
      toast.error('Failed to add loan');
    }
  };

  const totalInterest = (formData.emiAmount * formData.tenureMonths) - formData.principalAmount;

  return (
    <CenteredLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('loans')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Plus className="text-blue-600" size={28} />
              Add New Loan
            </h2>
            <p className="text-gray-500 mt-1">Track your loans and manage EMI payments</p>
          </div>
        </div>

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
            </div>

            {/* Loan Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Loan Type *</label>
              <select
                value={formData.loanType}
                onChange={(e) => handleFieldChange('loanType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              >
                <option value="personal">Personal Loan</option>
                <option value="home">Home Loan</option>
                <option value="auto">Auto Loan</option>
                <option value="education">Education Loan</option>
                <option value="business">Business Loan</option>
              </select>
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
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Link to Account</label>
              <select
                value={formData.accountId}
                onChange={(e) => handleFieldChange('accountId', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
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
            >
              Create Loan
            </button>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
