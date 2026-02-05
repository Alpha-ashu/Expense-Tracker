import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { Plus, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export const Groups: React.FC = () => {
  const { groupExpenses, accounts, currency, setCurrentPage } = useApp();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Group Expenses</h2>
            <p className="text-gray-500 mt-1">Split bills fairly with friends</p>
          </div>
        <button
          onClick={() => setCurrentPage('add-group')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Group Expense
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groupExpenses.map(expense => {
          const totalPaid = expense.members.filter(m => m.paid).reduce((sum, m) => sum + m.share, 0);
          const totalUnpaid = expense.totalAmount - totalPaid;

          return (
            <div key={expense.id} className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{expense.name}</h3>
                  <p className="text-sm text-gray-500">{new Date(expense.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(expense.totalAmount)}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Payment Progress</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(totalPaid)} / {formatCurrency(expense.totalAmount)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(totalPaid / expense.totalAmount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Members & Shares</p>
                {expense.members.map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        member.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.paid ? 'Paid' : 'Pending'}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">{formatCurrency(member.share)}</p>
                  </div>
                ))}
              </div>

              {expense.items && expense.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                  {expense.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groupExpenses.length === 0 && (
        <div className="bg-white p-12 rounded-xl border-2 border-dashed border-gray-300 text-center">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No group expenses yet</h3>
          <p className="text-gray-500 mb-4">Start splitting bills with friends</p>
          <button
            onClick={() => setCurrentPage('add-group')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Group Expense
          </button>
        </div>
      )}

      </div>
    </CenteredLayout>
  );
};
