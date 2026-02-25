import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import { Edit } from 'lucide-react';
import { toast } from 'sonner';
import supabase from '@/utils/supabase/client';

export const EditAccount: React.FC<{ accountId?: number }> = ({ accountId: propAccountId }) => {
  const { setCurrentPage, currency } = useApp();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get accountId from prop or localStorage
  const accountId = propAccountId || Number(localStorage.getItem('editAccountId'));

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    db.accounts.get(accountId).then((acc) => {
      setAccount(acc);
      setLoading(false);
    });

    // Cleanup localStorage on unmount
    return () => {
      localStorage.removeItem('editAccountId');
    };
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setSaving(true);
    try {
      // 1. Update local IndexedDB (instant UI update)
      await db.accounts.update(account.id, {
        name: account.name,
        type: account.type,
        balance: account.balance,
      });

      // 2. Sync to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: account.name,
            type: account.type,
            balance: account.balance,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('id', account.id);

        if (error) {
          // Local update already done — warn but don't block
          console.error('Supabase sync failed:', error);
          toast.warning('Saved locally — cloud sync will retry automatically.');
        } else {
          toast.success('Account updated successfully!');
        }
      } else {
        toast.success('Account updated locally!');
      }

      setCurrentPage('accounts');
    } catch (error: any) {
      console.error('Failed to update account:', error);
      toast.error('Failed to update account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Account not found</p>
      </div>
    );
  }

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <PageHeader
          title="Edit Account"
          subtitle="Update your account details"
          icon={<Edit size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="accounts"
        />

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={account.name}
                onChange={(e) => setAccount({ ...account, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-label="Account Name"
                title="Account Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                value={account.type}
                onChange={(e) => setAccount({ ...account, type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Account Type"
                title="Account Type"
              >
                <option value="bank">Bank Account</option>
                <option value="card">Credit/Debit Card</option>
                <option value="cash">Cash</option>
                <option value="wallet">Digital Wallet</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Balance
              </label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3 text-lg">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={account.balance || ''}
                  onChange={(e) => setAccount({ ...account, balance: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Current Balance"
                  title="Current Balance"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => setCurrentPage('accounts')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                aria-label="Cancel"
                title="Cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                aria-label="Save Changes"
                title="Save Changes"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
