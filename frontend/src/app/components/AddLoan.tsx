import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { queueTransactionInsertSync } from '@/lib/auth-sync-integration';
import { backendService } from '@/lib/backend-api';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
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

  const selectedAccount = accounts.find((a) => a.id === formData.accountId);
  const accountOptions = accounts
    .filter((account) => account.id)
    .map((account) => ({
      value: String(account.id),
      label: account.name,
      description: `${currency} ${account.balance.toFixed(2)} available`,
      group: account.type ? `${account.type.charAt(0).toUpperCase()}${account.type.slice(1)} accounts` : 'Accounts',
    }));

  const calculateEMI = (data = formData) => {
    const P = data.principalAmount;
    const r = data.interestRate / 100 / 12;
    const n = data.tenureMonths;
    if (P <= 0 || r < 0 || n <= 0) return 0;
    if (r === 0) return P / n;
    return Math.round(((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) * 100) / 100;
  };

  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...formData, [key]: value };
    if (key === 'principalAmount' || key === 'interestRate' || key === 'tenureMonths') {
      updated.emiAmount = calculateEMI(updated);
    }
    setFormData(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lenderName.trim()) { toast.error('Please enter lender name'); return; }
    if (formData.principalAmount <= 0) { toast.error('Principal amount must be greater than 0'); return; }
    if (formData.tenureMonths <= 0) { toast.error('Tenure must be greater than 0'); return; }
    if (!selectedAccount) { toast.error('Please select an account'); return; }

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
        await db.accounts.update(formData.accountId, { balance: newBalance, updatedAt: now });
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
        console.info(' Loan backend sync skipped:', syncError);
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
    const f = friends.find((fr) => fr.id === friendId);
    if (!f) return;
    setFormData((p) => ({ ...p, friendId, lenderName: f.name }));
    setShowFriendPicker(false);
  };

  const totalInterest = (formData.emiAmount * formData.tenureMonths) - formData.principalAmount;

  /*  Shared summary sidebar  */
  const SummaryPanel = () => (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl  border border-gray-200 shadow-sm p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Loan Summary</h3>
        <div className="space-y-4">
          {[
            { label: 'Principal', value: formData.principalAmount > 0 ? `${currency} ${formData.principalAmount.toFixed(2)}` : '-', cls: ' border-gray-100 text-gray-900' },
            { label: 'Monthly EMI', value: formData.emiAmount > 0 ? `${currency} ${formData.emiAmount.toFixed(2)}` : '-', cls: ' border-gray-100 text-gray-900' },
            { label: 'Total Interest', value: totalInterest > 0 ? `${currency} ${totalInterest.toFixed(2)}` : '-', cls: 'bg-amber-50 border-amber-100 text-amber-700' },
            { label: 'Total Payable', value: formData.principalAmount > 0 ? `${currency} ${(formData.principalAmount + totalInterest).toFixed(2)}` : '-', cls: 'bg-rose-50 border-rose-100 text-rose-700' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded-xl border px-4 py-3 ${cls}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </div>
          ))}
          {formData.tenureMonths > 0 && formData.emiAmount > 0 && (
            <p className="text-xs text-gray-500 text-center pt-1">
              {formData.tenureMonths} monthly payments of {currency} {formData.emiAmount.toFixed(2)}
            </p>
          )}
        </div>
      </div>
      {formData.lenderName && (
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-500 mb-1">Lender</p>
          <p className="text-sm font-semibold text-blue-900">{formData.lenderName}</p>
          {formData.startDate && (
            <p className="text-xs text-blue-600 mt-1">
              Starting {new Date(formData.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );

  /*  Shared form fields (used by both desktop loanForm var and mobile inline)  */
  const FriendPickerSection = () => (
    <>
      {friends && friends.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowFriendPicker(!showFriendPicker)}
            className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 font-medium">
            <UserPlus size={13} /> Select from friends
          </button>
          {showFriendPicker && (
            <div className="mt-2 p-3  border border-gray-200 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Choose friend</span>
                <button type="button" onClick={() => setShowFriendPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {friends.map((friend) => (
                  <button key={friend.id} type="button"
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between ${formData.friendId === friend.id ? 'bg-green-50 border-green-300 text-green-800 font-semibold' : ' border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => friend.id && handleFriendSelect(friend.id)}>
                    <span>{friend.name}</span>
                    {formData.friendId === friend.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  /*  Desktop shared form  */
  const loanForm = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Lender Name *</label>
        <input type="text" value={formData.lenderName}
          onChange={(e) => handleFieldChange('lenderName', e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500  text-sm"
          placeholder="e.g., HDFC Bank, John Doe" required />
        <FriendPickerSection />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Principal Amount *</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl  px-3 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <span className="text-gray-500 text-sm font-bold">{currency}</span>
            <input type="number" step="0.01" value={formData.principalAmount || ''}
              onChange={(e) => handleFieldChange('principalAmount', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="0.00" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Interest Rate (% p.a.)</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl  px-3 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <input type="number" step="0.01" value={formData.interestRate || ''}
              onChange={(e) => handleFieldChange('interestRate', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="0.00" />
            <span className="text-gray-500 text-sm font-bold">%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tenure *</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl  px-3 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <input type="number" step="1" value={formData.tenureMonths || ''}
              onChange={(e) => handleFieldChange('tenureMonths', parseInt(e.target.value) || 0)}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" placeholder="12" required />
            <span className="text-gray-500 text-sm">months</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
          <input type="date" value={formData.startDate}
            onChange={(e) => handleFieldChange('startDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500  text-sm font-semibold"
            required aria-label="Start Date" title="Start Date" />
        </div>
      </div>

      <div>
        <SearchableDropdown
          label="Link to Account"
          options={accountOptions}
          value={formData.accountId ? String(formData.accountId) : ''}
          onChange={(accountId) => handleFieldChange('accountId', parseInt(accountId, 10) || 0)}
          placeholder="Select account"
          searchPlaceholder="Search accounts..."
          grouped
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea value={formData.description} onChange={(e) => handleFieldChange('description', e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none  text-sm"
          rows={3} placeholder="Any notes about this loan..." />
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => setCurrentPage('loans')}
          className="px-5 py-3 rounded-xl font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all text-sm">
          Cancel
        </button>
        <button type="submit" disabled={isLoading}
          className="flex-1 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white py-3 rounded-xl font-semibold transition-all shadow-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {isLoading ? 'Creating...' : <><CreditCard size={15} /> Create Loan</>}
        </button>
      </div>
    </form>
  );

  const [isDesktop, setIsDesktop] = useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return (
    <>
      {isDesktop ? (
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans flex flex-col">
          <div className="w-full max-w-[800px] mx-auto px-8 py-10">
            <div className="mb-8 flex items-center gap-3">
              <button type="button" onClick={() => setCurrentPage('loans')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200  text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                aria-label="Go back">
                <Plus size={18} className="rotate-45" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md">
                <CreditCard size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add New Loan</h1>
                <p className="text-sm text-gray-500 mt-0.5">Track your loans and manage EMI payments</p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_300px] gap-6 items-start">
              <div className=" rounded-lg border border-gray-100 shadow-xl shadow-gray-200/50 p-8">
                {loanForm}
              </div>
              <div className="sticky top-8">
                <SummaryPanel />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-gray-100">
            <button type="button" onClick={() => setCurrentPage('loans')}
              className="w-9 h-9 rounded-xl border border-gray-200  flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all shadow-sm">
              <Plus size={18} className="rotate-45" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-sm">
                <CreditCard size={15} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-900 leading-tight">Add New Loan</h1>
                <p className="text-[11px] text-gray-400">Track your loans and manage EMI payments</p>
              </div>
            </div>
            <button type="button" onClick={() => setCurrentPage('loans')}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-1 px-4 py-4 space-y-4">

              {/* Lender */}
              <div className="/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Lender Name *</label>
                <input type="text" value={formData.lenderName}
                  onChange={(e) => handleFieldChange('lenderName', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus: transition-all placeholder:text-gray-300"
                  placeholder="e.g., HDFC Bank, John Doe" required />
                <FriendPickerSection />
              </div>

              {/* Principal + Interest */}
              <div className="/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Principal *</label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within: transition-all">
                      <span className="text-xs font-bold text-gray-400">{currency}</span>
                      <input type="number" step="0.01" value={formData.principalAmount || ''}
                        onChange={(e) => handleFieldChange('principalAmount', parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="0.00" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Interest % p.a.</label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within: transition-all">
                      <input type="number" step="0.01" value={formData.interestRate || ''}
                        onChange={(e) => handleFieldChange('interestRate', parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="0.00" />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tenure + Start Date */}
              <div className="/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tenure *</label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within: transition-all">
                      <input type="number" step="1" value={formData.tenureMonths || ''}
                        onChange={(e) => handleFieldChange('tenureMonths', parseInt(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="12" required />
                      <span className="text-[11px] font-semibold text-gray-400">mo</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Start Date *</label>
                    <input type="date" value={formData.startDate}
                      onChange={(e) => handleFieldChange('startDate', e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus: transition-all"
                      required aria-label="Start Date" title="Start Date" />
                  </div>
                </div>
              </div>

              {/* EMI Preview */}
              {formData.emiAmount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'EMI/mo', value: `${currency} ${formData.emiAmount.toFixed(2)}`, cls: 'bg-sky-50 border-sky-100 text-sky-800' },
                    { label: 'Interest', value: `${currency} ${totalInterest.toFixed(2)}`, cls: 'bg-amber-50 border-amber-100 text-amber-800' },
                    { label: 'Total', value: `${currency} ${(formData.principalAmount + totalInterest).toFixed(2)}`, cls: 'bg-rose-50 border-rose-100 text-rose-800' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`rounded-xl border p-3 ${cls}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                      <p className="text-xs font-black mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Account + Notes */}
              <div className="/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-[30px] p-4 space-y-3">
                <div>
                  <SearchableDropdown
                    label="Link to Account"
                    options={accountOptions}
                    value={formData.accountId ? String(formData.accountId) : ''}
                    onChange={(accountId) => handleFieldChange('accountId', parseInt(accountId, 10) || 0)}
                    placeholder="Select account"
                    searchPlaceholder="Search accounts..."
                    grouped
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <textarea value={formData.description} onChange={(e) => handleFieldChange('description', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus: resize-none transition-all placeholder:text-gray-300"
                    rows={3} placeholder="Any notes about this loan..." />
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="sticky bottom-0  border-t border-gray-100 px-4 py-4 flex gap-3">
              <button type="button" onClick={() => setCurrentPage('loans')}
                className="px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-sm font-black shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                {isLoading ? 'Creating...' : <><CreditCard size={15} /> Create Loan</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
