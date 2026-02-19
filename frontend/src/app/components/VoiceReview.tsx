import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/expenseCategories';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, ChevronLeft, Trash2 } from 'lucide-react';
import { CategoryDropdown } from '@/app/components/ui/CategoryDropdown';

const STORAGE_KEY = 'voiceBatchDraft';

type DraftIntent = 'expense' | 'income' | 'transfer';

type DraftItem = {
  intent: DraftIntent;
  amount: number;
  category: string | null;
  description: string;
};

const CATEGORIES = {
  expense: Object.values(EXPENSE_CATEGORIES).map((cat) => cat.name),
  income: Object.values(INCOME_CATEGORIES).map((cat) => cat.name),
};

export const VoiceReview: React.FC = () => {
  const { accounts, currency, setCurrentPage } = useApp();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const rawDraft = localStorage.getItem(STORAGE_KEY);
    if (!rawDraft) {
      toast.error('No voice draft found');
      setCurrentPage('transactions');
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as DraftItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('No transactions to review');
        setCurrentPage('transactions');
        return;
      }
      setItems(parsed);
    } catch (error) {
      console.error('Failed to parse voice batch draft:', error);
      toast.error('Failed to load voice draft');
      setCurrentPage('transactions');
    }
  }, [setCurrentPage]);

  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items]);

  const nonTransfers = useMemo(() => items.filter((item) => item.intent !== 'transfer'), [items]);
  const transfers = useMemo(() => items.filter((item) => item.intent === 'transfer'), [items]);

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const handleIntentChange = (index: number, nextIntent: DraftIntent) => {
    if (nextIntent === 'transfer') {
      handleUpdate(index, { intent: nextIntent, category: 'Transfer' });
      return;
    }

    const categoryList = CATEGORIES[nextIntent];
    handleUpdate(index, {
      intent: nextIntent,
      category: categoryList[0],
    });
  };

  const handleOpenTransfer = (item: DraftItem) => {
    localStorage.setItem('voiceTransferDraft', JSON.stringify({
      amount: item.amount,
      description: item.description,
    }));
    setCurrentPage('transfer');
  };

  const handleSave = async () => {
    if (!accountId) {
      toast.error('Please select an account');
      return;
    }

    if (nonTransfers.length === 0) {
      toast.error('No income or expense entries to save');
      return;
    }

    const invalid = nonTransfers.find((item) => !item.amount || item.amount <= 0);
    if (invalid) {
      toast.error('Each entry must have a valid amount');
      return;
    }

    setIsSaving(true);

    try {
      const account = accounts.find((acc) => acc.id === accountId);
      if (!account) {
        toast.error('Selected account not found');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      let balanceDelta = 0;

      for (const item of nonTransfers) {
        await db.transactions.add({
          type: item.intent,
          amount: item.amount,
          accountId: accountId,
          category: item.category || (item.intent === 'income' ? 'Other Income' : 'Miscellaneous'),
          subcategory: '',
          description: item.description,
          merchant: '',
          date: new Date(today),
          tags: [],
        });

        balanceDelta += item.intent === 'income' ? item.amount : -item.amount;
      }

      await db.accounts.update(accountId, {
        balance: account.balance + balanceDelta,
        updatedAt: new Date(),
      });

      // Calculate totals for feedback
      const totalIncome = nonTransfers
        .filter((item) => item.intent === 'income')
        .reduce((sum, item) => sum + item.amount, 0);
      const totalExpense = nonTransfers
        .filter((item) => item.intent === 'expense')
        .reduce((sum, item) => sum + item.amount, 0);

      if (transfers.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        const feedbackParts = [];
        if (totalIncome > 0) feedbackParts.push(`💰 Income: ${currency} ${totalIncome.toFixed(2)}`);
        if (totalExpense > 0) feedbackParts.push(`💸 Expense: ${currency} ${totalExpense.toFixed(2)}`);
        const message = `✅ Saved ${nonTransfers.length} transactions${feedbackParts.length > 0 ? ' · ' + feedbackParts.join(' · ') : ''}`;
        toast.success(message);
        setCurrentPage('transactions');
        return;
      }

      setItems(transfers);
      const feedbackParts = [];
      if (totalIncome > 0) feedbackParts.push(`💰 Income: ${currency} ${totalIncome.toFixed(2)}`);
      if (totalExpense > 0) feedbackParts.push(`💸 Expense: ${currency} ${totalExpense.toFixed(2)}`);
      const message = `✅ Saved ${nonTransfers.length} transactions${feedbackParts.length > 0 ? ' · ' + feedbackParts.join(' · ') : ''} · Review transfers next`;
      toast.success(message);
    } catch (error) {
      console.error('Failed to save reviewed transactions:', error);
      toast.error('❌ Failed to save transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('voice-input')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back to voice input"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Review Voice Transactions</h2>
            <p className="text-gray-500 mt-1">Edit, remove, and save your transactions</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Apply to Account</label>
          <select
            value={accountId}
            onChange={(event) => setAccountId(Number(event.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Select account for transactions"
          >
            <option value={0}>Select an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({currency} {account.balance.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
            No transactions to review.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => {
              const categoryList = item.intent === 'income' ? CATEGORIES.income : CATEGORIES.expense;
              return (
                <div key={`${item.intent}-${index}`} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-2">
                      <select
                        value={item.intent}
                        onChange={(event) => handleIntentChange(index, event.target.value as DraftIntent)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        aria-label="Select transaction type"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="transfer">Transfer</option>
                      </select>
                      {item.intent === 'transfer' && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Manual setup required</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(index)}
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount || ''}
                          onChange={(event) => handleUpdate(index, { amount: Number(event.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                          aria-label="Amount"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      {item.intent === 'transfer' ? (
                        <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500">Transfer</div>
                      ) : (
                        <CategoryDropdown
                          value={item.category || ''}
                          onChange={(value) => handleUpdate(index, { category: value })}
                          options={categoryList}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) => handleUpdate(index, { description: event.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Enter description"
                        aria-label="Description"
                      />
                    </div>
                  </div>

                  {item.intent === 'transfer' && (
                    <button
                      onClick={() => handleOpenTransfer(item)}
                      className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <ArrowRightLeft size={16} /> Open transfer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {nonTransfers.length} income/expense, {transfers.length} transfer
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving || nonTransfers.length === 0}
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
          >
            <Check size={18} /> {isSaving ? 'Saving...' : 'Save Transactions'}
          </button>
        </div>
      </div>
    </CenteredLayout>
  );
};
