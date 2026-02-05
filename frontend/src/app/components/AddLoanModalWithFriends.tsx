import React, { useState } from 'react';
import { db, Friend } from '@/lib/database';
import { useApp } from '@/contexts/AppContext';
import { UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AddLoanModalWithFriendsProps {
  onClose: () => void;
}

export const AddLoanModalWithFriends: React.FC<AddLoanModalWithFriendsProps> = ({ onClose }) => {
  const { friends } = useApp();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [formData, setFormData] = useState({
    type: 'borrowed' as 'borrowed' | 'lent' | 'emi',
    name: '',
    principalAmount: 0,
    interestRate: 0,
    emiAmount: 0,
    dueDate: '',
    frequency: 'monthly' as 'monthly' | 'weekly' | 'custom',
    contactPerson: '',
    friendId: undefined as number | undefined,
  });

  const [newFriend, setNewFriend] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const handleAddFriend = async () => {
    if (!newFriend.name.trim()) {
      toast.error('Please enter friend name');
      return;
    }

    const friendId = await db.friends.add({
      ...newFriend,
      createdAt: new Date(),
    });

    setFormData({ ...formData, friendId: friendId as number, contactPerson: newFriend.name });
    setNewFriend({ name: '', email: '', phone: '', notes: '' });
    setShowAddFriend(false);
    toast.success('Friend added successfully');
  };

  const handleFriendSelect = (friendId: number) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend) {
      setFormData({
        ...formData,
        friendId,
        contactPerson: friend.name,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { friendId, ...loanData } = formData;

    await db.loans.add({
      ...loanData,
      friendId,
      outstandingBalance: formData.principalAmount,
      status: 'active',
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      createdAt: new Date(),
    });

    toast.success('Loan added successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <h3 className="text-2xl font-bold">Add Loan</h3>
          <p className="text-blue-100 text-sm mt-1">Track borrowed, lent, or EMI loans</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Loan Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'borrowed', label: 'Borrowed', emoji: '📥' },
                { value: 'lent', label: 'Lent', emoji: '📤' },
                { value: 'emi', label: 'EMI', emoji: '💳' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: option.value as any })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    formData.type === option.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Loan Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g., Car Loan, Personal Loan"
              required
            />
          </div>

          {/* Principal Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Principal Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.principalAmount || ''}
                onChange={(e) => setFormData({ ...formData, principalAmount: parseFloat(e.target.value) || 0 })}
                className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Friend Selection */}
          {(formData.type === 'borrowed' || formData.type === 'lent') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <Users className="w-4 h-4 inline mr-1" />
                  Select Friend
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddFriend(!showAddFriend)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <UserPlus size={14} />
                  Add New
                </button>
              </div>

              {showAddFriend ? (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    value={newFriend.name}
                    onChange={(e) => setNewFriend({ ...newFriend, name: e.target.value })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Friend's name *"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={newFriend.email}
                      onChange={(e) => setNewFriend({ ...newFriend, email: e.target.value })}
                      className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Email"
                    />
                    <input
                      type="tel"
                      value={newFriend.phone}
                      onChange={(e) => setNewFriend({ ...newFriend, phone: e.target.value })}
                      className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddFriend}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Save Friend
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFriend(false)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={formData.friendId || ''}
                  onChange={(e) => handleFriendSelect(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select a friend (optional)</option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.name} {friend.phone && `(${friend.phone})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Contact Person (for EMI or if no friend selected) */}
          {(formData.type === 'emi' || !formData.friendId) && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Person / Institution
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Bank, Person, or Institution"
              />
            </div>
          )}

          {/* Interest & EMI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.interestRate || ''}
                onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">EMI Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.emiAmount || ''}
                onChange={(e) => setFormData({ ...formData, emiAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg shadow-blue-500/30"
            >
              Add Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
