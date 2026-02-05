import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { Plus, DollarSign, Calendar, TrendingUp, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddLoanModalWithFriends } from '@/app/components/AddLoanModalWithFriends';

export const Loans: React.FC = () => {
  const { loans, currency, accounts, friends, setCurrentPage } = useApp();
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  const loanStats = useMemo(() => {
    const borrowed = loans.filter(l => l.type === 'borrowed' && l.status === 'active');
    const lent = loans.filter(l => l.type === 'lent' && l.status === 'active');
    const emis = loans.filter(l => l.type === 'emi' && l.status === 'active');

    return {
      totalBorrowed: borrowed.reduce((sum, l) => sum + l.outstandingBalance, 0),
      totalLent: lent.reduce((sum, l) => sum + l.outstandingBalance, 0),
      totalEMI: emis.reduce((sum, l) => sum + (l.emiAmount || 0), 0),
      overdueCount: loans.filter(l => 
        l.status === 'active' && 
        l.dueDate && 
        new Date(l.dueDate) < new Date()
      ).length,
    };
  }, [loans]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getLoanStatusColor = (loan: any) => {
    if (loan.status === 'completed') return 'bg-green-100 text-green-800';
    if (loan.status === 'overdue') return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const handleEditClick = (loan: any) => {
    setEditingLoanId(loan.id);
    setEditFormData({ ...loan });
  };

  const handleSaveEdit = async () => {
    if (!editingLoanId) return;
    try {
      await db.loans.update(editingLoanId, {
        name: editFormData.name,
        principalAmount: editFormData.principalAmount,
        outstandingBalance: editFormData.outstandingBalance,
        interestRate: editFormData.interestRate,
        emiAmount: editFormData.emiAmount,
        dueDate: editFormData.dueDate ? new Date(editFormData.dueDate) : undefined,
      });
      setEditingLoanId(null);
      toast.success('Loan updated successfully');
    } catch (error) {
      console.error('Failed to update loan:', error);
      toast.error('Failed to update loan');
    }
  };

  const handleDeleteLoan = async (loanId: number) => {
    if (window.confirm('Are you sure you want to delete this loan?')) {
      try {
        await db.loans.delete(loanId);
        toast.success('Loan deleted successfully');
      } catch (error) {
        console.error('Failed to delete loan:', error);
        toast.error('Failed to delete loan');
      }
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Loans & EMIs</h2>
            <p className="text-gray-500 mt-1">Manage your debts and lending</p>
          </div>
        <button
          onClick={() => setCurrentPage('add-loan')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Loan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-600 p-6 rounded-xl text-white">
          <p className="text-sm opacity-90 mb-2">Total Borrowed</p>
          <p className="text-3xl font-bold">{formatCurrency(loanStats.totalBorrowed)}</p>
        </div>
        <div className="bg-green-600 p-6 rounded-xl text-white">
          <p className="text-sm opacity-90 mb-2">Total Lent</p>
          <p className="text-3xl font-bold">{formatCurrency(loanStats.totalLent)}</p>
        </div>
        <div className="bg-blue-600 p-6 rounded-xl text-white">
          <p className="text-sm opacity-90 mb-2">Monthly EMI</p>
          <p className="text-3xl font-bold">{formatCurrency(loanStats.totalEMI)}</p>
        </div>
        <div className="bg-red-600 p-6 rounded-xl text-white">
          <p className="text-sm opacity-90 mb-2">Overdue</p>
          <p className="text-3xl font-bold">{loanStats.overdueCount}</p>
        </div>
      </div>

      {loanStats.overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <p className="font-medium text-red-900">Overdue Payments</p>
            <p className="text-sm text-red-700 mt-1">
              You have {loanStats.overdueCount} overdue payment{loanStats.overdueCount > 1 ? 's' : ''}. Please make payments to avoid penalties.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['borrowed', 'lent', 'emi'].map(type => (
          <div key={type} className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 capitalize">{type} Loans</h3>
            <div className="space-y-3">
              {loans
                .filter(l => l.type === type && l.status === 'active')
                .map(loan => (
                  <div key={loan.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{loan.name}</h4>
                        {loan.contactPerson && (
                          <p className="text-sm text-gray-500">{loan.contactPerson}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(loan)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600"
                          title="Edit loan"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan.id!)}
                          className="p-1 hover:bg-red-100 rounded transition-colors text-red-600"
                          title="Delete loan"
                        >
                          <Trash2 size={16} />
                        </button>
                        <span className={`px-2 py-1 text-xs rounded-full ${getLoanStatusColor(loan)}`}>
                          {loan.status}
                        </span>
                      </div>
                    </div>
                    
                    {editingLoanId === loan.id ? (
                      <div className="space-y-3 mb-3">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          placeholder="Loan name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          value={editFormData.principalAmount}
                          onChange={(e) => setEditFormData({ ...editFormData, principalAmount: parseFloat(e.target.value) })}
                          placeholder="Principal amount"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          value={editFormData.outstandingBalance}
                          onChange={(e) => setEditFormData({ ...editFormData, outstandingBalance: parseFloat(e.target.value) })}
                          placeholder="Outstanding balance"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        {editFormData.emiAmount !== undefined && (
                          <input
                            type="number"
                            value={editFormData.emiAmount}
                            onChange={(e) => setEditFormData({ ...editFormData, emiAmount: parseFloat(e.target.value) })}
                            placeholder="EMI amount"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        )}
                        <input
                          type="date"
                          value={editFormData.dueDate ? new Date(editFormData.dueDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingLoanId(null)}
                            className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500">Principal</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(loan.principalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Outstanding</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(loan.outstandingBalance)}</p>
                          </div>
                          {loan.emiAmount && (
                            <div>
                              <p className="text-xs text-gray-500">EMI Amount</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(loan.emiAmount)}</p>
                            </div>
                          )}
                          {loan.dueDate && (
                            <div>
                              <p className="text-xs text-gray-500">Due Date</p>
                              <p className="font-semibold text-gray-900">
                                {new Date(loan.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${((loan.principalAmount - loan.outstandingBalance) / loan.principalAmount) * 100}%`,
                            }}
                          />
                        </div>

                        <button
                          onClick={() => setShowPaymentModal(loan.id!)}
                          className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          Make Payment
                        </button>
                      </>
                    )}
                  </div>
                ))}
              {loans.filter(l => l.type === type && l.status === 'active').length === 0 && (
                <p className="text-gray-500 text-center py-8">No active {type} loans</p>
              )}
            </div>
          </div>
        ))}
      </div>


      {showPaymentModal && (
        <PaymentModal
          loanId={showPaymentModal}
          accounts={accounts}
          onClose={() => setShowPaymentModal(null)}
        />
      )}
      </div>
    </CenteredLayout>
  );
};

interface PaymentModalProps {
  loanId: number;
  accounts: any[];
  onClose: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ loanId, accounts, onClose }) => {
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id || 0);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const loan = await db.loans.get(loanId);
    if (!loan) return;

    await db.loanPayments.add({
      loanId,
      amount,
      accountId,
      date: new Date(),
      notes,
    });

    const newOutstanding = Math.max(0, loan.outstandingBalance - amount);
    await db.loans.update(loanId, {
      outstandingBalance: newOutstanding,
      status: newOutstanding === 0 ? 'completed' : 'active',
    });

    const account = accounts.find(a => a.id === accountId);
    if (account) {
      await db.accounts.update(accountId, {
        balance: account.balance - amount,
      });
    }

    toast.success('Payment recorded successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Make Payment</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pay From</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};