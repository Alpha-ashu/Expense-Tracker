import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Plus, DollarSign, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, Home, Users } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { AddLoanModalWithFriends } from '@/app/components/AddLoanModalWithFriends';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const Loans: React.FC = () => {
  const { loans, currency, accounts, friends, setCurrentPage } = useApp();
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (loan.status === 'completed') return 'bg-green-100 text-green-700';
    if (loan.status === 'overdue') return 'bg-red-100 text-red-700';
    return 'bg-black/10 text-gray-900';
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
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      <PageHeader
        title="Loans & EMIs"
        subtitle="Manage your debts and lending"
        icon={<DollarSign size={20} className="sm:w-6 sm:h-6" />}
      >
        <Button
          onClick={() => setCurrentPage('add-loan')}
          className="rounded-full h-9 sm:h-10 px-3 sm:px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-xs sm:text-sm"
        >
          <Plus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Add Loan
        </Button>
      </PageHeader>

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
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
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
                  .filter(l => l.type === type && l.status === 'active')
                  .map(loan => (
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
                            {loan.status}
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
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <input
                            type="number"
                            value={editFormData.principalAmount}
                            onChange={(e) => setEditFormData({ ...editFormData, principalAmount: parseFloat(e.target.value) })}
                            placeholder="Principal amount"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <input
                            type="number"
                            value={editFormData.outstandingBalance}
                            onChange={(e) => setEditFormData({ ...editFormData, outstandingBalance: parseFloat(e.target.value) })}
                            placeholder="Outstanding balance"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          {editFormData.emiAmount !== undefined && (
                            <input
                              type="number"
                              value={editFormData.emiAmount}
                              onChange={(e) => setEditFormData({ ...editFormData, emiAmount: parseFloat(e.target.value) })}
                              placeholder="EMI amount"
                              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                          )}
                          <input
                            type="date"
                            value={editFormData.dueDate ? new Date(editFormData.dueDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
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

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div
                            className="bg-black h-2 rounded-full transition-all"
                            style={{
                              width: `${((loan.principalAmount - loan.outstandingBalance) / loan.principalAmount) * 100}%`,
                            }}
                          />
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
                ))}
                {loans.filter(l => l.type === type && l.status === 'active').length === 0 && (
                  <p className="text-gray-500 text-center py-8 text-sm">No active {type} loans</p>
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