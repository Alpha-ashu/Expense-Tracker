import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import { Users, UserPlus, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export const AddGroup: React.FC = () => {
  const { setCurrentPage, currency, friends } = useApp();
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    participants: [''],
    totalAmount: 0,
    amountPerPerson: 0,
    category: 'general',
    date: new Date().toISOString().split('T')[0],
  });

  const handleAddParticipant = () => {
    setFormData({ ...formData, participants: [...formData.participants, ''] });
  };

  const handleAddFriend = (friendName: string) => {
    // Check if friend is already added
    if (formData.participants.some(p => p.toLowerCase() === friendName.toLowerCase())) {
      toast.error(`${friendName} is already added`);
      return;
    }
    
    // If the first participant slot is empty, fill it; otherwise add new slot
    const emptyIndex = formData.participants.findIndex(p => p.trim() === '');
    if (emptyIndex !== -1) {
      const newParticipants = [...formData.participants];
      newParticipants[emptyIndex] = friendName;
      setFormData({ ...formData, participants: newParticipants });
    } else {
      setFormData({ ...formData, participants: [...formData.participants, friendName] });
    }
    setShowFriendPicker(false);
    toast.success(`${friendName} added to group`);
  };

  const handleRemoveParticipant = (index: number) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validParticipants = formData.participants.filter(p => p.trim());
    if (validParticipants.length < 2) {
      toast.error('Please add at least 2 participants');
      return;
    }

    if (formData.totalAmount <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }

    try {
      await db.groups.add({
        id: Date.now().toString(),
        name: formData.name,
        members: validParticipants,
        createdAt: new Date(),
      });
      toast.success('Group expense created successfully');
      setCurrentPage('groups');
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group expense');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
      <PageHeader
        title="Create Group Expense"
        subtitle="Split expenses with friends and family"
        icon={<Users size={20} className="sm:w-6 sm:h-6" />}
        showBack
        backTo="groups"
      />

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Group Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder="e.g., Weekend Trip"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Total Amount *</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount || ''}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="general">General</option>
              <option value="food">Food & Dining</option>
              <option value="travel">Travel</option>
              <option value="entertainment">Entertainment</option>
              <option value="rent">Rent/Accommodation</option>
              <option value="utilities">Utilities</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
              placeholder="Add details about this group expense"
              rows={3}
            />
          </div>

          {/* Participants */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Participants *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (friends && friends.length > 0) {
                      setShowFriendPicker(!showFriendPicker);
                    } else {
                      setCurrentPage('add-friends');
                    }
                  }}
                  className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded hover:bg-green-100 transition-colors flex items-center gap-1"
                >
                  <UserPlus size={14} />
                  {friends && friends.length > 0 ? 'Add Friend' : 'Add Friends First'}
                </button>
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                >
                  + Add Participant
                </button>
              </div>
            </div>
            
            {/* Friend Picker Dropdown */}
            {showFriendPicker && friends && friends.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-green-800">Select a friend:</span>
                  <button
                    type="button"
                    onClick={() => setShowFriendPicker(false)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {friends.map((friend) => {
                    const isAlreadyAdded = formData.participants.some(
                      p => p.toLowerCase() === friend.name.toLowerCase()
                    );
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => !isAlreadyAdded && handleAddFriend(friend.name)}
                        disabled={isAlreadyAdded}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${
                          isAlreadyAdded 
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                            : 'bg-white text-green-700 hover:bg-green-100 border border-green-300'
                        }`}
                      >
                        {isAlreadyAdded && <Check size={14} />}
                        {friend.name}
                      </button>
                    );
                  })}
                </div>
                {friends.length === 0 && (
                  <p className="text-sm text-green-600">No friends added yet. Add friends from the Loans page.</p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              {formData.participants.map((participant, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={participant}
                    onChange={(e) => {
                      const newParticipants = [...formData.participants];
                      newParticipants[index] = e.target.value;
                      setFormData({ ...formData, participants: newParticipants });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="Enter participant name"
                  />
                  {formData.participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.participants.length > 0 && formData.totalAmount > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-700 font-medium">
                  Amount per person: {currency} {(formData.totalAmount / formData.participants.filter(p => p.trim()).length).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage('groups')}
              className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-semibold shadow-lg"
            >
              Create Group Expense
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
