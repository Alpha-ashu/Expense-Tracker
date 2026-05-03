import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, DollarSign, TrendingUp, AlertCircle, Edit2, Trash2, Home, Users } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const isOpenLoan = (loan: { status?: string; outstandingBalance: number }) =>
  loan.outstandingBalance > 0 && loan.status !== 'completed';

const getLoanStatusFromDueDate = (dueDate?: Date | string, outstandingBalance?: number) => {
  if ((outstandingBalance ?? 0) <= 0) return 'completed' as const;
  if (!dueDate) return 'active' as const;

  const date = new Date(dueDate);
  const today = new Date();
  const dueKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return dueKey < todayKey ? 'overdue' as const : 'active' as const;
};

const getEffectiveLoanStatus = (loan: { dueDate?: Date | string; outstandingBalance: number }) =>
  getLoanStatusFromDueDate(loan.dueDate, loan.outstandingBalance);

export const Loans: React.FC = () => {
  const { loans, currency, accounts, setCurrentPage } = useApp();
  const loanPayments = useLiveQuery(() => db.loanPayments.toArray(), []) || [];
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loanStats = useMemo(() => {
    const borrowed = loans.filter(l => l.type === 'borrowed' && isOpenLoan(l));
    const lent = loans.filter(l => l.type === 'lent' && isOpenLoan(l));
    const emis = loans.filter(l => l.type === 'emi' && isOpenLoan(l));

    return {
      totalBorrowed: borrowed.reduce((sum, l) => sum + l.outstandingBalance, 0),
      totalLent: lent.reduce((sum, l) => sum + l.outstandingBalance, 0),
      totalEMI: emis.reduce((sum, l) => sum + (l.emiAmount || 0), 0),
      overdueCount: loans.filter(l => isOpenLoan(l) && getLoanStatusFromDueDate(l.dueDate, l.outstandingBalance) === 'overdue').length,
    };
  }, [loans]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatShortDate = (value?: Date | string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const latestPaymentByLoan = useMemo(() => {
    const map = new Map<number, Date>();
    loanPayments.forEach((payment) => {
      if (!payment.loanId || !payment.date) return;
      const paymentDate = new Date(payment.date);
      if (Number.isNaN(paymentDate.getTime())) return;
      const existing = map.get(payment.loanId);
      if (!existing || paymentDate > existing) {
        map.set(payment.loanId, paymentDate);
      }
    });
    return map;
  }, [loanPayments]);

  const completionDateByLoan = useMemo(() => {
    const map = new Map<number, Date>();
    loans.forEach((loan) => {
      if (!loan.id) return;
      if (getEffectiveLoanStatus(loan) !== 'completed') return;
      const lastPayment = latestPaymentByLoan.get(loan.id);
      if (lastPayment) map.set(loan.id, lastPayment);
    });
    return map;
  }, [loans, latestPaymentByLoan]);

  const getLoanStatusColor = (loan: any) => {
    const status = getEffectiveLoanStatus(loan);
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'overdue') return 'bg-red-100 text-red-700';
    return 'bg-black/10 text-gray-900';
  };

  const handleEditClick = (loan: any) => {
    setEditingLoanId(loan.id);
    setEditFormData({ ...loan });
  };

  const handleSaveEdit = async () => {
    if (!editingLoanId) return;
    try {
      const nextStatus = getLoanStatusFromDueDate(editFormData.dueDate, editFormData.outstandingBalance);
      await db.loans.update(editingLoanId, {
        name: editFormData.name,
        principalAmount: editFormData.principalAmount,
        outstandingBalance: editFormData.outstandingBalance,
        interestRate: editFormData.interestRate,
        emiAmount: editFormData.emiAmount,
        dueDate: editFormData.dueDate ? new Date(editFormData.dueDate) : undefined,
        status: nextStatus,
      });
      setEditingLoanId(null);
      toast.success('Loan updated successfully');
    } catch (error) {
      console.error('Failed to update loan:', error);
      toast.error('Failed to update loan');
    }
  };

  const handleDeleteLoan = (loanId: number, loanName: string) => {
    setLoanToDelete({ id: loanId, name: loanName });
    setDeleteModalOpen(true);
  };

  const confirmDeleteLoan = async () => {
    if (!loanToDelete) return;
    setIsDeleting(true);
    try {
      await db.loans.delete(loanToDelete.id);
      toast.success('Loan deleted successfully');
      setDeleteModalOpen(false);
      setLoanToDelete(null);
    } catch (error) {
      console.error('Failed to delete loan:', error);
      toast.error('Failed to delete loan');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 w-full space-y-6 sm:space-y-8 pb-24">
      
      <div className="hidden lg:flex items-center justify-between p-8 border-b border-gray-100 bg-white rounded-t-[32px] mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-gray-900" />
            Loans & EMIs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your debts and lending</p>
        </div>
        <Button
          onClick={() => {
            localStorage.setItem('quickFormType', 'expense');
            localStorage.setItem('quickExpenseMode', 'loan');
            localStorage.setItem('quickBackPage', 'loans');
            setCurrentPage('add-transaction');
          }}
          className="shadow-lg bg-gray-900 text-white hover:bg-gray-800 text-sm font-semibold h-10 px-6 rounded-2xl transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Loan
        </Button>
      </div>

      
      <div className="lg:hidden flex items-center justify-between pt-12 pb-6 px-6 relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-8 h-8" />
            Loans
          </h1>
          <p className="text-sm text-gray-500 mt-2">Manage debts and lending</p>
        </div>
        <button 
          onClick={() => {
            localStorage.setItem('quickFormType', 'expense');
            localStorage.setItem('quickExpenseMode', 'loan');
            localStorage.setItem('quickBackPage', 'loans');
            setCurrentPage('add-transaction');
          }}
          className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                <Home className="text-white sm:w-5 sm:h-5" size={18} />
              </div>
              <p className="text-gray-500 font-medium mb-1 text-sm uppercase tracking-wide">Total Borrowed</p>
              <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">
                {formatCurrency(loanStats.totalBorrowed)}
              </h3>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Users className="text-white" size={20} />
              </div>
              <p className="text-gray-500 font-medium mb-1 text-sm uppercase tracking-wide">Total Lent</p>
              <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">
                {formatCurrency(loanStats.totalLent)}
              </h3>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <TrendingUp className="text-white" size={20} />
              </div>
              <p className="text-gray-500 font-medium mb-1 text-sm uppercase tracking-wide">Monthly EMI</p>
              <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">
                {formatCurrency(loanStats.totalEMI)}
              </h3>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card variant="mesh-red" className="p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="text-white" size={20} />
              </div>
              <p className="text-white/80 font-medium mb-1 text-sm uppercase tracking-wide">Overdue</p>
              <h3 className="text-3xl font-display font-bold text-white tracking-tight">
                {loanStats.overdueCount}
              </h3>
            </div>
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </Card>
        </motion.div>
      </div>

      {loanStats.overdueCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card variant="glass" className="p-4 flex items-start gap-3 border-2 border-red-200">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
            <div>
              <p className="font-display font-bold text-red-900">Overdue Payments</p>
              <p className="text-sm text-red-700 mt-1">
                You have {loanStats.overdueCount} overdue payment{loanStats.overdueCount > 1 ? 's' : ''}. Please make payments to avoid penalties.
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Loans Grid */}
      {/* Loans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['borrowed', 'lent', 'emi'].map((type, idx) => (
          <motion.div key={type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card variant="glass" className="p-6">
              <h3 className="text-xl font-display font-bold text-gray-900 mb-4 capitalize">{type === 'emi' ? 'EMI Loans' : `${type} Loans`}</h3>
              <div className="space-y-3">
                {loans
                  .filter(l => l.type === type && isOpenLoan(l))
                  .map(loan => {
                    const effectiveStatus = getEffectiveLoanStatus(loan);
                    return (
                    <motion.div key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-display font-bold text-gray-900 text-sm">{loan.name}</h4>
                          {loan.contactPerson && (
                            <p className="text-xs text-gray-500 mt-1">{loan.contactPerson}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(loan)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                            title="Edit loan"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLoan(loan.id!, loan.name)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                            title="Delete loan"
                          >
                            <Trash2 size={14} />
                          </button>
                          <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full", getLoanStatusColor(loan))}>
                            {effectiveStatus}
                          </span>
                        </div>
                      </div>
                      
                      {editingLoanId === loan.id ? (
                        <div className="space-y-2 mb-3">
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Loan name"
                            aria-label="Loan name"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <input
                            type="number"
                            value={editFormData.principalAmount}
                            onChange={(e) => setEditFormData({ ...editFormData, principalAmount: parseFloat(e.target.value) })}
                            placeholder="Principal amount"
                            aria-label="Principal amount"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <input
                            type="number"
                            value={editFormData.outstandingBalance}
                            onChange={(e) => setEditFormData({ ...editFormData, outstandingBalance: parseFloat(e.target.value) })}
                            placeholder="Outstanding balance"
                            aria-label="Outstanding balance"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          {editFormData.emiAmount !== undefined && (
                            <input
                              type="number"
                              value={editFormData.emiAmount}
                              onChange={(e) => setEditFormData({ ...editFormData, emiAmount: parseFloat(e.target.value) })}
                              placeholder="EMI amount"
                              aria-label="EMI amount"
                              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                          )}
                          <input
                            type="date"
                            value={editFormData.dueDate ? new Date(editFormData.dueDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                            aria-label="Due date"
                            title="Due date"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 px-2 py-1 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-900"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLoanId(null)}
                              className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Principal</p>
                            <p className="font-display font-bold text-gray-900 text-sm">{formatCurrency(loan.principalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Outstanding</p>
                            <p className="font-display font-bold text-gray-900 text-sm">{formatCurrency(loan.outstandingBalance)}</p>
                          </div>
                          {loan.emiAmount && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium">EMI Amount</p>
                              <p className="font-display font-bold text-gray-900 text-sm">{formatCurrency(loan.emiAmount)}</p>
                            </div>
                          )}
                          {loan.dueDate && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Due Date</p>
                              <p className="font-display font-bold text-gray-900 text-sm">
                                {new Date(loan.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>

                        <progress
                          className="w-full h-2 mb-3 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-black [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-black"
                          value={Math.max(0, loan.principalAmount - loan.outstandingBalance)}
                          max={Math.max(1, loan.principalAmount)}
                          aria-label="Loan repayment progress"
                        />

                        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Payment Info</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
                            <span>
                              Last paid: {loan.id && latestPaymentByLoan.get(loan.id)
                                ? formatShortDate(latestPaymentByLoan.get(loan.id))
                                : 'No payment yet'}
                            </span>
                            {loan.id && completionDateByLoan.get(loan.id) && (
                              <span className="font-semibold text-green-700">
                                Completed on: {formatShortDate(completionDateByLoan.get(loan.id))}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setShowPaymentModal(loan.id!)}
                          className="w-full px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-900 transition-all text-xs font-bold shadow-sm active:scale-95"
                        >
                          Make Payment
                        </button>
                      </>
                    )}
                    </motion.div>
                  );
                })}
                {loans.filter(l => l.type === type && isOpenLoan(l)).length === 0 && (
                  <p className="text-gray-500 text-center py-8 text-sm">No open {type} loans</p>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {showPaymentModal && (
        <PaymentModal
          loanId={showPaymentModal}
          accounts={accounts}
          onClose={() => setShowPaymentModal(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Loan"
        message="This loan record will be permanently deleted. All payment history will be lost."
        itemName={loanToDelete?.name}
        isLoading={isDeleting}
        onConfirm={confirmDeleteLoan}
        onCancel={() => {
          setDeleteModalOpen(false);
          setLoanToDelete(null);
        }}
      />
    </div>
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
      status: getLoanStatusFromDueDate(loan.dueDate, newOutstanding),
    });

    const account = accounts.find(a => a.id === accountId);
    if (account) {
      const nextBalance = loan.type === 'lent'
        ? account.balance + amount
        : account.balance - amount;
      await db.accounts.update(accountId, {
        balance: nextBalance,
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
            <label htmlFor="loan-payment-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              id="loan-payment-amount"
              type="number"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="loan-payment-account" className="block text-sm font-medium text-gray-700 mb-1">Pay From</label>
            <select
              id="loan-payment-account"
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
            <label htmlFor="loan-payment-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              id="loan-payment-notes"
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
