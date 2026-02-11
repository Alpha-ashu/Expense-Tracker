import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../lib/database';
import { Plus, TrendingUp, TrendingDown, Search, Camera, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Repeat2, Wallet } from 'lucide-react';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { ReceiptScanner } from '@/app/components/ReceiptScanner';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getSubcategoriesForCategory } from '@/lib/expenseCategories';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';
import { TimeFilter, TimeFilterPeriod, filterByTimePeriod, getPeriodLabel } from '@/app/components/ui/TimeFilter';

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map(cat => cat.name),
  income: Object.values(INCOME_CATEGORIES).map(cat => cat.name),
};

export const Transactions: React.FC = () => {
  const { accounts, transactions, currency, setCurrentPage } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimeFilterPeriod>('monthly');
  const [showTransactionTypeModal, setShowTransactionTypeModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: number; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const type = localStorage.getItem('quickFormType');
    if (type === 'expense' || type === 'income') {
      setCurrentPage('add-transaction');
      localStorage.removeItem('quickFormType');
    } else if (type) {
      // Remove any other unexpected value
      localStorage.removeItem('quickFormType');
    }
  }, [setCurrentPage]);

  const filteredTransactions = useMemo(() => {
    // First filter by time period
    const timeFiltered = filterByTimePeriod(transactions, timePeriod);
    // Then filter by type and search
    return timeFiltered
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [transactions, filterType, searchQuery, timePeriod]);

  const stats = useMemo(() => {
    // Stats based on time-filtered transactions
    const timeFiltered = filterByTimePeriod(transactions, timePeriod);
    const expenses = timeFiltered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const income = timeFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    return { expenses, income, netFlow: income - expenses };
  }, [transactions, timePeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleDeleteTransaction = (id: number, description: string) => {
    setTransactionToDelete({ id, description });
    setDeleteModalOpen(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      await db.transactions.delete(transactionToDelete.id);
      toast.success('Transaction deleted successfully');
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      {/* App Header */}
      <PageHeader
        title="Transactions"
        subtitle="Track your financial activity"
        icon={<Wallet size={20} className="sm:w-6 sm:h-6" />}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => setShowScanModal(true)}
            className="shadow-sm border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm h-9 sm:h-10 px-2.5 sm:px-4"
          >
            <Camera size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Scan Bill</span>
            <span className="inline sm:hidden">Scan</span>
          </Button>
          <Button
            onClick={() => setShowTransactionTypeModal(true)}
            className="shadow-lg bg-black text-white hover:bg-gray-900 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
          >
            <Plus size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            Add
          </Button>
        </div>

      {/* Time Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TimeFilter value={timePeriod} onChange={setTimePeriod} />
        <p className="text-sm text-gray-500 font-medium">{getPeriodLabel(timePeriod)}</p>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card variant="mesh-green" className="p-4 sm:p-6 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 text-white/80">
              <div className="p-1 sm:p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                <ArrowDownLeft size={14} className="sm:w-4 sm:h-4" />
              </div>
              <span className="font-semibold text-xs sm:text-sm">Total Income</span>
            </div>
            <p className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">{formatCurrency(stats.income)}</p>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        </Card>

        <Card variant="mesh-pink" className="p-4 sm:p-6 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 text-white/80">
              <div className="p-1 sm:p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                <ArrowUpRight size={14} className="sm:w-4 sm:h-4" />
              </div>
              <span className="font-semibold text-xs sm:text-sm">Total Expense</span>
            </div>
            <p className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">{formatCurrency(stats.expenses)}</p>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        </Card>

        <Card variant="default" className="p-4 sm:p-6 bg-white border-white/60 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 text-gray-500">
              <div className="p-1 sm:p-1.5 bg-gray-100 rounded-lg">
                <TrendingUp size={14} className={cn("sm:w-4 sm:h-4", stats.netFlow >= 0 ? "text-emerald-500" : "text-red-500")} />
              </div>
              <span className="font-semibold text-xs sm:text-sm">Net Flow</span>
            </div>
            <p className={cn(
              "text-2xl sm:text-3xl font-display font-bold tracking-tight",
              stats.netFlow >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {stats.netFlow > 0 ? '+' : ''}{formatCurrency(stats.netFlow)}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 text-xs sm:text-sm"
          />
        </div>
        <div className="flex bg-gray-100/50 p-1 rounded-xl">
          {(['all', 'income', 'expense'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all capitalize",
                filterType === type
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <Card variant="glass" className="overflow-hidden !p-0 min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Details</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Account</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="w-16 sm:w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.map((transaction, i) => {
                const account = accounts.find(a => a.id === transaction.accountId);
                const displayType = transaction.type === 'transfer'
                  ? (transaction.subcategory === 'Transfer In' ? 'income' : 'expense')
                  : transaction.type;

                return (
                  <motion.tr
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-6 py-4 pl-8">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm border border-white/50",
                          displayType === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {displayType === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{transaction.description}</p>
                          <p className="text-xs text-gray-400 font-medium">{new Date(transaction.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        {transaction.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-500">
                      {account?.name}
                    </td>
                    <td className="px-6 py-4 text-right pr-8">
                      <span className={cn(
                        "font-bold text-sm",
                        displayType === 'income' ? "text-emerald-600" : "text-gray-900"
                      )}>
                        {displayType === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-600"
                          onClick={() => {
                            localStorage.setItem('editTransactionId', transaction.id?.toString() || '');
                            setCurrentPage('add-transaction');
                          }}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeleteTransaction(transaction.id!, transaction.description)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="text-gray-300" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No transactions found</h3>
              <p className="text-gray-500 text-sm max-w-xs mt-1">Try adjusting your filters or search query to find what you're looking for.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Transaction Type Modal */}
      {showTransactionTypeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-white/20"
          >
            <h3 className="text-2xl font-display font-bold mb-2">New Transaction</h3>
            <p className="text-gray-500 mb-8">What kind of transaction is this?</p>

            <div className="space-y-3">
              {[
                { type: 'expense', label: 'Expense', desc: 'Money spent', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100', icon: ArrowDownLeft },
                { type: 'income', label: 'Income', desc: 'Money received', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', icon: ArrowUpRight },
                { type: 'transfer', label: 'Transfer', desc: 'Move between accounts', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', icon: Repeat2 },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    setShowTransactionTypeModal(false);
                    if (opt.type === 'transfer') {
                      // Always open the Transfer page
                      setCurrentPage('transfer');
                    } else {
                      localStorage.setItem('quickFormType', opt.type);
                      setCurrentPage('add-transaction');
                    }
                  }}
                  className={cn(
                    "w-full p-4 flex items-center gap-4 rounded-2xl transition-all border border-transparent hover:scale-[1.02]",
                    opt.color
                  )}
                >
                  <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center shadow-sm">
                    <opt.icon size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">{opt.label}</p>
                    <p className="text-sm opacity-80 font-medium">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="w-full mt-6 rounded-xl hover:bg-gray-100"
              onClick={() => setShowTransactionTypeModal(false)}
            >
              Cancel
            </Button>
          </motion.div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Transaction"
        message="This transaction will be permanently deleted. This action cannot be undone."
        itemName={transactionToDelete?.description}
        isLoading={isDeleting}
        onConfirm={confirmDeleteTransaction}
        onCancel={() => {
          setDeleteModalOpen(false);
          setTransactionToDelete(null);
        }}
      />

      <ReceiptScanner
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onTransactionCreated={() => setShowScanModal(false)}
      />
    </div>
  );
};

interface AddTransactionModalProps {
  accounts: any[];
  onClose: () => void;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ accounts, onClose }) => {
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income',
    amount: 0,
    accountId: accounts[0]?.id || 0,
    category: CATEGORIES.expense[0],
    subcategory: '',
    description: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
  });

  const subcategories = useMemo(() => {
    return getSubcategoriesForCategory(formData.category, formData.type);
  }, [formData.category, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const account = accounts.find(a => a.id === formData.accountId);
    if (!account) {
      toast.error('Please select an account');
      return;
    }

    try {
      await db.transactions.add({
        ...formData,
        date: new Date(formData.date),
        tags: [],
      });

      const newBalance = formData.type === 'income'
        ? account.balance + formData.amount
        : account.balance - formData.amount;

      await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: new Date() });

      // Show detailed success message
      const typeLabel = formData.type === 'income' ? 'Income' : 'Expense';
      const icon = formData.type === 'income' ? '📈' : '📉';
      const message = `${icon} ${typeLabel} ₹${formData.amount.toFixed(2)} added to ${formData.category}`;
      toast.success(message);
      onClose();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('❌ Failed to add transaction. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Add Transaction</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense', category: CATEGORIES.expense[0] })}
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${formData.type === 'expense'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600'
                  }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income', category: CATEGORIES.income[0] })}
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${formData.type === 'income'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600'
                  }`}
              >
                Income
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 appearance-none bg-white"
              required
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <CategoryDropdown
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value, subcategory: '' })}
              options={CATEGORIES[formData.type]}
              label="Category"
              required
            />
          </div>

          {subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 appearance-none bg-white"
              >
                <option value="">Select a subcategory</option>
                {subcategories.map(subcat => (
                  <option key={subcat} value={subcat}>{subcat}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="e.g., Grocery shopping"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant (Optional)</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="e.g., Walmart"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-900 transition-all font-medium shadow-sm active:scale-95"
            >
              Add Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BillScannerModalProps {
  accounts: any[];
  onClose: () => void;
}

const BillScannerModal: React.FC<BillScannerModalProps> = ({ accounts, onClose }) => {
  const [scannedData, setScannedData] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    // Simulate OCR scanning
    setTimeout(() => {
      setScannedData({
        amount: Math.floor(Math.random() * 500) + 10,
        merchant: ['Walmart', 'Target', 'Starbucks', 'Amazon', 'McDonald\'s'][Math.floor(Math.random() * 5)],
        date: new Date().toISOString().split('T')[0],
        category: 'Shopping',
        items: [
          { name: 'Item 1', price: 12.99 },
          { name: 'Item 2', price: 25.49 },
          { name: 'Item 3', price: 8.99 },
        ],
      });
      setIsScanning(false);
      toast.success('Bill scanned successfully!');
    }, 2000);
  };

  const handleSaveScanned = async () => {
    if (!scannedData) return;

    try {
      await db.transactions.add({
        type: 'expense',
        amount: scannedData.amount,
        accountId: accounts[0]?.id || 0,
        category: scannedData.category,
        description: `Bill from ${scannedData.merchant}`,
        merchant: scannedData.merchant,
        date: new Date(scannedData.date),
        tags: ['scanned'],
      });

      const account = accounts[0];
      if (account) {
        await db.accounts.update(account.id, {
          balance: account.balance - scannedData.amount,
          updatedAt: new Date()
        });
      }

      toast.success('Transaction saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save scanned transaction:', error);
      toast.error('Failed to save transaction');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Scan Bill</h3>

        {!scannedData && !isScanning && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Camera className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-4">Upload a photo of your bill</p>
              <label className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500 text-center">
              AI will extract amount, merchant, and items from the bill
            </p>
          </div>
        )}

        {isScanning && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Scanning bill...</p>
          </div>
        )}

        {scannedData && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium mb-2">✓ Bill scanned successfully!</p>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Merchant:</span> {scannedData.merchant}</p>
                <p><span className="font-medium">Amount:</span> ${scannedData.amount}</p>
                <p><span className="font-medium">Date:</span> {scannedData.date}</p>
                <p><span className="font-medium">Category:</span> {scannedData.category}</p>
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Detected Items:</p>
              <div className="space-y-1">
                {scannedData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <span>{item.name}</span>
                    <span>${item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setScannedData(null)}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium active:scale-95"
              >
                Scan Again
              </button>
              <button
                onClick={handleSaveScanned}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-900 transition-all font-medium shadow-sm active:scale-95"
              >
                Save Transaction
              </button>
            </div>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium active:scale-95"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};