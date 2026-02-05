import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '../../lib/database';
import { Plus, Upload, TrendingUp, TrendingDown, Filter, Search, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getSubcategoriesForCategory } from '@/lib/expenseCategories';

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map(cat => cat.name),
  income: Object.values(INCOME_CATEGORIES).map(cat => cat.name),
};

export const Transactions: React.FC = () => {
  const { accounts, transactions, currency, setCurrentPage } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTransactionTypeModal, setShowTransactionTypeModal] = useState(false);

  // Check for quick form type from localStorage
  useEffect(() => {
    const type = localStorage.getItem('quickFormType') as 'expense' | 'income' | null;
    if (type) {
      setCurrentPage('add-transaction');
      localStorage.removeItem('quickFormType');
    }
  }, [setCurrentPage]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [transactions, filterType, searchQuery]);

  const stats = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    return { expenses, income, netFlow: income - expenses };
  }, [transactions]);

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
            <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
            <p className="text-gray-500 mt-1">Track all your income and expenses</p>
          </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Camera size={20} />
            Scan Bill
          </button>
          <button
            onClick={() => setShowTransactionTypeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-600 p-6 rounded-xl text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} />
            <p className="text-sm opacity-90">Total Income</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.income)}</p>
        </div>
        <div className="bg-red-600 p-6 rounded-xl text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} />
            <p className="text-sm opacity-90">Total Expenses</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.expenses)}</p>
        </div>
        <div className={`${stats.netFlow >= 0 ? 'bg-blue-600' : 'bg-red-600'} p-6 rounded-xl text-white`}>
          <div className="flex items-center gap-2 mb-2">
            <Filter size={20} />
            <p className="text-sm opacity-90">Net Flow</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.netFlow)}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'income' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'expense' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Expenses
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map(transaction => {
                const account = accounts.find(a => a.id === transaction.accountId);
                // Determine display type: for transfers, use subcategory to show Transfer In as income, Transfer Out as expense
                const displayType = transaction.type === 'transfer' 
                  ? (transaction.subcategory === 'Transfer In' ? 'income' : 'expense')
                  : transaction.type;
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          displayType === 'income' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {displayType === 'income' ? (
                            <TrendingUp className="text-green-600" size={16} />
                          ) : (
                            <TrendingDown className="text-red-600" size={16} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                          {transaction.merchant && (
                            <p className="text-xs text-gray-500">{transaction.merchant}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                        {transaction.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account?.name}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                      displayType === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {displayType === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>

      {/* Transaction Type Selection Modal */}
      {showTransactionTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Add Transaction</h3>
            <p className="text-gray-500 mb-6">Select transaction type</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowTransactionTypeModal(false);
                  localStorage.setItem('quickFormType', 'expense');
                  setCurrentPage('add-transaction');
                }}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">Expense</p>
                <p className="text-sm text-gray-500">Record money spent</p>
              </button>
              <button
                onClick={() => {
                  setShowTransactionTypeModal(false);
                  localStorage.setItem('quickFormType', 'income');
                  setCurrentPage('add-transaction');
                }}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">Income</p>
                <p className="text-sm text-gray-500">Record money received</p>
              </button>
              <button
                onClick={() => {
                  setShowTransactionTypeModal(false);
                  setCurrentPage('transfer');
                }}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">Transfer</p>
                <p className="text-sm text-gray-500">Move money between accounts</p>
              </button>
            </div>
            <button
              onClick={() => setShowTransactionTypeModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </div>
    </CenteredLayout>
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

      toast.success('Transaction added successfully');
      onClose();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('Failed to add transaction');
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
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${
                  formData.type === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income', category: CATEGORIES.income[0] })}
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${
                  formData.type === 'income'
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {CATEGORIES[formData.type].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Walmart"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Scan Again
              </button>
              <button
                onClick={handleSaveScanned}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save Transaction
              </button>
            </div>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};